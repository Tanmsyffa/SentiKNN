from collections import Counter
from math import ceil

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier

from .validation import CLASSES


def ensure_stratifiable(labels, ratio):
    counts = Counter(labels)
    if len(counts) < 2:
        raise ValueError("Evaluasi KNN memerlukan minimal dua kelas label manual.")
    insufficient = [name for name, count in counts.items() if count < 2]
    if insufficient:
        raise ValueError("Setiap kelas label manual harus memiliki minimal dua dokumen untuk split stratified.")
    test_size = ceil(len(labels) * (1 - ratio))
    train_size = len(labels) - test_size
    if test_size < len(counts) or train_size < len(counts):
        raise ValueError(
            "Jumlah data belum cukup untuk split stratified pada rasio ini. "
            "Set data uji dan data latih masing-masing harus memuat setiap kelas."
        )


def evaluate_knn(texts, labels, record_ids, raw_texts, k, ratio):
    ensure_stratifiable(labels, ratio)
    indices = list(range(len(texts)))
    train_indices, test_indices = train_test_split(
        indices,
        test_size=1 - ratio,
        stratify=labels,
        random_state=42,
    )
    train_texts = [texts[index] for index in train_indices]
    test_texts = [texts[index] for index in test_indices]
    y_train = [labels[index] for index in train_indices]
    y_test = [labels[index] for index in test_indices]
    if len(set(y_train)) < 2:
        raise ValueError("Data latih harus memiliki minimal dua kelas label manual.")

    vectorizer = TfidfVectorizer(sublinear_tf=True, norm="l2")
    x_train = vectorizer.fit_transform(train_texts)
    x_test = vectorizer.transform(test_texts)
    actual_k = min(k, len(train_indices))
    classifier = KNeighborsClassifier(n_neighbors=actual_k, metric="euclidean", weights="uniform")
    classifier.fit(x_train, y_train)
    predictions = classifier.predict(x_test)
    distances, neighbour_indices = classifier.kneighbors(x_test)

    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, predictions, labels=CLASSES, zero_division=0
    )
    class_metrics = {
        label: {
            "precision": round(float(precision[index] * 100), 2),
            "recall": round(float(recall[index] * 100), 2),
            "f1_score": round(float(f1[index] * 100), 2),
            "support": int(support[index]),
        }
        for index, label in enumerate(CLASSES)
    }
    records = []
    for local_index, original_index in enumerate(test_indices):
        neighbours = []
        votes = {label: 0 for label in CLASSES}
        for rank, neighbour_index in enumerate(neighbour_indices[local_index], start=1):
            label = y_train[neighbour_index]
            votes[label] += 1
            neighbours.append({
                "peringkat": rank,
                "id": record_ids[train_indices[neighbour_index]],
                "teks": raw_texts[train_indices[neighbour_index]],
                "jarak": round(float(distances[local_index][rank - 1]), 4),
                "label": label,
            })
        records.append({
            "tweet_id": record_ids[original_index],
            "teks": raw_texts[original_index],
            "actual_label": y_test[local_index],
            "predicted_label": str(predictions[local_index]),
            "is_correct": bool(predictions[local_index] == y_test[local_index]),
            "k_value": actual_k,
            "distance_metric": "Euclidean",
            "votes": votes,
            "neighbors": neighbours,
        })
    matrix = confusion_matrix(y_test, predictions, labels=CLASSES).tolist()
    return {
        "k": actual_k,
        "train_indices": train_indices,
        "test_indices": test_indices,
        "results_records": records,
        "accuracy": round(float(accuracy_score(y_test, predictions) * 100), 2),
        "precision": round(float(precision_recall_fscore_support(y_test, predictions, labels=CLASSES, average="macro", zero_division=0)[0] * 100), 2),
        "recall": round(float(precision_recall_fscore_support(y_test, predictions, labels=CLASSES, average="macro", zero_division=0)[1] * 100), 2),
        "f1_score": round(float(precision_recall_fscore_support(y_test, predictions, labels=CLASSES, average="macro", zero_division=0)[2] * 100), 2),
        "class_metrics": class_metrics,
        "confusion_matrix": {"labels": list(CLASSES), "data": matrix},
        "train_size": len(train_indices),
        "test_size": len(test_indices),
        "total_labeled": len(labels),
    }
