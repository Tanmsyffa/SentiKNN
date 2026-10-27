'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import StatsCard from '@/components/StatsCard';
import { getDatasetForAnalysis, getStoredDataset, getStoredPipeline, savePipeline } from '@/lib/dataService';
import { apiTfidf } from '@/lib/api';
import {
  FileText,
  BookOpen,
  Table as TableIcon,
  UploadCloud,
  Calculator,
  Loader2,
  AlertCircle,
  Hash,
  CheckCircle2,
} from 'lucide-react';

export default function TfidfPage() {
  const [dataset, setDataset] = useState([]);
  const [matrixData, setMatrixData] = useState([]);
  const [featureWords, setFeatureWords] = useState([]);
  const [topTerms, setTopTerms] = useState([]);
  const [totalVocab, setTotalVocab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    const rawData = getStoredDataset();
    const data = await getDatasetForAnalysis();
    const pipe = getStoredPipeline();
    setDataset(rawData);

    const cachedTfidf = pipe?.tfidf;
    const highestTerm = cachedTfidf?.top_terms?.[0]?.term;
    const usesRankedFeatures = highestTerm && cachedTfidf?.feature_names?.includes(highestTerm);
    if (cachedTfidf?.sample_matrix && usesRankedFeatures) {
      setMatrixData(cachedTfidf.sample_matrix || []);
      setFeatureWords(cachedTfidf.feature_names || []);
      setTopTerms(cachedTfidf.top_terms || []);
      setTotalVocab(cachedTfidf.total_vocabulary || 0);
      return;
    }

    if (data.length > 0) {
      setLoading(true);
      setError(null);
      try {
        const res = await apiTfidf(data, 3000);
        if (res.success) {
          setMatrixData(res.sample_matrix || []);
          setFeatureWords(res.feature_names || []);
          setTopTerms(res.top_terms || []);
          setTotalVocab(res.total_vocabulary || 0);
          await savePipeline({ ...(pipe || {}), total: data.length, tfidf: res }, false);
        } else {
          setError(res.error || 'Gagal menghitung TF-IDF.');
        }
      } catch (err) {
        setError(err.message || 'Gagal terhubung ke backend Python.');
      } finally {
        setLoading(false);
      }
    } else {
      setMatrixData([]);
      setFeatureWords([]);
      setTopTerms([]);
      setTotalVocab(0);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('sentiknn-dataset-updated', handleUpdate);
    window.addEventListener('sentiknn-pipeline-updated', handleUpdate);
    return () => {
      window.removeEventListener('sentiknn-dataset-updated', handleUpdate);
      window.removeEventListener('sentiknn-pipeline-updated', handleUpdate);
    };
  }, []);

  const hasData = dataset.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">TF-IDF</h1>
        <p className="page-subtitle">
          Representasi numerik teks menggunakan scikit-learn (TfidfVectorizer) untuk fitur masukan KNN
        </p>
      </div>

      {hasData && totalVocab > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between text-xs text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span>
              Matriks TF-IDF telah otomatis dihitung saat upload dan disimpan ke database Supabase (tabel <code>tfidf_matrix</code>).
            </span>
          </div>
          <span className="font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
            Fitur Numerik Siap
          </span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Jumlah Dokumen"
          value={hasData ? `${dataset.length.toLocaleString('id-ID')} data` : '0 data'}
          color="blue"
          icon={FileText}
        />
        <StatsCard
          title="Total Vocabulary"
          value={hasData ? `${totalVocab} kata unik` : '0 kata'}
          color="purple"
          icon={BookOpen}
        />
        <div className="bg-white rounded-xl p-5 shadow-card border border-slate-100 animate-slide-up flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Dimensi Matriks</p>
            <p className="text-xl font-bold text-accent-blue">
              {hasData && totalVocab > 0 ? `${dataset.length} × ${totalVocab}` : '0 × 0'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Dokumen × fitur bobot</p>
          </div>
          <div className="w-10 h-10 bg-blue-50 text-accent-blue rounded-xl flex items-center justify-center">
            <Calculator className="w-5 h-5" />
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl p-10 text-center shadow-card border border-slate-100">
          <Loader2 className="w-8 h-8 animate-spin text-accent-blue mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Menghitung matriks TF-IDF via Python scikit-learn...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TF-IDF Matrix Table */}
      {!loading && hasData && matrixData.length > 0 && (
        <div className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden animate-slide-up">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              Matriks Bobot TF-IDF: 10 Kata Paling Berbobot (Sampel 10 Dokumen)
            </h3>
            <span className="text-xs text-slate-400 font-mono">scikit-learn TfidfVectorizer</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Dokumen</th>
                  {featureWords.map((word) => (
                    <th key={word} className="text-center">
                      <span className="font-mono text-xs">{word}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.map((row) => (
                  <tr key={row.dokumen} className="hover:bg-slate-50/50 transition-colors">
                    <td className="font-semibold text-slate-700 font-mono text-xs">{row.dokumen}</td>
                    {featureWords.map((word) => {
                      const val = row[word] || 0;
                      return (
                        <td key={word} className="text-center">
                          <span
                            className={`font-mono text-xs ${
                              val > 0.4
                                ? 'text-blue-600 font-bold'
                                : val > 0
                                ? 'text-slate-700 font-medium'
                                : 'text-slate-300'
                            }`}
                          >
                            {val > 0 ? Number(val).toFixed(4) : '—'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !hasData && (
        <div className="bg-white rounded-xl p-12 text-center shadow-card border border-slate-100">
          <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center">
            <TableIcon className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Belum ada data untuk pembobotan TF-IDF</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Matriks TF-IDF akan dihitung secara otomatis oleh backend Python setelah Anda mengunggah dataset Excel/CSV.
          </p>
          <Link
            href="/dataset"
            className="inline-flex items-center gap-2 px-5 py-2 bg-accent-blue text-white hover:bg-blue-600 text-xs font-semibold rounded-lg shadow-md shadow-blue-500/20 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Dataset Sekarang</span>
          </Link>
        </div>
      )}

      {/* Top Terms Cards */}
      {!loading && topTerms.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100 animate-slide-up">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-accent-blue" />
            <span>Kata dengan Bobot TF-IDF Tertinggi</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {topTerms.slice(0, 15).map((item) => (
              <span
                key={item.term}
                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 flex items-center gap-1.5"
              >
                <span className="font-semibold text-blue-600">{item.term}</span>
                <span className="text-slate-400 text-[10px]">({item.weight_sum})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {!loading && matrixData.length > 0 && (
        <p className="text-xs text-slate-500 -mt-3">
          Tanda “—” berarti kata pada kolom tersebut tidak muncul dalam dokumen itu, bukan seluruh perhitungan bernilai nol.
        </p>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100 animate-slide-up">
          <h3 className="text-sm font-semibold text-accent-blue mb-3">Formula TF-IDF</h3>
          <div className="bg-slate-50 p-3 rounded-lg font-mono text-xs text-slate-700 mb-3">
            W(t, d) = TF(t, d) × ln((1 + n) / (1 + df(t))) + 1
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Pembobotan dilakukan dengan pustaka <strong>scikit-learn TfidfVectorizer</strong> pada backend Python. Kata yang sering muncul di satu dokumen tapi jarang di dokumen lain akan mendapat bobot tinggi.
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100 animate-slide-up">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Integrasi KNN</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Vektor fitur TF-IDF dari seluruh dokumen latih dan uji digunakan untuk menghitung jarak Euclidean guna menemukan tetangga terdekat pada klasifikasi sentimen.
          </p>
        </div>
      </div>
    </div>
  );
}
