"""
Modul Pelabelan Sentimen Otomatis Berbasis Leksikon (Lexicon-Based Sentiment Scoring)

Sumber data leksikon eksternal (dimuat murni dari CSV/TSV, bukan hardcode):
1. InSet Lexicon:
   Koto, F., & Rahmaningtyas, G. Y. (2017).
   "InSet Lexicon: Evaluation of a Word List for Indonesian Sentiment Analysis in Microblogs."
   2017 21st International Conference on Asian Language Processing (IALP), IEEE.
   https://ieeexplore.ieee.org/document/8300557
   File: inset_positive.tsv & inset_negative.tsv

2. ID-OpinionWords:
   Masdevid (2018). "Indonesian Sentiment Opinion Lexicon."
   Adaptasi leksikon opini Bing Liu untuk Bahasa Indonesia.
   https://github.com/masdevid/ID-OpinionWords
   File: opinion_positive.txt & opinion_negative.txt
"""

import os
import csv
from .nlp import ALL_STOPWORDS, NEGATION_WORDS

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def _load_lexicons():
    """
    Memuat dan menyelaraskan leksikon sentimen InSet dan ID-OpinionWords.
    Menggunakan ID-OpinionWords sebagai jangkar polaritas utama untuk mengeliminasi
    anomali kata sarkasme pada InSet Twitter (seperti 'bagus' yang ada di negative.tsv).
    """
    pos_txt = os.path.join(DATA_DIR, "opinion_positive.txt")
    neg_txt = os.path.join(DATA_DIR, "opinion_negative.txt")

    op_pos = set()
    op_neg = set()

    if os.path.exists(pos_txt):
        with open(pos_txt, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                w = line.strip().lower()
                if w and not w.startswith(";") and w not in ALL_STOPWORDS:
                    op_pos.add(w)

    if os.path.exists(neg_txt):
        with open(neg_txt, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                w = line.strip().lower()
                if w and not w.startswith(";") and w not in ALL_STOPWORDS:
                    op_neg.add(w)
    pure_op_pos = op_pos - op_neg
    pure_op_neg = op_neg - op_pos

    pos_dict = {}
    neg_dict = {}
    for w in pure_op_pos:
        pos_dict[w] = 3
    for w in pure_op_neg:
        neg_dict[w] = 3
    pos_tsv = os.path.join(DATA_DIR, "inset_positive.tsv")
    neg_tsv = os.path.join(DATA_DIR, "inset_negative.tsv")

    if os.path.exists(pos_tsv):
        with open(pos_tsv, "r", encoding="utf-8") as f:
            reader = csv.reader(f, delimiter="\t")
            next(reader, None)  # header
            for row in reader:
                if len(row) >= 2 and row[1].lstrip("-").isdigit():
                    w = row[0].strip().lower()
                    if w and w not in ALL_STOPWORDS:
                        if w in pure_op_neg:
                            continue
                        weight = max(1, abs(int(row[1])))
                        pos_dict[w] = max(pos_dict.get(w, 0), weight)

    if os.path.exists(neg_tsv):
        with open(neg_tsv, "r", encoding="utf-8") as f:
            reader = csv.reader(f, delimiter="\t")
            next(reader, None)  # header
            for row in reader:
                if len(row) >= 2 and row[1].lstrip("-").isdigit():
                    w = row[0].strip().lower()
                    if w and w not in ALL_STOPWORDS:
                        if w in pure_op_pos:
                            continue
                        weight = max(1, abs(int(row[1])))
                        neg_dict[w] = max(neg_dict.get(w, 0), weight)
    conflicts = set(pos_dict).intersection(neg_dict)
    for word in conflicts:
        del pos_dict[word]
        del neg_dict[word]

    return pos_dict, neg_dict


POSITIVE_LEXICON, NEGATIVE_LEXICON = _load_lexicons()
MAX_LEXICON_PHRASE_LENGTH = max(
    len(entry.split()) for entry in (*POSITIVE_LEXICON, *NEGATIVE_LEXICON)
)


def score_sentiment(tokens):
    """
    Menghitung skor polaritas sentimen berdasarkan kumpulan token kata.
    Score = Sum(bobot kata positif) - Sum(bobot kata negatif)
    """
    if not tokens:
        return {
            "label": "Netral",
            "score": 0,
            "pos_score": 0,
            "neg_score": 0,
            "polarity_strength": 0,
            "matched_term_count": 0,
            "pos_matches": [],
            "neg_matches": [],
        }

    pos_matches = []
    neg_matches = []
    pos_score = 0
    neg_score = 0

    normalized_tokens = [str(token).strip().lower() for token in tokens if str(token).strip()]
    index = 0
    negate_next_match = False
    while index < len(normalized_tokens):
        if normalized_tokens[index] in NEGATION_WORDS:
            negate_next_match = True
            index += 1
            continue
        match = None
        max_length = min(MAX_LEXICON_PHRASE_LENGTH, len(normalized_tokens) - index)
        for length in range(max_length, 0, -1):
            candidate = " ".join(normalized_tokens[index:index + length])
            if candidate in POSITIVE_LEXICON:
                match = ("positive", candidate, POSITIVE_LEXICON[candidate], length)
                break
            if candidate in NEGATIVE_LEXICON:
                match = ("negative", candidate, NEGATIVE_LEXICON[candidate], length)
                break
        if match is None:
            index += 1
            continue
        polarity, phrase, weight, length = match
        if negate_next_match:
            polarity = "negative" if polarity == "positive" else "positive"
            phrase = f"{normalized_tokens[index - 1]} {phrase}"
        negate_next_match = False
        if polarity == "positive":
            pos_matches.append((phrase, weight))
            pos_score += weight
        else:
            neg_matches.append((phrase, weight))
            neg_score += weight
        index += length

    total_score = pos_score - neg_score
    total_weight = pos_score + neg_score

    if total_score > 0:
        label = "Positif"
    elif total_score < 0:
        label = "Negatif"
    else:
        label = "Netral"

    return {
        "label": label,
        "score": total_score,
        "pos_score": pos_score,
        "neg_score": neg_score,
        "polarity_strength": round(abs(total_score) / total_weight, 4) if total_weight else 0,
        "matched_term_count": len(pos_matches) + len(neg_matches),
        "pos_matches": pos_matches,
        "neg_matches": neg_matches,
    }
