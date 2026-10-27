/**
 * Central Data & Pipeline Service
 * Stores dataset and automated pipeline results in localStorage and syncs with Supabase
 */


import { saveCompletePipelineToSupabase } from './supabaseService';
import { apiPreprocessBatch, apiTfidf } from './api';
import { clearLargePipelineDetails, getPreprocessingResults, savePreprocessingResults } from './largeDataStore';

const DATASET_STORAGE_KEY = 'sentiknn_user_uploaded_dataset';
const PIPELINE_STORAGE_KEY = 'sentiknn_pipeline_result';
const LARGE_DATASET_THRESHOLD = 300;

function compactDataset(dataset) {
  return (Array.isArray(dataset) ? dataset : []).map((item) => ({
    id: item.id,
    tanggal: item.tanggal,
    teks: item.teks,
    sumber: item.sumber,
    username: item.username,
    label: item.label,
    label_source: item.label_source,
    auto_labeled: Boolean(item.auto_labeled),
    lexicon_score: item.lexicon_score,
    lexicon_strength: item.lexicon_strength,
    lexicon_match_count: item.lexicon_match_count,
  }));
}

function compactPipeline(pipelineData) {
  const total = pipelineData?.total || pipelineData?.tweets?.length || 0;
  if (total <= LARGE_DATASET_THRESHOLD) return pipelineData;
  return {
    ...pipelineData,
    tweets: undefined,
    preprocessing_results: [],
    tfidf: {
      ...pipelineData.tfidf,
      tfidf_records: [],
    },
    knn: {
      ...pipelineData.knn,
      results_records: [],
    },
    storage_notice: 'Detail per dokumen tidak disimpan di localStorage untuk dataset besar. Data mentah dan ringkasan hasil tetap tersedia.',
  };
}

/**
 * Get stored raw dataset
 */
export function getStoredDataset() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DATASET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Gagal membaca dataset dari storage:', e);
  }
  return [];
}

export async function getDatasetForAnalysis() {
  const dataset = getStoredDataset();
  if (dataset.length === 0) return [];
  try {
    const preprocessingResults = await getPreprocessingResults();
    if (preprocessingResults.length === 0) return dataset;
    const stems = new Map(preprocessingResults.map((item) => [String(item.tweet_id), item.stemmed_text || '']));
    return dataset.map((item) => ({ ...item, stemmed: stems.get(String(item.id)) || '' }));
  } catch (error) {
    console.warn('Detail preprocessing tidak tersedia untuk analisis:', error);
    return dataset;
  }
}

/**
 * Save raw dataset to storage and notify all pages
 */
export function saveDataset(newDataset) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DATASET_STORAGE_KEY, JSON.stringify(compactDataset(newDataset)));
    window.dispatchEvent(new Event('sentiknn-dataset-updated'));
  } catch (e) {
    console.error('Gagal menyimpan dataset ke storage:', e);
  }
}

/**
 * Get stored complete pipeline results
 */
export function getStoredPipeline() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PIPELINE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.error('Gagal membaca pipeline dari storage:', e);
  }
  return null;
}

/**
 * Save complete pipeline results and optionally sync to Supabase
 */
export async function savePipeline(pipelineData, syncToSupabase = true) {
  if (typeof window === 'undefined') return;
  try {
    if (pipelineData.preprocessing_results?.length > LARGE_DATASET_THRESHOLD) {
      await savePreprocessingResults(pipelineData.preprocessing_results);
    }
    localStorage.removeItem(PIPELINE_STORAGE_KEY);
    const hasDatasetPayload = Array.isArray(pipelineData.tweets);
    if (hasDatasetPayload) {
      saveDataset(pipelineData.tweets);
    }
    localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(compactPipeline(pipelineData)));
    window.dispatchEvent(new Event('sentiknn-pipeline-updated'));

    if (syncToSupabase) {
      const supabaseResult = await saveCompletePipelineToSupabase(pipelineData);
      return supabaseResult;
    }
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      localStorage.removeItem(PIPELINE_STORAGE_KEY);
      window.dispatchEvent(new Event('sentiknn-pipeline-updated'));
      return { success: false, reason: 'browser_storage_limited', message: 'Detail proses terlalu besar untuk penyimpanan browser. Data mentah tetap tersimpan.' };
    }
    console.error('Gagal menyimpan pipeline ke storage:', e);
  }
}

