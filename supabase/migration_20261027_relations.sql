BEGIN;

ALTER TABLE evaluation_metrics
    ADD COLUMN IF NOT EXISTS evaluation_mode VARCHAR(20) NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS ground_truth VARCHAR(20) NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS disclaimer TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'evaluation_metrics_evaluation_mode_check'
    ) THEN
        ALTER TABLE evaluation_metrics
            ADD CONSTRAINT evaluation_metrics_evaluation_mode_check
            CHECK (evaluation_mode IN ('manual', 'exploratory'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'evaluation_metrics_ground_truth_check'
    ) THEN
        ALTER TABLE evaluation_metrics
            ADD CONSTRAINT evaluation_metrics_ground_truth_check
            CHECK (ground_truth IN ('manual', 'pseudo_label'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS split_data_run_split_type_idx
    ON split_data (run_id, split_type);

CREATE INDEX IF NOT EXISTS knn_results_run_k_value_idx
    ON knn_results (run_id, k_value);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'preprocessing_results_run_tweet_fkey'
    ) THEN
        ALTER TABLE preprocessing_results
            ADD CONSTRAINT preprocessing_results_run_tweet_fkey
            FOREIGN KEY (run_id, tweet_id)
            REFERENCES tweets (run_id, tweet_id)
            ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'split_data_run_tweet_fkey'
    ) THEN
        ALTER TABLE split_data
            ADD CONSTRAINT split_data_run_tweet_fkey
            FOREIGN KEY (run_id, tweet_id)
            REFERENCES tweets (run_id, tweet_id)
            ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tfidf_matrix_run_tweet_fkey'
    ) THEN
        ALTER TABLE tfidf_matrix
            ADD CONSTRAINT tfidf_matrix_run_tweet_fkey
            FOREIGN KEY (run_id, tweet_id)
            REFERENCES tweets (run_id, tweet_id)
            ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'knn_results_run_tweet_fkey'
    ) THEN
        ALTER TABLE knn_results
            ADD CONSTRAINT knn_results_run_tweet_fkey
            FOREIGN KEY (run_id, tweet_id)
            REFERENCES tweets (run_id, tweet_id)
            ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    END IF;
END $$;

COMMENT ON TABLE tweets IS 'Dataset: data mentah per dokumen dalam satu run analisis.';
COMMENT ON TABLE preprocessing_results IS 'Preprocessing: tujuh tahap pemrosesan teks per dokumen.';
COMMENT ON TABLE split_data IS 'PembagianData: partisi train atau test per dokumen dan run.';
COMMENT ON TABLE tfidf_matrix IS 'TF-IDF: representasi vektor sparse per dokumen dan run.';
COMMENT ON TABLE knn_results IS 'KlasifikasiKNN: hasil prediksi KNN untuk dokumen uji.';
COMMENT ON TABLE evaluation_metrics IS 'TrainingResult: metrik evaluasi satu eksperimen KNN.';

COMMIT;

-- Setelah memastikan tidak ada data lama yang yatim, validasikan foreign key:
-- ALTER TABLE preprocessing_results VALIDATE CONSTRAINT preprocessing_results_run_tweet_fkey;
-- ALTER TABLE split_data VALIDATE CONSTRAINT split_data_run_tweet_fkey;
-- ALTER TABLE tfidf_matrix VALIDATE CONSTRAINT tfidf_matrix_run_tweet_fkey;
-- ALTER TABLE knn_results VALIDATE CONSTRAINT knn_results_run_tweet_fkey;
