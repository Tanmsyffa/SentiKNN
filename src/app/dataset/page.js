'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import StatsCard from '@/components/StatsCard';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';
import {
  getStoredDataset,
  getStoredPipeline,
  clearDataset,
  getDatasetSummary,
  syncStoredPipelineToSupabase,
} from '@/lib/dataService';
import { runPipelineInBackground, getPipelineStatus, resetPipelineStatus } from '@/lib/pipelineRunner';
import { checkSupabaseConnection } from '@/lib/supabaseService';
import { exportRowsToXlsx } from '@/lib/exportCsv';
import {
  FileText,
  Calendar,
  CheckCircle2,
  UploadCloud,
  Trash2,
  AlertCircle,
  FileCheck,
  Loader2,
  FileSpreadsheet,
  Database,
  ArrowRight,
  Layers,
  Sparkles,
  Award,
  RefreshCw,
  Download,
} from 'lucide-react';

const columns = [
  { key: 'id', label: 'ID', width: '90px' },
  { key: 'tanggal', label: 'Tanggal', width: '130px' },
  { key: 'teks', label: 'Teks Unggahan X' },
  {
    key: 'username',
    label: 'Pengguna',
    width: '120px',
    render: (val) => <span className="text-slate-500 font-mono text-xs">{val ? `@${val}` : '-'}</span>,
  },
  {
    key: 'sumber',
    label: 'Sumber',
    width: '90px',
    render: (val) => <span className="text-accent-blue font-semibold text-xs">{val || 'X'}</span>,
  },
  {
    key: 'label',
    label: 'Label',
    width: '120px',
    render: (val) => {
      if (!val || val === '-') return <span className="text-slate-300 font-mono">-</span>;
      return <Badge variant={val.toLowerCase()}>{val}</Badge>;
    },
  },
];

const rawExportColumns = [
  { key: 'id', label: 'ID', width: 24 },
  { key: 'tanggal', label: 'Tanggal', width: 16 },
  { key: 'teks', label: 'Teks Unggahan X', width: 65 },
  { key: 'username', label: 'Pengguna', width: 22 },
  { key: 'sumber', label: 'Sumber', width: 14 },
];

