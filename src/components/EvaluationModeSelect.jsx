'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const options = [
  { value: 'manual', label: 'Evaluasi Pakar' },
  { value: 'exploratory', label: 'Eksplorasi Otomatis' },
];

export default function EvaluationModeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  return (
    <div ref={rootRef} className="relative w-full sm:w-56">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-semibold text-slate-700">
        <span className="truncate">{selected.label}</span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="listbox" className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((option) => (
            <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }} className={`block w-full px-3 py-2 text-left text-sm ${option.value === value ? 'bg-blue-50 font-semibold text-accent-blue' : 'text-slate-700 hover:bg-slate-50'}`}>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
