"""
Batch Preprocessing Endpoint
POST /api/preprocessing and /api/preprocess-all
Memproses seluruh dataset secara batch
"""


import json
import sys
import os
from http.server import BaseHTTPRequestHandler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib.nlp import batch_preprocess_dataset
from _lib.lexicon import score_sentiment


def process_batch(body):
    """Run high-performance concurrent preprocessing on entire dataset."""
    dataset = body.get("dataset", [])
    auto_label = bool(body.get("auto_label", False))

    if not dataset or len(dataset) == 0:
        return {"error": "Dataset kosong. Unggah file dataset terlebih dahulu."}, 400

    texts = [str(item.get("teks", "")).strip() for item in dataset]
    batch_res = batch_preprocess_dataset(texts)

    results = []
    labeled_data = []
    classes = {"Positif", "Negatif", "Netral"}
    for item, pipeline in zip(dataset, batch_res):
        results.append({
            "id": item.get("id", ""),
            "tweet_id": item.get("id", ""),
            "label": item.get("label", ""),
            **pipeline,
            "stemmed_text": " ".join(pipeline.get("step_7_stemming", [])),
        })

        if auto_label:
            existing_label = str(item.get("label") or "").strip()
            existing_source = item.get("label_source") or ("lexicon" if item.get("auto_labeled") else "manual")
            if existing_label in classes and existing_source == "manual" and not item.get("auto_labeled", False):
                labeled_data.append({**item, "label_source": "manual", "auto_labeled": False})
                continue
            scoring = score_sentiment(pipeline["step_6_stopword"])
            labeled_data.append({
                **item,
                "label": scoring["label"],
                "label_source": "lexicon",
                "auto_labeled": True,
                "lexicon_score": scoring["score"],
                "lexicon_strength": scoring["polarity_strength"],
                "lexicon_match_count": scoring["matched_term_count"],
                "matched_pos": scoring["pos_matches"],
                "matched_neg": scoring["neg_matches"],
            })

    response = {"success": True, "results": results, "total": len(results)}
    if auto_label:
        response["data"] = labeled_data
    return response, 200


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        try:
            result, status = process_batch(body)
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
