"""Pipeline batch preprocessing, pelabelan leksikon, TF-IDF, dan evaluasi KNN."""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

from sklearn.feature_extraction.text import TfidfVectorizer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib.lexicon import score_sentiment
from _lib.model import evaluate_knn
from _lib.nlp import batch_preprocess_dataset
from _lib.validation import CLASSES, is_manual_label, validated_dataset, validated_options


def count_labels(items):
    return {label: sum(item.get("label") == label for item in items) for label in CLASSES}


def empty_evaluation(message, manual_count, k):
    return {
        "status": "not_evaluated",
        "message": message,
        "ground_truth": "manual",
        "accuracy": 0,
        "precision": 0,
        "recall": 0,
        "f1_score": 0,
        "class_metrics": {label: {"precision": 0, "recall": 0, "f1_score": 0, "support": 0} for label in CLASSES},
        "k": k,
        "train_size": 0,
        "test_size": 0,
        "total_labeled": manual_count,
        "confusion_matrix": {"labels": list(CLASSES), "data": [[0, 0, 0] for _ in CLASSES]},
    }


def process_pipeline(body):
    dataset = validated_dataset(body)
    k, ratio = validated_options(body)
    raw_texts = []
    metadata = []
    for index, item in enumerate(dataset, start=1):
        text = str(item.get("teks", "")).strip()
        if not text:
            continue
        raw_texts.append(text)
        metadata.append({
            "id": item.get("id") or f"X{index:04d}",
            "tanggal": str(item.get("tanggal") or "")[:10],
            "teks": text,
            "sumber": item.get("sumber") or "X",
            "username": item.get("username") or "",
            "label": str(item.get("label") or "").strip(),
            "label_source": item.get("label_source"),
            "auto_labeled": bool(item.get("auto_labeled", False)),
        })
    if not raw_texts:
        return {"error": "Tidak ada teks valid untuk diproses."}, 400

    preprocessing = batch_preprocess_dataset(raw_texts)
    tweets = []
    preprocessing_results = []
    corpus = []
    for item, result in zip(metadata, preprocessing):
        stemmed_text = " ".join(result["step_7_stemming"]).strip() or item["teks"].lower()
        manual = item["label"] in CLASSES and item["label_source"] != "lexicon" and not item["auto_labeled"]
        if manual:
            label = item["label"]
            label_source = "manual"
            lexicon_score = None
        else:
            scoring = score_sentiment(result["step_6_stopword"])
            label = scoring["label"]
            label_source = "lexicon"
            lexicon_score = scoring["score"]
        tweets.append({
            "id": item["id"], "tanggal": item["tanggal"], "teks": item["teks"], "sumber": item["sumber"],
            "username": item["username"], "label": label, "label_source": label_source,
            "auto_labeled": label_source == "lexicon", "lexicon_score": lexicon_score,
            "lexicon_strength": scoring["polarity_strength"] if label_source == "lexicon" else None,
            "lexicon_match_count": scoring["matched_term_count"] if label_source == "lexicon" else 0,
            "stemmed": stemmed_text,
        })
        preprocessing_results.append({"tweet_id": item["id"], **result, "stemmed_text": stemmed_text})
        corpus.append(stemmed_text)

    vectorizer = TfidfVectorizer(max_features=3000, sublinear_tf=True, norm="l2")
    matrix = vectorizer.fit_transform(corpus)
    features = vectorizer.get_feature_names_out().tolist()
    feature_weights = matrix.sum(axis=0).A1
    top_terms = [
        {"term": features[index], "weight_sum": round(float(feature_weights[index]), 4)}
        for index in feature_weights.argsort()[::-1][:20]
    ]
    tfidf_records = []
    for index, row in enumerate(matrix):
        vector = {features[column]: round(float(value), 4) for column, value in zip(row.indices, row.data) if value > 0.001}
        tfidf_records.append({"tweet_id": tweets[index]["id"], "feature_vector": vector})
    sample_matrix = []
    display_features = features[:10]
    feature_index = {name: index for index, name in enumerate(features)}
    for index in range(min(10, len(tweets))):
        row = {"dokumen": tweets[index]["id"]}
        for feature in display_features:
            row[feature] = round(float(matrix[index, feature_index[feature]]), 4)
        sample_matrix.append(row)

    manual_indices = [index for index, item in enumerate(tweets) if is_manual_label(item)]
    manual_tweets = [tweets[index] for index in manual_indices]
    try:
        model_result = evaluate_knn(
            [corpus[index] for index in manual_indices],
            [item["label"] for item in manual_tweets],
            [item["id"] for item in manual_tweets],
            [item["teks"] for item in manual_tweets],
            k,
            ratio,
        )
        evaluation = {"status": "evaluated", "ground_truth": "manual", **model_result}
        split_records = [
            {"tweet_id": manual_tweets[index]["id"], "split_type": split_type}
            for split_type, indices in (("train", model_result["train_indices"]), ("test", model_result["test_indices"]))
            for index in indices
        ]
        train_tweets = [manual_tweets[index] for index in model_result["train_indices"]]
        test_tweets = [manual_tweets[index] for index in model_result["test_indices"]]
        knn_records = model_result["results_records"]
    except ValueError as error:
        evaluation = empty_evaluation(str(error), len(manual_tweets), k)
        split_records = []
        train_tweets = []
        test_tweets = []
        knn_records = []

    distribution = count_labels(tweets)
    dates = sorted(item["tanggal"] for item in tweets if item["tanggal"])
    sample = knn_records[0] if knn_records else None
    return {
        "success": True,
        "total": len(tweets),
        "summary": {
            "total": len(tweets), "labeled_total": len(manual_tweets), "manual_labeled": len(manual_tweets),
            "auto_labeled": len(tweets) - len(manual_tweets), "positif": distribution["Positif"], "negatif": distribution["Negatif"],
            "netral": distribution["Netral"], "pos_pct": round(distribution["Positif"] * 100 / len(tweets), 1),
            "neg_pct": round(distribution["Negatif"] * 100 / len(tweets), 1), "net_pct": round(distribution["Netral"] * 100 / len(tweets), 1),
            "train_count": len(train_tweets), "test_count": len(test_tweets), "date_range": f"{dates[0]} s/d {dates[-1]}" if dates else "Belum ada tanggal",
        },
        "tweets": tweets,
        "preprocessing_results": preprocessing_results,
        "split": {"train_count": len(train_tweets), "test_count": len(test_tweets), "train_distribution": count_labels(train_tweets), "test_distribution": count_labels(test_tweets), "split_records": split_records},
        "tfidf": {"total_documents": len(tweets), "total_vocabulary": len(features), "feature_names": display_features, "all_features": features, "top_terms": top_terms, "sample_matrix": sample_matrix, "tfidf_records": tfidf_records},
        "knn": {"k": evaluation["k"], "sample": sample, "results_records": knn_records},
        "evaluation": evaluation,
    }, 200


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 10 * 1024 * 1024:
                self.send_error(413, "Payload terlalu besar")
                return
            body = json.loads(self.rfile.read(content_length)) if content_length else {}
            result, status = process_pipeline(body)
        except ValueError as error:
            result, status = {"error": str(error)}, 422
        except Exception:
            result, status = {"error": "Server gagal menjalankan pipeline."}, 500
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
