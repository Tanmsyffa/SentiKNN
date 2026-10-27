'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import SentiKnnLogo from './SentiKnnLogo';
import { 
  HiHome, 
  HiDatabase, 
  HiTag, 
  HiCog, 
  HiScissors, 
  HiCalculator, 
  HiUserGroup, 
  HiChartBar,
  HiMenu,
  HiX
} from 'react-icons/hi';

const menuItems = [
  { name: 'Dashboard', href: '/', icon: HiHome },
  { name: 'Dataset X', href: '/dataset', icon: HiDatabase },
  { name: 'Pelabelan Data', href: '/pelabelan', icon: HiTag },
  { name: 'Preprocessing', href: '/preprocessing', icon: HiCog },
  { name: 'Split Data 80:20', href: '/split', icon: HiScissors },
  { name: 'TF-IDF', href: '/tfidf', icon: HiCalculator },
  { name: 'Klasifikasi KNN', href: '/klasifikasi', icon: HiUserGroup },
  { name: 'Evaluasi Model', href: '/evaluasi', icon: HiChartBar },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
        className="fixed left-3 top-3 z-[70] flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-bg text-white shadow-lg lg:hidden"
      >
        {isOpen ? <HiX className="h-6 w-6" /> : <HiMenu className="h-6 w-6" />}
      </button>
      {isOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/45 lg:hidden"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-[60] flex h-screen w-[250px] shrink-0 flex-col overflow-hidden bg-sidebar-bg shadow-xl shadow-slate-950/10 transition-transform duration-200 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <SentiKnnLogo className="h-11 w-11 shrink-0" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">SentiKNN</h1>
            <p className="text-xs text-sidebar-text">Analisis Sentimen X</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 lg:py-5">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`
                flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                transition-all duration-200 group
                ${isActive 
                  ? 'bg-accent-blue text-white shadow-lg shadow-blue-500/20' 
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                }
              `}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${!isActive ? 'group-hover:scale-110' : ''}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hidden px-3 pb-4 sm:block">
        <div className="rounded-2xl border border-white/10 bg-sidebar-accent p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">X</span>
            </div>
          </div>
          <p className="text-white text-xs font-semibold mb-1">Analisis Sentimen pada Platform X</p>
          <p className="text-sidebar-text text-[10px] leading-relaxed">
            Kasus Dugaan Korupsi Penyitaan Aset Eks Jampidsus Kejaksaan Agung
          </p>
        </div>
      </div>
      </aside>
    </>
  );
}
