'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getStoredDataset, getStoredPipeline, savePipeline } from '@/lib/dataService';
import { apiSplit } from '@/lib/api';
import EvaluationModeSelect from '@/components/EvaluationModeSelect';
import { UploadCloud, Layers, Database, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SplitPage() {
  const [dataset, setDataset] = useState([]);
  const [splitResult, setSplitResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [evaluationMode, setEvaluationMode] = useState('manual');

  const loadData = useCallback(async () => {
    const data = getStoredDataset();
    const pipe = getStoredPipeline();
    setDataset(data);

    // If precomputed split exists from automated upload, use it directly!
    if (pipe && pipe.split && pipe.split.train_count > 0 && (pipe.split.evaluation_mode || 'manual') === evaluationMode) {
      setSplitResult(pipe.split);
      return;
    }

    // Otherwise calculate via API if labeled data >= 5
    const labeled = data.filter((d) => d.label && (evaluationMode === 'exploratory' || (d.label_source !== 'lexicon' && !d.auto_labeled)));
    if (labeled.length >= 5) {
      setLoading(true);
      setError(null);
      try {
        const res = await apiSplit(data, 0.8, evaluationMode);
        if (res.success) {
          setSplitResult(res);
          const currentPipeline = getStoredPipeline() || {};
          await savePipeline({
            ...currentPipeline,
            split: {
              ...res,
              split_records: [
                ...(res.train || []).map((item) => ({ tweet_id: item.id, split_type: 'train' })),
                ...(res.test || []).map((item) => ({ tweet_id: item.id, split_type: 'test' })),
              ],
            },
          }, false);
        } else {
          setError(res.error || 'Gagal membagi data.');
        }
      } catch (err) {
        setError(err.message || 'Gagal terhubung ke backend Python.');
      } finally {
        setLoading(false);
      }
    } else {
      setSplitResult(null);
    }
  }, [evaluationMode]);

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

  const hasData = splitResult && splitResult.train_count > 0;
  const labeledCount = dataset.filter((d) => d.label && (evaluationMode === 'exploratory' || (d.label_source !== 'lexicon' && !d.auto_labeled))).length;
  const lexiconLabelCount = dataset.filter((d) => d.label && (d.label_source === 'lexicon' || d.auto_labeled)).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Split Data 80:20</h1>
        <p className="page-subtitle">
          Pemisahan data latih (80%) dan data uji (20%) secara stratified menggunakan scikit-learn di Python
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
        <span className="font-semibold text-slate-700">Mode sumber label</span>
        <EvaluationModeSelect value={evaluationMode} onChange={setEvaluationMode} />
        <span className={`min-w-0 break-words ${evaluationMode === 'manual' ? 'text-emerald-700' : 'text-amber-700'}`}>
          {evaluationMode === 'manual' ? 'Hanya label pakar digunakan sebagai ground truth.' : 'Menggunakan seluruh data berlabel. Pseudo-label leksikon bukan ground truth pakar.'}
        </span>
      </div>

      {hasData && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-green-800">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span>
              Pembagian data manual 80:20 telah otomatis diproses saat upload dan tersimpan pada sesi browser ini.
            </span>
          </div>
          <span className="font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
            Stratified Split Siap
          </span>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl p-8 text-center shadow-card border border-slate-100">
          <Loader2 className="w-8 h-8 animate-spin text-accent-blue mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Menjalankan stratified train_test_split via Python...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 sm:p-8 shadow-card border border-slate-100 animate-slide-up flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-500 mb-2">Data Latih (80%)</p>
            <p className="text-5xl font-bold text-accent-blue mb-2">
              {hasData ? splitResult.train_count.toLocaleString('id-ID') : 0}
            </p>
            <p className="text-xs text-slate-400">Digunakan sebagai acuan klasifikasi KNN</p>

            {hasData && splitResult.train_distribution && (
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                  Positif: {splitResult.train_distribution.Positif || 0}
                </span>
                <span className="text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                  Negatif: {splitResult.train_distribution.Negatif || 0}
                </span>
                <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  Netral: {splitResult.train_distribution.Netral || 0}
                </span>
              </div>
            )}
          </div>
          <div className="ml-3 w-12 h-12 shrink-0 bg-blue-50 text-accent-blue rounded-xl flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 sm:p-8 shadow-card border border-slate-100 animate-slide-up flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-500 mb-2">Data Uji (20%)</p>
            <p className="text-5xl font-bold text-accent-purple mb-2">
              {hasData ? splitResult.test_count.toLocaleString('id-ID') : 0}
            </p>
            <p className="text-xs text-slate-400">Digunakan untuk menguji akurasi model</p>

            {hasData && splitResult.test_distribution && (
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                  Positif: {splitResult.test_distribution.Positif || 0}
                </span>
                <span className="text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                  Negatif: {splitResult.test_distribution.Negatif || 0}
                </span>
                <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  Netral: {splitResult.test_distribution.Netral || 0}
                </span>
              </div>
            )}
          </div>
          <div className="ml-3 w-12 h-12 shrink-0 bg-purple-50 text-accent-purple rounded-xl flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Visual Split Bar */}
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-card border border-slate-100 animate-slide-up">
        <div className="flex rounded-xl overflow-hidden h-12 shadow-inner">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 flex min-w-0 items-center justify-center text-center text-white font-bold text-xs sm:text-sm transition-all duration-500"
            style={{ width: '80%' }}
          >
            <span className="truncate">80% DATA LATIH <span className="hidden sm:inline">{hasData && `(${splitResult.train_count})`}</span></span>
          </div>
          <div
            className="bg-gradient-to-r from-purple-400 to-purple-600 flex min-w-0 items-center justify-center text-center text-white font-bold text-[10px] leading-tight sm:text-sm transition-all duration-500"
            style={{ width: '20%' }}
          >
            <span>20%<span className="hidden sm:inline"> DATA UJI {hasData && `(${splitResult.test_count})`}</span></span>
          </div>
        </div>
      </div>

      {/* Stratified Settings Card */}
      <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100 animate-slide-up">
        <h3 className="text-base font-semibold text-slate-800 mb-5">Detail Pembagian Stratified Split</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100">
            <span className="text-slate-500">Pustaka Pemisah</span>
            <span className="font-mono text-slate-800 font-semibold">sklearn.model_selection.train_test_split</span>
          </div>
          <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100">
            <span className="text-slate-500">Metode Stratifikasi</span>
            <span className="text-slate-800 font-semibold">Stratify by Target Sentiment Label</span>
          </div>
          <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100">
            <span className="text-slate-500">Random State</span>
            <span className="font-mono text-slate-800 font-semibold">42 (Reproducible)</span>
          </div>
          <div className="flex items-center justify-between text-sm py-2">
            <span className="text-slate-500">Total Data Berlabel</span>
            <span className="text-accent-blue font-bold">{labeledCount} data</span>
          </div>
        </div>
      </div>

      {!hasData && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-sm font-semibold text-blue-800 mb-1">
            {lexiconLabelCount > 0 ? 'Label manual belum mencukupi untuk split data' : 'Data berlabel belum mencukupi untuk split data'}
          </p>
          <p className="text-xs text-blue-600 mb-4 max-w-md mx-auto">
            {lexiconLabelCount > 0
              ? `${lexiconLabelCount} label leksikon tersedia, tetapi evaluasi ilmiah memerlukan label manual. Tetapkan minimal dua dokumen manual pada setiap kelas sentimen.`
              : 'Tetapkan minimal dua dokumen manual pada setiap kelas sentimen agar train-test split stratified dapat dijalankan.'}
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/dataset"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-blue text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Dataset</span>
            </Link>
            <Link
              href="/pelabelan"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <span>Tinjau Label Manual</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
