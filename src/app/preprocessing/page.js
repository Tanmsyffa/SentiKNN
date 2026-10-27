'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiPreprocessBatch } from '@/lib/api';
import { getStoredDataset, getStoredPipeline, savePipeline } from '@/lib/dataService';
import { getPreprocessingResults } from '@/lib/largeDataStore';
import { exportRowsToXlsx } from '@/lib/exportCsv';
import DataTable from '@/components/DataTable';
import {
  FileText,
  Brush,
  Type,
  Sparkles,
  Scissors,
  Ban,
  TreePine,
  ArrowRight,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UploadCloud,
  Table2,
  Eye,
  ChevronLeft,
  Download,
} from 'lucide-react';

export default function PreprocessingPage() {
  const [dataset, setDataset] = useState([]);
  const [pipelineData, setPipelineData] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [selectedDocData, setSelectedDocData] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'detail'

  const loadData = useCallback(async () => {
    const data = getStoredDataset();
    const pipe = getStoredPipeline();
    setDataset(data);
    let activePipeline = pipe;
    if ((pipe?.preprocessing_results || []).length === 0 && data.length > 300) {
      try {
        const largeResults = await getPreprocessingResults();
        if (largeResults.length > 0) {
          activePipeline = { ...pipe, preprocessing_results: largeResults };
        }
      } catch (loadError) {
        setError('Detail preprocessing lokal belum tersedia. Jalankan preprocessing untuk menyimpannya kembali.');
      }
    }
    setPipelineData(activePipeline);

    const batchResults = activePipeline?.preprocessing_results || [];
    if (batchResults.length > 0) {
      if (!selectedDocId || !batchResults.some((p) => p.tweet_id === selectedDocId)) {
        const first = batchResults[0];
        setSelectedDocId(first.tweet_id);
        setSelectedDocData(first);
      } else {
        const found = batchResults.find((p) => p.tweet_id === selectedDocId);
        if (found) setSelectedDocData(found);
      }
    }
  }, [selectedDocId]);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('sentiknn-dataset-updated', handleUpdate);
    window.addEventListener('sentiknn-pipeline-updated', handleUpdate);
    return () => {
      window.removeEventListener('sentiknn-dataset-updated', handleUpdate);
      window.removeEventListener('sentiknn-pipeline-updated', handleUpdate);
    };
  }, [loadData]);

  const handleSelectTweet = (docId) => {
    setSelectedDocId(docId);
    setViewMode('detail');
    const batchResults = pipelineData?.preprocessing_results || [];
    const found = batchResults.find((p) => p.tweet_id === docId);
    if (found) {
      setSelectedDocData(found);
    }
  };

  const handleProcessAll = async () => {
    if (!dataset || dataset.length === 0) return;
    setBatchLoading(true);
    setError(null);
    try {
      const chunkSize = 20;
      const results = [];
      for (let start = 0; start < dataset.length; start += chunkSize) {
        const res = await apiPreprocessBatch(dataset.slice(start, start + chunkSize));
        if (!res.success || !res.results) throw new Error(res.error || 'Gagal memproses batch preprocessing.');
        results.push(...res.results);
      }
      if (results.length > 0) {
        const currentPipe = getStoredPipeline() || {};
        const updatedPipe = {
          ...currentPipe,
          preprocessing_results: results,
        };
        await savePipeline(updatedPipe, false);
        loadData();
        setViewMode('table');
      } else {
        setError('Tidak ada hasil preprocessing yang diterima.');
      }
    } catch (err) {
      setError(err.message || 'Gagal terhubung ke backend Python.');
    } finally {
      setBatchLoading(false);
    }
  };

  // Build columns for batch table
  const batchColumns = [
    { key: 'tweet_id', label: 'ID', width: '80px' },
    {
      key: 'step_1_asli',
      label: 'Data Asli',
      render: (val) => (
        <span className="text-xs text-slate-700 line-clamp-2">
          {val ? (val.length > 90 ? val.substring(0, 90) + '...' : val) : '-'}
        </span>
      ),
    },
    {
      key: 'step_2_cleaning',
      label: 'Cleaning',
      render: (val) => (
        <span className="text-xs text-slate-600 line-clamp-2">
          {val ? (val.length > 70 ? val.substring(0, 70) + '...' : val) : '-'}
        </span>
      ),
    },
    {
      key: 'step_7_stemming',
      label: 'Hasil Stemming (Kata Dasar)',
      render: (val) => (
        <span className="text-xs text-emerald-700 font-mono line-clamp-2">
          {Array.isArray(val)
            ? val.join(', ').length > 80
              ? val.join(', ').substring(0, 80) + '...'
              : val.join(', ')
            : '-'}
        </span>
      ),
    },
    {
      key: 'stemmed_text',
      label: 'Teks Final',
      render: (val) => (
        <span className="text-xs text-slate-700 font-medium line-clamp-2">
          {val ? (val.length > 70 ? val.substring(0, 70) + '...' : val) : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Tahapan',
      width: '90px',
      render: (_, row) => (
        <button
          onClick={() => handleSelectTweet(row.tweet_id)}
          className="px-2.5 py-1 bg-blue-50 text-accent-blue hover:bg-blue-100 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          Detail
        </button>
      ),
    },
  ];

  const batchData = pipelineData?.preprocessing_results || [];
  const exportPreprocessing = () => {
    const columns = [
      { key: 'tweet_id', label: 'ID', width: 24 },
      { key: 'label', label: 'Label Sentimen', width: 18 },
      { key: 'step_1_asli', label: 'Data Asli', width: 58 },
      { key: 'step_2_cleaning', label: 'Cleaning', width: 52 },
      { key: 'step_3_casefolding', label: 'Case Folding', width: 52 },
      { key: 'step_4_normalisasi', label: 'Normalisasi', width: 52 },
      { key: 'step_5_tokenizing', label: 'Tokenisasi', width: 52 },
      { key: 'step_6_stopword', label: 'Stopword Removal', width: 52 },
      { key: 'step_7_stemming', label: 'Stemming', width: 52 },
      { key: 'stemmed_text', label: 'Teks Final', width: 52 },
    ];
    exportRowsToXlsx('sentiknn-hasil-preprocessing.xlsx', columns, batchData, 'Hasil Preprocessing');
  };

  const stepsData = [
    {
      step: 1,
      title: 'Data Asli',
      desc: 'Teks mentah tweet langsung dari dataset tanpa modifikasi',
      result: selectedDocData ? selectedDocData.step_1_asli : '-',
      color: 'from-blue-500 to-blue-600',
      bgLight: 'bg-blue-50',
      icon: FileText,
    },
    {
      step: 2,
      title: 'Data Cleaning',
      desc: 'Pembersihan URL, @username, #hashtag, tanda baca, dan karakter non-alfabetik',
      result: selectedDocData ? selectedDocData.step_2_cleaning : '-',
      color: 'from-amber-500 to-orange-500',
      bgLight: 'bg-amber-50',
      icon: Brush,
    },
    {
      step: 3,
      title: 'Case Folding',
      desc: 'Mengubah seluruh karakter huruf menjadi huruf kecil (lowercase)',
      result: selectedDocData ? selectedDocData.step_3_casefolding : '-',
      color: 'from-green-500 to-emerald-500',
      bgLight: 'bg-green-50',
      icon: Type,
    },
    {
      step: 4,
      title: 'Normalisasi Kata',
      desc: 'Konversi kata singkatan & bahasa slang media sosial ke kata baku bahasa Indonesia',
      result: selectedDocData ? selectedDocData.step_4_normalisasi : '-',
      color: 'from-purple-500 to-violet-500',
      bgLight: 'bg-purple-50',
      icon: Sparkles,
    },
    {
      step: 5,
      title: 'Tokenizing',
      desc: 'Pemecahan rangkaian kalimat menjadi kumpulan token kata individu',
      result: selectedDocData
        ? Array.isArray(selectedDocData.step_5_tokenizing)
          ? selectedDocData.step_5_tokenizing.join(' | ')
          : JSON.stringify(selectedDocData.step_5_tokenizing)
        : '-',
      color: 'from-cyan-500 to-blue-500',
      bgLight: 'bg-cyan-50',
      icon: Scissors,
    },
    {
      step: 6,
      title: 'Stopword Removal',
      desc: 'Penyaringan kata-kata umum tidak bermakna (NLTK Indonesian stopwords + kamus khusus)',
      result: selectedDocData
        ? Array.isArray(selectedDocData.step_6_stopword)
          ? selectedDocData.step_6_stopword.join(' | ')
          : JSON.stringify(selectedDocData.step_6_stopword)
        : '-',
      color: 'from-indigo-500 to-blue-600',
      bgLight: 'bg-indigo-50',
      icon: Ban,
    },
    {
      step: 7,
      title: 'Stemming (Sastrawi)',
      desc: 'Transformasi setiap kata berimbuhan ke bentuk kata dasar menggunakan algoritma Sastrawi',
      result: selectedDocData
        ? Array.isArray(selectedDocData.step_7_stemming)
          ? selectedDocData.step_7_stemming.join(' | ')
          : JSON.stringify(selectedDocData.step_7_stemming)
        : '-',
      color: 'from-emerald-500 to-green-600',
      bgLight: 'bg-emerald-50',
      icon: TreePine,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Preprocessing Korpus Data</h1>
        <p className="page-subtitle">
          Pemrosesan teks 7 tahap secara batch pada seluruh korpus dokumen menggunakan pustaka Sastrawi & NLTK di Python
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Info Badge if data already precomputed from pipeline */}
      {batchData.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span>
              <strong>{batchData.length} Dokumen Korpus</strong> telah berhasil diproses secara batch dan tersimpan di database.
            </span>
          </div>
          <span className="font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded self-start sm:self-auto">
            Batch Corpus Ready
          </span>
        </div>
      )}

      {/* Banner if raw dataset exists but batch preprocessing not yet run */}
      {batchData.length === 0 && dataset.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs animate-slide-up">
          <div>
            <p className="font-bold text-blue-900 text-sm mb-1">
              Ditemukan {dataset.length} baris korpus data mentah
            </p>
            <p className="text-blue-700">
              Jalankan pemrosesan teks 7-tahap pada seluruh dataset secara otomatis dengan multi-threading Python.
            </p>
          </div>
          <button
            onClick={handleProcessAll}
            disabled={batchLoading}
            className="px-5 py-2.5 bg-accent-blue text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors flex items-center gap-2 flex-shrink-0 disabled:opacity-50 shadow-sm"
          >
            {batchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{batchLoading ? 'Memproses Seluruh Dataset...' : `Jalankan Preprocessing (${dataset.length} Dokumen)`}</span>
          </button>
        </div>
      )}

      {/* View Mode Toggle & Batch Re-run */}
      {batchData.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-accent-blue text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              Tabel Semua Data ({batchData.length})
            </button>
            <button
              onClick={() => setViewMode('detail')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'detail'
                  ? 'bg-accent-blue text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Detail 7 Tahap Per Dokumen
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportPreprocessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              Export Hasil Preprocessing (.xlsx)
            </button>
            <button
              onClick={handleProcessAll}
              disabled={batchLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200 disabled:opacity-50"
              title="Jalankan ulang batch preprocessing untuk semua dokumen"
            >
              {batchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-blue" /> : <RotateCcw className="w-3.5 h-3.5 text-slate-500" />}
              <span>{batchLoading ? 'Memproses korpus...' : 'Proses Ulang Seluruh Korpus'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== TABLE VIEW: Show all batch preprocessing results ===== */}
      {viewMode === 'table' && batchData.length > 0 && (
        <DataTable
          columns={batchColumns}
          data={batchData}
          searchPlaceholder="Cari ID, kata dasar, atau isi tweet..."
          pageSize={10}
        />
      )}

      {/* ===== DETAIL VIEW: Show 7-step detail for selected corpus document ===== */}
      {viewMode === 'detail' && batchData.length > 0 && (
        <div className="space-y-4 animate-slide-up">
          {/* Document Inspector Header */}
          <div className="bg-white rounded-xl p-5 shadow-card border border-slate-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewMode('table')}
                  className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors"
                  title="Kembali ke tabel semua data"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent-blue">
                    Inspeksi Dokumen Korpus
                  </span>
                  <h3 className="text-sm font-bold text-slate-800">
                    Dokumen ID: {selectedDocData?.tweet_id || selectedDocId}
                  </h3>
                </div>
              </div>

              {/* Selector for other documents in corpus */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-400 whitespace-nowrap">Pilih Dokumen:</span>
                <select
                  value={selectedDocId}
                  onChange={(e) => handleSelectTweet(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium w-full sm:max-w-xs truncate focus:outline-none focus:ring-1 focus:ring-accent-blue"
                >
                  {batchData.map((row) => (
                    <option key={row.tweet_id} value={row.tweet_id}>
                      {row.tweet_id}: {row.step_1_asli?.slice(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Teks Dokumen Asli:</span>
              <p className="text-xs text-slate-700 font-medium mt-1 leading-relaxed">
                &ldquo;{selectedDocData?.step_1_asli}&rdquo;
              </p>
            </div>
          </div>

          {/* Preprocessing Steps Cards */}
          <div className="space-y-3">
            {stepsData.map((step, idx) => {
              const StepIcon = step.icon;
              return (
                <div
                  key={step.step}
                  className="step-card flex flex-col md:flex-row md:items-center gap-4 p-4 bg-white rounded-xl shadow-card border border-slate-100 animate-slide-up"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-md flex-shrink-0 text-white`}
                    >
                      <span className="font-bold text-sm">{step.step}</span>
                    </div>

                    <div className="w-52 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <StepIcon className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-sm font-bold text-slate-800">{step.title}</p>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{step.desc}</p>
                    </div>
                  </div>

                  <div className={`flex-1 px-4 py-3 ${step.bgLight} rounded-lg overflow-hidden border border-slate-100`}>
                    <p className="text-xs text-slate-700 font-mono break-all leading-relaxed">{step.result}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dataset.length === 0 && (
        <div className="bg-white rounded-xl p-12 text-center shadow-card border border-slate-100">
          <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Belum ada dataset yang diunggah</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Unggah file data mentah Anda sekali di halaman Dataset untuk otomatis memproses seluruh korpus dokumen.
          </p>
          <Link
            href="/dataset"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-blue text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors shadow-sm"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Buka Halaman Dataset</span>
          </Link>
        </div>
      )}
    </div>
  );
}
