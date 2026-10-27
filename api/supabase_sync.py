"""Server-side Supabase batch writer. The service-role key never reaches the browser."""

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler

ALLOWED_TABLES = {
    "tweets", "preprocessing_results", "split_data", "tfidf_matrix", "knn_results", "evaluation_metrics"
}


def _setting(name):
    value = os.getenv(name)
    if value:
        return value
    local_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local")
    if os.path.exists(local_env):
        with open(local_env, encoding="utf-8") as env_file:
            for line in env_file:
                key, separator, candidate = line.strip().partition("=")
                if separator and key == name:
                    return candidate.strip().strip('"')
    return ""


def process_supabase_sync(body):
    if body.get("action") == "status":
        return process_supabase_status()

    table = str(body.get("table") or "")
    records = body.get("records")
    if table not in ALLOWED_TABLES or not isinstance(records, list) or not records:
        return {"error": "Tabel atau batch Supabase tidak valid."}, 400
    if len(records) > 50:
        return {"error": "Maksimal 50 baris per batch Supabase."}, 400

    url = _setting("SUPABASE_URL") or _setting("NEXT_PUBLIC_SUPABASE_URL")
    service_key = _setting("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        return {"error": "SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi pada backend."}, 503

    conflict_key = "run_id" if table == "evaluation_metrics" else "run_id,tweet_id"
    endpoint = f"{url.rstrip('/')}/rest/v1/{table}?on_conflict={conflict_key}"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(records).encode("utf-8"),
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30):
            pass
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")[:300]
        if "PGRST204" in details:
            return {
                "error": "Skema Supabase belum sesuai. Jalankan supabase/migration_20261027_relations.sql di SQL Editor, lalu coba sinkronkan lagi."
            }, 502
        if "tweets_tweet_id_key" in details:
            return {
                "error": "Constraint unik tweet_id versi lama masih aktif. Jalankan ulang supabase/migration_20261027_relations.sql di SQL Editor, lalu coba sinkronkan lagi."
            }, 502
        return {"error": f"Supabase menolak batch {table}: {details}"}, 502
    except urllib.error.URLError:
        return {"error": "Backend tidak dapat terhubung ke Supabase."}, 502
    return {"success": True, "table": table, "count": len(records)}, 200


def process_supabase_status():
    url = _setting("SUPABASE_URL") or _setting("NEXT_PUBLIC_SUPABASE_URL")
    service_key = _setting("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        return {"connected": False, "tablesExist": False, "message": "SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi pada backend."}, 503

    request = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/tweets?select=id&limit=1",
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=10):
            pass
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")[:180]
        return {"connected": True, "tablesExist": False, "message": f"Supabase terhubung, tetapi tabel tweets tidak siap: {details}"}, 502
    except urllib.error.URLError:
        return {"connected": False, "tablesExist": False, "message": "Backend tidak dapat terhubung ke Supabase."}, 502
    return {"connected": True, "tablesExist": True, "message": "Supabase siap menerima sinkronisasi melalui backend."}, 200


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 5 * 1024 * 1024:
                result, status = {"error": "Payload batch Supabase terlalu besar."}, 413
            else:
                body = json.loads(self.rfile.read(length)) if length else {}
                result, status = process_supabase_sync(body)
        except (TypeError, ValueError, json.JSONDecodeError):
            result, status = {"error": "Payload sinkronisasi Supabase tidak valid."}, 400
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
