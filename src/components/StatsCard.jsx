import React from 'react';

export default function StatsCard({ title, value, subtitle, icon: Icon, color = 'blue', badge }) {
  const colorMap = {
    blue: {
      iconBg: 'bg-blue-50',
      iconColor: 'text-accent-blue',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-700',
    },
    green: {
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      badgeBg: 'bg-green-100',
      badgeText: 'text-green-700',
    },
    purple: {
      iconBg: 'bg-purple-50',
      iconColor: 'text-accent-purple',
      badgeBg: 'bg-purple-100',
      badgeText: 'text-purple-700',
    },
    orange: {
      iconBg: 'bg-orange-50',
      iconColor: 'text-accent-orange',
      badgeBg: 'bg-orange-100',
      badgeText: 'text-orange-700',
    },
    teal: {
      iconBg: 'bg-teal-50',
      iconColor: 'text-accent-teal',
      badgeBg: 'bg-teal-100',
      badgeText: 'text-teal-700',
    },
  };

  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className="stats-card min-w-0 overflow-hidden bg-white rounded-xl p-4 sm:p-5 shadow-card border border-slate-100 animate-slide-up">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{title}</p>
          <p className="break-words text-xl font-bold text-slate-800 mb-0.5 sm:text-2xl">{value}</p>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className="ml-2 flex shrink-0 flex-col items-end gap-2">
          {Icon && (
            <div className={`w-10 h-10 ${colors.iconBg} rounded-xl flex items-center justify-center`}>
              {React.isValidElement(Icon) ? (
                Icon
              ) : typeof Icon === 'string' ? (
                <span className={colors.iconColor}>{Icon}</span>
              ) : (
                <Icon className={`w-5 h-5 ${colors.iconColor}`} />
              )}
            </div>
          )}
          {badge && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${colors.badgeBg} ${colors.badgeText}`}>
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
