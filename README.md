# SentiKNN

Aplikasi tugas akhir untuk analisis sentimen teks berbahasa Indonesia dengan preprocessing, pelabelan leksikon, TF-IDF, dan K-Nearest Neighbors.

## Batasan ilmiah

Label yang dihasilkan InSet dan ID-OpinionWords ditandai sebagai `lexicon`. Label itu boleh dipakai untuk eksplorasi distribusi sentimen, tetapi tidak dipakai sebagai ground truth evaluasi KNN. Metrik hanya dihitung dari data yang diberi label manual atau label pakar.

Evaluasi memakai stratified holdout 80:20 dengan `random_state=42`. TF-IDF hanya di-fit pada data latih, lalu data uji ditransformasikan dengan vocabulary yang sama. Setiap kelas manual harus memiliki minimal dua dokumen; aplikasi menolak split yang tidak memenuhi syarat tersebut agar hasil tidak bias.

Untuk dataset lebih dari 1.000 dokumen, pipeline memproses teks secara batch dan menyimpan TF-IDF sebagai sparse matrix. Maksimum input adalah 10.000 dokumen, 10.000 karakter per teks, 15 MB per berkas unggahan, dan 10 MB payload pipeline.

## Menjalankan lokal

1. Instal dependensi JavaScript dengan `npm install`.
2. Instal dependensi Python dengan `python -m pip install -r requirements.txt`.
3. Jalankan API Python dengan `python api/index.py`.
4. Pada terminal lain jalankan antarmuka dengan `npm run dev`.
5. Buka `http://localhost:3000`.


## Referensi metode dan sumber eksternal

1. F. Koto dan G. Y. Rahmaningtyas, [InSet Lexicon: Evaluation of a Word List for Indonesian Sentiment Analysis in Microblogs](https://ieeexplore.ieee.org/document/8300625), IALP 2017, DOI: 10.1109/IALP.2017.8300625. Digunakan untuk data leksikon InSet.
2. [ID-OpinionWords](https://github.com/masdevid/ID-OpinionWords) oleh Masdevid. Digunakan sebagai leksikon opini Bahasa Indonesia.
3. [Sastrawi](https://github.com/har07/PySastrawi). Digunakan melalui PySastrawi untuk stemming Bahasa Indonesia.
4. [Tala, 2003, A Study of Stemming Effects on Information Retrieval in Bahasa Indonesia](https://www.academia.edu/5833773/A_Study_of_Stemming_Effects_on_Information_Retrieval_in_Bahasa_Indonesia). Digunakan sebagai rujukan daftar stopword Bahasa Indonesia yang tersimpan di proyek.
5. [scikit-learn: train_test_split](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.train_test_split.html), [TfidfVectorizer](https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html), dan [KNeighborsClassifier](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.KNeighborsClassifier.html). Digunakan untuk split, representasi fitur, KNN, dan metrik evaluasi.
6. [WordCloud for Python](https://amueller.github.io/word_cloud/). Digunakan untuk membuat gambar word cloud dari frekuensi token hasil stemming pada dashboard.