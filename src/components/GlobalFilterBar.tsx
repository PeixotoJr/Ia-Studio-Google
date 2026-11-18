import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import type { GlobalFilters } from '../types/bi';
import type { FilterOptions } from '../services/biCalculations';

interface GlobalFilterBarProps {
  filters: GlobalFilters;
  options: FilterOptions;
  onChange: (next: GlobalFilters) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({
  filters,
  options,
  onChange,
  onReset,
  totalCount,
  filteredCount,
}) => {
  const hasActiveFilter = Object.values(filters).some((v) => v !== 'ALL');

  const update = (field: keyof GlobalFilters, value: string) => {
    onChange({ ...filters, [field]: value });
  };

  return (
    <section
      aria-label="Filtros globais"
      className="mb-6 p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[#F4EFE6]">
          <Filter className="w-4 h-4 text-amber-400" />
          <span>Filtros Globais</span>
          <span className="text-xs text-[#847866] font-normal">
            · Exibindo <strong className="text-[#F4EFE6] font-mono tabular-nums">{filteredCount.toLocaleString('pt-BR')}</strong> de{' '}
            <span className="font-mono tabular-nums">{totalCount.toLocaleString('pt-BR')}</span> registros
          </span>
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar filtros</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <FilterSelect
          label="Período Inicial"
          value={filters.periodoInicio}
          onChange={(v) => update('periodoInicio', v)}
          options={options.periodos.map((p) => ({ value: p, label: p }))}
        />
        <FilterSelect
          label="Período Final"
          value={filters.periodoFim}
          onChange={(v) => update('periodoFim', v)}
          options={options.periodos.map((p) => ({ value: p, label: p }))}
        />
        <FilterSelect
          label="Período Específico"
          value={filters.periodo}
          onChange={(v) => update('periodo', v)}
          options={options.periodos.map((p) => ({ value: p, label: p }))}
        />
        <FilterSelect
          label="Ano"
          value={filters.ano}
          onChange={(v) => update('ano', v)}
          options={options.anos.map((a) => ({ value: String(a), label: String(a) }))}
        />
        <FilterSelect
          label="Mês"
          value={filters.mes}
          onChange={(v) => update('mes', v)}
          options={options.meses.map((m) => ({
            value: String(m),
            label: `${String(m).padStart(2, '0')} - ${MONTH_NAMES[m - 1] ?? m}`,
          }))}
        />
        <FilterSelect
          label="Unidade de Negócio"
          value={filters.unidade_negocio}
          onChange={(v) => update('unidade_negocio', v)}
          options={options.unidades.map((u) => ({ value: u, label: u }))}
        />
        <FilterSelect
          label="Categoria"
          value={filters.categoria}
          onChange={(v) => update('categoria', v)}
          options={options.categorias.map((c) => ({ value: c, label: c }))}
        />
        <FilterSelect
          label="Produto"
          value={filters.produto}
          onChange={(v) => update('produto', v)}
          options={options.produtos.map((p) => ({ value: p, label: p }))}
        />
        <FilterSelect
          label="Forma de Pagamento"
          value={filters.forma_pagamento}
          onChange={(v) => update('forma_pagamento', v)}
          options={options.formasPagamento.map((f) => ({ value: f, label: f }))}
        />
        <FilterSelect
          label="Status de Pagamento"
          value={filters.status_pagamento}
          onChange={(v) => update('status_pagamento', v)}
          options={options.statusPagamento.map((s) => ({ value: s, label: s }))}
        />
      </div>
    </section>
  );
};

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

const FilterSelect: React.FC<FilterSelectProps> = ({ label, value, onChange, options }) => (
  <label className="block space-y-1">
    <span className="block text-[11px] font-medium text-[#B9AE9C]">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-2.5 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6] focus:outline-none focus:border-amber-400 transition-colors"
    >
      <option value="ALL">Todos</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </label>
);
