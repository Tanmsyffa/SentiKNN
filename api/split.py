"""
Split Data Endpoint (80:20 Stratified)
POST /api/split
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from sklearn.model_selection import train_test_split

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib.validation import CLASSES, evaluation_mode, labeled_items_for_mode, mode_metadata, validated_dataset, validated_options


def process_split(body):
    """Split labeled dataset into train/test (80:20 stratified)."""
    dataset = validated_dataset(body)
    _, ratio = validated_options(body)
    mode = evaluation_mode(body)
    labeled = labeled_items_for_mode(dataset, mode)
    if len(labeled) < 4:
        return {"error": "Minimal empat dokumen berlabel diperlukan untuk split."}, 422
    labels = [d["label"] for d in labeled]
    if len(set(labels)) < 2 or any(labels.count(label) < 2 for label in set(labels)):
        return {"error": "Split stratified memerlukan minimal dua kelas dan sedikitnya dua dokumen per kelas."}, 422
    try:
        train_data, test_data = train_test_split(
            labeled, test_size=(1 - ratio), stratify=labels, random_state=42
        )
    except ValueError as error:
        return {"error": f"Split stratified tidak dapat dijalankan: {error}"}, 422
    def count_labels(data):
        counts = {label: 0 for label in CLASSES}
        for d in data:
            lbl = d.get("label", "")
            if lbl in counts:
                counts[lbl] += 1
        return counts

    return {
        "success": True,
        "train": train_data,
        "test": test_data,
        "train_count": len(train_data),
        "test_count": len(test_data),
        "total_labeled": len(labeled),
        "train_distribution": count_labels(train_data),
        "test_distribution": count_labels(test_data),
        **mode_metadata(mode),
    }, 200


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        try:
            result, status = process_split(body)
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
