"""Endpoint evaluasi KNN menggunakan label manual sebagai ground truth."""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib.model import evaluate_knn
from _lib.nlp import batch_preprocess_dataset
from _lib.validation import evaluation_mode, labeled_items_for_mode, mode_metadata, validated_dataset, validated_options


def process_evaluate(body):
    dataset = validated_dataset(body)
    k, ratio = validated_options(body)
    mode = evaluation_mode(body)
    labeled_items = labeled_items_for_mode(dataset, mode)
    if not labeled_items:
        return {"error": "Evaluasi membutuhkan data berlabel.", "labeled_total": 0}, 422
    texts = []
    raw_texts = []
    labels = []
    record_ids = []
    unprocessed_indices = []
    for index, item in enumerate(labeled_items):
        text = str(item.get("stemmed") or item.get("stemmed_text") or "").strip()
        texts.append(text)
        raw_texts.append(str(item.get("teks", "")).strip())
        labels.append(item["label"])
        record_ids.append(item.get("id") or f"X{index + 1:04d}")
        if not text:
            unprocessed_indices.append(index)
    if unprocessed_indices:
        processed = batch_preprocess_dataset([raw_texts[index] for index in unprocessed_indices])
        for index, result in zip(unprocessed_indices, processed):
            texts[index] = " ".join(result["step_7_stemming"]) or raw_texts[index].lower()
    result = evaluate_knn(texts, labels, record_ids, raw_texts, k, ratio)
    result.update({"success": True, "status": "evaluated", "method": "Stratified holdout 80:20, TF-IDF fit on data latih, KNN Euclidean", **mode_metadata(mode)})
    return result, 200


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 10 * 1024 * 1024:
                self.send_error(413, "Payload terlalu besar")
                return
            body = json.loads(self.rfile.read(content_length)) if content_length else {}
            result, status = process_evaluate(body)
        except ValueError as error:
            result, status = {"error": str(error)}, 422
        except Exception:
            result, status = {"error": "Server gagal menjalankan evaluasi."}, 500
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
