# ERD Database SentiKNN

Dokumen ini memakai nama konseptual Bahasa Indonesia untuk laporan. Nama tabel fisik tidak diubah agar tetap sesuai dengan aplikasi dan migrasi yang telah dipakai.

| Nama konseptual | Tabel fisik | Identitas data |
|---|---|---|
| Dataset | `tweets` | `run_id`, `tweet_id` |
| Preprocessing | `preprocessing_results` | `run_id`, `tweet_id` |
| PembagianData | `split_data` | `run_id`, `tweet_id` |
| TF-IDF | `tfidf_matrix` | `run_id`, `tweet_id` |
| KlasifikasiKNN | `knn_results` | `run_id`, `tweet_id` |
| TrainingResult | `evaluation_metrics` | `run_id` |

```mermaid
erDiagram
    DATASET ||--o| PREPROCESSING : menghasilkan
    DATASET ||--o| PEMBAGIAN_DATA : dibagi
    DATASET ||--o| TF_IDF : direpresentasikan
    DATASET ||--o| KLASIFIKASI_KNN : diprediksi
    PEMBAGIAN_DATA ||--o| KLASIFIKASI_KNN : data_uji
    KLASIFIKASI_KNN }o--|| TRAINING_RESULT : dirangkum

    DATASET {
        uuid run_id
        varchar tweet_id
        date tanggal
        text teks_asli
        varchar label
        varchar label_source
    }
    PREPROCESSING {
        uuid run_id
        varchar tweet_id
        text step_1_asli
        text step_2_cleaning
        text step_3_casefolding
        text step_4_normalisasi
        jsonb step_5_tokenizing
        jsonb step_6_stopword
        jsonb step_7_stemming
    }
    PEMBAGIAN_DATA {
        uuid run_id
        varchar tweet_id
        varchar split_type
    }
    TF_IDF {
        uuid run_id
        varchar tweet_id
        jsonb feature_vector
    }
    KLASIFIKASI_KNN {
        uuid run_id
        varchar tweet_id
        int k_value
        varchar predicted_label
        varchar actual_label
        boolean is_correct
    }
    TRAINING_RESULT {
        uuid run_id
        int k_value
        numeric accuracy
        numeric precision_score
        numeric recall
        numeric f1_score
        varchar evaluation_mode
        varchar ground_truth
    }
```

`label_source` bernilai `manual` untuk label pakar dan `lexicon` untuk pseudo-label. `evaluation_mode` bernilai `manual` atau `exploratory`; mode `exploratory` memakai `ground_truth = pseudo_label` dan tidak boleh disimpulkan sebagai evaluasi ground truth pakar.

`feature_vector` disimpan sebagai JSONB sparse agar database tidak menyimpan seluruh kombinasi dokumen dan term yang bernilai nol.
