import "./globals.css";
import Sidebar from "@/components/Sidebar";
import GlobalPipelineBanner from "@/components/GlobalPipelineBanner";

export const metadata = {
  title: "SentiKNN - Analisis Sentimen Platform X",
  description: "Implementasi Algoritma K-Nearest Neighbor untuk Analisis Sentimen Masyarakat di Media Sosial X terhadap Kasus Dugaan Korupsi Penyitaan Aset Eks Jampidsus Kejaksaan Agung",
  keywords: "sentimen, analisis, KNN, text mining, platform X, kejaksaan",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="antialiased">
        <div className="min-h-screen bg-page-bg">
          <Sidebar />
          <main className="app-shell-main min-h-screen min-w-0 bg-page-bg">
            <GlobalPipelineBanner />
            {/* Top Bar */}
            <header className="sticky top-0 z-40 bg-page-bg/80 backdrop-blur-lg border-b border-slate-200/50">
              <div className="flex min-w-0 items-center justify-between gap-2 py-3 pl-16 pr-4 sm:gap-4 sm:px-6 sm:py-4 xl:px-8">
                <div className="relative min-w-0 flex-1 max-w-sm">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Cari data, kata kunci, atau menu..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm transition-all focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-500 xl:flex">
                    <span>TA</span>
                    <span className="text-slate-300">•</span>
                    <span>KNN</span>
                    <span className="text-slate-300">•</span>
                    <span>Platform X</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden items-center gap-2 text-xs text-slate-500 2xl:flex">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      </div>
                      <span className="hidden text-sm font-medium text-slate-700 xl:inline">Azra Zahwi</span>
                    </div>
                  </div>
                </div>
              </div>
            </header>
            {/* Page Content */}
            <div className="w-full min-w-0 overflow-x-clip p-4 sm:p-5 lg:p-6 xl:p-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
