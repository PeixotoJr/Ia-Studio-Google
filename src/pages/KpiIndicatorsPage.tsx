import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
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
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  CalendarClock,
  Info,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type {
  ComparisonMode,
  GlobalFilters,
  KpiCardMetric,
  KpiSignalStatus,
  LoadedDataset,
} from '../types/bi';
import { buildKpiModuleBundle } from '../services/kpiModuleCalculations';
import { buildMetaComparison } from '../services/biCalculations';
import {
  formatCurrencyBRL,
  formatCurrencyCompact,
  formatLiters,
  formatNumber,
  formatPercent,
} from '../utils/formatters';
import { ChartTooltip } from '../components/ChartTooltip';

interface KpiIndicatorsPageProps {
  dataset: LoadedDataset;
  filters: GlobalFilters;
}

type GroupFilter =
  | 'all'
  | 'financeiro'
  | 'comercial'
  | 'producao'
  | 'satisfacao'
  | 'metas'
  | 'graficos'
  | 'diagnostico';

interface AiKpiItem {
  indicadorAnalisado: string;
  valorObservado: string;
  comparacaoReferencia: string;
  interpretacao: string;
  recomendacaoAcao: string;
}

const CHANNEL_COLORS = ['#F59E0B', '#D97706', '#16A34A', '#38BDF8', '#B45309', '#92400E'];

const SIGNAL_STYLES: Record<
  KpiSignalStatus,
  { text: string; border: string; bg: string; sparkColor: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  favorable: {
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/10',
    sparkColor: '#16A34A',
    Icon: CheckCircle2,
  },
  attention: {
    text: 'text-amber-300',
    border: 'border-amber-500/25',
    bg: 'bg-amber-500/10',
    sparkColor: '#F59E0B',
    Icon: AlertTriangle,
  },
  unfavorable: {
    text: 'text-red-400',
    border: 'border-red-500/25',
    bg: 'bg-red-500/10',
    sparkColor: '#EF4444',
    Icon: XCircle,
  },
  insufficient: {
    text: 'text-[#847866]',
    border: 'border-amber-500/15',
    bg: 'bg-[#120E0B]',
    sparkColor: '#847866',
    Icon: MinusCircle,
  },
};

