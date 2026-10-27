"""
Library Pemrosesan Teks (NLP) untuk Analisis Sentimen
Implementasi 7 tahapan preprocessing korpus bahasa Indonesia.

Sumber data eksternal (dimuat dari CSV, bukan hardcode):
1. Stemming: PySastrawi
2. Stopwords: Tala, F. Z. (2003). A Study of Stemming Effects on Information
   Retrieval in Bahasa Indonesia. Universiteit van Amsterdam.
   Sumber file: https://github.com/masdevid/ID-Stopwords
   File: stopwords_tala.csv (758 kata)
3. Normalisasi slang: Salsabila, N. A. et al. (2018). Colloquial Indonesian
   Lexicon. Proc. IALP 2018, IEEE. https://ieeexplore.ieee.org/document/8629151
   Sumber file: https://github.com/nasalsabila/kamus-alay
   File: colloquial-indonesian-lexicon.csv (4330 mapping)
"""

import os
import re
import csv
import concurrent.futures
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory

factory = StemmerFactory()
sastrawi_stemmer = factory.create_stemmer()

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def _load_stopwords_csv(filepath):
    """Memuat daftar stopwords dari file CSV (kolom: word).
    Sumber: Tala (2003) via github.com/masdevid/ID-Stopwords"""
    words = set()
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            w = row.get("word", "").strip()
            if w:
                words.add(w)
    return words


def _load_slang_csv(filepath):
    """Memuat kamus slang dari file CSV (kolom: slang, formal).
    Sumber: Salsabila et al. (2018) via github.com/nasalsabila/kamus-alay"""
    mapping = {}
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            slang = row.get("slang", "").strip().lower()
            formal = row.get("formal", "").strip().lower()
            if slang and formal:
                mapping[slang] = formal
    return mapping


ALL_STOPWORDS = _load_stopwords_csv(os.path.join(DATA_DIR, "stopwords_tala.csv"))
NEGATION_WORDS = {"tidak", "tak", "bukan", "belum", "jangan", "kurang"}
SLANG_DICTIONARY = _load_slang_csv(
    os.path.join(DATA_DIR, "colloquial-indonesian-lexicon.csv")
)

STEM_CACHE = {}


def step_1_data_asli(text):
    """Step 1: Data Asli (teks mentah dari dataset)."""
    return str(text).strip() if text else ""


def step_2_cleaning(text):
    """Step 2: Data Cleaning (menghapus URL, mention, hashtag, tanda baca, dan angka)."""
    if not text:
        return ""
    clean = re.sub(r"https?://\S+|www\.\S+", "", text)
    clean = re.sub(r"@\w+", "", clean)
    clean = re.sub(r"#(\w+)", r"\1", clean)
    clean = re.sub(r"[^a-zA-Z\s]", " ", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def step_3_casefolding(text):
    """Step 3: Case Folding (mengubah teks ke huruf kecil)."""
    return text.lower() if text else ""


def step_4_normalisasi(text):
    """Step 4: Normalisasi (konversi kata slang ke baku via Colloquial Indonesian Lexicon)."""
    if not text:
        return ""
    words = text.split()
    normalized = []
    for w in words:
        replacement = SLANG_DICTIONARY.get(w, w)
        if replacement:
            normalized.append(replacement)
    return " ".join(normalized)


def step_5_tokenizing(text):
    """Step 5: Tokenizing (pemecahan teks menjadi deretan token kata)."""
    if not text:
        return []
    return [w.strip() for w in text.split() if w.strip() and len(w.strip()) > 0]


def step_6_stopword(tokens):
    """Step 6: Stopword Removal (penghapusan kata umum menggunakan leksikon Tala 2003)."""
    if not tokens:
        return []
    return [
        token for token in tokens
        if (token not in ALL_STOPWORDS or token in NEGATION_WORDS) and len(token) > 1
    ]


def step_7_stemming(tokens):
    """Step 7: Stemming (mengubah kata berimbuhan ke kata dasar menggunakan Sastrawi)."""
    if not tokens:
        return []
    result = []
    for t in tokens:
        if t not in STEM_CACHE:
            if len(t) <= 3:
                STEM_CACHE[t] = t
            else:
                STEM_CACHE[t] = sastrawi_stemmer.stem(t)
        result.append(STEM_CACHE[t])
    return result


def run_preprocessing_pipeline(raw_text):
    """Eksekusi 7 tahapan pemrosesan teks untuk 1 baris teks."""
    s1 = step_1_data_asli(raw_text)
    s2 = step_2_cleaning(s1)
    s3 = step_3_casefolding(s2)
    s4 = step_4_normalisasi(s3)
    s5 = step_5_tokenizing(s4)
    s6 = step_6_stopword(s5)
    s7 = step_7_stemming(s6)

    return {
        "step_1_asli": s1,
        "step_2_cleaning": s2,
        "step_3_casefolding": s3,
        "step_4_normalisasi": s4,
        "step_5_tokenizing": s5,
        "step_6_stopword": s6,
        "step_7_stemming": s7,
    }


def batch_preprocess_dataset(texts):
    """
    Eksekusi batch pemrosesan teks pada seluruh dataset korpus.
    Tahap 1-6 diproses sekuensial, tahap 7 (stemming) dieksekusi paralel
    dengan ThreadPoolExecutor untuk kata-kata unik yang belum di-cache.
    """
    doc_steps = []
    unique_words_to_stem = set()

    for t in texts:
        s1 = step_1_data_asli(t)
        s2 = step_2_cleaning(s1)
        s3 = step_3_casefolding(s2)
        s4 = step_4_normalisasi(s3)
        s5 = step_5_tokenizing(s4)
        s6 = step_6_stopword(s5)
        doc_steps.append({
            "step_1_asli": s1,
            "step_2_cleaning": s2,
            "step_3_casefolding": s3,
            "step_4_normalisasi": s4,
            "step_5_tokenizing": s5,
            "step_6_stopword": s6,
        })
        for w in s6:
            if w not in STEM_CACHE:
                if len(w) <= 3:
                    STEM_CACHE[w] = w
                else:
                    unique_words_to_stem.add(w)

    if unique_words_to_stem:
        word_list = list(unique_words_to_stem)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            stemmed_words = list(executor.map(sastrawi_stemmer.stem, word_list))
        for original, stemmed in zip(word_list, stemmed_words):
            STEM_CACHE[original] = stemmed

    results = []
    for d in doc_steps:
        tokens = d["step_6_stopword"]
        s7 = [STEM_CACHE.get(w, w) for w in tokens]
        d["step_7_stemming"] = s7
        results.append(d)

    return results
