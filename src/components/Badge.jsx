export default function Badge({ variant = 'default', children }) {
  const variants = {
    positif: 'badge-positif',
    negatif: 'badge-negatif',
    netral: 'badge-netral',
    default: 'bg-slate-100 text-slate-600 border border-slate-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
    success: 'bg-green-50 text-green-700 border border-green-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  };

  return (
    <span className={`badge ${variants[variant] || variants.default}`}>
      {children}
    </span>
  );
}
