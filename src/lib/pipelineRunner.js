/**
 * Global Pipeline Runner (Singleton)
 * Runs pipeline in background, survives page navigation
 */

import { apiUpload, apiRunPipeline, apiRunPipelineStaged } from './api';
import { savePipeline, saveDataset } from './dataService';

// Singleton state: lives at module level, survives React unmounts
let _pipelineState = {
  isRunning: false,
  step: 0,       // 0=idle, 1=uploading, 2=pipeline, 3=saving, 4=done
  message: null,  // { type: 'success'|'error', text: string }
  error: null,
};

// AbortController reference: NOT used to cancel on unmount
let _currentAbortController = null;

/**
 * Get current pipeline runner state (non-reactive, call from components)
 */
export function getPipelineStatus() {
  return { ..._pipelineState };
}

/**
 * Broadcast pipeline status change to all listening components
 */
function broadcastStatus() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sentiknn-pipeline-status', {
      detail: { ..._pipelineState },
    }));
  }
}

/**
 * Run the full pipeline in background - survives page navigation
 * @param {File} file - The uploaded file
 * @returns {Promise<void>}
 */
export async function runPipelineInBackground(file) {
  if (_pipelineState.isRunning) {
    console.warn('[PipelineRunner] Pipeline already running, ignoring duplicate call.');
    return;
  }

  _pipelineState = { isRunning: true, step: 1, message: null, error: null };
  broadcastStatus();

  try {
    // Step 1: Read file and upload
    const base64Data = await readFileAsBase64(file);

    _pipelineState.step = 1;
    broadcastStatus();

    const uploadRes = await apiUpload({
      fileBase64: base64Data,
      filename: file.name,
    });

    if (!uploadRes.success || !uploadRes.data || uploadRes.data.length === 0) {
      throw new Error(uploadRes.error || 'Dataset kosong atau format file tidak dikenali.');
    }

    // Segera simpan dan tampilkan dataset mentah di antarmuka web
    saveDataset(uploadRes.data);

    // Step 2: Run full pipeline (this is the long-running step)
    _pipelineState.step = 2;
    broadcastStatus();

    const rawItems = uploadRes.data;
    const pipeRes = rawItems.length > 300
      ? await apiRunPipelineStaged(rawItems, 5, 0.8, (detail) => {
        _pipelineState = { ..._pipelineState, detail };
        broadcastStatus();
      })
      : await apiRunPipeline(rawItems, 5, 0.8);

    if (!pipeRes.success) {
      throw new Error(pipeRes.error || 'Gagal menjalankan pipeline NLP di Python.');
    }

    // Step 3: Save to localStorage & Supabase
    _pipelineState.step = 3;
    broadcastStatus();

    const supabaseRes = await savePipeline(pipeRes, true);

    // Step 4: Done!
    const evaluationReady = pipeRes.evaluation?.status === 'evaluated';
    let statusDetail = evaluationReady
      ? 'Seluruh proses otomatis selesai.'
      : 'Preprocessing, label leksikon, dan TF-IDF selesai. Tinjau label manual untuk menjalankan split, KNN, dan evaluasi.';
    if (supabaseRes?.success) {
      statusDetail = evaluationReady
        ? 'Semua data mentah dan hasil tiap tahap berhasil disimpan ke Supabase.'
        : 'Data mentah serta hasil preprocessing dan TF-IDF berhasil disimpan ke Supabase. Label manual masih diperlukan untuk split, KNN, dan evaluasi.';
    } else if (supabaseRes?.reason === 'tables_not_found') {
      statusDetail =
        'Data mentah & hasil proses tersimpan lokal. Harap jalankan script schema.sql di Supabase SQL Editor untuk sinkronisasi.';
    } else if (supabaseRes?.reason === 'secure_sync_disabled') {
      statusDetail = 'Hasil tersimpan aman di browser. Sinkronisasi Supabase publik dinonaktifkan sampai backend tepercaya tersedia.';
    } else if (supabaseRes?.errors?.length) {
      statusDetail = `Hasil tersimpan lokal. Sinkronisasi Supabase belum berhasil: ${supabaseRes.errors[0]}`;
    }

    _pipelineState = {
      isRunning: false,
      step: 4,
      message: {
        type: 'success',
        text: `Berhasil memproses ${pipeRes.total} data dari file ${file.name}. ${statusDetail}`,
      },
      error: null,
    };
    broadcastStatus();

  } catch (err) {
    console.error('[PipelineRunner] Error:', err);
    _pipelineState = {
      isRunning: false,
      step: 0,
      message: {
        type: 'error',
        text: `Gagal memproses file: ${err.message || 'Pastikan backend Python sedang berjalan.'}`,
      },
      error: err.message,
    };
    broadcastStatus();
  }
}

/**
 * Reset pipeline status (e.g., after user clears data)
 */
export function resetPipelineStatus() {
  _pipelineState = { isRunning: false, step: 0, message: null, error: null };
  broadcastStatus();
}

/**
 * Read a File as base64 string
 */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl) {
        resolve(dataUrl.split(',')[1]);
      } else {
        reject(new Error('Gagal membaca file dari disk lokal.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file dari disk lokal.'));
    reader.readAsDataURL(file);
  });
}
