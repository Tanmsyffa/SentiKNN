"""
Dashboard Analytics Endpoint
POST /api/dashboard
"""

import base64
import io
import json
import sys
import os
from http.server import BaseHTTPRequestHandler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib.nlp import batch_preprocess_dataset
from wordcloud import WordCloud


def process_dashboard(body):
    """Aggregate statistics, sentiment trends, topics, and word frequencies."""
    dataset = body.get("dataset", [])

    total = len(dataset)
    positif = sum(1 for d in dataset if d.get("label") == "Positif")
    negatif = sum(1 for d in dataset if d.get("label") == "Negatif")
    netral = sum(1 for d in dataset if d.get("label") == "Netral")
    labeled_total = positif + negatif + netral
    unlabeled = total - labeled_total

    train_count = round(labeled_total * 0.8) if labeled_total > 0 else 0
    test_count = labeled_total - train_count if labeled_total > 0 else 0

    pos_pct = round((positif / labeled_total) * 100, 2) if labeled_total > 0 else 0
    neg_pct = round((negatif / labeled_total) * 100, 2) if labeled_total > 0 else 0
    net_pct = round((netral / labeled_total) * 100, 2) if labeled_total > 0 else 0
    dates = sorted([str(d.get("tanggal", ""))[:10] for d in dataset if d.get("tanggal")])
    date_range = f"{dates[0]} s/d {dates[-1]}" if dates else "Belum ada data"
    date_sentiment = {}
    for d in dataset:
        tgl = str(d.get("tanggal", ""))[:10]
        lbl = d.get("label", "")
        if tgl and lbl in ("Positif", "Negatif", "Netral"):
            if tgl not in date_sentiment:
                date_sentiment[tgl] = {"Positif": 0, "Negatif": 0, "Netral": 0}
            date_sentiment[tgl][lbl] += 1

    sorted_dates = sorted(date_sentiment.keys())[:15]
    trend = {
        "labels": sorted_dates,
        "positif": [date_sentiment[d]["Positif"] for d in sorted_dates],
        "negatif": [date_sentiment[d]["Negatif"] for d in sorted_dates],
        "netral": [date_sentiment[d]["Netral"] for d in sorted_dates],
    }
    word_count = {}
    corpus_dataset = dataset[:10_000]
    unstemmed_sample = []

    for d in corpus_dataset:
        stemmed = (
            d.get("stemmed")
            or d.get("stemmed_text")
            or (" ".join(d.get("step_7_stemming", [])) if isinstance(d.get("step_7_stemming"), list) else None)
        )
        if stemmed and str(stemmed).strip():
            for w in str(stemmed).split():
                if w and len(w) > 2:
                    word_count[w] = word_count.get(w, 0) + 1
        else:
            teks = d.get("teks", "")
            if teks:
                unstemmed_sample.append(str(teks).strip())

    if unstemmed_sample:
        batch_res = batch_preprocess_dataset(unstemmed_sample)
        for prep in batch_res:
            for w in prep.get("step_7_stemming", []):
                if w and len(w) > 2:
                    word_count[w] = word_count.get(w, 0) + 1

    sorted_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)
    top_topics = [{"name": w, "count": c} for w, c in sorted_words[:5]]
    word_cloud = [{"text": w, "count": c} for w, c in sorted_words[:25]]
    word_cloud_image = None
    if word_count:
        cloud = WordCloud(
            width=1200,
            height=420,
            background_color="white",
            colormap="viridis",
            max_words=80,
            prefer_horizontal=0.85,
            collocations=False,
            random_state=42,
        ).generate_from_frequencies(word_count)
        image_buffer = io.BytesIO()
        cloud.to_image().save(image_buffer, format="PNG", optimize=True)
        word_cloud_image = "data:image/png;base64," + base64.b64encode(image_buffer.getvalue()).decode("ascii")

    return {
        "success": True,
        "stats": {
            "total": total,
            "labeled_total": labeled_total,
            "unlabeled": unlabeled,
            "positif": positif,
            "negatif": negatif,
            "netral": netral,
            "pos_pct": pos_pct,
            "neg_pct": neg_pct,
            "net_pct": net_pct,
            "train_count": train_count,
            "test_count": test_count,
            "date_range": date_range,
        },
        "trend": trend,
        "top_topics": top_topics,
        "word_cloud": word_cloud,
        "word_cloud_image": word_cloud_image,
    }, 200


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        try:
            result, status = process_dashboard(body)
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
