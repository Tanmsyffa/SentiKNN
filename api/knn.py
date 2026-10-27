"""Endpoint klasifikasi KNN untuk data berlabel manual."""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib.model import evaluate_knn
from _lib.nlp import batch_preprocess_dataset
from _lib.validation import evaluation_mode, labeled_items_for_mode, mode_metadata, validated_dataset, validated_options


def process_knn(body):
    dataset = validated_dataset(body)
    k, ratio = validated_options(body)
    mode = evaluation_mode(body)
    items = labeled_items_for_mode(dataset, mode)
    if not items:
        return {"error": "Klasifikasi KNN membutuhkan data berlabel."}, 422
    raw_texts = [str(item.get("teks", "")).strip() for item in items]
    texts = [str(item.get("stemmed") or item.get("stemmed_text") or "").strip() for item in items]
    missing_indices = [index for index, text in enumerate(texts) if not text]
    if missing_indices:
        processed = batch_preprocess_dataset([raw_texts[index] for index in missing_indices])
        for index, result in zip(missing_indices, processed):
            texts[index] = " ".join(result["step_7_stemming"]) or raw_texts[index].lower()
    labels = [item["label"] for item in items]
    record_ids = [item.get("id") or f"X{index + 1:04d}" for index, item in enumerate(items)]
    result = evaluate_knn(texts, labels, record_ids, raw_texts, k, ratio)
    correct_count = sum(item["is_correct"] for item in result["results_records"])
    result.update({
        "success": True,
        "results": result["results_records"],
        "correct_count": correct_count,
        "incorrect_count": result["test_size"] - correct_count,
        "predictions_distribution": {
            label: sum(item["predicted_label"] == label for item in result["results_records"])
            for label in ("Positif", "Negatif", "Netral")
        },
        **mode_metadata(mode),
    })
    return result, 200


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 10 * 1024 * 1024:
                self.send_error(413, "Payload terlalu besar")
                return
            body = json.loads(self.rfile.read(content_length)) if content_length else {}
            result, status = process_knn(body)
        except ValueError as error:
            result, status = {"error": str(error)}, 422
        except Exception:
            result, status = {"error": "Server gagal menjalankan klasifikasi."}, 500
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