export default function DatasetPage() {
  const [dataset, setDataset] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    dateRange: 'Belum ada data',
    labeledTotal: 0,
  });
  const [pipelineData, setPipelineData] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState(() => getPipelineStatus());
  const [supabaseStatus, setSupabaseStatus] = useState(null);
  const [isSyncingDatabase, setIsSyncingDatabase] = useState(false);
  const [databaseMessage, setDatabaseMessage] = useState(null);

  const loadData = useCallback(() => {
    const data = getStoredDataset();
    const pipe = getStoredPipeline();
    setDataset(data);
    setPipelineData(pipe);
    setStats(getDatasetSummary(data));
  }, []);

  useEffect(() => {
    loadData();
    // Sync with current pipeline runner state (may already be running from before navigation)
    setPipelineStatus(getPipelineStatus());
    checkSupabaseConnection().then(setSupabaseStatus);

    const handleDataUpdate = () => loadData();
    const handlePipelineStatusChange = (e) => {
      const status = e.detail || getPipelineStatus();
      setPipelineStatus(status);
      // Reload data when pipeline completes
      if (status.step === 4 || (status.step === 0 && status.message)) {
        loadData();
      }
    };

    window.addEventListener('sentiknn-dataset-updated', handleDataUpdate);
    window.addEventListener('sentiknn-pipeline-updated', handleDataUpdate);
    window.addEventListener('sentiknn-pipeline-status', handlePipelineStatusChange);
    return () => {
      window.removeEventListener('sentiknn-dataset-updated', handleDataUpdate);
      window.removeEventListener('sentiknn-pipeline-updated', handleDataUpdate);
      window.removeEventListener('sentiknn-pipeline-status', handlePipelineStatusChange);
    };
  }, [loadData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Fire and forget - runs in background, survives page navigation
    runPipelineInBackground(file);
  };

  const handleClear = () => {
    if (confirm('Apakah Anda yakin ingin mengosongkan seluruh dataset dan hasil proses?')) {
      clearDataset();
      setPipelineData(null);
      resetPipelineStatus();
    }
  };

  const handleDatabaseSync = async () => {
    setIsSyncingDatabase(true);
    setDatabaseMessage({ type: 'info', text: 'Menyiapkan sinkronisasi database.' });
    try {
      const result = await syncStoredPipelineToSupabase((text) => setDatabaseMessage({ type: 'info', text }));
      setDatabaseMessage({
        type: result.success ? 'success' : 'error',
        text: result.errors?.[0] || result.message || 'Sinkronisasi database gagal.',
      });
      checkSupabaseConnection().then(setSupabaseStatus);
    } catch (error) {
      setDatabaseMessage({ type: 'error', text: error.message || 'Sinkronisasi database gagal.' });
    } finally {
      setIsSyncingDatabase(false);
    }
  };

  const handleRawExport = () => {
    exportRowsToXlsx('sentiknn-data-mentah.xlsx', rawExportColumns, dataset, 'Data Mentah');
  };

  const isUploading = pipelineStatus.isRunning;
  const uploadStep = pipelineStatus.step;
  const uploadMessage = pipelineStatus.message;
  const evaluationReady = pipelineData?.evaluation?.status === 'evaluated';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Dataset X (Data Mentah)</h1>
          <p className="page-subtitle">
            Upload satu kali - sistem otomatis memproses Preprocessing, Pelabelan, TF-IDF, Split, KNN, dan Evaluasi serta menyimpan ke Supabase.
          </p>
        </div>

        {/* Supabase Status Indicator */}
        {supabaseStatus && (
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              supabaseStatus.tablesExist
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={supabaseStatus.message}
          >
            <Database className="w-3.5 h-3.5" />
            <span>
              {supabaseStatus.tablesExist
                ? 'Database Terhubung (Tabel Siap)'
                : 'Database: tidak terhubung'}
            </span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Total Unggahan"
          value={`${stats.total.toLocaleString('id-ID')} data`}
          color="blue"
          icon={FileText}
        />
        <StatsCard
          title="Rentang Data"
          value={stats.dateRange}
          color="purple"
          icon={Calendar}
        />
        <StatsCard
          title="Status Pipeline"
          value={
            isUploading
              ? 'Sedang Memproses...'
              : pipelineData
              ? evaluationReady
                ? 'Seluruh Step Siap'
                : 'Perlu Label Manual'
              : stats.total > 0
              ? 'Data Tersimpan'
              : 'Menunggu Upload'
          }
          color={isUploading ? 'orange' : pipelineData ? 'green' : stats.total > 0 ? 'blue' : 'orange'}
          icon={isUploading ? Loader2 : pipelineData ? CheckCircle2 : AlertCircle}
        />
      </div>

      {/* Step Quick Navigation Bar (Active once uploaded) */}
      {pipelineData && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-4 rounded-xl border border-blue-100 animate-slide-up">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <Sparkles className="w-4 h-4 text-accent-blue" />
              <span className="min-w-0 break-words text-xs font-bold text-slate-800">
                {evaluationReady
                  ? 'Otomatisasi selesai: seluruh hasil siap ditinjau tanpa upload ulang'
                  : 'Preprocessing, label leksikon, dan TF-IDF siap. Tinjau label manual untuk mengaktifkan split, KNN, dan evaluasi.'}
              </span>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
              <Link
                href="/preprocessing"
                className="px-3 py-1 bg-white hover:bg-blue-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>Preprocessing</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </Link>
              <Link
                href="/split"
                className="px-3 py-1 bg-white hover:bg-blue-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>Split 80:20</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </Link>
              <Link
                href="/tfidf"
                className="px-3 py-1 bg-white hover:bg-blue-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>TF-IDF</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </Link>
              <Link
                href="/klasifikasi"
                className="px-3 py-1 bg-white hover:bg-blue-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>KNN</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </Link>
              <Link
                href="/evaluasi"
                className="px-3 py-1 bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <Award className="w-3 h-3" />
                <span>{evaluationReady ? `Evaluasi (${pipelineData.evaluation.accuracy}%)` : 'Tinjau Label Manual'}</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-500 font-medium">
          {stats.total > 0 ? (
            <span>Menampilkan {dataset.length} baris data mentah yang telah diunggah</span>
          ) : (
            <span>Data masih kosong. Silakan unggah file Excel (.xlsx) atau CSV Anda.</span>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {dataset.length > 0 && (
            <button
              onClick={handleRawExport}
              className="flex w-full items-center justify-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 text-accent-blue hover:bg-blue-100 text-xs font-semibold rounded-lg transition-colors sm:w-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Data Mentah (.xlsx)</span>
            </button>
          )}
          {dataset.length > 0 && (
            <button
              onClick={handleDatabaseSync}
              disabled={isSyncingDatabase || isUploading}
              className="flex w-full items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700 text-xs font-semibold rounded-lg transition-colors sm:w-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDatabase ? 'animate-spin' : ''}`} />
              <span>{isSyncingDatabase ? 'Sinkronisasi berjalan...' : 'Sinkronkan Ulang ke Supabase'}</span>
            </button>
          )}
          {dataset.length > 0 && (
            <button
              onClick={handleClear}
              className="flex w-full items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors sm:w-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Kosongkan Data</span>
            </button>
          )}
          <button
            onClick={() => setShowImport(!showImport)}
            className="flex w-full items-center justify-center gap-2 px-6 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20 active:scale-95 sm:w-auto"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Data Mentah (Excel / CSV)</span>
          </button>
        </div>
      </div>
      {databaseMessage && (
        <div className={`text-xs rounded-lg border px-3 py-2 ${databaseMessage.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : databaseMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
          {databaseMessage.text}
        </div>
      )}

      {/* Upload Modal / Area */}
      {showImport && (
        <div className="bg-white rounded-xl p-6 shadow-card border-2 border-dashed border-blue-300 animate-slide-up">
          <div className="text-center py-6">
            <div className="w-14 h-14 mx-auto mb-3 bg-blue-50 text-accent-blue rounded-2xl flex items-center justify-center">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">
              Upload File Excel (.xlsx / .xls) atau CSV Data Mentah
            </p>
            <p className="text-xs text-slate-400 mb-5 max-w-md mx-auto">
              Sistem akan otomatis mengeksekusi semua tahapan: Preprocessing 7-tahap, Pelabelan, TF-IDF, Split 80:20, Klasifikasi KNN, Evaluasi Model, dan menyimpan ke Supabase.
              <br/><strong className="text-slate-500">Proses berjalan di background - Anda bebas berpindah halaman.</strong>
            </p>

            <div className="inline-block">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
                <span className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-sm">
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sedang memproses seluruh tahapan...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Pilih File dari Komputer</span>
                    </>
                  )}
                </span>
              </label>
            </div>

            {/* Visual Step Progress while uploading */}
            {isUploading && (
              <div className="mt-6 max-w-md mx-auto bg-slate-50 p-4 rounded-xl border border-slate-200 text-left">
                <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-blue" />
                  <span>Progres Otomatisasi Terpadu (berjalan di background):</span>
                </p>
                <div className="space-y-2 text-xs">
                  <div className={`flex items-center gap-2 ${uploadStep >= 1 ? 'text-accent-blue font-semibold' : 'text-slate-400'}`}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>1. Membaca & validasi format data mentah</span>
                  </div>
                  <div className={`flex items-center gap-2 ${uploadStep >= 2 ? 'text-accent-blue font-semibold' : 'text-slate-400'}`}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>2. Menjalankan 7 tahap Preprocessing (Sastrawi & NLTK)</span>
                  </div>
                  <div className={`flex items-center gap-2 ${uploadStep >= 3 ? 'text-accent-blue font-semibold' : 'text-slate-400'}`}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>3. Stratified Split 80:20, TF-IDF & KNN</span>
                  </div>
                  <div className={`flex items-center gap-2 ${uploadStep >= 3 ? 'text-accent-blue font-semibold' : 'text-slate-400'}`}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>4. Menyimpan ke Supabase & Local Cache</span>
                  </div>
                  <div className={`flex items-center gap-2 ${uploadStep >= 4 ? 'text-green-600 font-bold' : 'text-slate-400'}`}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>5. Selesai!</span>
                  </div>
                </div>
              </div>
            )}

            {uploadMessage && (
              <div
                className={`mt-4 p-3 rounded-lg text-xs font-medium max-w-lg mx-auto flex items-center justify-center gap-2 ${
                  uploadMessage.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {uploadMessage.type === 'success' ? (
                  <FileCheck className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{uploadMessage.text}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Pipeline Status Banner (visible even if upload area is closed) */}
      {!showImport && isUploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 animate-slide-up">
          <Loader2 className="w-5 h-5 animate-spin text-accent-blue flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Pipeline sedang berjalan di background...</p>
            <p className="text-xs text-blue-600">
              Anda bebas berpindah halaman. Proses tidak akan terhenti. Step saat ini: {uploadStep}/4
            </p>
          </div>
        </div>
      )}
      {!showImport && !isUploading && uploadMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 ${
            uploadMessage.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {uploadMessage.type === 'success' ? (
            <FileCheck className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{uploadMessage.text}</span>
        </div>
      )}

      {/* Data Table */}
      {dataset.length > 0 ? (
        <DataTable
          columns={columns}
          data={dataset}
          searchPlaceholder="Cari kata kunci atau isi unggahan..."
          pageSize={10}
        />
      ) : (
        <div className="bg-white rounded-xl p-12 text-center shadow-card border border-slate-100">
          <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Belum ada data mentah yang diunggah</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Klik tombol di bawah untuk mengunggah file dataset Excel/CSV. Sistem akan otomatis memproses dan menyimpannya.
          </p>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-50 text-accent-blue hover:bg-blue-100 text-xs font-semibold rounded-lg transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Unggah Data Mentah (Excel / CSV)</span>
          </button>
        </div>
      )}

      {/* Footnote */}
      <p className="text-xs text-slate-400 text-center italic">
        Dataset diproses menggunakan library Python (pandas, Sastrawi, scikit-learn, NLTK) dan disinkronkan ke Supabase.
      </p>
    </div>
  );
}
