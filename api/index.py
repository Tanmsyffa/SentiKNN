"""
Python Backend API Router (Flask Development Server and Master Router)
"""


import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from upload import process_upload
from preprocessing import process_batch
from autolabel import process_autolabel
from split import process_split
from tfidf import process_tfidf
from knn import process_knn
from evaluate import process_evaluate
from dashboard import process_dashboard
from pipeline import process_pipeline
from supabase_sync import process_supabase_sync

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "SentiKNN Python NLP/ML API (Batch Text Mining Mode)",
        "modules": [
            "upload",
            "preprocessing (7 steps batch)",
            "split (80:20 stratified)",
            "tfidf (scikit-learn batch)",
            "knn (scikit-learn batch)",
            "evaluate (metrics & confusion matrix)",
            "dashboard",
        ],
    })
@app.route("/api/upload", methods=["POST", "OPTIONS"])
def route_upload():
    if request.method == "OPTIONS":
        return "", 200
    body = request.get_json(force=True, silent=True) or {}
    result, status = process_upload(body)
    return jsonify(result), status
@app.route("/api/preprocessing", methods=["POST", "OPTIONS"])
@app.route("/api/preprocess", methods=["POST", "OPTIONS"])
@app.route("/api/preprocess-all", methods=["POST", "OPTIONS"])
def route_preprocessing():
    if request.method == "OPTIONS":
        return "", 200
    body = request.get_json(force=True, silent=True) or {}
    result, status = process_batch(body)
    return jsonify(result), status
@app.route("/api/autolabel", methods=["POST", "OPTIONS"])
@app.route("/api/label-auto", methods=["POST", "OPTIONS"])
def route_autolabel():
    if request.method == "OPTIONS":
        return "", 200
    body = request.get_json(force=True, silent=True) or {}
    result, status = process_autolabel(body)
    return jsonify(result), status
@app.route("/api/split", methods=["POST", "OPTIONS"])
def route_split():
    if request.method == "OPTIONS":
        return "", 200
    body = request.get_json(force=True, silent=True) or {}
    result, status = process_split(body)
    return jsonify(result), status
@app.route("/api/tfidf", methods=["POST", "OPTIONS"])
def route_tfidf():
    if request.method == "OPTIONS":
        return "", 200
    body = request.get_json(force=True, silent=True) or {}
    result, status = process_tfidf(body)
    return jsonify(result), status
@app.route("/api/knn", methods=["POST", "OPTIONS"])
@app.route("/api/classify", methods=["POST", "OPTIONS"])
def route_knn():
    if request.method == "OPTIONS":
        return "", 200
    body = request.get_json(force=True, silent=True) or {}
    result, status = process_knn(body)
    return jsonify(result), status
@app.route("/api/evaluate", methods=["POST", "OPTIONS"])
def route_evaluate():
    if request.method == "OPTIONS":
        return "", 200
    body = request.get_json(force=True, silent=True) or {}
    result, status = process_evaluate(body)
    return jsonify(result), status
@app.route("/api/dashboard", methods=["POST", "OPTIONS"])
def route_dashboard():
    if request.method == "OPTIONS":
        return "", 200
    body = request.get_json(force=True, silent=True) or {}
    result, status = process_dashboard(body)
    return jsonify(result), status
@app.route("/api/pipeline", methods=["POST", "OPTIONS"])
def route_pipeline():
    if request.method == "OPTIONS":
        return "", 200
    body = request.get_json(force=True, silent=True) or {}
    result, status = process_pipeline(body)
    return jsonify(result), status


@app.route("/api/supabase_sync", methods=["POST", "OPTIONS"])
@app.route("/api/supabase-sync", methods=["POST", "OPTIONS"])
def route_supabase_sync():
    if request.method == "OPTIONS":
        return "", 200
    result, status = process_supabase_sync(request.get_json(force=True, silent=True) or {})
    return jsonify(result), status


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
