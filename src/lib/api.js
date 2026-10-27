/**
 * Frontend API Client for Python Backend
 * Connects Next.js pages to Python serverless functions / Flask dev server
 */


// Get appropriate API base URL
// In development browser, connect directly to Python Flask server on port 5000
// to eliminate Next.js dev-server Node proxy socket hang up / ECONNRESET
function getApiUrl(endpoint) {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:5000/api${endpoint}`;
    }
  }
  return `/api${endpoint}`;
}

async function postJSON(endpoint, data, timeoutMs = 240000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const primaryUrl = getApiUrl(endpoint);

  try {
    let res;
    try {
      res = await fetch(primaryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      // Fallback to Next.js rewrite route if direct fetch to port 5000 failed
      if (primaryUrl !== `/api${endpoint}`) {
        res = await fetch(`/api${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          signal: controller.signal,
        });
      } else {
        throw fetchErr;
      }
    }

    clearTimeout(timer);

    const rawText = await res.text();
    let json;
    try {
      json = JSON.parse(rawText);
    } catch (parseErr) {
      if (!res.ok) {
        throw new Error(`Server error (${res.status}): Pastikan backend Python berjalan di port 5000.`);
      }
      throw new Error(`Format respons server tidak valid: ${rawText.slice(0, 100)}`);
    }

    if (!res.ok) {
      throw new Error(json.error || `HTTP error ${res.status}`);
    }
    return json;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Request timeout. Periksa backend Python lalu coba ulang batch yang gagal.');
    }
    throw err;
  }
}

/**
 * Upload dataset (Excel .xlsx / .xls via base64 or CSV text)
 */
export async function apiUpload({ fileBase64, filename, csvText }) {
  return postJSON('/upload', {
    file_base64: fileBase64,
    filename,
    csv_text: csvText,
  });
}

/**
 * Automatically label dataset using InSet Lexicon (Koto & Rahmaningtyas, IEEE 2017)
 */
export async function apiAutolabel(dataset, overwrite = false) {
  return postJSON('/autolabel', { dataset, overwrite });
}

/**
 * Run 7-step preprocessing on all texts in dataset (batch mode)
 */
export async function apiPreprocessBatch(dataset, autoLabel = false) {
  return postJSON('/preprocessing', { dataset, auto_label: autoLabel });
}

/**
 * Split dataset into 80:20 train/test stratified using scikit-learn
 */
export async function apiSplit(dataset, ratio = 0.8, evaluationMode = 'manual') {
  return postJSON('/split', { dataset, ratio, evaluation_mode: evaluationMode });
}

/**
 * Compute TF-IDF matrix using scikit-learn for all corpus documents
 */
export async function apiTfidf(dataset, maxFeatures = 50, includeRecords = false) {
  return postJSON('/tfidf', {
    dataset,
    max_features: maxFeatures,
    include_records: includeRecords,
  }, 300000);
}

/**
 * Run KNN classification on the entire test dataset (batch mode)
 */
export async function apiKNN(dataset, k = 5, ratio = 0.8, evaluationMode = 'manual') {
  return postJSON('/knn', { dataset, k, ratio, evaluation_mode: evaluationMode }, 300000);
}

/**
 * Run full evaluation (accuracy, precision, recall, f1, confusion matrix)
 */
export async function apiEvaluate(dataset, k = 5, ratio = 0.8, evaluationMode = 'manual') {
  return postJSON('/evaluate', { dataset, k, ratio, evaluation_mode: evaluationMode }, 300000);
}

/**
 * Aggregate dashboard statistics, trends, and word cloud
 */
export async function apiDashboard(dataset) {
  return postJSON('/dashboard', { dataset });
}

export async function apiSupabaseSync(table, records) {
  const localEndpoint = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  return postJSON(localEndpoint ? '/supabase-sync' : '/supabase_sync', { table, records }, 60000);
}

export async function apiSupabaseStatus() {
  const localEndpoint = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  return postJSON(localEndpoint ? '/supabase-sync' : '/supabase_sync', { action: 'status' }, 15000);
}

/**
 * Run full automated end-to-end pipeline in one request:
 * Preprocessing -> Labeling -> Split -> TF-IDF -> KNN -> Evaluation
 */
