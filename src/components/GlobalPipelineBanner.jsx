'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPipelineStatus } from '@/lib/pipelineRunner';
import { Loader2, CheckCircle2, AlertCircle, X, Sparkles, ArrowRight } from 'lucide-react';

const STEP_LABELS = {
  1: 'Langkah 1/4: Membaca & validasi format data mentah',
  2: 'Langkah 2/4: Menjalankan 7 Tahap Preprocessing & Ekstraksi Model di Python',
  3: 'Langkah 3/4: Sinkronisasi ke Supabase & Penyimpanan Lokal',
  4: 'Pipeline selesai: hasil yang tersedia siap ditinjau.',
};

const STEP_PROGRESS = {
  1: '25%',
  2: '65%',
  3: '90%',
  4: '100%',
};

export default function GlobalPipelineBanner() {
  const [status, setStatus] = useState(() => getPipelineStatus());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setStatus(getPipelineStatus());

    const handleStatus = (e) => {
      const newStatus = e.detail || getPipelineStatus();
      setStatus(newStatus);
      if (newStatus.isRunning) {
        setDismissed(false);
      }
    };

    window.addEventListener('sentiknn-pipeline-status', handleStatus);
    return () => {
      window.removeEventListener('sentiknn-pipeline-status', handleStatus);
    };
  }, []);

  if (dismissed) return null;

  // Running State
  if (status.isRunning) {
    const stepLabel = STEP_LABELS[status.step] || 'Sedang memproses pipeline...';
    const progressWidth = STEP_PROGRESS[status.step] || '30%';

    return (
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-4 py-2.5 sm:px-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-slide-up sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-blue-200 flex-shrink-0" />
          <div>
            <span className="font-bold tracking-wide uppercase text-[10px] bg-white/20 px-2 py-0.5 rounded mr-2">
              Background Runner
            </span>
            <span className="font-medium text-white">{stepLabel}</span>
            {status.detail && <span className="text-blue-100">{status.detail}</span>}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Progress bar */}
          <div className="w-32 bg-white/20 rounded-full h-2 overflow-hidden hidden sm:block">
            <div
              className="bg-emerald-400 h-full transition-all duration-500 rounded-full"
              style={{ width: progressWidth }}
            />
          </div>
          <span className="text-[11px] font-mono text-blue-100 hidden sm:inline">
            {progressWidth}
          </span>
          <span className="text-[11px] text-blue-100 bg-white/10 px-2 py-0.5 rounded">
            Bebas pindah tab
          </span>
        </div>
      </div>
    );
  }

  // Done State Banner (Temporary)
  if (status.step === 4 && status.message && !dismissed) {
    return (
      <div className="bg-emerald-600 text-white px-4 py-2 sm:px-6 shadow-md flex items-center justify-between gap-3 text-xs animate-slide-up sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 flex-shrink-0" />
          <span className="font-semibold">{status.message.text}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/evaluasi"
            className="px-2.5 py-1 bg-white text-emerald-700 hover:bg-emerald-50 rounded font-semibold text-[11px] flex items-center gap-1 transition-colors"
          >
            <span>Lihat Evaluasi</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/80 hover:text-white p-0.5"
            title="Tutup banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Error State Banner
  if (status.step === 0 && status.error && !dismissed) {
    return (
      <div className="bg-red-600 text-white px-4 py-2 sm:px-6 shadow-md flex items-center justify-between gap-3 text-xs animate-slide-up sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-200 flex-shrink-0" />
          <span className="font-semibold">Pipeline Error: {status.error}</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/80 hover:text-white p-0.5"
          title="Tutup banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}