export async function syncStoredPipelineToSupabase(onProgress) {
  const dataset = getStoredDataset();
  if (dataset.length === 0) {
    return { success: false, message: 'Tidak ada dataset lokal yang dapat disinkronkan.' };
  }

  const stored = getStoredPipeline() || {};
  let preprocessingResults = stored.preprocessing_results || [];
  if (preprocessingResults.length !== dataset.length) {
    preprocessingResults = await getPreprocessingResults();
  }

  let tweets = dataset;
  if (preprocessingResults.length !== dataset.length) {
    const chunks = [];
    for (let index = 0; index < dataset.length; index += 20) {
      chunks.push(dataset.slice(index, index + 20));
    }
    preprocessingResults = [];
    tweets = [];
    for (let index = 0; index < chunks.length; index += 1) {
      onProgress?.(`Memproses ulang data ${index + 1} dari ${chunks.length} untuk sinkronisasi.`);
      const response = await apiPreprocessBatch(chunks[index], true);
      if (!response.success) throw new Error(response.error || 'Preprocessing untuk sinkronisasi gagal.');
      preprocessingResults.push(...response.results);
      tweets.push(...(response.data || []));
    }
  }

  const stems = new Map(preprocessingResults.map((item) => [String(item.tweet_id), item.stemmed_text || '']));
  tweets = tweets.map((item) => ({ ...item, stemmed: stems.get(String(item.id)) || item.stemmed || '' }));
  onProgress?.('Membangun kembali vektor TF-IDF untuk database.');
  const tfidf = await apiTfidf(tweets, 3000, true);
  if (!tfidf.success) throw new Error(tfidf.error || 'Perhitungan TF-IDF untuk sinkronisasi gagal.');

  const payload = { ...stored, total: tweets.length, tweets, preprocessing_results: preprocessingResults, tfidf };
  const result = await saveCompletePipelineToSupabase(payload);
  if (result.success) {
    await savePipeline(payload, false);
  }
  return result;
}

/**
 * Update a single item in the dataset and pipeline
 */
export function updateDatasetItem(id, updates) {
  const current = getStoredDataset();
  const updated = current.map((item) => (item.id === id ? { ...item, ...updates, label_source: 'manual', auto_labeled: false } : item));
  saveDataset(updated);

  const pipeline = getStoredPipeline();
  if (pipeline) {
    if (pipeline.tweets) {
      pipeline.tweets = pipeline.tweets.map((item) => (item.id === id ? { ...item, ...updates, label_source: 'manual', auto_labeled: false } : item));
    }
    pipeline.split = null;
    pipeline.knn = null;
    pipeline.evaluation = {
      status: 'not_evaluated',
      message: 'Label manual berubah. Jalankan kembali split, klasifikasi, dan evaluasi.',
    };
    localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(pipeline));
    window.dispatchEvent(new Event('sentiknn-pipeline-updated'));
  }

  return updated;
}

/**
 * Clear all dataset and pipeline data
 */
export function clearDataset() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DATASET_STORAGE_KEY);
    localStorage.removeItem(PIPELINE_STORAGE_KEY);
    clearLargePipelineDetails().catch((error) => console.error('Gagal menghapus detail besar:', error));
    window.dispatchEvent(new Event('sentiknn-dataset-updated'));
    window.dispatchEvent(new Event('sentiknn-pipeline-updated'));
  } catch (e) {
    console.error('Gagal mengosongkan dataset:', e);
  }
}

/**
 * Check if pipeline data is available
 */
export function hasPipelineData() {
  const p = getStoredPipeline();
  return Boolean(p && p.total && p.total > 0);
}

/**
 * Calculate dataset summary counts
 */
export function getDatasetSummary(dataset = getStoredDataset()) {
  const currentData = Array.isArray(dataset) ? dataset : [];
  const total = currentData.length;
  let positif = 0;
  let negatif = 0;
  let netral = 0;
  let unlabeled = 0;

  currentData.forEach((row) => {
    const lbl = (row.label || '').trim().toLowerCase();
    if (lbl === 'positif') positif++;
    else if (lbl === 'negatif') negatif++;
    else if (lbl === 'netral') netral++;
    else unlabeled++;
  });

  const labeledTotal = positif + negatif + netral;
  const trainCount = labeledTotal > 0 ? Math.round(labeledTotal * 0.8) : 0;
  const testCount = labeledTotal > 0 ? labeledTotal - trainCount : 0;

  const dates = currentData.map((d) => d.tanggal).filter(Boolean).sort();
  const dateRange = dates.length > 0 ? `${dates[0]} s/d ${dates[dates.length - 1]}` : 'Belum ada data';

  return {
    total,
    labeledTotal,
    labeled_total: labeledTotal,
    unlabeled,
    positif,
    negatif,
    netral,
    trainCount,
    testCount,
    dateRange,
    pos_pct: labeledTotal > 0 ? Math.round((positif / labeledTotal) * 100) : 0,
    neg_pct: labeledTotal > 0 ? Math.round((negatif / labeledTotal) * 100) : 0,
    net_pct: labeledTotal > 0 ? Math.round((netral / labeledTotal) * 100) : 0,
  };
}