export async function apiRunPipeline(dataset, k = 5, ratio = 0.8) {
  // Pipeline processes all documents (stemming can take 1-3 min for 300+ docs)
  // Use 5-minute timeout to prevent premature abort
  return postJSON('/pipeline', { dataset, k, ratio }, 300000);
}

export async function apiRunPipelineStaged(dataset, k = 5, ratio = 0.8, onProgress) {
  const chunkSize = 20;
  const chunks = [];
  for (let start = 0; start < dataset.length; start += chunkSize) {
    chunks.push(dataset.slice(start, start + chunkSize));
  }
  const preprocessingResults = [];
  const labeledData = [];

  for (let index = 0; index < chunks.length; index += 1) {
    onProgress?.(`Preprocessing dan pelabelan batch ${index + 1} dari ${chunks.length}`);
    const preprocessing = await apiPreprocessBatch(chunks[index], true);
    if (!preprocessing.success) throw new Error(preprocessing.error || 'Preprocessing batch gagal.');
    preprocessingResults.push(...preprocessing.results);
    labeledData.push(...(preprocessing.data || []));
  }

  const stemmedById = new Map(preprocessingResults.map((item) => [String(item.tweet_id), item.stemmed_text || '']));
  const tweets = labeledData.map((item) => ({ ...item, stemmed: stemmedById.get(String(item.id)) || '' }));
  onProgress?.('Menghitung TF-IDF korpus');
  const tfidf = await apiTfidf(tweets, 3000, true);
  if (!tfidf.success) throw new Error(tfidf.error || 'Perhitungan TF-IDF gagal.');

  const manual = tweets.filter((item) => item.label && item.label_source !== 'lexicon' && !item.auto_labeled);
  let split = { train_count: 0, test_count: 0, train_distribution: {}, test_distribution: {}, split_records: [] };
  let knn = { k, sample: null, results_records: [] };
  let evaluation = { status: 'not_evaluated', message: 'Label pakar belum mencukupi untuk evaluasi.', k, accuracy: 0, precision: 0, recall: 0, f1_score: 0 };
  if (manual.length >= 5) {
    onProgress?.('Membagi data pakar dan mengevaluasi KNN');
    try {
      const splitResponse = await apiSplit(tweets, ratio, 'manual');
      const evaluationResponse = await apiEvaluate(tweets, k, ratio, 'manual');
      split = {
        ...splitResponse,
        split_records: [
          ...(splitResponse.train || []).map((item) => ({ tweet_id: item.id, split_type: 'train' })),
          ...(splitResponse.test || []).map((item) => ({ tweet_id: item.id, split_type: 'test' })),
        ],
      };
      knn = { k: evaluationResponse.k, sample: evaluationResponse.results_records?.[0] || null, results_records: evaluationResponse.results_records || [] };
      evaluation = { status: 'evaluated', ...evaluationResponse };
    } catch (error) {
      evaluation = { ...evaluation, message: error.message };
    }
  }

  const counts = tweets.reduce((total, item) => ({ ...total, [item.label]: (total[item.label] || 0) + 1 }), {});
  const dates = tweets.map((item) => item.tanggal).filter(Boolean).sort();
  return {
    success: true,
    total: tweets.length,
    tweets,
    preprocessing_results: preprocessingResults,
    tfidf,
    split,
    knn,
    evaluation,
    summary: {
      total: tweets.length,
      labeled_total: tweets.length,
      manual_labeled: manual.length,
      auto_labeled: tweets.length - manual.length,
      positif: counts.Positif || 0,
      negatif: counts.Negatif || 0,
      netral: counts.Netral || 0,
      pos_pct: tweets.length ? Math.round((counts.Positif || 0) * 1000 / tweets.length) / 10 : 0,
      neg_pct: tweets.length ? Math.round((counts.Negatif || 0) * 1000 / tweets.length) / 10 : 0,
      net_pct: tweets.length ? Math.round((counts.Netral || 0) * 1000 / tweets.length) / 10 : 0,
      train_count: split.train_count || 0,
      test_count: split.test_count || 0,
      date_range: dates.length ? `${dates[0]} s/d ${dates[dates.length - 1]}` : 'Belum ada tanggal',
    },
  };
}
