import React from 'react';
import { formatCurrencyBRL, formatLiters, formatPercent, formatNumber } from '../utils/formatters';

interface TooltipPayloadEntry {
  name?: string;
  value?: number | string | null;
  color?: string;
  dataKey?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  formatterType?: 'currency' | 'liters' | 'percent' | 'number';
}

export const ChartTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  formatterType = 'currency',
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const formatVal = (val: unknown, key?: string): string => {
    if (val === null || val === undefined) return 'N/A';
    if (Array.isArray(val) && val.length === 2) {
      return `${formatVal(val[0], key)} a ${formatVal(val[1], key)}`;
    }
    const num = Number(val);
    if (!Number.isFinite(num)) return String(val);

    if (key && key.toLowerCase().includes('margem')) return formatPercent(num);
    if (key && key.toLowerCase().includes('volume')) return formatLiters(num);

    switch (formatterType) {
      case 'currency':
        return formatCurrencyBRL(num);
      case 'liters':
        return formatLiters(num);
      case 'percent':
        return formatPercent(num);
      default:
        return formatNumber(num, 2);
    }
  };

  return (
    <div className="rounded-lg bg-[#14100C] border border-amber-500/30 px-3.5 py-2.5 shadow-xl text-xs space-y-1.5">
      {label && <p className="font-semibold text-[#F4EFE6] border-b border-amber-500/15 pb-1">{label}</p>}
      {payload.map((entry, idx) => (
        <div key={`${entry.dataKey}-${idx}`} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-[#B9AE9C]">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: entry.color || '#F59E0B' }}
            />
            <span>{entry.name}</span>
          </span>
          <span className="font-mono tabular-nums font-medium text-[#F4EFE6]">
            {formatVal(entry.value, entry.dataKey)}
          </span>
        </div>
      ))}
    </div>
  );
};
