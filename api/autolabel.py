"""
Automated Sentiment Labeling Endpoint
POST /api/autolabel and /api/label-auto
Melabeli data sentimen secara otomatis berdasarkan leksikon InSet (IEEE 2017) dan ID-OpinionWords
"""

import json
import sys
import os
from http.server import BaseHTTPRequestHandler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib.nlp import (
    step_1_data_asli,
    step_2_cleaning,
    step_3_casefolding,
    step_4_normalisasi,
    step_5_tokenizing,
    step_6_stopword,
)
from _lib.lexicon import score_sentiment


def process_autolabel(body):
    """
    Melakukan pelabelan otomatis berbasis leksikon pada dataset.
    Hanya mengisi label pada data yang belum dilabeli (atau semua jika overwrite=True).
    """
    dataset = body.get("dataset", [])
    overwrite = bool(body.get("overwrite", False))

    if not dataset:
        return {"error": "Dataset kosong. Silakan unggah dataset terlebih dahulu."}, 400

    classes = ["Positif", "Negatif", "Netral"]
    updated_dataset = []
    labeled_count = 0
    auto_count = 0
    manual_count = 0

    for idx, item in enumerate(dataset):
        existing_label = (item.get("label") or "").strip()
        raw_text = str(item.get("teks", "")).strip()
        if existing_label in classes and not overwrite:
            source = item.get("label_source") or ("lexicon" if item.get("auto_labeled") else "manual")
            updated_dataset.append({**item, "label_source": source, "auto_labeled": source == "lexicon"})
            labeled_count += 1
            if source == "manual":
                manual_count += 1
            continue
        s1 = step_1_data_asli(raw_text)
        s2 = step_2_cleaning(s1)
        s3 = step_3_casefolding(s2)
        s4 = step_4_normalisasi(s3)
        tokens = step_5_tokenizing(s4)
        clean_tokens = step_6_stopword(tokens)
        scoring = score_sentiment(clean_tokens)
        assigned_label = scoring["label"]

        updated_item = {
            **item,
            "label": assigned_label,
            "label_source": "lexicon",
            "auto_labeled": True,
            "lexicon_score": scoring["score"],
            "lexicon_strength": scoring["polarity_strength"],
            "lexicon_match_count": scoring["matched_term_count"],
            "matched_pos": scoring["pos_matches"],
            "matched_neg": scoring["neg_matches"],
        }
        updated_dataset.append(updated_item)
        auto_count += 1
        labeled_count += 1
    pos_cnt = sum(1 for d in updated_dataset if d.get("label") == "Positif")
    neg_cnt = sum(1 for d in updated_dataset if d.get("label") == "Negatif")
    net_cnt = sum(1 for d in updated_dataset if d.get("label") == "Netral")

    return {
        "success": True,
        "total": len(updated_dataset),
        "auto_labeled_count": auto_count,
        "already_labeled_count": len(updated_dataset) - auto_count,
        "manual_labeled_count": manual_count,
        "skipped_existing_labels": len(updated_dataset) - auto_count,
        "distribution": {
            "Positif": pos_cnt,
            "Negatif": neg_cnt,
            "Netral": net_cnt,
        },
        "source": "InSet Lexicon (Koto & Rahmaningtyas, IEEE 2017) and ID-OpinionWords (Masdevid)",
        "data": updated_dataset,
    }, 200


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        try:
            result, status = process_autolabel(body)
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
