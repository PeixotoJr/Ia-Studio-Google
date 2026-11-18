import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { AlertCircle } from 'lucide-react';
import type { LoadedDataset, VendaRecord, GlobalFilters } from '../types/bi';
import {
  computeKpis,
  buildMonthlySeries,
  buildSegmentMetrics,
} from '../services/biCalculations';
import {
  formatCurrencyBRL,
  formatCurrencyCompact,
  formatLiters,
  formatNumber,
  formatPercent,
} from '../utils/formatters';
import { ChartTooltip } from '../components/ChartTooltip';

interface DashboardExecutivePageProps {
  dataset: LoadedDataset;
  filteredVendas: VendaRecord[];
  filters: GlobalFilters;
}

const CHANNEL_COLORS = ['#F59E0B', '#D97706', '#B45309', '#78350F', '#FBBF24', '#92400E'];

export const DashboardExecutivePage: React.FC<DashboardExecutivePageProps> = ({
  dataset,
  filteredVendas,
  filters,
}) => {
  const kpis = useMemo(
    () => computeKpis(filteredVendas, dataset.metas, filters),
    [filteredVendas, dataset.metas, filters],
  );

  const monthlySeries = useMemo(
    () => buildMonthlySeries(filteredVendas, dataset.metas, filters),
    [filteredVendas, dataset.metas, filters],
  );

  const byUnit = useMemo(
    () => buildSegmentMetrics(filteredVendas, (v) => v.unidade_negocio),
    [filteredVendas],
  );

  const byCategory = useMemo(
    () => buildSegmentMetrics(filteredVendas, (v) => v.categoria),
    [filteredVendas],
  );

  const emptyMonths = useMemo(
    () => monthlySeries.filter((m) => m.semRegistros).map((m) => m.periodo),
    [monthlySeries],
  );

  const hasProductLevelFilter =
    filters.categoria !== 'ALL' || filters.produto !== 'ALL' || filters.forma_pagamento !== 'ALL';

  if (filteredVendas.length === 0) {
    return (
      <div className="p-8 rounded-xl bg-[#16120E] border border-amber-500/20 text-center space-y-2">
        <p className="text-base font-semibold text-[#F4EFE6]">Nenhum registro encontrado para os filtros selecionados</p>
        <p className="text-sm text-[#B9AE9C]">
          Ajuste ou limpe os filtros globais acima para visualizar os indicadores e gráficos da Galpão Bier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 10 Executive KPIs */}
      <section aria-label="Indicadores principais">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
          <KpiCard
            label="1. Faturamento Bruto"
            value={formatCurrencyBRL(kpis.faturamentoBruto)}
            sub={
              kpis.atingimentoMetaFaturamentoPct !== null
                ? `Meta: ${formatPercent(kpis.atingimentoMetaFaturamentoPct)} atingido`
                : `${formatNumber(kpis.registrosCount)} registros no recorte`
            }
            accent="amber"
          />
          <KpiCard
            label="2. Resultado Operacional"
            value={formatCurrencyBRL(kpis.resultadoOperacional)}
            sub={`Margem Contrib.: ${formatPercent(kpis.margemContribuicaoPct)}`}
            accent={kpis.resultadoOperacional >= 0 ? 'emerald' : 'red'}
          />
          <KpiCard
            label="3. Margem Operacional"
            value={formatPercent(kpis.margemOperacionalPct)}
            sub="Resultado Op. / Faturamento"
            accent={
              kpis.margemOperacionalPct === null
                ? 'neutral'
                : kpis.margemOperacionalPct >= 15
                ? 'emerald'
                : kpis.margemOperacionalPct >= 0
                ? 'amber'
                : 'red'
            }
          />
          <KpiCard
            label="4. Volume Comercializado"
            value={formatLiters(kpis.volumeLitros)}
            sub={
              kpis.atingimentoMetaVolumePct !== null
                ? `Meta Vol.: ${formatPercent(kpis.atingimentoMetaVolumePct)}`
                : `Custo/Litro: ${formatCurrencyBRL(kpis.custoPorLitro)}`
            }
          />
          <KpiCard
            label="5. Unidades Vendidas"
            value={formatNumber(kpis.quantidadeUnidades)}
            sub="Soma de quantidade_unidades"
          />
          <KpiCard
            label="6. Ticket Médio / Registro"
            value={formatCurrencyBRL(kpis.ticketMedioPorRegistro)}
            sub={`Base: ${formatNumber(kpis.registrosCount)} transações`}
          />
          <KpiCard
            label="7. Custo Direto Total"
            value={formatCurrencyBRL(kpis.custoDiretoTotal)}
            sub={`Custo por litro: ${formatCurrencyBRL(kpis.custoPorLitro)}`}
          />
          <KpiCard
            label="8. Despesas Operacionais"
            value={formatCurrencyBRL(kpis.despesasOperacionaisTotal)}
            sub="Soma de despesa_operacional"
          />
          <KpiCard
            label="9. Valores Recebidos"
            value={formatCurrencyBRL(kpis.valoresRecebidos)}
            sub={`Recebimento: ${formatPercent(kpis.percentualRecebimentoPct)}`}
            accent="emerald"
          />
          <KpiCard
            label="10. Valores em Aberto"
            value={formatCurrencyBRL(kpis.valoresEmAberto)}
            sub={`Em aberto: ${formatPercent(kpis.percentualEmAbertoPct)}`}
            accent={kpis.valoresEmAberto > 0 ? 'amber' : 'neutral'}
          />
        </div>
      </section>

      {emptyMonths.length > 0 && (
        <div className="p-3.5 rounded-xl bg-[#16120E] border border-amber-500/20 text-xs text-[#B9AE9C] flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Meses sem registros no intervalo selecionado:{' '}
            <strong className="text-[#F4EFE6] font-mono">{emptyMonths.join(', ')}</strong>.
          </span>
        </div>
      )}

      {/* 8 Mandatory Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Evolução mensal do faturamento */}
        <ChartCard
          title="1. Evolução Mensal do Faturamento"
          subtitle="Soma mensal de faturamento_bruto (R$)"
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlySeries} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.38} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
              <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
              <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={76} />
              <Tooltip content={<ChartTooltip formatterType="currency" />} />
              <Area
                type="monotone"
                dataKey="faturamentoBruto"
                name="Faturamento Bruto"
                stroke="#F59E0B"
                strokeWidth={2}
                fill="url(#fatGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 2. Evolução mensal do resultado operacional */}
        <ChartCard
          title="2. Evolução Mensal do Resultado Operacional"
          subtitle="Resultado operacional estimado por mês (R$)"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlySeries} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
              <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
              <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={76} />
              <ReferenceLine y={0} stroke="#847866" />
              <Tooltip content={<ChartTooltip formatterType="currency" />} />
              <Bar dataKey="resultadoOperacional" name="Resultado Operacional" radius={[4, 4, 0, 0]}>
                {monthlySeries.map((entry, idx) => (
                  <Cell
                    key={`res-${idx}`}
                    fill={entry.resultadoOperacional >= 0 ? '#16A34A' : '#DC2626'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 3. Faturamento realizado versus meta */}
        <ChartCard
          title="3. Faturamento Realizado vs Meta"
          subtitle={
            hasProductLevelFilter
              ? 'Metas definidas por período/unidade (não aplicáveis com filtro de categoria/produto/pagamento)'
              : 'Comparativo mensal entre realizado e meta_faturamento'
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlySeries} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
              <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
              <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={76} />
              <Tooltip content={<ChartTooltip formatterType="currency" />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#B9AE9C' }} />
              <Bar dataKey="faturamentoBruto" name="Realizado" fill="#D97706" radius={[4, 4, 0, 0]} />
              {!hasProductLevelFilter && (
                <Line
                  type="monotone"
                  dataKey="metaFaturamento"
                  name="Meta Faturamento"
                  stroke="#F4EFE6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#F4EFE6' }}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 4. Faturamento por unidade de negócio */}
        <ChartCard
          title="4. Faturamento por Unidade de Negócio"
          subtitle="Desempenho bruto por canal comercial (R$)"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byUnit} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
              <XAxis type="number" tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} />
              <YAxis type="category" dataKey="nome" tick={{ fill: '#F4EFE6', fontSize: 11 }} width={120} />
              <Tooltip content={<ChartTooltip formatterType="currency" />} />
              <Bar dataKey="faturamentoBruto" name="Faturamento Bruto" fill="#F59E0B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 5. Faturamento por categoria de cerveja */}
        <ChartCard
          title="5. Faturamento por Categoria de Cerveja"
          subtitle="Distribuição da receita bruta por estilo/categoria"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byCategory} margin={{ top: 10, right: 16, left: 4, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
              <XAxis dataKey="nome" tick={{ fill: '#B9AE9C', fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={76} />
              <Tooltip content={<ChartTooltip formatterType="currency" />} />
              <Bar dataKey="faturamentoBruto" name="Faturamento Bruto" fill="#D97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 6. Margem operacional por categoria */}
        <ChartCard
          title="6. Margem Operacional por Categoria"
          subtitle="Resultado operacional / Faturamento bruto (%)"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byCategory} margin={{ top: 10, right: 16, left: 4, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
              <XAxis dataKey="nome" tick={{ fill: '#B9AE9C', fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => `${v}%`} width={54} />
              <ReferenceLine y={0} stroke="#847866" />
              <Tooltip content={<ChartTooltip formatterType="percent" />} />
              <Bar dataKey="margemOperacionalPct" name="Margem Operacional (%)" radius={[4, 4, 0, 0]}>
                {byCategory.map((entry, idx) => (
                  <Cell
                    key={`cat-m-${idx}`}
                    fill={
                      (entry.margemOperacionalPct ?? 0) < 0
                        ? '#DC2626'
                        : (entry.margemOperacionalPct ?? 0) < 10
                        ? '#D97706'
                        : '#16A34A'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 7. Participação percentual dos canais de venda */}
        <ChartCard
          title="7. Participação Percentual dos Canais de Venda"
          subtitle="Composição do faturamento bruto por unidade de negócio"
        >
          <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4 h-[280px]">
            <div className="sm:col-span-7 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byUnit}
                    dataKey="faturamentoBruto"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {byUnit.map((_, idx) => (
                      <Cell key={`pie-${idx}`} fill={CHANNEL_COLORS[idx % CHANNEL_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="sm:col-span-5 space-y-2 text-xs overflow-y-auto max-h-[240px] pr-1">
              {byUnit.map((unit, idx) => (
                <div key={unit.nome} className="flex items-center justify-between gap-2 py-1 border-b border-amber-500/10">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: CHANNEL_COLORS[idx % CHANNEL_COLORS.length] }}
                    />
                    <span className="text-[#F4EFE6] truncate">{unit.nome}</span>
                  </span>
                  <span className="font-mono tabular-nums text-amber-300 shrink-0">
                    {formatPercent(unit.participacaoFaturamentoPct)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* 8. Volume comercializado por mês */}
        <ChartCard
          title="8. Volume Comercializado por Mês"
          subtitle="Soma mensal de volume_litros (L)"
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlySeries} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D97706" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#D97706" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
              <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
              <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => `${formatNumber(Number(v))} L`} width={72} />
              <Tooltip content={<ChartTooltip formatterType="liters" />} />
              <Area
                type="monotone"
                dataKey="volumeLitros"
                name="Volume (Litros)"
                stroke="#FBBF24"
                strokeWidth={2}
                fill="url(#volGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
};

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  accent?: 'amber' | 'emerald' | 'red' | 'neutral';
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, accent = 'neutral' }) => {
  const valueColor =
    accent === 'amber'
      ? 'text-amber-300'
      : accent === 'emerald'
      ? 'text-emerald-400'
      : accent === 'red'
      ? 'text-red-400'
      : 'text-[#F4EFE6]';

  return (
    <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1.5">
      <p className="text-xs font-medium text-[#B9AE9C] truncate">{label}</p>
      <p className={`text-lg sm:text-xl font-semibold font-mono tabular-nums truncate ${valueColor}`}>
        {value}
      </p>
      <p className="text-[11px] text-[#847866] truncate">{sub}</p>
    </div>
  );
};

const ChartCard: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
    <div>
      <h3 className="font-display text-base font-semibold text-[#F4EFE6]">{title}</h3>
      <p className="text-xs text-[#847866] mt-0.5">{subtitle}</p>
    </div>
    <div>{children}</div>
  </div>
);
