import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Loader2,
  ArrowRightCircle,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import type { LoadedDataset, VendaRecord, GlobalFilters, DecisaoRecord } from '../types/bi';
import { buildMonthlySeries } from '../services/biCalculations';
import {
  generateAdvancedForecast,
  buildSegmentedForecasts,
  buildCoherentFinancialForecast,
  buildForecastGoalComparison,
  simulateForecastScenarios,
  type ForecastHorizon,
  type ForecastModelType,
  type ForecastResult,
} from '../services/predictiveEngine';
import {
  formatCurrencyBRL,
  formatCurrencyCompact,
  formatLiters,
  formatNumber,
  formatPercent,
} from '../utils/formatters';
import { ChartTooltip } from '../components/ChartTooltip';

interface PredictiveAnalysisPageProps {
  dataset: LoadedDataset;
  filteredVendas: VendaRecord[];
  filters: GlobalFilters;
  onCreateDecision?: (decision: DecisaoRecord) => void;
}

type IndicatorChoice =
  | 'faturamento_bruto'
  | 'volume_litros'
  | 'resultado_operacional'
  | 'custo_direto'
  | 'despesa_operacional';

interface AiPredictiveRecommendation {
  indicadorAnalisado: string;
  previsaoCalculada: string;
  evidenciaHistorica: string;
  grauIncerteza: string;
  interpretacao: string;
  recomendacaoGerencial: string;
}

