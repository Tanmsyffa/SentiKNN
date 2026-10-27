'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import StatsCard from '@/components/StatsCard';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  FileText,
  Tag,
  Database,
  Layers,
  Target,
  ShieldCheck,
  Search,
  Calculator,
  PieChart as PieChartIcon,
  TrendingUp,
  UploadCloud,
  CheckCircle2,
  Info,
  Loader2,
} from 'lucide-react';
import { getDatasetSummary, getStoredDataset, getStoredPipeline } from '@/lib/dataService';
import { getPreprocessingResults } from '@/lib/largeDataStore';
import { apiDashboard, apiEvaluate } from '@/lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const alurPenelitian = [
  { step: 1, title: 'Dataset X', desc: 'Import dataset dari platform X (Excel / CSV)', color: '#3B82F6' },
  { step: 2, title: 'Pelabelan Data', desc: 'Label sentimen secara manual oleh pakar', color: '#F59E0B' },
  { step: 3, title: 'Preprocessing Teks', desc: '7 tahap: Cleaning, Case Folding, Normalisasi, Tokenizing, Stopword, Stemming Sastrawi', color: '#10B981' },
  { step: 4, title: 'Split Data 80:20', desc: 'Stratified train/test split scikit-learn', color: '#8B5CF6' },
  { step: 5, title: 'TF-IDF', desc: 'Pembobotan kata menggunakan TfidfVectorizer', color: '#06B6D4' },
  { step: 6, title: 'Klasifikasi KNN', desc: 'Klasifikasi K-Nearest Neighbor & Jarak Euclidean', color: '#6366F1' },
  { step: 7, title: 'Evaluasi Model', desc: 'Confusion Matrix, Akurasi, Presisi, Recall, F1-Score', color: '#22C55E' },
];

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [dataset, setDataset] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    labeled_total: 0,
    unlabeled: 0,
    positif: 0,
    negatif: 0,
    netral: 0,
    pos_pct: 0,
    neg_pct: 0,
    net_pct: 0,
    train_count: 0,
    test_count: 0,
    date_range: 'Belum ada data',
  });
  const [trendData, setTrendData] = useState({ labels: [], datasets: [] });
  const [topTopics, setTopTopics] = useState([]);
  const [wordCloudImage, setWordCloudImage] = useState(null);
  const [evaluation, setEvaluation] = useState({
    accuracy: '-',
    precision: '-',
    recall: '-',
    f1_score: '-',
    evaluation_mode: 'manual',
  });

  const refreshAllData = async () => {
    const data = getStoredDataset();
    setDataset(data);

    if (data.length === 0) {
      setStats({
        total: 0,
        labeled_total: 0,
        unlabeled: 0,
        positif: 0,
        negatif: 0,
        netral: 0,
        pos_pct: 0,
        neg_pct: 0,
        net_pct: 0,
        train_count: 0,
        test_count: 0,
        date_range: 'Belum ada data',
      });
      setTrendData({ labels: [], datasets: [] });
      setTopTopics([]);
      setWordCloudImage(null);
      setEvaluation({ accuracy: '-', precision: '-', recall: '-', f1_score: '-' });
      return;
    }

    // Prefill instantly from stored pipeline if available
    const pipe = getStoredPipeline();
    if (pipe && pipe.summary) {
      setStats({
        total: pipe.summary.total || data.length,
        labeled_total: pipe.summary.labeled_total || data.length,
        unlabeled: 0,
        positif: pipe.summary.positif || 0,
        negatif: pipe.summary.negatif || 0,
        netral: pipe.summary.netral || 0,
        pos_pct: pipe.summary.pos_pct || 0,
        neg_pct: pipe.summary.neg_pct || 0,
        net_pct: pipe.summary.net_pct || 0,
        train_count: pipe.split?.train_count ?? pipe.summary.train_count ?? 0,
        test_count: pipe.split?.test_count ?? pipe.summary.test_count ?? 0,
        date_range: pipe.summary.date_range || 'Semua Data',
      });
      if (pipe.evaluation?.status === 'evaluated' && pipe.evaluation.accuracy !== undefined) {
        setEvaluation({
          accuracy: `${pipe.evaluation.accuracy}%`,
          precision: `${pipe.evaluation.precision}%`,
          recall: `${pipe.evaluation.recall}%`,
          f1_score: `${pipe.evaluation.f1_score}%`,
          evaluation_mode: pipe.evaluation.evaluation_mode || 'manual',
        });
      }
    }

    if (data.length > 300) {
      const summary = pipe?.summary || getDatasetSummary(data);
      const byDate = {};
      data.forEach((item) => {
        const date = String(item.tanggal || '').slice(0, 10);
        if (!date || !['Positif', 'Negatif', 'Netral'].includes(item.label)) return;
        byDate[date] ||= { Positif: 0, Negatif: 0, Netral: 0 };
        byDate[date][item.label] += 1;
      });
      const dates = Object.keys(byDate).sort().slice(0, 15);
      setStats({
        total: summary.total || data.length,
        labeled_total: summary.labeled_total || summary.labeledTotal || data.length,
        unlabeled: summary.unlabeled || 0,
        positif: summary.positif || 0,
        negatif: summary.negatif || 0,
        netral: summary.netral || 0,
        pos_pct: summary.pos_pct || 0,
        neg_pct: summary.neg_pct || 0,
        net_pct: summary.net_pct || 0,
        train_count: pipe?.split?.train_count ?? summary.train_count ?? summary.trainCount ?? 0,
        test_count: pipe?.split?.test_count ?? summary.test_count ?? summary.testCount ?? 0,
        date_range: summary.date_range || summary.dateRange || 'Semua Data',
      });
      setTrendData({
        labels: dates,
        datasets: [
          { label: 'Positif', data: dates.map((date) => byDate[date].Positif), borderColor: '#22C55E', tension: 0.35, fill: false, pointRadius: 3 },
          { label: 'Negatif', data: dates.map((date) => byDate[date].Negatif), borderColor: '#EF4444', tension: 0.35, fill: false, pointRadius: 3 },
          { label: 'Netral', data: dates.map((date) => byDate[date].Netral), borderColor: '#94A3B8', tension: 0.35, fill: false, pointRadius: 3 },
        ],
      });
      setTopTopics((pipe?.tfidf?.top_terms || []).slice(0, 5).map((item) => ({ name: item.term, count: item.weight_sum })));
      try {
        const preprocessing = await getPreprocessingResults();
        const stemmedById = new Map(preprocessing.map((item) => [String(item.tweet_id), item.stemmed_text || '']));
        const analyticsDataset = data.map((item) => ({
          tanggal: item.tanggal,
          label: item.label,
          stemmed: stemmedById.get(String(item.id)) || '',
        }));
        if (preprocessing.length > 0) {
          const dash = await apiDashboard(analyticsDataset);
          setWordCloudImage(dash.word_cloud_image || null);
          if (dash.top_topics?.length > 0) setTopTopics(dash.top_topics);
        } else {
          setWordCloudImage(null);
        }
      } catch (error) {
        console.warn('Word cloud tidak dapat dibuat dari hasil preprocessing:', error);
        setWordCloudImage(null);
      }
      return;
    }

    setLoading(true);
    try {
      // 1. Dashboard stats & trend from Python
      const dash = await apiDashboard(data);
      if (dash.success) {
        setStats(dash.stats || {});
        setTopTopics(dash.top_topics || []);
        setWordCloudImage(dash.word_cloud_image || null);

        if (dash.trend && dash.trend.labels && dash.trend.labels.length > 0) {
          setTrendData({
            labels: dash.trend.labels,
            datasets: [
              {
                label: 'Positif',
                data: dash.trend.positif,
                borderColor: '#22C55E',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.35,
                fill: false,
                pointRadius: 3,
              },
              {
                label: 'Negatif',
                data: dash.trend.negatif,
                borderColor: '#EF4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.35,
                fill: false,
                pointRadius: 3,
              },
              {
                label: 'Netral',
                data: dash.trend.netral,
                borderColor: '#94A3B8',
                backgroundColor: 'rgba(148, 163, 184, 0.1)',
                tension: 0.35,
                fill: false,
                pointRadius: 3,
              },
            ],
          });
        }
      }

      // 2. Evaluation metrics from Pipeline or Python API if labeled data exists
      const pipe = getStoredPipeline();
      if (pipe?.evaluation?.status === 'evaluated' && pipe.evaluation.accuracy !== undefined) {
        setEvaluation({
          accuracy: `${pipe.evaluation.accuracy}%`,
          precision: `${pipe.evaluation.precision}%`,
          recall: `${pipe.evaluation.recall}%`,
          f1_score: `${pipe.evaluation.f1_score}%`,
          evaluation_mode: pipe.evaluation.evaluation_mode || 'manual',
        });
      } else {
        const labeled = data.filter((d) => d.label && d.label_source !== 'lexicon' && !d.auto_labeled);
        if (labeled.length >= 5) {
          const ev = await apiEvaluate(data, 5, 0.8);
          if (ev.success) {
            setEvaluation({
              accuracy: `${ev.accuracy}%`,
              precision: `${ev.precision}%`,
              recall: `${ev.recall}%`,
              f1_score: `${ev.f1_score}%`,
              evaluation_mode: ev.evaluation_mode || 'manual',
            });
          }
        } else {
          setEvaluation({ accuracy: '-', precision: '-', recall: '-', f1_score: '-' });
        }
      }
    } catch (err) {
      console.error('Error refreshing dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    refreshAllData();

    const handleUpdate = () => refreshAllData();
    window.addEventListener('sentiknn-dataset-updated', handleUpdate);
    window.addEventListener('sentiknn-pipeline-updated', handleUpdate);
    return () => {
      window.removeEventListener('sentiknn-dataset-updated', handleUpdate);
      window.removeEventListener('sentiknn-pipeline-updated', handleUpdate);
    };
  }, []);

  if (!mounted) return null;

  const hasData = dataset.length > 0;
  const hasLabels = stats.labeled_total > 0;

  // Donut chart config
  const donutChartData = {
    labels: ['Positif', 'Negatif', 'Netral'],
    datasets: [
      {
        data: hasLabels ? [stats.positif, stats.negatif, stats.netral] : [0, 0, 0],
        backgroundColor: ['#22C55E', '#EF4444', '#94A3B8'],
        borderWidth: 0,
        cutout: '72%',
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: hasLabels,
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${stats.labeled_total > 0 ? ((ctx.raw / stats.labeled_total) * 100).toFixed(1) : 0}%)`,
        },
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle', font: { size: 11, family: 'Inter' } },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0, font: { size: 10 } },
        grid: { color: 'rgba(226, 232, 240, 0.6)' },
      },
      x: {
        ticks: { font: { size: 10 } },
        grid: { display: false },
      },
    },
  };

  const topicColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  const evaluationIsExploratory = evaluation.evaluation_mode === 'exploratory';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Analisis Sentimen Kasus Dugaan Korupsi Eks Jampidsus Kejaksaan Agung (K-Nearest Neighbor)
          </p>
        </div>
        {!hasData && (
          <Link
            href="/dataset"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white text-xs font-semibold rounded-lg hover:bg-blue-600 shadow-md shadow-blue-500/20 transition-all self-start"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Dataset</span>
          </Link>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-xl text-xs font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Memperbarui metrik dan analitik via Python backend...</span>
        </div>
      )}

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Data"
          value={hasData ? stats.total.toLocaleString('id-ID') : '0'}
          subtitle="unggahan"
          icon={FileText}
          color="blue"
        />
        <StatsCard
          title="Data Berlabel"
          value={hasData ? stats.labeled_total.toLocaleString('id-ID') : '0'}
          subtitle="unggahan"
          icon={Tag}
          color="green"
          badge={hasData && stats.total > 0 ? `${Math.round((stats.labeled_total / stats.total) * 100)}%` : '0%'}
        />
        <StatsCard
          title="Data Training"
          value={hasData ? stats.train_count.toLocaleString('id-ID') : '0'}
          subtitle="unggahan"
          icon={Database}
          color="purple"
          badge="80%"
        />
        <StatsCard
          title="Data Testing"
          value={hasData ? stats.test_count.toLocaleString('id-ID') : '0'}
          subtitle="unggahan"
          icon={Layers}
          color="orange"
          badge="20%"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart - Distribusi Sentimen */}
        <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Distribusi Sentimen</h3>
            <PieChartIcon className="w-4 h-4 text-slate-400" />
          </div>

          {hasLabels ? (
            <div>
              <div className="relative flex items-center justify-center my-2">
                <div className="w-48 h-48">
                  <Doughnut data={donutChartData} options={donutOptions} />
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-slate-800">{stats.labeled_total.toLocaleString('id-ID')}</span>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Data Berlabel</span>
                </div>
              </div>

              {/* Custom Legend */}
              <div className="space-y-2 mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-sentiment-positif" />
                    <span className="text-slate-600 font-medium">Positif</span>
                  </div>
                  <span className="font-semibold text-slate-800">
                    {stats.positif} ({stats.pos_pct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-sentiment-negatif" />
                    <span className="text-slate-600 font-medium">Negatif</span>
                  </div>
                  <span className="font-semibold text-slate-800">
                    {stats.negatif} ({stats.neg_pct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-sentiment-netral" />
                    <span className="text-slate-600 font-medium">Netral</span>
                  </div>
                  <span className="font-semibold text-slate-800">
                    {stats.netral} ({stats.net_pct}%)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <PieChartIcon className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Belum Ada Data Berlabel</p>
              <p className="text-[11px] text-slate-400 max-w-[200px]">
                Unggah dataset dan beri label pada menu Pelabelan Data untuk melihat grafik distribusi.
              </p>
            </div>
          )}
        </div>

        {/* Line Chart - Tren Sentimen */}
        <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Tren Sentimen per Tanggal</h3>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>

          {trendData.labels && trendData.labels.length > 0 ? (
            <div className="h-56">
              <Line data={trendData} options={lineOptions} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <TrendingUp className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Belum Ada Data Tren</p>
              <p className="text-[11px] text-slate-400 max-w-[220px]">
                Grafik tren akan aktif setelah dataset dengan tanggal dan label diunggah.
              </p>
            </div>
          )}
        </div>

        {/* Pembagian Data 80/20 Progress Bar */}
        <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Pembagian Data (Train/Test)</h3>

            {/* Split Bar */}
            <div className="flex rounded-xl overflow-hidden h-11 mb-4 shadow-inner">
              <div
                className="bg-accent-blue flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                style={{ width: '80%' }}
              >
                80% DATA LATIH
              </div>
              <div
                className="bg-purple-500 flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                style={{ width: '20%' }}
              >
                20% UJI
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-blue-50/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent-blue" />
                  <span className="text-xs text-slate-500 font-medium">Data Training</span>
                </div>
                <p className="text-lg font-bold text-slate-800">{stats.train_count.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-slate-400">80% dari data berlabel</p>
              </div>
              <div className="p-3 bg-purple-50/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="text-xs text-slate-500 font-medium">Data Testing</span>
                </div>
                <p className="text-lg font-bold text-slate-800">{stats.test_count.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-slate-400">20% dari data berlabel</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl text-slate-600 text-xs">
            <Info className="w-4 h-4 text-accent-blue flex-shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Pemisahan dataset dilakukan menggunakan stratified sampling pada Python scikit-learn.
            </p>
          </div>
        </div>
      </div>

      {/* Row 3: Hasil Evaluasi KNN & Topik Paling Banyak Dibahas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Metric Cards */}
        <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">
              Hasil Evaluasi Model KNN ({evaluationIsExploratory ? 'Data Uji Pseudo-label 20%' : 'Data Uji Pakar 20%'})
            </h3>
            <span className="text-xs text-slate-400 font-mono">K = 5</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Accuracy', value: evaluation.accuracy, color: 'text-teal-600', bg: 'bg-teal-50', icon: Target },
              { label: 'Precision', value: evaluation.precision, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: ShieldCheck },
              { label: 'Recall', value: evaluation.recall, color: 'text-amber-600', bg: 'bg-amber-50', icon: Search },
              { label: 'F1-Score', value: evaluation.f1_score, color: 'text-blue-600', bg: 'bg-blue-50', icon: Calculator },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="text-center p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl">
                  <div className={`w-8 h-8 mx-auto mb-2 rounded-lg ${m.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${m.color}`} />
                  </div>
                  <p className="text-xs font-medium text-slate-500 mb-1">{m.label}</p>
                  <p className="text-lg font-bold text-slate-800">{m.value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {evaluation.accuracy !== '-' ? (evaluationIsExploratory ? 'pseudo-label' : 'ground truth pakar') : 'Belum dievaluasi'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Topik Paling Banyak Dibahas */}
        <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Topik Paling Banyak Dibahas</h3>
          {topTopics.length > 0 ? (
            <div className="space-y-3">
              {topTopics.map((topic, idx) => (
                <div key={topic.name} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: topicColors[idx % topicColors.length] }} />
                  <span className="text-xs text-slate-600 w-24 font-mono font-medium truncate">{topic.name}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, (topic.count / (topTopics[0]?.count || 1)) * 100)}%`,
                        backgroundColor: topicColors[idx % topicColors.length],
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 w-10 text-right">{topic.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-400">Belum ada topik (menunggu dataset diunggah)</p>
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Word Cloud + Ringkasan Alur Penelitian */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Word Cloud */}
        <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Kata Kunci Populer</h3>
            <span className="text-[10px] font-medium text-slate-400">Frekuensi token stemming Python</span>
          </div>
          {wordCloudImage ? (
            <Image
              src={wordCloudImage}
              alt="Word cloud dari frekuensi token hasil preprocessing"
              width={1200}
              height={420}
              unoptimized
              className="h-56 w-full object-contain"
            />
          ) : (
            <div className="py-12 text-center">
              <p className="text-xs text-slate-400">
                Word cloud akan muncul setelah teks diproses.
              </p>
            </div>
          )}
        </div>

        {/* Ringkasan Alur Penelitian */}
        <div className="bg-white rounded-xl p-6 shadow-card border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Ringkasan Alur Penelitian</h3>
          <div className="flex items-start gap-0 overflow-x-auto pb-2">
            {alurPenelitian.map((item, idx) => (
              <div key={item.step} className="flex items-start min-w-[130px]">
                <div className="flex flex-col items-center text-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mb-2 shadow-md"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.step}
                  </div>
                  <p className="text-[11px] font-semibold text-slate-700 mb-1 leading-tight">{item.title}</p>
                  <p className="text-[9px] text-slate-400 leading-snug px-1">{item.desc}</p>
                </div>
                {idx < alurPenelitian.length - 1 && (
                  <div className="flex items-center pt-3 px-1">
                    <div className="w-4 h-[2px] bg-slate-200" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
