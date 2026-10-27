"""
TF-IDF Feature Extraction Endpoint
POST /api/tfidf
"""

import json
import sys
import os
from http.server import BaseHTTPRequestHandler
from sklearn.feature_extraction.text import TfidfVectorizer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib.nlp import batch_preprocess_dataset


def process_tfidf(body):
    """Compute TF-IDF matrix from preprocessed dataset using scikit-learn."""
    dataset = body.get("dataset", [])
    max_features = body.get("max_features", 50)
    include_records = bool(body.get("include_records", False))

    if not dataset:
        return {"error": "Dataset kosong. Silakan unggah dataset terlebih dahulu."}, 400

    doc_ids = []
    doc_texts = []
    items_to_process = []
    raw_texts = []

    for item in dataset:
        teks = item.get("teks", "")
        if not teks:
            continue
        stemmed = (
            item.get("stemmed")
            or item.get("stemmed_text")
            or (" ".join(item.get("step_7_stemming", [])) if isinstance(item.get("step_7_stemming"), list) else None)
        )
        if stemmed and str(stemmed).strip():
            doc_ids.append(item.get("id", ""))
            doc_texts.append(str(stemmed).strip())
        else:
            items_to_process.append(item)
            raw_texts.append(str(teks).strip())

    if raw_texts:
        batch_res = batch_preprocess_dataset(raw_texts)
        for it, prep in zip(items_to_process, batch_res):
            stemmed_text = " ".join(prep.get("step_7_stemming", []))
            if stemmed_text.strip():
                doc_ids.append(it.get("id", ""))
                doc_texts.append(stemmed_text)

    if len(doc_texts) == 0:
        return {"error": "Tidak ada dokumen valid setelah tahap preprocessing."}, 400
    vectorizer = TfidfVectorizer(max_features=max_features)
    tfidf_matrix = vectorizer.fit_transform(doc_texts)
    feature_names = vectorizer.get_feature_names_out().tolist()
    term_sums = tfidf_matrix.sum(axis=0).A1
    ranked_indices = term_sums.argsort()[::-1]
    display_indices = ranked_indices[:10].tolist()
    display_features = [feature_names[index] for index in display_indices]
    sample_size = min(10, len(doc_ids))
    sample_matrix = []
    for i in range(sample_size):
        row = {"dokumen": doc_ids[i]}
        for word, col_idx in zip(display_features, display_indices):
            val = tfidf_matrix[i, col_idx]
            row[word] = round(float(val), 4)
        sample_matrix.append(row)
    term_frequencies = []
    for idx, word in enumerate(feature_names):
        term_frequencies.append({
            "term": word,
            "weight_sum": round(float(term_sums[idx]), 4),
        })
    term_frequencies.sort(key=lambda x: x["weight_sum"], reverse=True)

    tfidf_records = []
    if include_records:
        for index, row in enumerate(tfidf_matrix):
            vector = {
                feature_names[column]: round(float(value), 4)
                for column, value in zip(row.indices, row.data)
                if value > 0.001
            }
            tfidf_records.append({"tweet_id": doc_ids[index], "feature_vector": vector})

    return {
        "success": True,
        "total_documents": len(doc_texts),
        "total_vocabulary": len(feature_names),
        "feature_names": display_features,
        "all_features": feature_names,
        "top_terms": term_frequencies[:20],
        "sample_matrix": sample_matrix,
        "matrix_shape": [tfidf_matrix.shape[0], tfidf_matrix.shape[1]],
        "tfidf_records": tfidf_records,
    }, 200


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        try:
            result, status = process_tfidf(body)
        except Exception as e:
            result, status = {"error": str(e)}, 500

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
