import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { LoadedDataset, VendaRecord, GlobalFilters } from '../types/bi';
import {
  computeKpis,
  buildMonthlySeries,
  buildSegmentMetrics,
  buildMetaComparison,
} from '../services/biCalculations';
import {
  formatCurrencyBRL,
  formatCurrencyCompact,
  formatLiters,
  formatNumber,
  formatPercent,
} from '../utils/formatters';
import { ChartTooltip } from '../components/ChartTooltip';

interface PerformanceAnalysisPageProps {
  dataset: LoadedDataset;
  filteredVendas: VendaRecord[];
  filters: GlobalFilters;
}

type PerfTab = 'comercial' | 'rentabilidade' | 'financeira' | 'metas';

export const PerformanceAnalysisPage: React.FC<PerformanceAnalysisPageProps> = ({
  dataset,
  filteredVendas,
  filters,
}) => {
  const [activeTab, setActiveTab] = useState<PerfTab>('comercial');

  const kpis = useMemo(
    () => computeKpis(filteredVendas, dataset.metas, filters),
    [filteredVendas, dataset.metas, filters],
  );
  const monthly = useMemo(
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
  const byProduct = useMemo(
    () => buildSegmentMetrics(filteredVendas, (v) => v.produto),
    [filteredVendas],
  );
  const byPayment = useMemo(
    () => buildSegmentMetrics(filteredVendas, (v) => v.forma_pagamento),
    [filteredVendas],
  );
  const metaRows = useMemo(
    () => buildMetaComparison(filteredVendas, dataset.metas, filters),
    [filteredVendas, dataset.metas, filters],
  );

  const topProducts = useMemo(() => byProduct.slice(0, 8), [byProduct]);
  const bottomProducts = useMemo(
    () => [...byProduct].sort((a, b) => a.faturamentoBruto - b.faturamentoBruto).slice(0, 8),
    [byProduct],
  );
  const alertProducts = useMemo(
    () => byProduct.filter((p) => (p.margemOperacionalPct ?? 0) < 10),
    [byProduct],
  );

  const unitMetaSummary = useMemo(() => {
    const map = new Map<string, { fat: number; metaFat: number; vol: number; metaVol: number; hasMeta: boolean }>();
    for (const r of metaRows) {
      const cur = map.get(r.unidade_negocio) || { fat: 0, metaFat: 0, vol: 0, metaVol: 0, hasMeta: false };
      cur.fat += r.faturamentoRealizado;
      cur.vol += r.volumeRealizado;
      if (r.metaFaturamento !== null) {
        cur.metaFat += r.metaFaturamento;
        cur.hasMeta = true;
      }
      if (r.metaVolumeLitros !== null) {
        cur.metaVol += r.metaVolumeLitros;
      }
      map.set(r.unidade_negocio, cur);
    }
    return Array.from(map.entries()).map(([unidade, d]) => {
      const atingFat = d.hasMeta && d.metaFat > 0 ? (d.fat / d.metaFat) * 100 : null;
      const atingVol = d.metaVol > 0 ? (d.vol / d.metaVol) * 100 : null;
      const status: 'Satisfatório' | 'Atenção' | 'Abaixo do esperado' | 'Sem meta' =
        atingFat === null
          ? 'Sem meta'
          : atingFat >= 100
          ? 'Satisfatório'
          : atingFat >= 85
          ? 'Atenção'
          : 'Abaixo do esperado';
      return {
        unidade,
        fat: d.fat,
        metaFat: d.hasMeta ? d.metaFat : null,
        difFat: d.hasMeta ? d.fat - d.metaFat : null,
        atingFat,
        vol: d.vol,
        metaVol: d.metaVol > 0 ? d.metaVol : null,
        atingVol,
        status,
      };
    });
  }, [metaRows]);

  if (filteredVendas.length === 0) {
    return (
      <div className="p-8 rounded-xl bg-[#16120E] border border-amber-500/20 text-center text-sm text-[#B9AE9C]">
        Nenhum registro de venda encontrado para os filtros ativos.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-[#16120E] border border-amber-500/15">
        {(
          [
            { id: 'comercial', label: 'Análise Comercial' },
            { id: 'rentabilidade', label: 'Análise de Rentabilidade' },
            { id: 'financeira', label: 'Análise Financeira' },
            { id: 'metas', label: 'Análise de Metas' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-amber-600 text-[#0D0B09] font-semibold'
                : 'text-[#B9AE9C] hover:text-[#F4EFE6]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: COMERCIAL */}
      {activeTab === 'comercial' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
              <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
                Crescimento Mensal das Vendas (MoM %)
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => `${v}%`} width={54} />
                  <ReferenceLine y={0} stroke="#847866" />
                  <Tooltip content={<ChartTooltip formatterType="percent" />} />
                  <Bar dataKey="crescimentoFaturamentoMoMPct" name="Variação MoM (%)">
                    {monthly.map((m, idx) => (
                      <Cell
                        key={`mom-${idx}`}
                        fill={(m.crescimentoFaturamentoMoMPct ?? 0) >= 0 ? '#16A34A' : '#DC2626'}
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
              <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
                Ticket Médio e Faturamento por Canal
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byUnit}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="nome" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={72} />
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                  <Bar dataKey="ticketMedio" name="Ticket Médio" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Categoria Share Table */}
          <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
            <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
              Participação por Categoria de Cerveja
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-amber-500/15 text-[#847866]">
                    <th className="py-2 px-3">Categoria</th>
                    <th className="py-2 px-3 text-right">Registros</th>
                    <th className="py-2 px-3 text-right">Volume (L)</th>
                    <th className="py-2 px-3 text-right">Faturamento</th>
                    <th className="py-2 px-3 text-right">Participação</th>
                    <th className="py-2 px-3 text-right">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-500/10">
                  {byCategory.map((c) => (
                    <tr key={c.nome} className="hover:bg-[#1E1813]">
                      <td className="py-2.5 px-3 font-medium text-[#F4EFE6]">{c.nome}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatNumber(c.registros)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">{formatLiters(c.volumeLitros)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#F4EFE6]">{formatCurrencyBRL(c.faturamentoBruto)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-300">{formatPercent(c.participacaoFaturamentoPct)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">{formatCurrencyBRL(c.ticketMedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top vs Bottom products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ProductRankTable title="Produtos Mais Vendidos (Top 8 Faturamento)" rows={topProducts} />
            <ProductRankTable title="Produtos com Menor Desempenho (8 Menores)" rows={bottomProducts} />
          </div>
        </div>
      )}

      {/* TAB 2: RENTABILIDADE */}
      {activeTab === 'rentabilidade' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1">
              <span className="text-xs text-[#847866]">Margem de Contribuição Estimada</span>
              <p className="text-xl font-mono tabular-nums font-semibold text-amber-300">
                {formatPercent(kpis.margemContribuicaoPct)}
              </p>
              <span className="text-[11px] text-[#B9AE9C]">(Faturamento - Custo Direto) / Faturamento</span>
            </div>
            <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1">
              <span className="text-xs text-[#847866]">Margem Operacional</span>
              <p className="text-xl font-mono tabular-nums font-semibold text-[#F4EFE6]">
                {formatPercent(kpis.margemOperacionalPct)}
              </p>
              <span className="text-[11px] text-[#B9AE9C]">Resultado Operacional / Faturamento</span>
            </div>
            <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1">
              <span className="text-xs text-[#847866]">Produtos com Margem &lt; 10% ou Negativa</span>
              <p className={`text-xl font-mono tabular-nums font-semibold ${alertProducts.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {alertProducts.length} produto(s)
              </p>
              <span className="text-[11px] text-[#B9AE9C]">Requerem revisão de preço ou custo</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
              <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
                Margem Operacional por Unidade de Negócio
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byUnit}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="nome" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => `${v}%`} width={50} />
                  <ReferenceLine y={0} stroke="#847866" />
                  <Tooltip content={<ChartTooltip formatterType="percent" />} />
                  <Bar dataKey="margemOperacionalPct" name="Margem Operacional (%)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
              <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
                Relação Faturamento vs Custos e Despesas (Mensal)
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={74} />
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="custoDireto" name="Custo Direto" stackId="cost" fill="#B45309" />
                  <Bar dataKey="despesaOperacional" name="Despesa Op." stackId="cost" fill="#78350F" />
                  <Line type="monotone" dataKey="faturamentoBruto" name="Faturamento Bruto" stroke="#FBBF24" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
            <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
              Resultado Operacional e Margens por Produto
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-amber-500/15 text-[#847866]">
                    <th className="py-2 px-3">Produto</th>
                    <th className="py-2 px-3 text-right">Faturamento</th>
                    <th className="py-2 px-3 text-right">Custo Direto</th>
                    <th className="py-2 px-3 text-right">Despesa Op.</th>
                    <th className="py-2 px-3 text-right">Resultado Op.</th>
                    <th className="py-2 px-3 text-right">Margem Contrib.</th>
                    <th className="py-2 px-3 text-right">Margem Op.</th>
                    <th className="py-2 px-3">Sinalização</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-500/10">
                  {byProduct.map((p) => {
                    const m = p.margemOperacionalPct;
                    const statusLabel =
                      m === null
                        ? 'Sem base'
                        : m < 0
                        ? 'Abaixo do esperado'
                        : m < 10
                        ? 'Atenção'
                        : 'Satisfatório';
                    return (
                      <tr key={p.nome} className="hover:bg-[#1E1813]">
                        <td className="py-2.5 px-3 font-medium text-[#F4EFE6]">{p.nome}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(p.faturamentoBruto)}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">{formatCurrencyBRL(p.custoDireto)}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">{formatCurrencyBRL(p.despesaOperacional)}</td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono tabular-nums font-medium ${
                            p.resultadoOperacional >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {formatCurrencyBRL(p.resultadoOperacional)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-300">
                          {formatPercent(p.margemContribuicaoPct)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium">
                          {formatPercent(p.margemOperacionalPct)}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusIndicator status={statusLabel} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FINANCEIRA */}
      {activeTab === 'financeira' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1">
              <span className="text-xs text-[#847866]">Faturamento Bruto</span>
              <p className="text-xl font-mono tabular-nums font-semibold text-[#F4EFE6]">
                {formatCurrencyBRL(kpis.faturamentoBruto)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1">
              <span className="text-xs text-[#847866]">Valores Recebidos</span>
              <p className="text-xl font-mono tabular-nums font-semibold text-emerald-400">
                {formatCurrencyBRL(kpis.valoresRecebidos)}
              </p>
              <span className="text-xs text-[#B9AE9C]">
                {formatPercent(kpis.percentualRecebimentoPct)} do faturamento
              </span>
            </div>
            <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1">
              <span className="text-xs text-[#847866]">Valores em Aberto</span>
              <p className="text-xl font-mono tabular-nums font-semibold text-amber-300">
                {formatCurrencyBRL(kpis.valoresEmAberto)}
              </p>
              <span className="text-xs text-[#B9AE9C]">
                {formatPercent(kpis.percentualEmAbertoPct)} do faturamento
              </span>
            </div>
            <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1">
              <span className="text-xs text-[#847866]">Custo por Litro (Direto)</span>
              <p className="text-xl font-mono tabular-nums font-semibold text-[#F4EFE6]">
                {formatCurrencyBRL(kpis.custoPorLitro)}
              </p>
              <span className="text-xs text-[#B9AE9C]">Custo direto / volume litros</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
              <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
                Distribuição por Forma de Pagamento
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byPayment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="nome" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={74} />
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="valorRecebido" name="Recebido" fill="#16A34A" stackId="pg" />
                  <Bar dataKey="valorEmAberto" name="Em Aberto" fill="#D97706" stackId="pg" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
              <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
                Evolução de Custos Diretos e Despesas Operacionais
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={74} />
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="custoDireto" name="Custo Direto" stroke="#F59E0B" strokeWidth={2} />
                  <Line type="monotone" dataKey="despesaOperacional" name="Despesa Operacional" stroke="#EF4444" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 overflow-x-auto">
            <h3 className="font-display text-base font-semibold text-[#F4EFE6] mb-3">
              Recebimento por Forma de Pagamento
            </h3>
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-500/15 text-[#847866]">
                  <th className="py-2 px-3">Forma de Pagamento</th>
                  <th className="py-2 px-3 text-right">Registros</th>
                  <th className="py-2 px-3 text-right">Faturamento Bruto</th>
                  <th className="py-2 px-3 text-right">Valor Recebido</th>
                  <th className="py-2 px-3 text-right">Valor em Aberto</th>
                  <th className="py-2 px-3 text-right">% Recebimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {byPayment.map((p) => (
                  <tr key={p.nome} className="hover:bg-[#1E1813]">
                    <td className="py-2.5 px-3 font-medium text-[#F4EFE6]">{p.nome}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatNumber(p.registros)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(p.faturamentoBruto)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400">{formatCurrencyBRL(p.valorRecebido)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-300">{formatCurrencyBRL(p.valorEmAberto)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatPercent(p.percentualRecebimentoPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: METAS */}
      {activeTab === 'metas' && (
        <div className="space-y-6">
          {/* Consolidado por Unidade */}
          <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
            <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
              Desempenho Consolidado de Metas por Unidade de Negócio
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-amber-500/15 text-[#847866]">
                    <th className="py-2 px-3">Unidade de Negócio</th>
                    <th className="py-2 px-3 text-right">Fat. Realizado</th>
                    <th className="py-2 px-3 text-right">Meta Faturamento</th>
                    <th className="py-2 px-3 text-right">Diferença (R$)</th>
                    <th className="py-2 px-3 text-right">Ating. Fat.</th>
                    <th className="py-2 px-3 text-right">Vol. Realizado</th>
                    <th className="py-2 px-3 text-right">Ating. Vol.</th>
                    <th className="py-2 px-3">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-500/10">
                  {unitMetaSummary.map((u) => (
                    <tr key={u.unidade} className="hover:bg-[#1E1813]">
                      <td className="py-2.5 px-3 font-medium text-[#F4EFE6]">{u.unidade}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(u.fat)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">{formatCurrencyBRL(u.metaFat)}</td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                          (u.difFat ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {formatCurrencyBRL(u.difFat)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium">{formatPercent(u.atingFat)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">{formatLiters(u.vol)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatPercent(u.atingVol)}</td>
                      <td className="py-2.5 px-3">
                        <StatusIndicator status={u.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detalhamento Mensal por Unidade */}
          <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
            <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
              Detalhamento Mensal de Metas (Período × Unidade)
            </h3>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-[#120E0B]">
                  <tr className="border-b border-amber-500/15 text-[#847866]">
                    <th className="py-2 px-3">Período</th>
                    <th className="py-2 px-3">Unidade</th>
                    <th className="py-2 px-3 text-right">Realizado (R$)</th>
                    <th className="py-2 px-3 text-right">Meta (R$)</th>
                    <th className="py-2 px-3 text-right">Ating. Fat.</th>
                    <th className="py-2 px-3 text-right">Realizado (L)</th>
                    <th className="py-2 px-3 text-right">Meta (L)</th>
                    <th className="py-2 px-3 text-right">Ating. Vol.</th>
                    <th className="py-2 px-3">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-500/10">
                  {metaRows.map((r) => (
                    <tr key={`${r.periodo}-${r.unidade_negocio}`} className="hover:bg-[#1E1813]">
                      <td className="py-2 px-3 font-mono tabular-nums text-amber-300">{r.periodo}</td>
                      <td className="py-2 px-3 text-[#F4EFE6]">{r.unidade_negocio}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(r.faturamentoRealizado)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">{formatCurrencyBRL(r.metaFaturamento)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{formatPercent(r.atingimentoFaturamentoPct)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">{formatLiters(r.volumeRealizado)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">{formatLiters(r.metaVolumeLitros)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{formatPercent(r.atingimentoVolumePct)}</td>
                      <td className="py-2 px-3">
                        <StatusIndicator status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProductRankTable: React.FC<{ title: string; rows: ReturnType<typeof buildSegmentMetrics> }> = ({
  title,
  rows,
}) => (
  <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
    <h3 className="font-display text-base font-semibold text-[#F4EFE6]">{title}</h3>
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="border-b border-amber-500/15 text-[#847866]">
            <th className="py-2 px-2.5">Produto</th>
            <th className="py-2 px-2.5 text-right">Volume (L)</th>
            <th className="py-2 px-2.5 text-right">Faturamento</th>
            <th className="py-2 px-2.5 text-right">Margem Op.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-500/10">
          {rows.map((r) => (
            <tr key={r.nome} className="hover:bg-[#1E1813]">
              <td className="py-2 px-2.5 font-medium text-[#F4EFE6] max-w-[180px] truncate" title={r.nome}>
                {r.nome}
              </td>
              <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#B9AE9C]">
                {formatLiters(r.volumeLitros)}
              </td>
              <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#F4EFE6]">
                {formatCurrencyBRL(r.faturamentoBruto)}
              </td>
              <td
                className={`py-2 px-2.5 text-right font-mono tabular-nums ${
                  (r.margemOperacionalPct ?? 0) < 0
                    ? 'text-red-400'
                    : (r.margemOperacionalPct ?? 0) < 10
                    ? 'text-amber-300'
                    : 'text-emerald-400'
                }`}
              >
                {formatPercent(r.margemOperacionalPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const StatusIndicator: React.FC<{ status: 'Satisfatório' | 'Atenção' | 'Abaixo do esperado' | 'Sem meta' | 'Sem base' }> = ({
  status,
}) => {
  if (status === 'Satisfatório') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Satisfatório</span>
      </span>
    );
  }
  if (status === 'Atenção') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-400 font-medium whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>Atenção</span>
      </span>
    );
  }
  if (status === 'Abaixo do esperado') {
    return (
      <span className="inline-flex items-center gap-1 text-red-400 font-medium whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Abaixo do esperado</span>
      </span>
    );
  }
  return <span className="text-[#847866] whitespace-nowrap">{status}</span>;
};