export const KpiIndicatorsPage: React.FC<KpiIndicatorsPageProps> = ({
  dataset,
  filters,
}) => {
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('mom');
  const [activeGroup, setActiveGroup] = useState<GroupFilter>('all');
  const [aiItems, setAiItems] = useState<AiKpiItem[] | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const bundle = useMemo(
    () => buildKpiModuleBundle(dataset.vendas, dataset.metas, filters, comparisonMode),
    [dataset.vendas, dataset.metas, filters, comparisonMode],
  );

  const detailedMetaRows = useMemo(
    () =>
      buildMetaComparison(
        dataset.vendas.filter((v) => {
          if (filters.periodo !== 'ALL' && v.periodo !== filters.periodo) return false;
          if (filters.periodoInicio !== 'ALL' && (!v.periodo || v.periodo < filters.periodoInicio)) return false;
          if (filters.periodoFim !== 'ALL' && (!v.periodo || v.periodo > filters.periodoFim)) return false;
          if (filters.ano !== 'ALL' && String(v.ano) !== filters.ano) return false;
          if (filters.mes !== 'ALL' && String(v.mes) !== filters.mes) return false;
          if (filters.unidade_negocio !== 'ALL' && v.unidade_negocio !== filters.unidade_negocio) return false;
          return true;
        }),
        dataset.metas,
        filters,
      ),
    [dataset.vendas, dataset.metas, filters],
  );

  const showSection = (g: Exclude<GroupFilter, 'all'>) =>
    activeGroup === 'all' || activeGroup === g;

  const handleInterpretWithAi = async () => {
    setIsLoadingAi(true);
    setAiError(null);
    try {
      const payloadLines = [
        `Período atual: ${bundle.currentPeriodLabel} | Período de referência: ${bundle.previousPeriodLabel}`,
        bundle.comparisonCaveat ? `Ressalva de comparabilidade: ${bundle.comparisonCaveat}` : '',
        '',
        'KPIS CALCULADOS PELO SISTEMA:',
        ...bundle.cards.map(
          (c) =>
            `- ${c.name}: Atual=${c.formattedValue} | Anterior=${c.formattedPreviousValue} | Var=${c.formattedDeltaAbs} (${c.deltaPct !== null ? formatPercent(c.deltaPct) : 'N/A'}) | Meta=${c.formattedMetaValue} | Ating=${formatPercent(c.attainmentPct)} | Status=${c.statusText}`,
        ),
        '',
        'METAS CONSOLIDADAS:',
        ...bundle.metaTargetsSummary.map(
          (m) =>
            `- ${m.indicador}: Realizado=${m.realizadoFormatted} | Meta=${m.metaFormatted} | Dif=${m.diferencaAbsFormatted} (${m.diferencaPctFormatted}) | Ating=${formatPercent(m.atingimentoPct)} | Situação=${m.situacaoLabel}`,
        ),
        '',
        'DESEMPENHO POR CATEGORIA:',
        ...bundle.byCategory.map(
          (c) =>
            `- ${c.nome}: Fat=${formatCurrencyBRL(c.faturamentoBruto)}, Vol=${formatLiters(c.volumeLitros)}, Margem Op=${formatPercent(c.margemOperacionalPct)}, Sat=${c.satisfacaoMedia !== null ? c.satisfacaoMedia.toFixed(2) : 'N/A'}`,
        ),
        '',
        'DESEMPENHO POR UNIDADE:',
        ...bundle.byUnit.map(
          (u) =>
            `- ${u.nome}: Fat=${formatCurrencyBRL(u.faturamentoBruto)}, Res.Op=${formatCurrencyBRL(u.resultadoOperacional)}, Margem Op=${formatPercent(u.margemOperacionalPct)}`,
        ),
      ];

      const resp = await fetch('/api/ai/kpi-diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpiPayload: payloadLines.join('\n') }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Erro ao interpretar KPIs com IA.');
      }
      setAiItems(data.items as AiKpiItem[]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Erro ao consultar IA.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  const financeiroCards = bundle.cards.filter((c) => c.group === 'financeiro');
  const comercialCards = bundle.cards.filter((c) => c.group === 'comercial');
  const producaoCards = bundle.cards.filter((c) => c.group === 'producao');
  const satisfacaoCards = bundle.cards.filter((c) => c.group === 'satisfacao');

  const hasRecordLevelFilter =
    filters.categoria !== 'ALL' ||
    filters.produto !== 'ALL' ||
    filters.forma_pagamento !== 'ALL' ||
    filters.status_pagamento !== 'ALL';

  return (
    <div className="space-y-6">
      {/* Period Comparison Mode & Section Navigator */}
      <section className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#F4EFE6]">
              <CalendarClock className="w-4 h-4 text-amber-400" />
              <span>Comparação Temporal dos KPIs</span>
            </div>
            <p className="text-xs text-[#B9AE9C] font-mono tabular-nums">
              Período atual: <strong className="text-amber-300">{bundle.currentPeriodLabel}</strong> · Referência:{' '}
              <strong className="text-[#F4EFE6]">{bundle.previousPeriodLabel}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0D0B09] border border-amber-500/20">
            {(
              [
                { id: 'mom', label: 'Mês vs Mês anterior' },
                { id: 'yoy', label: 'Mesmo mês vs Ano anterior' },
                { id: 'equal_duration', label: 'Período vs Anterior igual' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setComparisonMode(opt.id);
                  setAiItems(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  comparisonMode === opt.id
                    ? 'bg-amber-600 text-[#0D0B09] font-semibold'
                    : 'text-[#B9AE9C] hover:text-[#F4EFE6]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {bundle.comparisonCaveat && (
          <div className="p-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{bundle.comparisonCaveat}</span>
          </div>
        )}

        {/* Group Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-amber-500/10">
          {(
            [
              { id: 'all', label: 'Visão Completa' },
              { id: 'financeiro', label: '1. Financeiro' },
              { id: 'comercial', label: '2. Comercial' },
              { id: 'producao', label: '3. Produção e Estoque' },
              { id: 'satisfacao', label: '4. Satisfação' },
              { id: 'metas', label: '5. Metas e Resultados' },
              { id: 'graficos', label: 'Gráficos (12)' },
              { id: 'diagnostico', label: 'Inteligência Gerencial' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveGroup(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeGroup === tab.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-[#0D0B09] text-[#B9AE9C] hover:text-[#F4EFE6] border border-amber-500/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* GRUPO 1: DESEMPENHO FINANCEIRO */}
      {showSection('financeiro') && (
        <section className="space-y-4">
          <SectionHeader
            title="1. Desempenho Financeiro"
            subtitle="Faturamento, margens (contribuição vs operacional), custos diretos, despesas, custo por litro e recebíveis."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {financeiroCards.map((card) => (
              <KpiMetricCard key={card.id} card={card} />
            ))}
          </div>

          {/* Pagamentos breakdown */}
          <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
            <h4 className="font-display text-sm font-semibold text-[#F4EFE6]">
              Distribuição de Recebimentos e Valores em Aberto por Forma de Pagamento
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-amber-500/15 text-[#847866]">
                    <th className="py-2 px-3">Forma de Pagamento</th>
                    <th className="py-2 px-3 text-right">Faturamento</th>
                    <th className="py-2 px-3 text-right">Recebido</th>
                    <th className="py-2 px-3 text-right">Em Aberto</th>
                    <th className="py-2 px-3 text-right">% Recebido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-500/10">
                  {bundle.byPayment.map((p) => (
                    <tr key={p.nome} className="hover:bg-[#1E1813]">
                      <td className="py-2 px-3 font-medium text-[#F4EFE6]">{p.nome}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(p.faturamentoBruto)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-400">{formatCurrencyBRL(p.valorRecebido)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-300">{formatCurrencyBRL(p.valorEmAberto)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{formatPercent(p.percentualRecebimentoPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* GRUPO 2: DESEMPENHO COMERCIAL */}
      {showSection('comercial') && (
        <section className="space-y-4">
          <SectionHeader
            title="2. Desempenho Comercial"
            subtitle="Volume comercializado, unidades vendidas, ticket médio por registro (sem ID único de cliente), preço médio/L, canais e categorias."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {comercialCards.map((card) => (
              <KpiMetricCard key={card.id} card={card} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Canais */}
            <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
              <h4 className="font-display text-sm font-semibold text-[#F4EFE6]">
                Participação dos Canais de Venda (Faturamento e Volume)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-amber-500/15 text-[#847866]">
                      <th className="py-2 px-2.5">Canal / Unidade</th>
                      <th className="py-2 px-2.5 text-right">Part. Fat.</th>
                      <th className="py-2 px-2.5 text-right">Part. Vol.</th>
                      <th className="py-2 px-2.5 text-right">Preço/L</th>
                      <th className="py-2 px-2.5 text-right">Margem Op.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-500/10">
                    {bundle.channelMix.map((c) => (
                      <tr key={c.canal} className="hover:bg-[#1E1813]">
                        <td className="py-2 px-2.5 font-medium text-[#F4EFE6]">{c.canal}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-amber-300">{formatPercent(c.participacaoFaturamentoPct)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#B9AE9C]">{formatPercent(c.participacaoVolumePct)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrencyBRL(c.precoMedioPorLitro)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatPercent(c.margemOperacionalPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Categorias */}
            <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
              <h4 className="font-display text-sm font-semibold text-[#F4EFE6]">
                Desempenho por Categoria (Faturamento, Volume, Custo e Margem)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-amber-500/15 text-[#847866]">
                      <th className="py-2 px-2.5">Categoria</th>
                      <th className="py-2 px-2.5 text-right">Faturamento</th>
                      <th className="py-2 px-2.5 text-right">Volume (L)</th>
                      <th className="py-2 px-2.5 text-right">Custo Direto</th>
                      <th className="py-2 px-2.5 text-right">Margem Op.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-500/10">
                    {bundle.byCategory.map((c) => (
                      <tr key={c.nome} className="hover:bg-[#1E1813]">
                        <td className="py-2 px-2.5 font-medium text-[#F4EFE6]">{c.nome}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrencyBRL(c.faturamentoBruto)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#B9AE9C]">{formatLiters(c.volumeLitros)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#B9AE9C]">{formatCurrencyBRL(c.custoDireto)}</td>
                        <td
                          className={`py-2 px-2.5 text-right font-mono tabular-nums font-medium ${
                            (c.margemOperacionalPct ?? 0) >= 15
                              ? 'text-emerald-400'
                              : (c.margemOperacionalPct ?? 0) >= 0
                              ? 'text-amber-300'
                              : 'text-red-400'
                          }`}
                        >
                          {formatPercent(c.margemOperacionalPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* GRUPO 3: PRODUÇÃO E ESTOQUE */}
      {showSection('producao') && (
        <section className="space-y-4">
          <SectionHeader
            title="3. Produção e Estoque"
            subtitle="Observações transacionais de estoque antes/depois, movimentação observada e demanda produtiva por categoria."
          />

          <div className="p-3.5 rounded-xl bg-[#16120E] border border-amber-500/20 text-xs text-[#B9AE9C] flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                <strong className="text-[#F4EFE6]">Escopo de estoque:</strong> Os campos <span className="font-mono">estoque_unidades_antes</span> e <span className="font-mono">estoque_unidades_depois</span> representam observações pontuais no momento da venda e não constituem inventário consolidado nem histórico completo de entradas/saídas.
              </p>
              <p>
                <strong className="text-[#F4EFE6]">Perdas produtivas:</strong> Não são estimadas perdas reais de produção, pois a aba Vendas não possui registros efetivos de perdas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {producaoCards.map((card) => (
              <KpiMetricCard key={card.id} card={card} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Planejamento de Produção - Demanda por Categoria */}
            <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
              <h4 className="font-display text-sm font-semibold text-[#F4EFE6]">
                Demanda de Produção por Categoria (Volume Comercializado)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-amber-500/15 text-[#847866]">
                      <th className="py-2 px-2.5">Categoria</th>
                      <th className="py-2 px-2.5 text-right">Volume (L)</th>
                      <th className="py-2 px-2.5 text-right">Part. Vol.</th>
                      <th className="py-2 px-2.5 text-right">Preço/L</th>
                      <th className="py-2 px-2.5 text-right">Resultado Op.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-500/10">
                    {bundle.productionDemand.map((d) => (
                      <tr key={d.categoria} className="hover:bg-[#1E1813]">
                        <td className="py-2 px-2.5 font-medium text-[#F4EFE6]">{d.categoria}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-amber-300">{formatLiters(d.volumeLitros)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatPercent(d.participacaoVolumePct)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#B9AE9C]">{formatCurrencyBRL(d.precoMedioPorLitro)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrencyBRL(d.resultadoOperacional)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Estoque observado por categoria/produto */}
            <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
              <h4 className="font-display text-sm font-semibold text-[#F4EFE6]">
                Estoque Observado e Movimentação por Produto (Top 8 Volume)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-amber-500/15 text-[#847866]">
                      <th className="py-2 px-2.5">Produto</th>
                      <th className="py-2 px-2.5 text-right">Qtd. Vendida</th>
                      <th className="py-2 px-2.5 text-right">Est. Médio Antes</th>
                      <th className="py-2 px-2.5 text-right">Est. Médio Depois</th>
                      <th className="py-2 px-2.5 text-right">Mov. Obs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-500/10">
                    {bundle.stockSummary.byProduct.slice(0, 8).map((s) => (
                      <tr key={`${s.categoria}-${s.produto}`} className="hover:bg-[#1E1813]">
                        <td className="py-2 px-2.5 font-medium text-[#F4EFE6] max-w-[160px] truncate" title={s.produto}>
                          {s.produto}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatNumber(s.quantidadeVendida)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#B9AE9C]">{formatNumber(s.estoqueMedioAntes, 1)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#B9AE9C]">{formatNumber(s.estoqueMedioDepois, 1)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-amber-300">{formatPercent(s.indiceMovimentacao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* GRUPO 4: SATISFAÇÃO DOS CLIENTES */}
      {showSection('satisfacao') && (
        <section className="space-y-4">
          <SectionHeader
            title="4. Satisfação dos Clientes"
            subtitle={`Média calculada exclusivamente sobre ${bundle.satisfactionSummary.avaliacoesValidas} avaliações válidas (0 a 10); ${bundle.satisfactionSummary.avaliacoesAusentes} registros nulos preservados sem conversão para zero.`}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4">
              {satisfacaoCards.map((card) => (
                <KpiMetricCard key={card.id} card={card} />
              ))}
            </div>

            <div className="lg:col-span-8 p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
              <h4 className="font-display text-sm font-semibold text-[#F4EFE6]">
                Distribuição das Avaliações Válidas (0 a 10)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bundle.satisfactionSummary.buckets.map((b) => (
                  <div key={b.faixa} className="p-3 rounded-lg bg-[#0D0B09] border border-amber-500/10 flex items-center justify-between text-xs">
                    <span className="text-[#F4EFE6]">{b.faixa}</span>
                    <span className="font-mono tabular-nums text-amber-300">
                      {formatNumber(b.quantidade)} ({formatPercent(b.percentualPct)})
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-500/10 text-xs">
                <div>
                  <p className="text-[#847866] mb-1.5 font-medium">Média por Unidade de Negócio</p>
                  {bundle.satisfactionSummary.byUnit.map((u) => (
                    <div key={u.nome} className="flex justify-between py-1 border-b border-amber-500/5">
                      <span className="text-[#B9AE9C]">{u.nome}</span>
                      <span className="font-mono tabular-nums text-[#F4EFE6]">
                        {u.satisfacaoMedia !== null ? u.satisfacaoMedia.toFixed(2) : 'N/A'}
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[#847866] mb-1.5 font-medium">Média por Categoria</p>
                  {bundle.satisfactionSummary.byCategory.map((c) => (
                    <div key={c.nome} className="flex justify-between py-1 border-b border-amber-500/5">
                      <span className="text-[#B9AE9C]">{c.nome}</span>
                      <span className="font-mono tabular-nums text-[#F4EFE6]">
                        {c.satisfacaoMedia !== null ? c.satisfacaoMedia.toFixed(2) : 'N/A'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* GRUPO 5: METAS E RESULTADOS */}
      {showSection('metas') && (
        <section className="space-y-4">
          <SectionHeader
            title="5. Metas e Resultados"
            subtitle="Confronto ponderado entre realizado (aba Vendas) e metas estabelecidas (aba Metas) por período e unidade de negócio."
          />

          <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-500/15 text-[#847866]">
                  <th className="py-2.5 px-3">Indicador</th>
                  <th className="py-2.5 px-3 text-right">Realizado</th>
                  <th className="py-2.5 px-3 text-right">Meta</th>
                  <th className="py-2.5 px-3 text-right">Diferença Abs.</th>
                  <th className="py-2.5 px-3 text-right">Diferença %</th>
                  <th className="py-2.5 px-3 text-right">Atingimento</th>
                  <th className="py-2.5 px-3">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {bundle.metaTargetsSummary.map((row) => (
                  <tr key={row.indicador} className="hover:bg-[#1E1813]">
                    <td className="py-3 px-3">
                      <span className="font-medium text-[#F4EFE6] block">{row.indicador}</span>
                      {row.observacao && <span className="text-[11px] text-[#847866]">{row.observacao}</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#F4EFE6]">{row.realizadoFormatted}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">{row.metaFormatted}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{row.diferencaAbsFormatted}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{row.diferencaPctFormatted}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-medium">{formatPercent(row.atingimentoPct)}</td>
                    <td className="py-3 px-3">
                      <SignalBadge status={row.situacao} label={row.situacaoLabel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!hasRecordLevelFilter && detailedMetaRows.length > 0 && (
            <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
              <h4 className="font-display text-sm font-semibold text-[#F4EFE6]">
                Acompanhamento Detalhado por Período e Unidade de Negócio
              </h4>
              <div className="overflow-x-auto max-h-[340px]">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 bg-[#120E0B]">
                    <tr className="border-b border-amber-500/15 text-[#847866]">
                      <th className="py-2 px-3">Período</th>
                      <th className="py-2 px-3">Unidade</th>
                      <th className="py-2 px-3 text-right">Fat. Realizado</th>
                      <th className="py-2 px-3 text-right">Meta Fat.</th>
                      <th className="py-2 px-3 text-right">Ating. Fat.</th>
                      <th className="py-2 px-3 text-right">Margem Real.</th>
                      <th className="py-2 px-3 text-right">Meta Margem</th>
                      <th className="py-2 px-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-500/10">
                    {detailedMetaRows.map((r) => (
                      <tr key={`${r.periodo}-${r.unidade_negocio}`} className="hover:bg-[#1E1813]">
                        <td className="py-2 px-3 font-mono tabular-nums text-amber-300">{r.periodo}</td>
                        <td className="py-2 px-3">{r.unidade_negocio}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(r.faturamentoRealizado)}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">
                          {r.metaFaturamento !== null ? formatCurrencyBRL(r.metaFaturamento) : 'Meta não cadastrada'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{formatPercent(r.atingimentoFaturamentoPct)}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{formatPercent(r.margemRealizadaPct)}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">{formatPercent(r.metaMargemPct)}</td>
                        <td className="py-2 px-3 text-xs">{r.status === 'Sem meta' ? 'Meta não cadastrada' : r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 12 GRÁFICOS OBRIGATÓRIOS */}
      {showSection('graficos') && (
        <section className="space-y-4">
          <SectionHeader
            title="Painel Gráfico de Indicadores (12 Visualizações)"
            subtitle="Todos os gráficos respondem dinamicamente aos filtros globais selecionados."
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Linha: evolução mensal do faturamento */}
            <KpiChartCard title="1. Evolução Mensal do Faturamento (Linha)">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={bundle.monthlyCurrent}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={72} />
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="faturamentoBruto" name="Faturamento Bruto" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </KpiChartCard>

            {/* 2. Linha: evolução do resultado operacional */}
            <KpiChartCard title="2. Evolução do Resultado Operacional (Linha)">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={bundle.monthlyCurrent}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={72} />
                  <ReferenceLine y={0} stroke="#847866" />
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="resultadoOperacional" name="Resultado Operacional" stroke="#16A34A" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </KpiChartCard>

            {/* 3. Linha: evolução da margem operacional */}
            <KpiChartCard title="3. Evolução da Margem Operacional % (Linha)">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={bundle.monthlyCurrent}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => `${v}%`} width={50} />
                  <ReferenceLine y={0} stroke="#847866" />
                  <Tooltip content={<ChartTooltip formatterType="percent" />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="margemOperacionalPct" name="Margem Operacional (%)" stroke="#38BDF8" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </KpiChartCard>

            {/* 4. Barras: faturamento por categoria */}
            <KpiChartCard title="4. Faturamento por Categoria (Barras)">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bundle.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="nome" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={72} />
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="faturamentoBruto" name="Faturamento Bruto" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </KpiChartCard>

            {/* 5. Barras: resultado operacional por unidade de negócio */}
            <KpiChartCard title="5. Resultado Operacional por Unidade de Negócio (Barras)">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bundle.byUnit}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="nome" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={72} />
                  <ReferenceLine y={0} stroke="#847866" />
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="resultadoOperacional" name="Resultado Operacional" radius={[4, 4, 0, 0]}>
                    {bundle.byUnit.map((u, idx) => (
                      <Cell key={`u-${idx}`} fill={u.resultadoOperacional >= 0 ? '#16A34A' : '#DC2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </KpiChartCard>

            {/* 6. Barras agrupadas: realizado versus meta */}
            <KpiChartCard title="6. Faturamento Realizado vs Meta (Barras Agrupadas)">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bundle.monthlyCurrent}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={72} />
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="faturamentoBruto" name="Realizado" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  {!hasRecordLevelFilter && (
                    <Bar dataKey="metaFaturamento" name="Meta" fill="#64748B" radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </KpiChartCard>

            {/* 7. Rosca: participação das unidades de negócio no faturamento */}
            <KpiChartCard title="7. Participação das Unidades no Faturamento (Rosca)">
              <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 h-[240px]">
                <div className="sm:col-span-7 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bundle.byUnit}
                        dataKey="faturamentoBruto"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={82}
                        paddingAngle={2}
                      >
                        {bundle.byUnit.map((_, idx) => (
                          <Cell key={`d-${idx}`} fill={CHANNEL_COLORS[idx % CHANNEL_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip formatterType="currency" />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="sm:col-span-5 space-y-1.5 text-xs overflow-y-auto max-h-[210px]">
                  {bundle.byUnit.map((u, idx) => (
                    <div key={u.nome} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: CHANNEL_COLORS[idx % CHANNEL_COLORS.length] }}
                        />
                        <span className="text-[#F4EFE6] truncate">{u.nome}</span>
                      </span>
                      <span className="font-mono tabular-nums text-amber-300 shrink-0">
                        {formatPercent(u.participacaoFaturamentoPct)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </KpiChartCard>

            {/* 8. Barras: volume comercializado por categoria */}
            <KpiChartCard title="8. Volume Comercializado por Categoria (Barras)">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bundle.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="nome" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => `${formatNumber(Number(v))} L`} width={68} />
                  <Tooltip content={<ChartTooltip formatterType="liters" />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="volumeLitros" name="Volume (Litros)" fill="#D97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </KpiChartCard>

            {/* 9. Linha: evolução do custo por litro */}
            <KpiChartCard title="9. Evolução do Custo Direto por Litro (Linha)">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={bundle.monthlyCurrent}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => `R$ ${Number(v).toFixed(2)}`} width={68} />
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="custoPorLitro" name="Custo/Litro (R$/L)" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </KpiChartCard>

            {/* 10. Barras: recebimentos versus valores em aberto */}
            <KpiChartCard title="10. Recebimentos vs Valores em Aberto por Mês (Barras)">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bundle.monthlyCurrent}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={72} />
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="valorRecebido" name="Valor Recebido" fill="#16A34A" stackId="rec" />
                  <Bar dataKey="valorEmAberto" name="Valor em Aberto" fill="#D97706" stackId="rec" />
                </BarChart>
              </ResponsiveContainer>
            </KpiChartCard>

            {/* 11. Barras: satisfação média por categoria */}
            <KpiChartCard title="11. Satisfação Média por Categoria (Barras · 0–10)">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bundle.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="nome" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fill: '#B9AE9C', fontSize: 11 }} width={40} />
                  <Tooltip content={<ChartTooltip formatterType="number" />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="satisfacaoMedia" name="Nota Média (0–10)" fill="#FBBF24" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </KpiChartCard>

            {/* 12. Linha: comparação entre faturamento atual e período anterior */}
            <KpiChartCard title="12. Faturamento Atual vs Período Anterior (Linha)">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={bundle.comparisonSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={72} />
                  <Tooltip content={<ChartTooltip formatterType="currency" />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="faturamentoAtual" name="Período Atual" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="faturamentoAnterior" name="Período Anterior" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </KpiChartCard>
          </div>
        </section>
      )}

      {/* INTELIGÊNCIA GERENCIAL AUTOMÁTICA BASEADA NOS KPIS */}
      {showSection('diagnostico') && (
        <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
                Inteligência Gerencial Automática (Diagnóstico dos KPIs)
              </h3>
              <p className="text-xs text-[#847866] mt-0.5">
                Diagnósticos gerados matematicamente pelo sistema a partir dos KPIs calculados. Opcionalmente, solicite ao Consultor IA uma interpretação complementar sobre esses números já apurados.
              </p>
            </div>
            <button
              type="button"
              onClick={handleInterpretWithAi}
              disabled={isLoadingAi}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-[#0D0B09] text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              {isLoadingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isLoadingAi ? 'Interpretando KPIs...' : 'Interpretar KPIs com Consultor IA'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {bundle.diagnostics.map((d) => (
              <div
                key={d.id}
                className="p-4 rounded-xl bg-[#0D0B09] border border-amber-500/15 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#F4EFE6] text-sm">{d.indicadorAnalisado}</span>
                  <SignalBadge
                    status={d.status}
                    label={
                      d.status === 'favorable'
                        ? 'Favorável'
                        : d.status === 'attention'
                        ? 'Atenção'
                        : d.status === 'unfavorable'
                        ? 'Desfavorável'
                        : 'Sem base'
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono tabular-nums text-[11px] text-amber-300">
                  <span>Observado: {d.valorObservado}</span>
                  <span className="text-[#B9AE9C]">Ref.: {d.comparacaoReferencia}</span>
                </div>
                <p className="text-[#B9AE9C]">
                  <strong className="text-[#F4EFE6]">Interpretação:</strong> {d.interpretacao}
                </p>
                <p className="text-[#B9AE9C]">
                  <strong className="text-emerald-400">Recomendação:</strong> {d.recomendacaoAcao}
                </p>
              </div>
            ))}
          </div>

          {aiError && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200">
              {aiError}
            </div>
          )}

          {aiItems && aiItems.length > 0 && (
            <div className="pt-4 border-t border-amber-500/15 space-y-3">
              <h4 className="font-display text-sm font-semibold text-amber-300">
                Parecer Consultivo da IA (sobre os KPIs pré-calculados)
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {aiItems.map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[#0D0B09] border border-amber-500/25 space-y-1.5 text-xs">
                    <p className="font-semibold text-[#F4EFE6]">{item.indicadorAnalisado}</p>
                    <p className="font-mono tabular-nums text-amber-300 text-[11px]">
                      {item.valorObservado} · {item.comparacaoReferencia}
                    </p>
                    <p className="text-[#B9AE9C]">{item.interpretacao}</p>
                    <p className="text-emerald-400/90">
                      <strong>Ação:</strong> {item.recomendacaoAcao}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div>
    <h3 className="font-display text-base sm:text-lg font-semibold text-[#F4EFE6]">{title}</h3>
    <p className="text-xs text-[#847866] mt-0.5">{subtitle}</p>
  </div>
);

const KpiMetricCard: React.FC<{ card: KpiCardMetric }> = ({ card }) => {
  const style = SIGNAL_STYLES[card.status];
  const Icon = style.Icon;

  return (
    <div className={`p-4 rounded-xl bg-[#16120E] border ${style.border} flex flex-col justify-between space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#B9AE9C] truncate" title={card.name}>
            {card.name}
          </p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg sm:text-xl font-mono tabular-nums font-semibold text-[#F4EFE6]">
              {card.formattedValue}
            </span>
            <span className="text-[11px] text-[#847866]">{card.unitLabel}</span>
          </div>
        </div>

        {/* Mini Sparkline */}
        {card.sparkline.length > 1 && (
          <div className="w-24 h-11 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={card.sparkline}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={style.sparkColor}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-500/10 text-[11px]">
        <div>
          <span className="text-[#847866] block">Período anterior</span>
          <span className="font-mono tabular-nums text-[#B9AE9C]">{card.formattedPreviousValue}</span>
        </div>
        <div className="text-right">
          <span className="text-[#847866] block">Variação</span>
          <span className={`font-mono tabular-nums font-medium ${style.text}`}>
            {card.formattedDeltaAbs}{' '}
            {card.deltaPct !== null ? `(${card.deltaPct >= 0 ? '+' : ''}${formatPercent(card.deltaPct)})` : ''}
          </span>
        </div>
        <div>
          <span className="text-[#847866] block">Meta</span>
          <span className="font-mono tabular-nums text-[#B9AE9C]">{card.formattedMetaValue}</span>
        </div>
        <div className="text-right">
          <span className="text-[#847866] block">Atingimento</span>
          <span className="font-mono tabular-nums text-[#F4EFE6]">{formatPercent(card.attainmentPct)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-amber-500/10 text-[11px]">
        <span className={`inline-flex items-center gap-1 font-medium ${style.text}`}>
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span>{card.statusText}</span>
        </span>
      </div>

      {card.note && <p className="text-[11px] text-[#847866] leading-snug">{card.note}</p>}
    </div>
  );
};

const SignalBadge: React.FC<{ status: KpiSignalStatus; label: string }> = ({ status, label }) => {
  const style = SIGNAL_STYLES[status];
  const Icon = style.Icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${style.text}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
};

const KpiChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
    <h4 className="font-display text-sm font-semibold text-[#F4EFE6]">{title}</h4>
    <div>{children}</div>
  </div>
);
