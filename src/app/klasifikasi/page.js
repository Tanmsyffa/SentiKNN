'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Badge from '@/components/Badge';
import DataTable from '@/components/DataTable';
import EvaluationModeSelect from '@/components/EvaluationModeSelect';
import { getDatasetForAnalysis, getStoredDataset, getStoredPipeline, savePipeline } from '@/lib/dataService';
import { apiKNN } from '@/lib/api';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  UploadCloud,
  Tag,
  Layers,
  Award,
  Eye,
  ChevronLeft,
  RotateCcw,
  Check,
  X,
  Target,
} from 'lucide-react';

export default function KlasifikasiPage() {
  const [dataset, setDataset] = useState([]);
  const [analysisDataset, setAnalysisDataset] = useState([]);
  const [pipelineData, setPipelineData] = useState(null);
  const [kValue, setKValue] = useState(5);
  const [classificationResults, setClassificationResults] = useState([]);
  const [stats, setStats] = useState({
    trainSize: 0,
    testSize: 0,
    correctCount: 0,
    incorrectCount: 0,
    accuracy: 0,
  });
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [evaluationMode, setEvaluationMode] = useState('manual');
  const activeRunRef = useRef(null);

  const runBatchClassification = useCallback(async (data, k, mode = evaluationMode) => {
    const labeled = data.filter((d) => d.label && (mode === 'exploratory' || (d.label_source !== 'lexicon' && !d.auto_labeled)));
    if (labeled.length < 5) return;
    const runKey = `${mode}:${k}:${labeled.length}:${labeled.map((item) => `${item.id}:${item.label}`).join('|')}`;
    if (activeRunRef.current === runKey) return;
    activeRunRef.current = runKey;

    setLoading(true);
    setError(null);
    try {
      const res = await apiKNN(data, k, 0.8, mode);
      if (res.success && res.results_records) {
        setClassificationResults(res.results_records);
        setSelectedDoc(res.results_records[0]);
        setStats({
          trainSize: res.train_size,
          testSize: res.test_size,
          correctCount: res.correct_count,
          incorrectCount: res.incorrect_count,
          accuracy: res.accuracy,
        });

        const currentPipe = getStoredPipeline() || {};
        const updatedPipe = {
          ...currentPipe,
          knn: {
            k: res.k,
            evaluation_mode: mode,
            results_records: res.results_records,
          },
        };
        await savePipeline(updatedPipe, false);
      } else {
        setError(res.error || 'Gagal menjalankan klasifikasi KNN batch.');
      }
    } catch (err) {
      setError(err.message || 'Gagal terhubung ke backend Python.');
    } finally {
      activeRunRef.current = null;
      setLoading(false);
    }
  }, [evaluationMode]);

  const loadData = useCallback(async (activeK) => {
    const rawData = getStoredDataset();
    const data = await getDatasetForAnalysis();
    const pipe = getStoredPipeline();
    setDataset(rawData);
    setAnalysisDataset(data);
    setPipelineData(pipe);

    const cachedMode = pipe?.knn?.evaluation_mode || 'manual';
    if (pipe?.knn?.results_records?.length > 0 && cachedMode === evaluationMode && Number(pipe.knn.k) === Number(activeK)) {
      const records = pipe.knn.results_records;
      setClassificationResults(records);
      setSelectedDoc(records[0]);
      const correct = records.filter((r) => r.is_correct).length;
      setStats({
        trainSize: pipe.split?.train_count || Math.round(data.length * 0.8),
        testSize: records.length,
        correctCount: correct,
        incorrectCount: records.length - correct,
        accuracy: records.length > 0 ? Math.round((correct / records.length) * 1000) / 10 : 0,
      });
    } else {
      const labeled = data.filter((d) => d.label && (evaluationMode === 'exploratory' || (d.label_source !== 'lexicon' && !d.auto_labeled)));
      if (labeled.length >= 5) {
        runBatchClassification(data, activeK);
      }
    }
  }, [evaluationMode, runBatchClassification]);

  useEffect(() => {
    loadData(5);
    const handleUpdate = () => loadData(5);
    window.addEventListener('sentiknn-dataset-updated', handleUpdate);
    return () => {
      window.removeEventListener('sentiknn-dataset-updated', handleUpdate);
    };
  }, [loadData]);

  const handleKChange = (newK) => {
    setKValue(newK);
    setClassificationResults([]);
    loadData(newK);
  };

  const labeledCount = dataset.filter((d) => d.label && (evaluationMode === 'exploratory' || (d.label_source !== 'lexicon' && !d.auto_labeled))).length;
  const lexiconLabelCount = dataset.filter((d) => d.label && (d.label_source === 'lexicon' || d.auto_labeled)).length;
  const hasData = classificationResults.length > 0;

  const columns = [
    { key: 'tweet_id', label: 'ID Uji', width: '90px' },
    {
      key: 'teks',
      label: 'Teks Dokumen Data Uji',
      render: (val) => (
        <span className="text-xs text-slate-700 line-clamp-2">
          {val ? (val.length > 100 ? val.substring(0, 100) + '...' : val) : '-'}
        </span>
      ),
    },
    {
      key: 'actual_label',
      label: 'Label Aktual',
      width: '120px',
      render: (val) => <Badge variant={val?.toLowerCase()}>{val}</Badge>,
    },
    {
      key: 'predicted_label',
      label: 'Prediksi KNN',
      width: '120px',
      render: (val) => <Badge variant={val?.toLowerCase()}>{val}</Badge>,
    },
    {
      key: 'is_correct',
      label: 'Hasil',
      width: '110px',
      render: (val) => (
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
            val ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {val ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
          <span>{val ? 'Sesuai' : 'Beda'}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Detail Tetangga',
      width: '110px',
      render: (_, row) => (
        <button
          onClick={() => setSelectedDoc(row)}
          className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
            selectedDoc?.tweet_id === row.tweet_id
              ? 'bg-accent-blue text-white shadow-sm'
              : 'bg-blue-50 text-accent-blue hover:bg-blue-100'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Tetangga</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Klasifikasi KNN Korpus Data Uji</h1>
        <p className="page-subtitle">
          Klasifikasi seluruh korpus data uji (20%) berdasarkan data latih (80%) menggunakan K-Nearest Neighbors & Jarak Euclidean di Python
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
        <span className="font-semibold text-slate-700">Mode sumber label</span>
        <EvaluationModeSelect value={evaluationMode} onChange={(value) => { setEvaluationMode(value); setClassificationResults([]); }} />
        <span className={`min-w-0 break-words ${evaluationMode === 'manual' ? 'text-emerald-700' : 'text-amber-700'}`}>
          {evaluationMode === 'manual' ? 'Label aktual berasal dari pakar.' : 'Hasil membandingkan prediksi dengan pseudo-label, bukan ground truth pakar.'}
        </span>
      </div>

      {hasData && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span>
              Klasifikasi KNN berhasil dijalankan pada seluruh <strong>{stats.testSize} data uji</strong> (Parameter K = {kValue}).
            </span>
          </div>
          <span className="font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded self-start sm:self-auto">
            Akurasi Uji: {stats.accuracy}%
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Model Parameter & Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Parameter K Card */}
        <div className="bg-white rounded-xl p-5 shadow-card border border-slate-100 animate-slide-up flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Parameter K</p>
            <div className="flex gap-1">
              {[1, 3, 5, 7, 9].map((k) => (
                <button
                  key={k}
                  onClick={() => handleKChange(k)}
                  disabled={loading}
                  className={`text-xs px-2 py-0.5 rounded font-semibold transition-colors ${
                    kValue === k
                      ? 'bg-accent-blue text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <p className="text-3xl font-bold text-accent-blue mb-1">K = {kValue}</p>
          <p className="text-[11px] text-slate-400">Pilih nilai K untuk menguji ulang seluruh data uji</p>
        </div>

        {/* Train & Test Size */}
        <div className="bg-white rounded-xl p-5 shadow-card border border-slate-100 animate-slide-up">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Partisi Korpus (80:20)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800">{stats.testSize}</span>
            <span className="text-xs font-semibold text-slate-400">Data Uji (20%)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Dibandingkan terhadap <strong className="text-slate-600">{stats.trainSize} data latih</strong>
          </p>
        </div>

        {/* Prediction Accuracy */}
        <div className="bg-white rounded-xl p-5 shadow-card border border-slate-100 animate-slide-up">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Akurasi Prediksi Data Uji</p>
          <p className="text-3xl font-bold text-emerald-600 mb-1">{stats.accuracy}%</p>
          <p className="text-[11px] text-slate-400">
            {stats.correctCount} dari {stats.testSize} prediksi tepat
          </p>
        </div>

        {/* Method */}
        <div className="bg-white rounded-xl p-5 shadow-card border border-slate-100 animate-slide-up">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fungsi Jarak & Voting</p>
          <p className="text-xl font-bold text-slate-800">Euclidean Distance</p>
          <p className="text-[11px] text-slate-400 mt-1">Majority Voting dari {kValue} tetangga terdekat</p>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl p-8 text-center shadow-card border border-slate-100">
          <Loader2 className="w-7 h-7 animate-spin text-accent-blue mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Menghitung jarak Euclidean & voting KNN untuk seluruh data uji...</p>
        </div>
      )}

      {/* Main Table: All Test Documents Classification Results */}
      {hasData && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Tabel Hasil Klasifikasi Seluruh Data Uji ({classificationResults.length} Dokumen)
            </h2>
            <button
              onClick={() => runBatchClassification(analysisDataset, kValue)}
              disabled={loading}
              className="text-xs font-semibold text-accent-blue hover:text-blue-700 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Hitung Ulang</span>
            </button>
          </div>

          <DataTable
            columns={columns}
            data={classificationResults}
            searchPlaceholder="Cari ID data uji atau kata kunci..."
            pageSize={10}
          />
        </div>
      )}

      {/* Selected Document Nearest Neighbors Inspector */}
      {selectedDoc && !loading && (
        <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100 animate-slide-up space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent-blue">
                  Inspeksi Perhitungan KNN Dokumen Uji: {selectedDoc.tweet_id}
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    selectedDoc.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {selectedDoc.is_correct ? 'Prediksi Benar' : 'Prediksi Beda'}
                </span>
              </div>
              <p className="text-xs text-slate-700 font-medium leading-relaxed max-w-3xl">
                &ldquo;{selectedDoc.teks}&rdquo;
              </p>
            </div>

            {/* Voting Distribution Chips */}
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-center text-xs">
                <span className="font-semibold text-green-700">Positif: </span>
                <strong className="text-green-800">{selectedDoc.votes?.Positif || 0}</strong>
              </div>
              <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-center text-xs">
                <span className="font-semibold text-red-700">Negatif: </span>
                <strong className="text-red-800">{selectedDoc.votes?.Negatif || 0}</strong>
              </div>
              <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-center text-xs">
                <span className="font-semibold text-slate-700">Netral: </span>
                <strong className="text-slate-800">{selectedDoc.votes?.Netral || 0}</strong>
              </div>
            </div>
          </div>

          {/* Table of K Nearest Neighbors for Selected Document */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
              {kValue} Tetangga Terdekat dari Data Latih (Jarak Euclidean Terkecil)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-center" style={{ width: '80px' }}>Peringkat</th>
                    <th style={{ width: '100px' }}>ID Latih</th>
                    <th>Teks Dokumen Data Latih</th>
                    <th style={{ width: '140px' }}>Jarak Euclidean ($d$)</th>
                    <th style={{ width: '120px' }}>Label Latih</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDoc.neighbors?.map((n) => (
                    <tr key={n.peringkat} className="hover:bg-slate-50/50 transition-colors">
                      <td className="text-center font-bold text-slate-500 font-mono">#{n.peringkat}</td>
                      <td className="font-semibold text-slate-700 font-mono text-xs">{n.id}</td>
                      <td className="text-slate-600 text-xs">{n.teks}</td>
                      <td className="font-mono text-xs text-slate-800 font-semibold">{n.jarak}</td>
                      <td>
                        <Badge variant={n.label?.toLowerCase()}>{n.label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!hasData && !loading && (
        <div className="bg-white rounded-xl p-12 text-center shadow-card border border-slate-100">
          <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">
            {lexiconLabelCount > 0 ? 'Label manual belum tersedia untuk klasifikasi KNN' : 'Belum ada data korpus berlabel untuk klasifikasi KNN'}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            {lexiconLabelCount > 0
              ? `${lexiconLabelCount} label leksikon tersedia sebagai bantuan. Tinjau label secara manual agar KNN mempunyai ground truth yang sah.`
              : 'Algoritma K-Nearest Neighbor memerlukan label manual untuk membagi korpus menjadi data latih dan data uji.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dataset"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-blue text-white hover:bg-blue-600 text-xs font-semibold rounded-lg shadow-md shadow-blue-500/20 transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Dataset Korpus</span>
            </Link>
            <Link
              href="/pelabelan"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold rounded-lg transition-all"
            >
              <Tag className="w-4 h-4" />
              <span>Tinjau Label Manual</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
