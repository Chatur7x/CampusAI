import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  iconBg?: string;
  loading?: boolean;
}

export function StatsCard({
  title,
  value,
  change,
  changeLabel = 'vs last month',
  icon,
  iconBg = 'from-emerald-400/20 to-emerald-600/20',
  loading = false,
}: StatsCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
            <div className="h-8 w-20 bg-slate-800 rounded animate-pulse" />
            <div className="h-3 w-32 bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="h-12 w-12 bg-slate-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur p-5 transition-all hover:bg-slate-900/70 hover:border-slate-700 group">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-400 font-medium">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  'flex items-center gap-0.5 font-medium px-1.5 py-0.5 rounded',
                  isPositive && 'text-emerald-400 bg-emerald-400/10',
                  isNegative && 'text-red-400 bg-red-400/10',
                  isNeutral && 'text-slate-400 bg-slate-400/10'
                )}
              >
                {isPositive && <TrendingUp className="h-3 w-3" />}
                {isNegative && <TrendingDown className="h-3 w-3" />}
                {isNeutral && <Minus className="h-3 w-3" />}
                {isPositive && '+'}
                {change}%
              </span>
              <span className="text-slate-500">{changeLabel}</span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'p-3 rounded-xl bg-gradient-to-br transition-transform group-hover:scale-110',
              iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface MiniChartProps {
  data: number[];
  color?: string;
  height?: number;
}

export function MiniChart({ data, color = '#10b981', height = 40 }: MiniChartProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} 100,${height}`}
        fill={`url(#gradient-${color})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ProgressCardProps {
  title: string;
  value: number;
  max: number;
  label?: string;
  color?: string;
  loading?: boolean;
}

export function ProgressCard({
  title,
  value,
  max,
  label,
  color = 'emerald',
  loading = false,
}: ProgressCardProps) {
  const percentage = Math.round((value / max) * 100);

  const colorClasses = {
    emerald: 'bg-emerald-500',
    violet: 'bg-violet-500',
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  }[color] || 'bg-emerald-500';

  const bgClasses = {
    emerald: 'bg-emerald-500/20',
    violet: 'bg-violet-500/20',
    cyan: 'bg-cyan-500/20',
    amber: 'bg-amber-500/20',
    red: 'bg-red-500/20',
  }[color] || 'bg-emerald-500/20';

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
        <div className="h-2 bg-slate-800 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">{title}</span>
        <span className="text-white font-medium">
          {label || `${value}/${max}`}
        </span>
      </div>
      <div className={cn('h-2 rounded-full overflow-hidden', bgClasses)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', colorClasses)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface ActivityItemProps {
  avatar?: ReactNode;
  title: string;
  description: string;
  time: string;
  type?: 'default' | 'success' | 'warning' | 'error';
}

export function ActivityItem({
  avatar,
  title,
  description,
  time,
  type = 'default',
}: ActivityItemProps) {
  const dotColors = {
    default: 'bg-slate-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    error: 'bg-red-400',
  };

  return (
    <div className="flex gap-3 py-3">
      <div className="relative">
        {avatar || (
          <div className={cn('h-2 w-2 rounded-full mt-2', dotColors[type])} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{description}</p>
      </div>
      <span className="text-xs text-slate-600 flex-shrink-0">{time}</span>
    </div>
  );
}
