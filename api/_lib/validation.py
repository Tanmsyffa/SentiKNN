CLASSES = ("Positif", "Negatif", "Netral")
MAX_RECORDS = 10_000
MAX_TEXT_LENGTH = 10_000


def validated_options(body):
    try:
        k = int(body.get("k", 5))
        ratio = float(body.get("ratio", 0.8))
    except (TypeError, ValueError):
        raise ValueError("Parameter k harus bilangan bulat dan ratio harus berupa angka.")
    if not 1 <= k <= 50:
        raise ValueError("Parameter k harus berada di antara 1 dan 50.")
    if not 0.5 <= ratio <= 0.9:
        raise ValueError("Parameter ratio harus berada di antara 0.5 dan 0.9.")
    return k, ratio


def validated_dataset(body):
    dataset = body.get("dataset", [])
    if not isinstance(dataset, list) or not dataset:
        raise ValueError("Dataset harus berupa daftar data yang tidak kosong.")
    if len(dataset) > MAX_RECORDS:
        raise ValueError(f"Dataset maksimal berisi {MAX_RECORDS:,} dokumen per permintaan.")
    valid = []
    for index, item in enumerate(dataset, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Baris {index} tidak memiliki format objek yang valid.")
        text = str(item.get("teks", "")).strip()
        if len(text) > MAX_TEXT_LENGTH:
            raise ValueError(f"Teks pada baris {index} melebihi {MAX_TEXT_LENGTH:,} karakter.")
        valid.append(item)
    return valid


def is_manual_label(item):
    return (
        item.get("label") in CLASSES
        and item.get("label_source", "manual") == "manual"
        and not item.get("auto_labeled", False)
    )


def labeled_items_for_mode(dataset, mode):
    if mode == "exploratory":
        return [item for item in dataset if item.get("label") in CLASSES]
    return [item for item in dataset if is_manual_label(item)]


def evaluation_mode(body):
    mode = str(body.get("evaluation_mode", "manual")).strip().lower()
    if mode not in {"manual", "exploratory"}:
        raise ValueError("Mode evaluasi harus 'manual' atau 'exploratory'.")
    return mode


def mode_metadata(mode):
    if mode == "exploratory":
        return {
            "evaluation_mode": "exploratory",
            "ground_truth": "pseudo_label",
            "disclaimer": "Label aktual berasal dari label leksikon dan/atau pakar. Hasil ini adalah eksplorasi terhadap pseudo-label, bukan evaluasi ground truth pakar.",
        }
    return {
        "evaluation_mode": "manual",
        "ground_truth": "manual",
        "disclaimer": "Label aktual berasal dari penetapan pakar dan digunakan sebagai ground truth.",
    }
