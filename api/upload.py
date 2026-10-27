"""
Upload Dataset Endpoint (CSV and Excel .xlsx / .xls)
POST /api/upload
"""


import json
import io
import base64
import pandas as pd
from http.server import BaseHTTPRequestHandler

MAX_UPLOAD_BYTES = 15 * 1024 * 1024


def process_upload(body):
    """Parse CSV text or base64 file (Excel/CSV) and return structured data array."""
    file_base64 = body.get("file_base64", "")
    filename = body.get("filename", "").lower()
    csv_text = body.get("csv_text", "")

    df = None

    if file_base64:
        try:
            file_bytes = base64.b64decode(file_base64, validate=True)
            if len(file_bytes) > MAX_UPLOAD_BYTES:
                return {"error": "Ukuran file maksimal 15 MB."}, 413
            if filename.endswith(".xlsx") or filename.endswith(".xls"):
                df = pd.read_excel(io.BytesIO(file_bytes))
            else:
                text = file_bytes.decode("utf-8", errors="replace")
                first_line = text.strip().split("\n")[0]
                delimiter = ";" if first_line.count(";") > first_line.count(",") else (
                    "\t" if "\t" in first_line else ","
                )
                df = pd.read_csv(io.StringIO(text), delimiter=delimiter, dtype=str)
        except Exception as e:
            return {"error": f"Gagal membaca file: {str(e)}"}, 400

    elif csv_text and csv_text.strip():
        if len(csv_text.encode("utf-8")) > MAX_UPLOAD_BYTES:
            return {"error": "Ukuran CSV maksimal 15 MB."}, 413
        first_line = csv_text.strip().split("\n")[0]
        delimiter = ";" if first_line.count(";") > first_line.count(",") else (
            "\t" if "\t" in first_line else ","
        )
        df = pd.read_csv(io.StringIO(csv_text), delimiter=delimiter, dtype=str)

    if df is None or len(df) == 0:
        return {"error": "Dataset kosong atau format tidak dikenali"}, 400
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    col_map = {}
    for col in df.columns:
        if any(k == col for k in ["id_str", "tweet_id", "id", "s"]) and "id" not in col_map:
            col_map["id"] = col
        elif any(k in col for k in ["created_at", "tanggal", "date", "time", "created"]) and "tanggal" not in col_map:
            col_map["tanggal"] = col
        elif any(k in col for k in ["full_text", "teks", "text", "tweet", "konten", "content"]) and "teks" not in col_map:
            col_map["teks"] = col
        elif any(k in col for k in ["label", "sentimen", "sentiment", "kelas"]) and "label" not in col_map:
            col_map["label"] = col
        elif any(k in col for k in ["username", "user", "author", "screen_name"]) and "username" not in col_map:
            col_map["username"] = col
        elif any(k in col for k in ["sumber", "source", "platform"]) and "sumber" not in col_map:
            col_map["sumber"] = col

    results = []
    for row_number, (_, row) in enumerate(df.iterrows(), start=1):
        teks_col = col_map.get("teks")
        teks = str(row.get(teks_col, "")).strip() if teks_col else ""
        if not teks or teks == "nan":
            continue
        id_col = col_map.get("id")
        raw_id = str(row.get(id_col, "")).strip() if id_col else ""
        doc_id = raw_id if raw_id and raw_id != "nan" else f"X{row_number:03d}"
        tgl_col = col_map.get("tanggal")
        raw_tgl = str(row.get(tgl_col, "")).strip() if tgl_col else ""
        if raw_tgl and raw_tgl != "nan":
            parsed_date = pd.to_datetime(raw_tgl, errors="coerce")
            tanggal = parsed_date.strftime("%Y-%m-%d") if not pd.isna(parsed_date) else ""
        else:
            tanggal = ""
        lbl_col = col_map.get("label")
        label = str(row.get(lbl_col, "")).strip() if lbl_col else ""
        if label and label != "nan":
            lower = label.lower()
            if lower.startswith("pos"):
                label = "Positif"
            elif lower.startswith("neg"):
                label = "Negatif"
            elif lower.startswith("net"):
                label = "Netral"
            else:
                label = ""
        else:
            label = ""
        usr_col = col_map.get("username")
        username = str(row.get(usr_col, "")).strip() if usr_col else ""
        if username == "nan":
            username = ""
        src_col = col_map.get("sumber")
        sumber = str(row.get(src_col, "")).strip() if src_col else "X"
        if not sumber or sumber == "nan":
            sumber = "X"

        results.append({
            "id": doc_id,
            "tanggal": tanggal,
            "teks": teks,
            "username": username,
            "sumber": sumber,
            "label": label,
        })

    return {
        "success": True,
        "data": results,
        "total": len(results),
    }, 200


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 22 * 1024 * 1024:
            self.send_error(413, "Payload terlalu besar")
            return
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        try:
            result, status = process_upload(body)
        except Exception:
            result, status = {"error": "Server gagal memproses unggahan."}, 500

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