export const PredictiveAnalysisPage: React.FC<PredictiveAnalysisPageProps> = ({
  dataset,
  filteredVendas,
  filters,
  onCreateDecision,
}) => {
  const [horizon, setHorizon] = useState<ForecastHorizon>(3);
  const [modelMode, setModelMode] = useState<ForecastModelType>('auto');
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorChoice>('faturamento_bruto');
  const [focusedCategory, setFocusedCategory] = useState<string>('');
  const [conservativeAdj, setConservativeAdj] = useState<number>(-10);
  const [optimisticAdj, setOptimisticAdj] = useState<number>(10);
  const [costElasticity, setCostElasticity] = useState<number>(55);

  const [aiInsights, setAiInsights] = useState<AiPredictiveRecommendation[] | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const baseMonthly = useMemo(
    () => buildMonthlySeries(filteredVendas, dataset.metas, filters),
    [filteredVendas, dataset.metas, filters],
  );

  // Coherent financial forecasts (Revenue, Direct Cost, Operating Expense, Operating Result)
  const financial = useMemo(
    () => buildCoherentFinancialForecast(baseMonthly, modelMode, horizon),
    [baseMonthly, modelMode, horizon],
  );

  // Volume forecast
  const volumeForecast = useMemo(
    () =>
      generateAdvancedForecast(
        baseMonthly,
        (m) => m.volumeLitros,
        'volume_litros',
        'Volume Comercializado (Litros)',
        'L',
        modelMode,
        horizon,
        false,
      ),
    [baseMonthly, modelMode, horizon],
  );

  // Primary chart forecast according to selected indicator
  const activeForecast: ForecastResult = useMemo(() => {
    switch (selectedIndicator) {
      case 'volume_litros':
        return volumeForecast;
      case 'resultado_operacional':
        return financial.opResult;
      case 'custo_direto':
        return financial.directCost;
      case 'despesa_operacional':
        return financial.opExpense;
      default:
        return financial.revenue;
    }
  }, [selectedIndicator, volumeForecast, financial]);

  // 3.6 Demanda por categoria (Pilsen, IPA, Weiss, Stout, Sour, etc.)
  const categoryForecasts = useMemo(
    () =>
      buildSegmentedForecasts(
        filteredVendas,
        dataset.metas,
        filters,
        'categoria',
        modelMode,
        horizon,
      ),
    [filteredVendas, dataset.metas, filters, modelMode, horizon],
  );

  const activeCategorySummary = useMemo(() => {
    if (categoryForecasts.length === 0) return null;
    return (
      categoryForecasts.find((c) => c.nome === focusedCategory) || categoryForecasts[0]
    );
  }, [categoryForecasts, focusedCategory]);

  // 3.7 Desempenho por unidade de negócio (Loja Física, Delivery, Distribuidores, Eventos, etc.)
  const unitForecasts = useMemo(
    () =>
      buildSegmentedForecasts(
        filteredVendas,
        dataset.metas,
        filters,
        'unidade_negocio',
        modelMode,
        horizon,
      ),
    [filteredVendas, dataset.metas, filters, modelMode, horizon],
  );

  // 8. Scenario simulation
  const scenarios = useMemo(
    () =>
      simulateForecastScenarios(
        financial.coherentRows,
        horizon,
        conservativeAdj,
        optimisticAdj,
        costElasticity,
      ),
    [financial.coherentRows, horizon, conservativeAdj, optimisticAdj, costElasticity],
  );

  // 9. Comparison with future Metas
  const goalComparison = useMemo(
    () =>
      buildForecastGoalComparison(
        financial.coherentRows,
        volumeForecast,
        dataset.metas,
        filters,
      ),
    [financial.coherentRows, volumeForecast, dataset.metas, filters],
  );

  const handleInterpretWithAi = async () => {
    setIsLoadingAi(true);
    setAiError(null);
    try {
      const payloadLines = [
        `Escopo: ${filteredVendas.length} registros observados | Meses válidos: ${financial.revenue.historicalCount} | Lacunas mensais: ${financial.revenue.missingMonthsCount} | Horizonte: ${horizon} mês(es)`,
        `Confiabilidade amostral: ${financial.revenue.reliabilityLabel}`,
        `Qualidade (aba Qualidade): ${dataset.metadata.validationStatus}`,
        '',
        'PREVISÃO DE FATURAMENTO:',
        `- Modelo selecionado: ${financial.revenue.selectedModelName} (${financial.revenue.selectionJustification})`,
        `- Próximo mês: ${formatCurrencyBRL(financial.revenue.nextMonthForecast)} | Acumulado ${horizon}m: ${formatCurrencyBRL(financial.revenue.accumulatedForecast)} | Variação esperada vs último mês: ${formatPercent(financial.revenue.expectedVariationPct)} | Tendência: ${financial.revenue.trendDirection}`,
        `- Erro Backtesting Walk-Forward (${financial.revenue.errorMetrics.sampleSizeValidation} testes): RMSE=${formatCurrencyBRL(financial.revenue.errorMetrics.rmse)}, MAE=${formatCurrencyBRL(financial.revenue.errorMetrics.mae)}, MAPE=${formatPercent(financial.revenue.errorMetrics.mapePct)}`,
        '',
        'PREVISÃO DE VOLUME:',
        `- Volume acumulado ${horizon}m: ${formatLiters(volumeForecast.accumulatedForecast)} | Variação esperada: ${formatPercent(volumeForecast.expectedVariationPct)} | Tendência: ${volumeForecast.trendDirection}`,
        '',
        'PREVISÃO FINANCEIRA COERENTE (MÊS A MÊS):',
        ...financial.coherentRows.map(
          (r) =>
            `- ${r.periodo}: Fat=${formatCurrencyBRL(r.faturamentoPrevisto)}, CustoDir=${formatCurrencyBRL(r.custoDiretoPrevisto)}, DespOp=${formatCurrencyBRL(r.despesaOperacionalPrevista)}, ResOp=${formatCurrencyBRL(r.resultadoOperacionalPrevisto)}, MargemProj=${formatPercent(r.margemOperacionalProjetadaPct)}`,
        ),
        '',
        'PREVISÃO POR CATEGORIA (VOLUME & FATURAMENTO):',
        ...categoryForecasts.map(
          (c) =>
            `- ${c.nome}: Vol Proj (${horizon}m)=${formatLiters(c.projectedVolumeSum)}, Fat Proj=${formatCurrencyBRL(c.projectedRevenueSum)}, Var Vol=${formatPercent(c.expectedVolumeDeltaPct)}, Tendência=${c.trendDirection}`,
        ),
        '',
        'PREVISÃO POR UNIDADE DE NEGÓCIO (CANAIS):',
        ...unitForecasts.map(
          (u) =>
            `- ${u.nome}: Fat Proj (${horizon}m)=${formatCurrencyBRL(u.projectedRevenueSum)} (Part.=${formatPercent(u.projectedRevenueSharePct)}), Var=${formatPercent(u.expectedRevenueDeltaPct)}, Tendência=${u.trendDirection}`,
        ),
        '',
        'DECISÕES JÁ CADASTRADAS NA PLANILHA (REFERÊNCIA):',
        ...dataset.decisoes.slice(0, 6).map((d) => `- ${d.id_decisao}: ${d.tema} (${d.status})`),
      ];

      const resp = await fetch('/api/ai/predictive-diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictivePayload: payloadLines.join('\n') }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Erro ao interpretar previsões com IA.');
      }
      setAiInsights(data.items as AiPredictiveRecommendation[]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Erro ao consultar IA.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleConvertInsightToDecision = (item: AiPredictiveRecommendation) => {
    if (!onCreateDecision) return;
    const now = new Date().toISOString();
    onCreateDecision({
      id_decisao: `DEC-PRED-${String(dataset.decisoes.length + 1).padStart(3, '0')}`,
      tema: `Previsão · ${item.indicadorAnalisado}`,
      analise_necessaria: `${item.evidenciaHistorica} | Incerteza: ${item.grauIncerteza}`,
      decisao_possivel: item.recomendacaoGerencial,
      responsavel: 'Gestão Galpão Bier',
      periodicidade: 'Mensal',
      indicador_associado: item.indicadorAnalisado,
      status: 'Planejada',
      prioridade: 'Alta',
      data_decisao: now.slice(0, 10),
      justificativa: `Previsão calculada: ${item.previsaoCalculada} | Interpretação: ${item.interpretacao}`,
      origem_registro: 'Novo Registro',
      updated_at: now,
      historico: [
        {
          timestamp: now,
          action: 'Originada da Análise Preditiva',
          details: `Recomendação gerencial gerada sobre previsão de ${horizon} mês(es).`,
        },
      ],
    });
  };

  // Build chart data with clean separation between historical and projected series
  // Must stay above any conditional return to obey React Rules of Hooks.
  const mainChartData = useMemo(() => {
    const lastHistIdx = activeForecast.points.map((p) => p.tipo).lastIndexOf('histórico');
    return activeForecast.points.map((p, idx) => ({
      ...p,
      // Connect dashed line smoothly from last historical point without marking historical point as forecast
      seriePrevista:
        p.tipo === 'previsão'
          ? p.previsto
          : idx === lastHistIdx
          ? p.realizado
          : null,
      intervaloFaixa:
        p.tipo === 'previsão' && p.limiteInferior !== null && p.limiteSuperior !== null
          ? [p.limiteInferior, p.limiteSuperior]
          : null,
    }));
  }, [activeForecast]);

  const categoryDetailChartData = useMemo(() => {
    if (!activeCategorySummary) return [];
    const pts = activeCategorySummary.volumeForecast.points;
    const lastHistIdx = pts.map((p) => p.tipo).lastIndexOf('histórico');
    return pts.map((p, idx) => ({
      ...p,
      seriePrevista:
        p.tipo === 'previsão'
          ? p.previsto
          : idx === lastHistIdx
          ? p.realizado
          : null,
    }));
  }, [activeCategorySummary]);

  if (filteredVendas.length === 0) {
    return (
      <div className="p-8 rounded-xl bg-[#16120E] border border-amber-500/20 text-center text-sm text-[#B9AE9C]">
        Nenhum registro disponível para modelagem preditiva no recorte atual.
      </div>
    );
  }

  const rev = financial.revenue;
  const revNextPeriod = rev.points.find((p) => p.tipo === 'previsão')?.periodo ?? 'N/A';
  const revLastFuture = [...rev.points].reverse().find((p) => p.tipo === 'previsão')?.periodo ?? 'N/A';
  const horizonRangeLabel =
    horizon === 1 ? revNextPeriod : `${revNextPeriod} a ${revLastFuture}`;

  const futureOpResultAcc = financial.coherentRows.reduce<number | null>(
    (acc, r) => (r.resultadoOperacionalPrevisto === null ? acc : (acc ?? 0) + r.resultadoOperacionalPrevisto),
    null,
  );

  const formatMetricVal = (v: number | null, unit: 'BRL' | 'L') =>
    unit === 'BRL' ? formatCurrencyBRL(v) : formatLiters(v);
  const formatMetricAxis = (v: number, unit: 'BRL' | 'L') =>
    unit === 'BRL' ? formatCurrencyCompact(v) : `${formatNumber(v)} L`;

  return (
    <div className="space-y-6">
      {/* Controls & Sample Reliability Signaling */}
      <section className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#F4EFE6]">
              Configuração da Análise Preditiva e Validação Temporal
            </h2>
            <p className="text-xs text-[#847866] mt-0.5">
              Modelagem estatística executada localmente sobre séries mensais reais (nunca delegada ao Gemini).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Indicator selector */}
            <select
              value={selectedIndicator}
              onChange={(e) => setSelectedIndicator(e.target.value as IndicatorChoice)}
              aria-label="Selecionar indicador para projeção principal"
              className="h-9 px-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6]"
            >
              <option value="faturamento_bruto">Indicador: Faturamento Mensal (R$)</option>
              <option value="volume_litros">Indicador: Volume Comercializado (L)</option>
              <option value="resultado_operacional">Indicador: Resultado Operacional (R$)</option>
              <option value="custo_direto">Indicador: Custos Diretos (R$)</option>
              <option value="despesa_operacional">Indicador: Despesas Operacionais (R$)</option>
            </select>

            {/* Horizon 1 or 3 months */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0D0B09] border border-amber-500/20">
              {([1, 3] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setHorizon(h);
                    setAiInsights(null);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    horizon === h ? 'bg-amber-600 text-[#0D0B09] font-semibold' : 'text-[#B9AE9C] hover:text-[#F4EFE6]'
                  }`}
                >
                  Horizonte: {h} {h === 1 ? 'mês' : 'meses'}
                </button>
              ))}
            </div>

            {/* Model selection (Auto recommended vs manual) */}
            <select
              value={modelMode}
              onChange={(e) => {
                setModelMode(e.target.value as ForecastModelType);
                setAiInsights(null);
              }}
              aria-label="Selecionar metodologia estatística"
              className="h-9 px-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6]"
            >
              <option value="auto">Seleção Automática (Melhor Backtesting)</option>
              <option value="simple_exponential_smoothing">Suavização Exponencial Simples (SES)</option>
              <option value="moving_average">Média Móvel Simples (3M)</option>
              <option value="linear_regression">Regressão Linear (OLS)</option>
              <option value="holt_trend">Suavização Exponencial com Tendência (Holt)</option>
              <option value="seasonal_naive">Método Ingênuo Sazonal (12M)</option>
            </select>
          </div>
        </div>

        {/* Reliability & Data Quality Banner (Sections 12 & 13) */}
        <div
          className={`p-3.5 rounded-xl border text-xs flex flex-wrap items-start justify-between gap-3 ${
            activeForecast.reliabilityTier === 'sufficient'
              ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
              : activeForecast.reliabilityTier === 'limited'
              ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
              : 'bg-red-950/30 border-red-500/30 text-red-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {activeForecast.reliabilityTier === 'sufficient' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : activeForecast.reliabilityTier === 'limited' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">{activeForecast.reliabilityLabel}</p>
              <p className="text-[11px] opacity-90">
                Base observada: <strong className="font-mono">{activeForecast.historicalCount}</strong> mês(es) · Lacunas sem registros:{' '}
                <strong className="font-mono">{activeForecast.missingMonthsCount}</strong> · Outliers detectados:{' '}
                <strong className="font-mono">
                  {activeForecast.outlierPeriods.length > 0 ? activeForecast.outlierPeriods.join(', ') : 'Nenhum'}
                </strong>{' '}
                · Validação da planilha (Qualidade): <strong>{dataset.metadata.validationStatus}</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7.1 RESUMO EXECUTIVO DA PREVISÃO */}
      <section className="space-y-3">
        <SectionTitle
          title="7.1 Resumo Executivo da Previsão"
          subtitle="Todos os valores abaixo são estimativas estatísticas sujeitas a incerteza, calculadas a partir da base histórica."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          <SummaryCard
            label="Faturamento Próx. Mês"
            value={formatCurrencyBRL(rev.nextMonthForecast)}
            tag={`Previsão · ${revNextPeriod}`}
          />
          <SummaryCard
            label={`Faturamento Acum. (${horizon}m)`}
            value={formatCurrencyBRL(rev.accumulatedForecast)}
            tag={`Previsão · ${horizonRangeLabel}`}
          />
          <SummaryCard
            label="Variação Esperada (Fat.)"
            value={
              rev.expectedVariationPct !== null
                ? `${rev.expectedVariationPct >= 0 ? '+' : ''}${formatPercent(rev.expectedVariationPct)}`
                : 'N/A'
            }
            tag={`Vs último mês (${rev.lastObservedPeriodo ?? 'N/A'})`}
            highlight={
              rev.expectedVariationPct === null
                ? 'neutral'
                : rev.expectedVariationPct >= 0
                ? 'emerald'
                : 'red'
            }
          />
          <SummaryCard
            label={`Volume Previsto (${horizon}m)`}
            value={formatLiters(volumeForecast.accumulatedForecast)}
            tag={`Previsão · ${horizonRangeLabel}`}
          />
          <SummaryCard
            label={`Resultado Op. Previsto (${horizon}m)`}
            value={formatCurrencyBRL(futureOpResultAcc)}
            tag={`Previsão · ${horizonRangeLabel}`}
            highlight={
              futureOpResultAcc === null ? 'neutral' : futureOpResultAcc >= 0 ? 'emerald' : 'red'
            }
          />
          <SummaryCard
            label="Modelo Selecionado"
            value={activeForecast.selectedModelName}
            tag={`RMSE Backtest: ${formatMetricVal(activeForecast.errorMetrics.rmse, activeForecast.unit)}`}
            smallText
          />
        </div>
      </section>

      {/* 7.2 HISTÓRICO E PREVISÃO */}
      <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
              7.2 Histórico Real e Previsão — {activeForecast.metricLabel}
            </h3>
            <p className="text-xs text-[#847866] mt-0.5">
              Linha contínua = realizado na planilha · Linha tracejada = previsão estatística · Faixa sombreada = intervalo de previsão baseado nos erros de validação
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-[#B9AE9C]">
              {activeForecast.trendDirection === 'Alta' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
              {activeForecast.trendDirection === 'Queda' && <TrendingDown className="w-4 h-4 text-red-400" />}
              {(activeForecast.trendDirection === 'Estável' || activeForecast.trendDirection === 'Indeterminada') && (
                <Minus className="w-4 h-4 text-amber-400" />
              )}
              <span>
                Tendência: <strong className="text-[#F4EFE6]">{activeForecast.trendDirection}</strong>
              </span>
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={mainChartData} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
            <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#B9AE9C', fontSize: 11 }}
              tickFormatter={(v) => formatMetricAxis(Number(v), activeForecast.unit)}
              width={78}
            />
            <Tooltip
              content={
                <ChartTooltip
                  formatterType={activeForecast.unit === 'BRL' ? 'currency' : 'liters'}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {activeForecast.lastObservedPeriodo && (
              <ReferenceLine
                x={formatPeriodoLabelSafe(activeForecast.lastObservedPeriodo)}
                stroke="#847866"
                strokeDasharray="3 3"
              />
            )}
            <Area
              type="monotone"
              dataKey="intervaloFaixa"
              name="Intervalo de Previsão (90%)"
              stroke="#38BDF8"
              strokeOpacity={0.25}
              fill="#38BDF8"
              fillOpacity={0.14}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="realizado"
              name="Histórico Realizado"
              stroke="#F59E0B"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#F59E0B' }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="seriePrevista"
              name="Previsão Estatística"
              stroke="#38BDF8"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={{ r: 4, fill: '#38BDF8' }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Month-by-month projected table */}
        <div className="overflow-x-auto border-t border-amber-500/10 pt-3">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="text-[#847866]">
                <th className="py-1.5 px-2.5">Mês Projetado</th>
                <th className="py-1.5 px-2.5">Classificação</th>
                <th className="py-1.5 px-2.5 text-right">Previsão Central</th>
                <th className="py-1.5 px-2.5 text-right">Limite Inferior</th>
                <th className="py-1.5 px-2.5 text-right">Limite Superior</th>
                <th className="py-1.5 px-2.5">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/10">
              {activeForecast.points
                .filter((p) => p.tipo === 'previsão')
                .map((p) => (
                  <tr key={p.periodo}>
                    <td className="py-2 px-2.5 font-mono tabular-nums text-sky-300">{p.periodo}</td>
                    <td className="py-2 px-2.5 text-[#B9AE9C]">Estimativa sujeita a incerteza</td>
                    <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#F4EFE6] font-semibold">
                      {formatMetricVal(p.previsto, activeForecast.unit)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#B9AE9C]">
                      {formatMetricVal(p.limiteInferior, activeForecast.unit)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#B9AE9C]">
                      {formatMetricVal(p.limiteSuperior, activeForecast.unit)}
                    </td>
                    <td className="py-2 px-2.5 text-[11px] text-[#847866]">
                      {p.clampedNonNegative
                        ? 'Ajustado para não negatividade (>= 0)'
                        : 'Intervalo via erro de backtesting'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7.3 PREVISÃO POR CATEGORIA & 7.4 PREVISÃO POR UNIDADE DE NEGÓCIO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 7.3 Categoria */}
        <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
                7.3 Previsão por Categoria ({horizon}m)
              </h3>
              <p className="text-xs text-[#847866]">Volume e faturamento projetados por estilo</p>
            </div>
            {categoryForecasts.length > 0 && (
              <select
                value={activeCategorySummary?.nome || ''}
                onChange={(e) => setFocusedCategory(e.target.value)}
                aria-label="Selecionar categoria específica"
                className="h-8 px-2.5 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6]"
              >
                {categoryForecasts.map((c) => (
                  <option key={c.nome} value={c.nome}>
                    Detalhe: {c.nome}
                  </option>
                ))}
              </select>
            )}
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryForecasts}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
              <XAxis dataKey="nome" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
              <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => `${formatNumber(Number(v))} L`} width={64} />
              <Tooltip content={<ChartTooltip formatterType="liters" />} />
              <Bar dataKey="projectedVolumeSum" name={`Volume Previsto (${horizon}m)`} fill="#D97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-500/15 text-[#847866]">
                  <th className="py-1.5 px-2">Categoria</th>
                  <th className="py-1.5 px-2 text-right">Vol. Prev. ({horizon}m)</th>
                  <th className="py-1.5 px-2 text-right">Fat. Prev. ({horizon}m)</th>
                  <th className="py-1.5 px-2 text-right">Var. Média</th>
                  <th className="py-1.5 px-2">Tendência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {categoryForecasts.map((c) => (
                  <tr
                    key={c.nome}
                    onClick={() => setFocusedCategory(c.nome)}
                    className={`cursor-pointer ${
                      c.nome === activeCategorySummary?.nome ? 'bg-amber-500/10' : 'hover:bg-[#1E1813]'
                    }`}
                  >
                    <td className="py-2 px-2 font-medium text-[#F4EFE6]">{c.nome}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-amber-300">
                      {formatLiters(c.projectedVolumeSum)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">
                      {formatCurrencyBRL(c.projectedRevenueSum)}
                    </td>
                    <td
                      className={`py-2 px-2 text-right font-mono tabular-nums ${
                        (c.expectedVolumeDeltaPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {c.expectedVolumeDeltaPct !== null
                        ? `${c.expectedVolumeDeltaPct >= 0 ? '+' : ''}${formatPercent(c.expectedVolumeDeltaPct)}`
                        : 'N/A'}
                    </td>
                    <td className="py-2 px-2 text-[#B9AE9C]">{c.trendDirection}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activeCategorySummary && categoryDetailChartData.length > 0 && (
            <div className="pt-3 border-t border-amber-500/10 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#F4EFE6]">
                  Trajetória de Volume — <strong className="text-amber-300">{activeCategorySummary.nome}</strong>
                </span>
                <span className="text-[11px] text-[#847866]">
                  Modelo: {activeCategorySummary.selectedModelName}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={145}>
                <ComposedChart data={categoryDetailChartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.08)" />
                  <XAxis dataKey="label" tick={{ fill: '#847866', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#847866', fontSize: 10 }} tickFormatter={(v) => `${formatNumber(Number(v))} L`} width={58} />
                  <Tooltip content={<ChartTooltip formatterType="liters" />} />
                  <Line
                    type="monotone"
                    dataKey="realizado"
                    name="Realizado (L)"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="seriePrevista"
                    name="Previsto (L)"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 3, fill: '#38BDF8' }}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* 7.4 Unidade de Negócio */}
        <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
              7.4 Previsão por Unidade de Negócio ({horizon}m)
            </h3>
            <p className="text-xs text-[#847866]">
              Contribuição projetada de cada canal no faturamento total previsto
            </p>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={unitForecasts}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
              <XAxis dataKey="nome" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
              <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={72} />
              <Tooltip content={<ChartTooltip formatterType="currency" />} />
              <Bar dataKey="projectedRevenueSum" name={`Faturamento Previsto (${horizon}m)`} fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-500/15 text-[#847866]">
                  <th className="py-1.5 px-2">Unidade / Canal</th>
                  <th className="py-1.5 px-2 text-right">Fat. Prev. ({horizon}m)</th>
                  <th className="py-1.5 px-2 text-right">Part. Projetada</th>
                  <th className="py-1.5 px-2 text-right">Vol. Prev.</th>
                  <th className="py-1.5 px-2">Tendência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {unitForecasts.map((u) => (
                  <tr key={u.nome} className="hover:bg-[#1E1813]">
                    <td className="py-2 px-2 font-medium text-[#F4EFE6]">{u.nome}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-[#F4EFE6]">
                      {formatCurrencyBRL(u.projectedRevenueSum)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-amber-300">
                      {formatPercent(u.projectedRevenueSharePct)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-[#B9AE9C]">
                      {formatLiters(u.projectedVolumeSum)}
                    </td>
                    <td className="py-2 px-2 text-[#B9AE9C]">{u.trendDirection}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* 7.5 PREVISÃO FINANCEIRA COERENTE */}
      <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
              7.5 Previsão Financeira Integrada (Receita, Custos, Despesas e Resultado Coerente)
            </h3>
            <p className="text-xs text-[#847866] mt-0.5">
              Resultado e margem operacional projetados derivam diretamente das projeções coerentes de faturamento, custo direto e despesas, condicionais à continuidade dos padrões históricos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-6 h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financial.coherentRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,155,67,0.1)" />
                <XAxis dataKey="label" tick={{ fill: '#B9AE9C', fontSize: 11 }} />
                <YAxis tick={{ fill: '#B9AE9C', fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v))} width={72} />
                <Tooltip content={<ChartTooltip formatterType="currency" />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="faturamentoPrevisto" name="Faturamento Previsto" fill="#F59E0B" />
                <Bar dataKey="custoDiretoPrevisto" name="Custo Direto Previsto" fill="#B45309" />
                <Bar dataKey="despesaOperacionalPrevista" name="Despesa Op. Prevista" fill="#78350F" />
                <Bar dataKey="resultadoOperacionalPrevisto" name="Resultado Op. Previsto" fill="#16A34A" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-6 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-500/15 text-[#847866]">
                  <th className="py-2 px-2">Período</th>
                  <th className="py-2 px-2 text-right">Faturamento</th>
                  <th className="py-2 px-2 text-right">Custo Direto</th>
                  <th className="py-2 px-2 text-right">Despesa Op.</th>
                  <th className="py-2 px-2 text-right">Resultado Op.</th>
                  <th className="py-2 px-2 text-right">Margem Proj.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {financial.coherentRows.map((r) => (
                  <tr key={r.periodo}>
                    <td className="py-2 px-2 font-mono tabular-nums text-sky-300">{r.periodo}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{formatCurrencyBRL(r.faturamentoPrevisto)}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-[#B9AE9C]">{formatCurrencyBRL(r.custoDiretoPrevisto)}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-[#B9AE9C]">{formatCurrencyBRL(r.despesaOperacionalPrevista)}</td>
                    <td
                      className={`py-2 px-2 text-right font-mono tabular-nums font-medium ${
                        (r.resultadoOperacionalPrevisto ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {formatCurrencyBRL(r.resultadoOperacionalPrevisto)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-amber-300">
                      {formatPercent(r.margemOperacionalProjetadaPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 8. ANÁLISE DE CENÁRIOS SIMULADOS */}
      <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <SlidersHorizontal className="w-4 h-4" />
              <span>8. Simulação Gerencial de Cenários (Hipóteses sobre a Previsão Base)</span>
            </div>
            <p className="text-xs text-[#847866]">
              Ajustes percentuais abaixo são hipóteses de simulação gerencial definidas pelo gestor, não previsões estatísticas do modelo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#0D0B09] border border-amber-500/15 text-xs">
          <label className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#B9AE9C]">Cenário Conservador (Demanda/Fat.)</span>
              <span className="font-mono tabular-nums text-red-400">{conservativeAdj}%</span>
            </div>
            <input
              type="range"
              min={-30}
              max={0}
              step={1}
              value={conservativeAdj}
              onChange={(e) => setConservativeAdj(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </label>

          <label className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#B9AE9C]">Cenário Otimista (Demanda/Fat.)</span>
              <span className="font-mono tabular-nums text-emerald-400">+{optimisticAdj}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={35}
              step={1}
              value={optimisticAdj}
              onChange={(e) => setOptimisticAdj(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </label>

          <label className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#B9AE9C]">Elasticidade dos Custos Variáveis</span>
              <span className="font-mono tabular-nums text-amber-300">{costElasticity}%</span>
            </div>
            <input
              type="range"
              min={20}
              max={90}
              step={5}
              value={costElasticity}
              onChange={(e) => setCostElasticity(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <ScenarioCard
            title={`Conservador (${conservativeAdj}% receita)`}
            subtitle="Hipótese de retração comercial"
            revenue={scenarios.totals.conservativeRevenue}
            opResult={scenarios.totals.conservativeOpResult}
            tone="red"
          />
          <ScenarioCard
            title="Cenário Base (Previsão Central)"
            subtitle="Projeção estatística do modelo selecionado"
            revenue={scenarios.totals.baseRevenue}
            opResult={scenarios.totals.baseOpResult}
            tone="amber"
          />
          <ScenarioCard
            title={`Otimista (+${optimisticAdj}% receita)`}
            subtitle="Hipótese de expansão comercial"
            revenue={scenarios.totals.optimisticRevenue}
            opResult={scenarios.totals.optimisticOpResult}
            tone="emerald"
          />
        </div>
      </section>

      {/* 9. COMPARAÇÃO COM METAS FUTURAS */}
      <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
        <div>
          <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
            9. Comparação das Previsões com Metas Cadastradas (Aba Metas)
          </h3>
          <p className="text-xs text-[#847866] mt-0.5">
            Relacionado por período e unidade de negócio. Meses futuros sem registro na aba Metas exibem "Meta não cadastrada".
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-amber-500/15 text-[#847866]">
                <th className="py-2 px-3">Período Futuro</th>
                <th className="py-2 px-3 text-right">Fat. Previsto</th>
                <th className="py-2 px-3 text-right">Meta Fat.</th>
                <th className="py-2 px-3 text-right">Dif. Abs. / %</th>
                <th className="py-2 px-3 text-right">Ating. Fat.</th>
                <th className="py-2 px-3 text-right">Vol. Previsto</th>
                <th className="py-2 px-3 text-right">Meta Vol.</th>
                <th className="py-2 px-3 text-right">Margem Proj. vs Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/10">
              {goalComparison.map((g) => (
                <tr key={g.periodo} className="hover:bg-[#1E1813]">
                  <td className="py-2.5 px-3 font-mono tabular-nums text-sky-300">{g.periodo}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(g.faturamentoPrevisto)}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">
                    {g.metaFaturamento !== null ? formatCurrencyBRL(g.metaFaturamento) : 'Meta não cadastrada'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {g.difFatAbs !== null
                      ? `${formatCurrencyBRL(g.difFatAbs)} (${formatPercent(g.difFatPct)})`
                      : 'N/A'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium">
                    {formatPercent(g.atingFatPct)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatLiters(g.volumePrevisto)}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">
                    {g.metaVolume !== null ? formatLiters(g.metaVolume) : 'Meta não cadastrada'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {formatPercent(g.margemProjetadaPct)} / {g.metaMargemPct !== null ? formatPercent(g.metaMargemPct) : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7.6 DESEMPENHO DOS MODELOS (BACKTESTING) & 7.7 EXPLICAÇÃO METODOLÓGICA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
          <div>
            <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
              7.6 Comparação dos Modelos na Validação Temporal (Backtesting)
            </h3>
            <p className="text-xs text-[#847866] mt-0.5">
              Avaliação estritamente cronológica (walk-forward) para {activeForecast.metricLabel}.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-500/15 text-[#847866]">
                  <th className="py-2 px-2.5">Modelo</th>
                  <th className="py-2 px-2.5 text-right">MAE</th>
                  <th className="py-2 px-2.5 text-right">RMSE</th>
                  <th className="py-2 px-2.5 text-right">MAPE / WAPE</th>
                  <th className="py-2 px-2.5 text-right">Obs. (Treino/Teste)</th>
                  <th className="py-2 px-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {activeForecast.candidateEvaluations.map((ev) => (
                  <tr
                    key={ev.modelId}
                    className={ev.selected ? 'bg-amber-500/10' : 'hover:bg-[#1E1813]'}
                  >
                    <td className="py-2.5 px-2.5 font-medium text-[#F4EFE6]">
                      {ev.modelName}
                      {ev.selected && (
                        <span className="block text-[11px] text-amber-300 font-semibold">
                          Selecionado
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums">
                      {formatMetricVal(ev.mae, activeForecast.unit)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-medium">
                      {formatMetricVal(ev.rmse, activeForecast.unit)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-[#B9AE9C]">
                      {ev.mapePct !== null
                        ? `${formatPercent(ev.mapePct)} (MAPE)`
                        : ev.wapePct !== null
                        ? `${formatPercent(ev.wapePct)} (WAPE)`
                        : 'N/A'}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-[#B9AE9C]">
                      {ev.trainingObs} / {ev.validationObs}
                    </td>
                    <td className="py-2.5 px-2.5 text-[#B9AE9C]">{ev.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {activeForecast.errorMetrics.mapeUnavailableReason && (
            <p className="text-[11px] text-[#847866]">{activeForecast.errorMetrics.mapeUnavailableReason}</p>
          )}
        </section>

        <section className="lg:col-span-5 p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3 text-xs">
          <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
            7.7 Explicação Metodológica para Gestão
          </h3>
          <div className="space-y-2.5 text-[#B9AE9C] leading-relaxed">
            <p>
              <strong className="text-[#F4EFE6]">1. Agregação histórica:</strong>{' '}
              {activeForecast.methodologySummary.aggregation}
            </p>
            <p>
              <strong className="text-[#F4EFE6]">2. Validação temporal:</strong>{' '}
              {activeForecast.methodologySummary.validation}
            </p>
            <p>
              <strong className="text-[#F4EFE6]">3. Escolha do modelo:</strong>{' '}
              {activeForecast.methodologySummary.selection}
            </p>
            <p>
              <strong className="text-[#F4EFE6]">4. Sazonalidade:</strong>{' '}
              {activeForecast.seasonalityNote}
            </p>
            <p>
              <strong className="text-amber-300">5. Limitações:</strong>{' '}
              {activeForecast.methodologySummary.limitations}
            </p>
          </div>
        </section>
      </div>

      {/* 10. INTERPRETAÇÃO POR INTELIGÊNCIA ARTIFICIAL */}
      <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
              10. Interpretação Gerencial das Previsões por IA
            </h3>
            <p className="text-xs text-[#847866] mt-0.5">
              O Gemini recebe apenas os resultados já calculados pelos modelos estatísticos para interpretar tendências, riscos de margem e recomendações.
            </p>
          </div>

          <button
            type="button"
            onClick={handleInterpretWithAi}
            disabled={isLoadingAi || activeForecast.reliabilityTier === 'insufficient'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-[#0D0B09] text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            {isLoadingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isLoadingAi ? 'Interpretando previsões...' : 'Interpretar Previsões com IA'}</span>
          </button>
        </div>

        {aiError && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200">
            {aiError}
          </div>
        )}

        {!aiInsights && !isLoadingAi && (
          <div className="p-4 rounded-xl bg-[#0D0B09] border border-amber-500/10 text-xs text-[#847866] flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Clique em "Interpretar Previsões com IA" para gerar parecer executivo sobre tendência de faturamento, categorias líderes, canais e risco de margem.
            </span>
          </div>
        )}

        {aiInsights && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {aiInsights.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#0D0B09] border border-amber-500/20 flex flex-col justify-between space-y-3 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-semibold text-[#F4EFE6]">
                      {item.indicadorAnalisado}
                    </span>
                    <span className="text-[11px] text-amber-300 font-medium">
                      Incerteza: {item.grauIncerteza}
                    </span>
                  </div>
                  <p className="font-mono tabular-nums text-sky-300 text-[11px]">
                    Previsão: {item.previsaoCalculada}
                  </p>
                  <p className="text-[#B9AE9C]">
                    <strong className="text-[#F4EFE6]">Evidência histórica:</strong> {item.evidenciaHistorica}
                  </p>
                  <p className="text-[#B9AE9C]">
                    <strong className="text-[#F4EFE6]">Interpretação:</strong> {item.interpretacao}
                  </p>
                  <p className="text-emerald-400">
                    <strong>Recomendação gerencial:</strong> {item.recomendacaoGerencial}
                  </p>
                </div>

                {onCreateDecision && (
                  <div className="pt-2 border-t border-amber-500/10 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleConvertInsightToDecision(item)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 cursor-pointer"
                    >
                      <ArrowRightCircle className="w-3.5 h-3.5" />
                      <span>Registrar em Decisões Gerenciais</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

function formatPeriodoLabelSafe(periodo: string): string {
  const m = periodo.match(/^(\d{4})-(\d{2})$/);
  if (!m) return periodo;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[Number(m[2]) - 1] ?? m[2]}/${m[1].slice(2)}`;
}

const SectionTitle: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div>
    <h3 className="font-display text-base font-semibold text-[#F4EFE6]">{title}</h3>
    <p className="text-xs text-[#847866] mt-0.5">{subtitle}</p>
  </div>
);

const SummaryCard: React.FC<{
  label: string;
  value: string;
  tag: string;
  highlight?: 'amber' | 'emerald' | 'red' | 'neutral';
  smallText?: boolean;
}> = ({ label, value, tag, highlight = 'neutral', smallText = false }) => {
  const valColor =
    highlight === 'emerald'
      ? 'text-emerald-400'
      : highlight === 'red'
      ? 'text-red-400'
      : highlight === 'amber'
      ? 'text-amber-300'
      : 'text-[#F4EFE6]';

  return (
    <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1.5">
      <p className="text-xs font-medium text-[#B9AE9C] truncate" title={label}>
        {label}
      </p>
      <p
        className={`${
          smallText ? 'text-sm leading-snug' : 'text-lg font-mono tabular-nums'
        } font-semibold ${valColor}`}
      >
        {value}
      </p>
      <p className="text-[11px] text-[#847866] truncate">{tag}</p>
    </div>
  );
};

const ScenarioCard: React.FC<{
  title: string;
  subtitle: string;
  revenue: number | null;
  opResult: number | null;
  tone: 'red' | 'amber' | 'emerald';
}> = ({ title, subtitle, revenue, opResult, tone }) => {
  const border =
    tone === 'emerald'
      ? 'border-emerald-500/30'
      : tone === 'red'
      ? 'border-red-500/30'
      : 'border-amber-500/30';
  const titleColor =
    tone === 'emerald'
      ? 'text-emerald-400'
      : tone === 'red'
      ? 'text-red-400'
      : 'text-amber-300';

  return (
    <div className={`p-4 rounded-xl bg-[#0D0B09] border ${border} space-y-3`}>
      <div>
        <h4 className={`font-semibold text-sm ${titleColor}`}>{title}</h4>
        <p className="text-[11px] text-[#847866]">{subtitle}</p>
      </div>
      <div className="space-y-1.5 pt-2 border-t border-amber-500/10">
        <div className="flex justify-between">
          <span className="text-[#B9AE9C]">Faturamento Simulado</span>
          <span className="font-mono tabular-nums font-semibold text-[#F4EFE6]">
            {formatCurrencyBRL(revenue)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#B9AE9C]">Resultado Op. Estimado</span>
          <span
            className={`font-mono tabular-nums font-semibold ${
              (opResult ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {formatCurrencyBRL(opResult)}
          </span>
        </div>
      </div>
    </div>
  );
};
