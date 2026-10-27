'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import EvaluationModeSelect from '@/components/EvaluationModeSelect';
import { getDatasetForAnalysis, getStoredDataset, getStoredPipeline, savePipeline } from '@/lib/dataService';
import { apiEvaluate } from '@/lib/api';
import {
  Award,
  Target,
  RefreshCw,
  Zap,
  UploadCloud,
  Tag,
  Loader2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

export default function EvaluasiPage() {
  const [dataset, setDataset] = useState([]);
  const [kValue, setKValue] = useState(5);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [evaluationMode, setEvaluationMode] = useState('manual');
  const lastAutomaticRequestRef = useRef('');

  const runEvaluation = useCallback(async (data, k, mode = evaluationMode) => {
    const labeled = data.filter((d) => d.label && (mode === 'exploratory' || (d.label_source !== 'lexicon' && !d.auto_labeled)));
    if (labeled.length < 5) {
      setMetrics(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiEvaluate(data, k, 0.8, mode);
      if (res.success) {
        setMetrics(res);
        const currentPipeline = getStoredPipeline() || {};
        const labeled = data.filter((item) => item.label && (mode === 'exploratory' || (item.label_source !== 'lexicon' && !item.auto_labeled)));
        await savePipeline({
          ...currentPipeline,
          split: {
            ...(currentPipeline.split || {}),
            train_count: res.train_size,
            test_count: res.test_size,
            evaluation_mode: res.evaluation_mode,
            split_records: [
              ...(res.train_indices || []).map((index) => ({ tweet_id: labeled[index]?.id, split_type: 'train' })).filter((item) => item.tweet_id),
              ...(res.test_indices || []).map((index) => ({ tweet_id: labeled[index]?.id, split_type: 'test' })).filter((item) => item.tweet_id),
            ],
          },
          knn: {
            k: res.k,
            evaluation_mode: res.evaluation_mode,
            ground_truth: res.ground_truth,
            results_records: res.results_records || [],
          },
          evaluation: { ...res, status: 'evaluated' },
        }, false);
      } else {
        setError(res.error || 'Gagal menghitung metrik evaluasi.');
      }
    } catch (err) {
      setError(err.message || 'Gagal terhubung ke backend Python.');
    } finally {
      setLoading(false);
    }
  }, [evaluationMode]);

  const loadData = useCallback(async (newK) => {
    const rawData = getStoredDataset();
    const data = await getDatasetForAnalysis();
    const pipe = getStoredPipeline();
    setDataset(rawData);

    // If pipeline already evaluated with this K, display instantly!
    if (pipe && pipe.evaluation && pipe.evaluation.k === newK && pipe.evaluation.accuracy !== undefined && (pipe.evaluation.evaluation_mode || 'manual') === evaluationMode) {
      setMetrics(pipe.evaluation);
      return;
    }

    const labeled = data.filter((d) => d.label && (evaluationMode === 'exploratory' || (d.label_source !== 'lexicon' && !d.auto_labeled)));
    if (labeled.length >= 5) {
      const requestKey = `${evaluationMode}:${newK}:${labeled.map((item) => `${item.id}:${item.label}:${item.label_source}:${item.auto_labeled}`).join('|')}`;
      if (lastAutomaticRequestRef.current === requestKey) return;
      lastAutomaticRequestRef.current = requestKey;
      runEvaluation(data, newK);
    } else {
      setMetrics(null);
    }
  }, [evaluationMode, runEvaluation]);

  useEffect(() => {
    loadData(kValue);

    const handleUpdate = () => {
      loadData(kValue);
    };
    window.addEventListener('sentiknn-dataset-updated', handleUpdate);
    window.addEventListener('sentiknn-pipeline-updated', handleUpdate);
    return () => {
      window.removeEventListener('sentiknn-dataset-updated', handleUpdate);
      window.removeEventListener('sentiknn-pipeline-updated', handleUpdate);
    };
  }, [kValue, loadData]);

  const handleKChange = (newK) => {
    setKValue(newK);
    setMetrics(null);
  };

  const labeledCount = dataset.filter((d) => d.label && (evaluationMode === 'exploratory' || (d.label_source !== 'lexicon' && !d.auto_labeled))).length;
  const lexiconLabelCount = dataset.filter((d) => d.label && (d.label_source === 'lexicon' || d.auto_labeled)).length;
  const hasData = metrics && metrics.train_size > 0;

  const metricCards = [
    {
      label: 'Accuracy',
      value: hasData ? `${metrics.accuracy}%` : '-',
      desc: 'Proporsi prediksi benar terhadap total data uji',
      color: 'from-teal-400 to-teal-500',
      icon: Award,
    },
    {
      label: 'Precision (Macro)',
      value: hasData ? `${metrics.precision}%` : '-',
      desc: 'Ketepatan prediksi per kelas sentimen',
      color: 'from-indigo-400 to-indigo-500',
      icon: Target,
    },
    {
      label: 'Recall (Macro)',
      value: hasData ? `${metrics.recall}%` : '-',
      desc: 'Sensitivitas model dalam mengenali kelas',
      color: 'from-amber-400 to-amber-500',
      icon: RefreshCw,
    },
    {
      label: 'F1-Score (Macro)',
      value: hasData ? `${metrics.f1_score}%` : '-',
      desc: 'Rata-rata harmonis antara precision dan recall',
      color: 'from-blue-400 to-blue-500',
      icon: Zap,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Evaluasi Model</h1>
          <p className="page-subtitle">
            Pengukuran kinerja klasifikasi KNN (80% Train, 20% Test) menggunakan scikit-learn di Python
          </p>
        </div>

        {labeledCount >= 5 && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
            <span className="text-xs font-semibold text-slate-500">Nilai K:</span>
            <div className="flex gap-1">
              {[1, 3, 5, 7, 9].map((k) => (
                <button
                  key={k}
                  onClick={() => handleKChange(k)}
                  className={`text-xs px-2.5 py-1 rounded font-semibold transition-colors ${
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
        )}
      </div>

      <div className={`border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3 text-xs ${evaluationMode === 'manual' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
        <span className="font-semibold">Mode sumber label</span>
        <EvaluationModeSelect value={evaluationMode} onChange={(value) => { setEvaluationMode(value); setMetrics(null); }} />
        <span className="min-w-0 break-words">{evaluationMode === 'manual' ? 'Metrik memakai label pakar sebagai ground truth.' : 'Metrik membandingkan prediksi dengan pseudo-label leksikon dan tidak boleh diklaim sebagai akurasi ground truth pakar.'}</span>
      </div>

      {hasData && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between text-xs text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span>
              {evaluationMode === 'manual'
                ? 'Metrik evaluasi dihitung pada subset data uji berlabel pakar (20%) dan tersimpan pada sesi browser ini.'
                : 'Mode eksplorasi aktif: metrik dihitung terhadap pseudo-label dan bukan ground truth pakar.'}
            </span>
          </div>
          <span className="font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
            Evaluasi Selesai
          </span>
        </div>
      )}

      {hasData && metrics.class_metrics?.Netral?.support > 0 && metrics.class_metrics.Netral.f1_score === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          Kelas Netral memiliki {metrics.class_metrics.Netral.support} data uji, tetapi tidak ada prediksi Netral yang benar. Ini adalah hasil model pada data saat ini, bukan nilai yang diatur aplikasi.
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl p-8 text-center shadow-card border border-slate-100">
          <Loader2 className="w-8 h-8 animate-spin text-accent-blue mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">
            Menjalankan evaluasi pipeline di Python (Split 80:20 &rarr; TF-IDF &rarr; KNN &rarr; Metrics)...
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="bg-white rounded-xl p-5 shadow-card border border-slate-100 animate-slide-up"
              style={{ animationDelay: `${idx * 70}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">{m.label}</p>
                <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${m.color} mb-3`} />
              <p className="text-3xl font-bold text-slate-800 mb-1">{m.value}</p>
              <p className="text-xs text-slate-400">{m.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Confusion Matrix & Classification Report */}
      {hasData ? (
        <>
          <div className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden animate-slide-up">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Confusion Matrix 3×3</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluasi prediksi {metrics.test_size} data uji dari total {metrics.total_labeled} data berlabel (K={metrics.k})
              </p>
            </div>
            <span className="text-xs font-mono bg-blue-50 text-accent-blue px-2.5 py-1 rounded font-semibold">
              Python scikit-learn
            </span>
          </div>

          <div className="p-6">
            <div className="max-w-md mx-auto">
              {/* Header Row */}
              <div className="grid grid-cols-4 gap-2 mb-2">
                <div className="text-[11px] font-semibold text-slate-400 flex items-end justify-center pb-2">
                  Aktual \ Prediksi
                </div>
                {metrics.confusion_matrix.labels.map((label) => (
                  <div key={label} className="text-center text-xs font-bold text-slate-600 pb-2">
                    {label}
                  </div>
                ))}
              </div>

              {/* Matrix Rows */}
              {metrics.confusion_matrix.labels.map((rowLabel, rowIdx) => (
                <div key={rowLabel} className="grid grid-cols-4 gap-2 mb-2">
                  <div
                    className={`flex items-center justify-center rounded-lg py-3.5 px-2 text-xs font-semibold ${
                      rowIdx === 0
                        ? 'bg-green-50 text-green-700'
                        : rowIdx === 1
                        ? 'bg-red-50 text-red-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {rowLabel}
                  </div>
                  {metrics.confusion_matrix.data[rowIdx].map((val, colIdx) => (
                    <div
                      key={colIdx}
                      className={`flex items-center justify-center rounded-lg py-3.5 text-sm font-bold border transition-all ${
                        rowIdx === colIdx
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-slate-50/50 border-slate-100 text-slate-400'
                      }`}
                    >
                      {val}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Classification Report per Class */}
        {metrics.class_metrics && (
          <div className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Classification Report per Kelas Sentimen</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rincian presisi, recall, dan F1-Score per kelas sentimen pada data uji
                </p>
              </div>
              <span className="text-xs font-mono bg-blue-50 text-accent-blue px-2.5 py-1 rounded font-semibold">
                Detail Metrik
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-5">Kelas Sentimen</th>
                    <th className="py-3 px-5 text-right">Precision (%)</th>
                    <th className="py-3 px-5 text-right">Recall (%)</th>
                    <th className="py-3 px-5 text-right">F1-Score (%)</th>
                    <th className="py-3 px-5 text-right">Support (Data Uji)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {['Positif', 'Negatif', 'Netral'].map((clsName) => {
                    const c = metrics.class_metrics[clsName] || { precision: 0, recall: 0, f1_score: 0, support: 0 };
                    return (
                      <tr key={clsName} className="hover:bg-slate-50/50">
                        <td className="py-3 px-5 font-semibold text-slate-800 flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              clsName === 'Positif'
                                ? 'bg-green-500'
                                : clsName === 'Negatif'
                                ? 'bg-red-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          {clsName}
                        </td>
                        <td className="py-3 px-5 text-right font-mono">{c.precision}%</td>
                        <td className="py-3 px-5 text-right font-mono">{c.recall}%</td>
                        <td className="py-3 px-5 text-right font-mono">{c.f1_score}%</td>
                        <td className="py-3 px-5 text-right font-mono text-slate-500">{c.support}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50/70 font-semibold border-t border-slate-200">
                  <tr>
                    <td className="py-3 px-5 text-slate-700">Macro Average</td>
                    <td className="py-3 px-5 text-right font-mono text-slate-800">{metrics.precision}%</td>
                    <td className="py-3 px-5 text-right font-mono text-slate-800">{metrics.recall}%</td>
                    <td className="py-3 px-5 text-right font-mono text-slate-800">{metrics.f1_score}%</td>
                    <td className="py-3 px-5 text-right font-mono text-slate-500">{metrics.test_size}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
        </>
      ) : (
        <div className="bg-white rounded-xl p-12 text-center shadow-card border border-slate-100">
          <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center">
            <HelpCircle className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">
            {evaluationMode === 'exploratory'
              ? 'Hasil eksplorasi otomatis belum tersedia'
              : lexiconLabelCount > 0 ? 'Label manual belum mencukupi untuk evaluasi' : 'Belum ada hasil evaluasi'}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            {evaluationMode === 'exploratory'
              ? 'Menyiapkan klasifikasi menggunakan label leksikon sebagai pseudo-label. Hasil tidak digunakan sebagai evaluasi ground truth pakar.'
              : lexiconLabelCount > 0
              ? `${lexiconLabelCount} label leksikon tersedia, tetapi tidak dipakai sebagai ground truth. Tinjau label secara manual pada minimal dua dokumen di setiap kelas.`
              : 'Evaluasi model memerlukan label manual pada dataset. Unggah file data mentah Anda sekali di menu Dataset.'}
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/dataset"
              className="inline-flex items-center gap-2 px-5 py-2 bg-accent-blue text-white hover:bg-blue-600 text-xs font-semibold rounded-lg shadow-md shadow-blue-500/20 transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Dataset</span>
            </Link>
            <Link
              href="/pelabelan"
              className="inline-flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold rounded-lg transition-all"
            >
              <Tag className="w-4 h-4" />
              <span>Tinjau Label Manual</span>
            </Link>
          </div>
        </div>
      )}

      {/* Interpretasi */}
      <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100 animate-slide-up">
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Interpretasi Evaluasi Model</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Confusion matrix membandingkan label aktual pakar dengan label prediksi hasil algoritma KNN.
          Metrik akurasi, presisi, recall, dan F1-Score dihitung murni dari hasil prediksi pada subset data uji (20%)
          menggunakan scikit-learn tanpa manipulasi data buatan.
        </p>
      </div>
    </div>
  );
}
