'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import StatsCard from '@/components/StatsCard';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';
import {
  getStoredDataset,
  updateDatasetItem,
  getDatasetSummary,
  saveDataset,
  getStoredPipeline,
  savePipeline,
} from '@/lib/dataService';
import { apiAutolabel, apiRunPipeline, apiRunPipelineStaged } from '@/lib/api';
import {
  Clock,
  CheckCircle2,
  Tag,
  UploadCloud,
  Inbox,
  Sparkles,
  Loader2,
  BookOpen,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

export default function PelabelanPage() {
  const [dataset, setDataset] = useState([]);
  const [stats, setStats] = useState({ unlabeled: 0, labeledTotal: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const loadData = () => {
    const data = getStoredDataset();
    setDataset(data);
    setStats(getDatasetSummary(data));
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

  const handleUpdateLabel = (id, newLabel) => {
    const updated = updateDatasetItem(id, { label: newLabel === '-' ? '' : newLabel });
    setDataset(updated);
  };

  const handleAutolabel = async () => {
    if (!dataset || dataset.length === 0) return;
    setLoading(true);
    setMessage(null);

    try {
      const chunks = [];
      for (let index = 0; index < dataset.length; index += 50) {
        chunks.push(dataset.slice(index, index + 50));
      }
      const labeledData = [];
      let autoLabeledCount = 0;
      for (const chunk of chunks) {
        const res = await apiAutolabel(chunk, false);
        if (!res.success || !res.data) throw new Error(res.error || 'Gagal menjalankan pelabelan otomatis.');
        labeledData.push(...res.data);
        autoLabeledCount += res.auto_labeled_count || 0;
      }
      if (labeledData.length > 0) {
        saveDataset(labeledData);
        setDataset(labeledData);
        setStats(getDatasetSummary(labeledData));

        // Re-run pipeline to sync Split, TF-IDF, KNN, and Evaluation
        try {
          const pipeRes = labeledData.length > 300
            ? await apiRunPipelineStaged(labeledData, 5, 0.8)
            : await apiRunPipeline(labeledData, 5, 0.8);
          if (pipeRes.success) {
            await savePipeline(pipeRes, true);
          }
        } catch (pipeErr) {
          console.warn('Sync pipeline error:', pipeErr);
        }

        setMessage({
          type: 'success',
          text: `Berhasil memberi ${autoLabeledCount} label leksikon menggunakan InSet Lexicon (IEEE 2017). Tinjau dan tetapkan label manual sebelum menjalankan split, KNN, dan evaluasi.`,
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Gagal terhubung ke backend Python.',
      });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'id', label: 'ID', width: '90px' },
    { key: 'teks', label: 'Teks Unggahan X' },
    {
      key: 'label',
      label: 'Label Sentimen',
      width: '180px',
      render: (val, row) => (
        <select
          value={val || '-'}
          onChange={(e) => handleUpdateLabel(row.id, e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-accent-blue"
        >
          <option value="-">Belum ada label</option>
          <option value="Positif">Positif</option>
          <option value="Negatif">Negatif</option>
          <option value="Netral">Netral</option>
        </select>
      ),
    },
    {
      key: 'status',
      label: 'Status & Metode',
      width: '160px',
      render: (_, row) => {
        const isLabeled = row.label && row.label !== '-' && row.label !== '';
        return (
          <div className="flex flex-col gap-0.5">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                isLabeled ? 'text-green-600' : 'text-amber-500'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLabeled ? 'bg-green-500' : 'bg-amber-400'}`} />
              {isLabeled ? 'Sudah dilabeli' : 'Belum dilabeli'}
            </span>
            {row.auto_labeled && (
              <span className="text-[10px] text-blue-600 font-medium">
                InSet (skor kumulatif: {row.lexicon_score ?? 0})
              </span>
            )}
          </div>
        );
      },
    },
  ];

  const hasUnlabeled = (stats.unlabeled || 0) > 0;
  const manualLabelCount = dataset.filter((item) => item.label && item.label_source !== 'lexicon' && !item.auto_labeled).length;
  const lexiconLabelCount = dataset.filter((item) => item.label && (item.label_source === 'lexicon' || item.auto_labeled)).length;
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Pelabelan Data</h1>
          <p className="page-subtitle">
            Penetapan label sentimen (Manual oleh Pakar atau Otomatis berbasis Leksikon InSet IEEE 2017)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {dataset.length > 0 && hasUnlabeled && (
            <button
              onClick={handleAutolabel}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md text-xs font-semibold transition-all disabled:opacity-50"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Memproses Leksikon InSet...</span></> : <><Sparkles className="w-4 h-4 text-amber-300" /><span>Isi Label Kosong Otomatis (InSet)</span></>}
            </button>
          )}
        </div>
      </div>

      {/* Referensi Ilmiah Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700">
        <div className="flex items-start sm:items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-accent-blue flex-shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>Referensi Ilmiah:</strong> Leksikon Sentimen InSet (Koto & Rahmaningtyas, IEEE IALP 2017) & ID-OpinionWords (Masdevid).
          </span>
        </div>
        <span className="bg-blue-100 text-accent-blue px-2.5 py-0.5 rounded font-mono text-[11px] font-semibold self-start sm:self-auto">
          IEEE DOI: 10.1109/ICAICTA.2017.8090963
        </span>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          {message.type === 'success' && (
            <Link
              href="/pelabelan"
              className="px-3 py-1 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 transition-colors"
            >
              Tinjau Label Manual &rarr;
            </Link>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Belum Dilabeli"
          value={stats.total > 0 ? `${stats.unlabeled || 0} data` : '0 data'}
          color="orange"
          icon={Clock}
        />
        <StatsCard
          title="Label Manual"
          value={`${manualLabelCount} data`}
          color="green"
          icon={CheckCircle2}
        />
        <StatsCard
          title="Label Leksikon"
          value={`${lexiconLabelCount} data`}
          color="purple"
          icon={Sparkles}
        />
        <div className="bg-white rounded-xl p-5 shadow-card border border-slate-100 animate-slide-up flex flex-col justify-between md:col-span-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Kelas Sentimen</p>
          <div className="flex gap-2">
            <Badge variant="positif">Positif ({stats.positif || 0})</Badge>
            <Badge variant="negatif">Negatif ({stats.negatif || 0})</Badge>
            <Badge variant="netral">Netral ({stats.netral || 0})</Badge>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {dataset.length > 0 ? (
        <DataTable
          columns={columns}
          data={dataset}
          searchPlaceholder="Cari teks unggahan..."
          pageSize={10}
        />
      ) : (
        <div className="bg-white rounded-xl p-12 text-center shadow-card border border-slate-100">
          <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center">
            <Inbox className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Belum ada data untuk pelabelan</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Data saat ini kosong. Silakan unggah dataset Excel/CSV Anda melalui menu Dataset terlebih dahulu.
          </p>
          <Link
            href="/dataset"
            className="inline-flex items-center gap-2 px-5 py-2 bg-accent-blue text-white hover:bg-blue-600 text-xs font-semibold rounded-lg shadow-md shadow-blue-500/20 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Buka Halaman Dataset</span>
          </Link>
        </div>
      )}

      {/* Note */}
      <p className="text-xs text-slate-400 text-center italic">
        Label leksikon adalah bantuan awal. Hanya label yang ditinjau dan ditetapkan manual yang dipakai sebagai ground truth untuk split, KNN, dan evaluasi.
      </p>
    </div>
  );
}
