/**
 * Supabase Database Integration Service
 * Saves and retrieves pipeline data across Supabase tables
 */


import { apiSupabaseStatus, apiSupabaseSync } from './api';

function databaseDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (!match || Number.isNaN(Date.parse(`${match[0]}T00:00:00Z`))) return null;
  return match[0];
}

function uniqueByTweetId(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = String(record.tweet_id || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Check if Supabase is connected and tables exist
 */
export async function checkSupabaseConnection() {
  try {
    return await apiSupabaseStatus();
  } catch (err) {
    return {
      connected: false,
      tablesExist: false,
      message: `Gagal memeriksa Supabase melalui backend: ${err.message}`,
    };
  }
}

/**
 * Save complete pipeline results to all 6 Supabase tables
 */
export async function saveCompletePipelineToSupabase(pipelineData) {
  const errors = [];
  const runId = crypto.randomUUID();
  const sendBatches = async (table, records) => {
    const uniqueRecords = table === 'evaluation_metrics' ? records : uniqueByTweetId(records);
    for (let index = 0; index < uniqueRecords.length; index += 50) {
      await apiSupabaseSync(table, uniqueRecords.slice(index, index + 50));
    }
  };

  // 1. Save Tweets (Data Asli)
  try {
    const tweetsPayload = (pipelineData.tweets || []).map((t) => ({
      run_id: runId,
      tweet_id: t.id,
      tanggal: databaseDate(t.tanggal),
      teks_asli: t.teks,
      sumber: t.sumber || 'X',
      label: t.label || 'Netral',
      label_source: t.label_source === 'manual' ? 'manual' : 'lexicon',
    }));
    await sendBatches('tweets', tweetsPayload);
  } catch (err) {
    return {
      success: false,
      partial: true,
      errors: [`Gagal simpan tweets: ${err.message}`],
      message: 'Sinkronisasi dihentikan sebelum tabel hasil ditulis agar relasi data tetap konsisten.',
    };
  }

  // 2. Save Preprocessing Results (7 Tahap Sesuai Spesifikasi)
  try {
    const prepPayload = (pipelineData.preprocessing_results || []).map((p) => ({
      run_id: runId,
      tweet_id: p.tweet_id,
      step_1_asli: p.step_1_asli || '',
      step_2_cleaning: p.step_2_cleaning || '',
      step_3_casefolding: p.step_3_casefolding || '',
      step_4_normalisasi: p.step_4_normalisasi || '',
      step_5_tokenizing: p.step_5_tokenizing || [],
      step_6_stopword: p.step_6_stopword || [],
      step_7_stemming: p.step_7_stemming || [],
    }));
    await sendBatches('preprocessing_results', prepPayload);
  } catch (err) {
    errors.push(`Gagal simpan preprocessing_results: ${err.message}`);
  }

  // 3. Save Split Data (Train / Test)
  try {
    const splitRecords = pipelineData.split?.split_records || [];
    if (splitRecords.length > 0) {
      const splitPayload = splitRecords.map((s) => ({
        run_id: runId,
        tweet_id: s.tweet_id,
        split_type: s.split_type,
      }));
      await sendBatches('split_data', splitPayload);
    }
  } catch (err) {
    errors.push(`Gagal simpan split_data: ${err.message}`);
  }

  // 4. Save TF-IDF Matrix (Fitur Vektor)
  try {
    const tfidfRecords = pipelineData.tfidf?.tfidf_records || [];
    if (tfidfRecords.length > 0) {
      const tfidfPayload = tfidfRecords.map((tf) => ({
        run_id: runId,
        tweet_id: tf.tweet_id,
        feature_vector: tf.feature_vector || {},
      }));
      await sendBatches('tfidf_matrix', tfidfPayload);
    }
  } catch (err) {
    errors.push(`Gagal simpan tfidf_matrix: ${err.message}`);
  }

  // 5. Save KNN Classification Results
  try {
    const knnRecords = pipelineData.knn?.results_records || [];
    if (knnRecords.length > 0) {
      const knnPayload = knnRecords.map((k) => ({
        run_id: runId,
        tweet_id: k.tweet_id,
        k_value: k.k_value || 5,
        distance_metric: k.distance_metric || 'Euclidean',
        neighbors: k.neighbors || [],
        predicted_label: k.predicted_label,
        actual_label: k.actual_label,
        is_correct: k.is_correct,
      }));
      await sendBatches('knn_results', knnPayload);
    }
  } catch (err) {
    errors.push(`Gagal simpan knn_results: ${err.message}`);
  }

  // 6. Save Evaluation Metrics
  try {
    const ev = pipelineData.evaluation;
    if (ev?.status === 'evaluated' && ev.accuracy !== undefined) {
      await apiSupabaseSync('evaluation_metrics', [{
        run_id: runId,
        k_value: ev.k || 5,
        accuracy: ev.accuracy,
        precision_score: ev.precision || 0,
        recall: ev.recall || 0,
        f1_score: ev.f1_score || 0,
        confusion_matrix: ev.confusion_matrix || {},
        evaluation_mode: ev.evaluation_mode || 'manual',
        ground_truth: ev.ground_truth || 'manual',
        disclaimer: ev.disclaimer || '',
      }]);
    }
  } catch (err) {
    errors.push(`Gagal simpan evaluation_metrics: ${err.message}`);
  }

  if (errors.length > 0) {
    return {
      success: false,
      partial: true,
      errors,
      message: 'Sebagian data berhasil disimpan ke Supabase dengan beberapa catatan.',
    };
  }

  return {
    success: true,
    runId,
    message: 'Seluruh data mentah dan hasil pipeline NLP/ML berhasil disimpan ke Supabase!',
  };
}

