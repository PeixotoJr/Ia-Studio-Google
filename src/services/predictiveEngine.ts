import type { MonthlySeriesPoint, MetaRecord, VendaRecord, GlobalFilters } from '../types/bi';
import { buildMonthlySeries, filterMetas } from './biCalculations';
import { formatPeriodoLabel, safeDivide } from '../utils/formatters';

export type ForecastModelType =
  | 'auto'
  | 'linear_regression'
  | 'moving_average'
  | 'simple_exponential_smoothing'
  | 'holt_trend'
  | 'seasonal_naive';

export type ConcreteModelId = Exclude<ForecastModelType, 'auto'>;
export type ForecastHorizon = 1 | 3;

export type ReliabilityTier = 'sufficient' | 'limited' | 'insufficient';

export interface CandidateModelEvaluation {
  modelId: ConcreteModelId;
  modelName: string;
  mae: number | null;
  rmse: number | null;
  mapePct: number | null;
  wapePct: number | null;
  validationObs: number;
  trainingObs: number;
  status: string;
  selected: boolean;
}

export interface ForecastPoint {
  periodo: string;
  label: string;
  tipo: 'histórico' | 'previsão';
  realizado: number | null;
  previsto: number | null;
  limiteInferior: number | null;
  limiteSuperior: number | null;
  semRegistros: boolean;
  clampedNonNegative: boolean;
}

export interface ForecastErrorMetrics {
  mae: number | null;
  rmse: number | null;
  mapePct: number | null;
  wapePct: number | null;
  sampleSizeValidation: number;
  mapeUnavailableReason: string | null;
}

export interface ForecastResult {
  metricKey: string;
  metricLabel: string;
  unit: 'BRL' | 'L';
  requestedMode: ForecastModelType;
  selectedModel: ConcreteModelId;
  selectedModelName: string;
  selectionJustification: string;
  horizon: ForecastHorizon;
  historicalCount: number;
  missingMonthsCount: number;
  missingMonthsList: string[];
  outlierPeriods: string[];
  reliabilityTier: ReliabilityTier;
  reliabilityLabel: string;
  trendDirection: 'Alta' | 'Estável' | 'Queda' | 'Indeterminada';
  expectedVariationPct: number | null;
  slopePerMonth: number | null;
  lastObservedPeriodo: string | null;
  lastObservedValue: number | null;
  nextMonthForecast: number | null;
  accumulatedForecast: number | null;
  points: ForecastPoint[];
  errorMetrics: ForecastErrorMetrics;
  candidateEvaluations: CandidateModelEvaluation[];
  clampedCount: number;
  limitations: string[];
  seasonalityNote: string;
  methodologySummary: {
    aggregation: string;
    validation: string;
    selection: string;
    limitations: string;
  };
}

export interface SegmentForecastSummary {
  nome: string;
  historicalCount: number;
  lastObservedMonthlyVolume: number | null;
  lastObservedMonthlyRevenue: number | null;
  projectedVolumeSum: number | null;
  projectedRevenueSum: number | null;
  projectedMonthlyAvgVolume: number | null;
  projectedMonthlyAvgRevenue: number | null;
  expectedRevenueDeltaPct: number | null;
  expectedVolumeDeltaPct: number | null;
  projectedRevenueSharePct: number | null;
  trendDirection: 'Alta' | 'Estável' | 'Queda' | 'Indeterminada';
  selectedModelName: string;
  reliabilityTier: ReliabilityTier;
  volumeForecast: ForecastResult;
  revenueForecast: ForecastResult;
}

export interface CoherentFinancialForecastRow {
  periodo: string;
  label: string;
  faturamentoPrevisto: number | null;
  custoDiretoPrevisto: number | null;
  despesaOperacionalPrevista: number | null;
  resultadoOperacionalPrevisto: number | null;
  margemOperacionalProjetadaPct: number | null;
}

export interface ForecastGoalComparisonRow {
  periodo: string;
  faturamentoPrevisto: number | null;
  metaFaturamento: number | null;
  difFatAbs: number | null;
  difFatPct: number | null;
  atingFatPct: number | null;
  volumePrevisto: number | null;
  metaVolume: number | null;
  difVolAbs: number | null;
  difVolPct: number | null;
  atingVolPct: number | null;
  margemProjetadaPct: number | null;
  metaMargemPct: number | null;
  hasMeta: boolean;
}

export interface ScenarioSimulationResult {
  horizonMonths: ForecastHorizon;
  conservativeAdjPct: number;
  optimisticAdjPct: number;
  costElasticityPct: number;
  rows: Array<{
    periodo: string;
    label: string;
    baseRevenue: number | null;
    conservativeRevenue: number | null;
    optimisticRevenue: number | null;
    baseOpResult: number | null;
    conservativeOpResult: number | null;
    optimisticOpResult: number | null;
  }>;
  totals: {
    baseRevenue: number | null;
    conservativeRevenue: number | null;
    optimisticRevenue: number | null;
    baseOpResult: number | null;
    conservativeOpResult: number | null;
    optimisticOpResult: number | null;
  };
}

const MODEL_NAMES: Record<ConcreteModelId, string> = {
  linear_regression: 'Regressão Linear (OLS)',
  moving_average: 'Média Móvel Simples',
  simple_exponential_smoothing: 'Suavização Exponencial Simples (SES)',
  holt_trend: 'Suavização Exponencial com Tendência (Holt)',
  seasonal_naive: 'Método Ingênuo Sazonal (12M)',
};

function addMonths(periodo: string, offset: number): string {
  const match = periodo.match(/^(\d{4})-(\d{2})$/);
  if (!match) return `+${offset}m`;
  const baseYear = Number(match[1]);
  const baseMonth = Number(match[2]) - 1;
  const totalMonths = baseYear * 12 + baseMonth + offset;
  const y = Math.floor(totalMonths / 12);
  const m = (totalMonths % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function clampVal(val: number, allowNegative: boolean): { val: number; clamped: boolean } {
  if (!allowNegative && val < 0) return { val: 0, clamped: true };
  return { val, clamped: false };
}

// ============================================================================
// INDEPENDENT STATISTICAL MODEL FUNCTIONS (PURE & REPRODUCIBLE)
// ============================================================================

export function forecastLinearRegression(
  train: number[],
  horizon: number,
  allowNegative: boolean,
): number[] {
  const n = train.length;
  if (n === 0) return Array(horizon).fill(0);
  if (n === 1) return Array(horizon).fill(clampVal(train[0], allowNegative).val);

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += train[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (train[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;

  const preds: number[] = [];
  for (let h = 0; h < horizon; h++) {
    const raw = intercept + slope * (n + h);
    preds.push(clampVal(raw, allowNegative).val);
  }
  return preds;
}

export function forecastMovingAverage(
  train: number[],
  horizon: number,
  allowNegative: boolean,
): number[] {
  const n = train.length;
  if (n === 0) return Array(horizon).fill(0);
  const windowSize = Math.min(3, n);
  const rolling = [...train];
  const preds: number[] = [];

  for (let h = 0; h < horizon; h++) {
    const slice = rolling.slice(-windowSize);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    const clamped = clampVal(avg, allowNegative).val;
    preds.push(clamped);
    rolling.push(clamped);
  }
  return preds;
}

export function forecastSimpleExponentialSmoothing(
  train: number[],
  horizon: number,
  allowNegative: boolean,
): number[] {
  const n = train.length;
  if (n === 0) return Array(horizon).fill(0);
  if (n === 1) return Array(horizon).fill(clampVal(train[0], allowNegative).val);

  // Optimize alpha via in-train 1-step SSE grid search
  const alphas = [0.2, 0.35, 0.5, 0.7];
  let bestAlpha = 0.35;
  let bestSse = Infinity;
  let bestLevel = train[0];

  for (const alpha of alphas) {
    let level = train[0];
    let sse = 0;
    for (let i = 1; i < n; i++) {
      const err = train[i] - level;
      sse += err * err;
      level = alpha * train[i] + (1 - alpha) * level;
    }
    if (sse < bestSse) {
      bestSse = sse;
      bestAlpha = alpha;
      bestLevel = level;
    }
  }

  // Re-run with bestAlpha cleanly
  let level = train[0];
  for (let i = 1; i < n; i++) {
    level = bestAlpha * train[i] + (1 - bestAlpha) * level;
  }
  const pred = clampVal(bestLevel ?? level, allowNegative).val;
  return Array(horizon).fill(pred);
}

export function forecastHoltTrend(
  train: number[],
  horizon: number,
  allowNegative: boolean,
): number[] {
  const n = train.length;
  if (n < 3) return forecastSimpleExponentialSmoothing(train, horizon, allowNegative);

  const alphas = [0.25, 0.45, 0.65];
  const betas = [0.1, 0.25];
  let bestAlpha = 0.45;
  let bestBeta = 0.15;
  let bestSse = Infinity;

  for (const alpha of alphas) {
    for (const beta of betas) {
      let level = train[0];
      let trend = train[1] - train[0];
      let sse = 0;
      for (let i = 1; i < n; i++) {
        const err = train[i] - (level + trend);
        sse += err * err;
        const prevLevel = level;
        level = alpha * train[i] + (1 - alpha) * (level + trend);
        trend = beta * (level - prevLevel) + (1 - beta) * trend;
      }
      if (sse < bestSse) {
        bestSse = sse;
        bestAlpha = alpha;
        bestBeta = beta;
      }
    }
  }

  let level = train[0];
  let trend = train[1] - train[0];
  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    level = bestAlpha * train[i] + (1 - bestAlpha) * (level + trend);
    trend = bestBeta * (level - prevLevel) + (1 - bestBeta) * trend;
  }

  const preds: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    preds.push(clampVal(level + h * trend, allowNegative).val);
  }
  return preds;
}

export function forecastSeasonalNaive(
  train: number[],
  horizon: number,
  allowNegative: boolean,
): number[] {
  const n = train.length;
  if (n < 12) return forecastMovingAverage(train, horizon, allowNegative);
  const preds: number[] = [];
  for (let h = 0; h < horizon; h++) {
    const idx = n - 12 + (h % 12);
    preds.push(clampVal(train[idx], allowNegative).val);
  }
  return preds;
}

function runModelPredictor(
  modelId: ConcreteModelId,
  train: number[],
  horizon: number,
  allowNegative: boolean,
): number[] {
  switch (modelId) {
    case 'linear_regression':
      return forecastLinearRegression(train, horizon, allowNegative);
    case 'moving_average':
      return forecastMovingAverage(train, horizon, allowNegative);
    case 'simple_exponential_smoothing':
      return forecastSimpleExponentialSmoothing(train, horizon, allowNegative);
    case 'holt_trend':
      return forecastHoltTrend(train, horizon, allowNegative);
    case 'seasonal_naive':
      return forecastSeasonalNaive(train, horizon, allowNegative);
  }
}

// ============================================================================
// OUTLIER DETECTION & WALK-FORWARD TEMPORAL BACKTESTING
// ============================================================================

function detectOutlierPeriods(validHistory: MonthlySeriesPoint[], values: number[]): string[] {
  if (values.length < 6) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  if (iqr === 0) return [];
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const outliers: string[] = [];
  values.forEach((v, idx) => {
    if (v < lower || v > upper) {
      outliers.push(validHistory[idx].periodo);
    }
  });
  return outliers;
}

function evaluateModelWalkForward(
  modelId: ConcreteModelId,
  values: number[],
  allowNegative: boolean,
): {
  applicable: boolean;
  status: string;
  trainingObs: number;
  validationObs: number;
  mae: number | null;
  rmse: number | null;
  mapePct: number | null;
  wapePct: number | null;
  mapeUnavailableReason: string | null;
  errors: number[];
} {
  const n = values.length;
  const minRequired =
    modelId === 'seasonal_naive' ? 14 : modelId === 'holt_trend' ? 6 : 4;

  if (n < minRequired) {
    return {
      applicable: false,
      status:
        modelId === 'seasonal_naive'
          ? `Requer >= 14 meses (base atual: ${n})`
          : modelId === 'holt_trend'
          ? `Requer >= 6 meses (base atual: ${n})`
          : `Amostra insuficiente (${n} meses)`,
      trainingObs: n,
      validationObs: 0,
      mae: null,
      rmse: null,
      mapePct: null,
      wapePct: null,
      mapeUnavailableReason: 'Amostra insuficiente para validação temporal.',
      errors: [],
    };
  }

  // Chronological walk-forward origin
  const minTrain =
    modelId === 'seasonal_naive'
      ? 12
      : Math.max(3, Math.min(n - 2, Math.floor(n * 0.6)));

  const errors: number[] = [];
  const actuals: number[] = [];

  for (let t = minTrain; t < n; t++) {
    const trainSlice = values.slice(0, t);
    const [pred1] = runModelPredictor(modelId, trainSlice, 1, allowNegative);
    errors.push(values[t] - pred1);
    actuals.push(values[t]);
  }

  const valCount = errors.length;
  if (valCount === 0) {
    return {
      applicable: false,
      status: 'Sem janela de teste suficiente',
      trainingObs: n,
      validationObs: 0,
      mae: null,
      rmse: null,
      mapePct: null,
      wapePct: null,
      mapeUnavailableReason: 'Sem observações de teste.',
      errors: [],
    };
  }

  let absErr = 0;
  let sqErr = 0;
  let sumAbsActual = 0;
  let hasNonPositive = false;
  let pctSum = 0;

  for (let i = 0; i < valCount; i++) {
    const e = Math.abs(errors[i]);
    absErr += e;
    sqErr += errors[i] * errors[i];
    sumAbsActual += Math.abs(actuals[i]);
    if (actuals[i] <= 0) {
      hasNonPositive = true;
    } else {
      pctSum += (e / actuals[i]) * 100;
    }
  }

  const mae = absErr / valCount;
  const rmse = Math.sqrt(sqErr / valCount);
  const mapePct = !hasNonPositive ? pctSum / valCount : null;
  const wapePct = sumAbsActual > 0 ? (absErr / sumAbsActual) * 100 : null;

  return {
    applicable: true,
    status: 'Validado (Walk-Forward)',
    trainingObs: minTrain,
    validationObs: valCount,
    mae,
    rmse,
    mapePct,
    wapePct,
    mapeUnavailableReason: hasNonPositive
      ? 'MAPE omitido pois há meses com valor real menor ou igual a zero no período de teste.'
      : null,
    errors,
  };
}

// ============================================================================
// MAIN FORECAST PIPELINE
// ============================================================================

export function generateAdvancedForecast(
  monthlySeries: MonthlySeriesPoint[],
  valueSelector: (p: MonthlySeriesPoint) => number,
  metricKey: string,
  metricLabel: string,
  unit: 'BRL' | 'L',
  requestedMode: ForecastModelType,
  horizon: ForecastHorizon,
  allowNegative = false,
): ForecastResult {
  // Trim leading/trailing meta-only months (semRegistros outside the observed sales span)
  // while preserving genuine interior gaps between the first and last observed sales months.
  const firstObservedIdx = monthlySeries.findIndex((m) => !m.semRegistros);
  let lastObservedIdx = -1;
  for (let i = monthlySeries.length - 1; i >= 0; i--) {
    if (!monthlySeries[i].semRegistros) {
      lastObservedIdx = i;
      break;
    }
  }
  const observedSpanSeries =
    firstObservedIdx >= 0 && lastObservedIdx >= firstObservedIdx
      ? monthlySeries.slice(firstObservedIdx, lastObservedIdx + 1)
      : [];

  const validHistory = observedSpanSeries.filter((m) => !m.semRegistros);
  const missingMonthsList = observedSpanSeries.filter((m) => m.semRegistros).map((m) => m.periodo);
  const missingMonthsCount = missingMonthsList.length;
  const n = validHistory.length;
  const values = validHistory.map(valueSelector);
  const outlierPeriods = detectOutlierPeriods(validHistory, values);

  // Reliability classification (Section 13)
  let reliabilityTier: ReliabilityTier = 'sufficient';
  let reliabilityLabel = 'Histórico suficiente: modelo validado com amostra adequada';
  if (n < 4) {
    reliabilityTier = 'insufficient';
    reliabilityLabel = 'Histórico insuficiente: previsão estatística não confiável';
  } else if (n < 12 || missingMonthsCount > 2) {
    reliabilityTier = 'limited';
    reliabilityLabel = 'Histórico limitado: previsão exploratória (sazonalidade anual não confirmável)';
  }

  const limitations: string[] = [];
  if (n < 4) {
    limitations.push(`Apenas ${n} mês(es) com registros observados. São necessários pelo menos 4 meses para validação temporal.`);
  } else if (n < 12) {
    limitations.push(`Série com ${n} meses observados (< 12 meses); não permite estimar sazonalidade anual robusta.`);
  } else if (n < 24) {
    limitations.push(`Série com ${n} meses observados (ex.: ~22 meses de 2025–2026): adequada para tendência de curto prazo, porém com restrição para validar múltiplos ciclos sazonais anuais.`);
  }
  if (missingMonthsCount > 0) {
    limitations.push(`Existem ${missingMonthsCount} mês(es) sem registros (${missingMonthsList.join(', ')}), preservados como ausência de observação e não convertidos em zero.`);
  }
  if (outlierPeriods.length > 0) {
    limitations.push(`Valores atípicos detectados nos meses: ${outlierPeriods.join(', ')}. Recomenda-se verificar eventos extraordinários na aba Qualidade/Vendas.`);
  }

  const seasonalityNote =
    n >= 15
      ? 'Método Ingênuo Sazonal (12M) avaliado em backtesting; compare o RMSE dele com os modelos de tendência antes de assumir sazonalidade anual.'
      : 'Sazonalidade anual robusta não estimada devido ao tamanho da série (< 15 meses necessários para treino sazonal + validação).';

  const candidates: ConcreteModelId[] = [
    'simple_exponential_smoothing',
    'moving_average',
    'linear_regression',
    'holt_trend',
    'seasonal_naive',
  ];

  // If insufficient history (< 3 months), return transparent non-forecast state
  if (n < 3) {
    const emptyEvals: CandidateModelEvaluation[] = candidates.map((mId) => ({
      modelId: mId,
      modelName: MODEL_NAMES[mId],
      mae: null,
      rmse: null,
      mapePct: null,
      wapePct: null,
      validationObs: 0,
      trainingObs: n,
      status: 'Amostra insuficiente (< 3 meses)',
      selected: false,
    }));

    return {
      metricKey,
      metricLabel,
      unit,
      requestedMode,
      selectedModel: 'moving_average',
      selectedModelName: MODEL_NAMES.moving_average,
      selectionJustification: 'Histórico inferior a 3 meses com registros; projeção estatística suprimida para evitar estimativas artificiais.',
      horizon,
      historicalCount: n,
      missingMonthsCount,
      missingMonthsList,
      outlierPeriods,
      reliabilityTier: 'insufficient',
      reliabilityLabel,
      trendDirection: 'Indeterminada',
      expectedVariationPct: null,
      slopePerMonth: null,
      lastObservedPeriodo: validHistory[n - 1]?.periodo ?? null,
      lastObservedValue: values[n - 1] ?? null,
      nextMonthForecast: null,
      accumulatedForecast: null,
      points: observedSpanSeries.map((m) => ({
        periodo: m.periodo,
        label: m.label,
        tipo: 'histórico',
        realizado: m.semRegistros ? null : valueSelector(m),
        previsto: null,
        limiteInferior: null,
        limiteSuperior: null,
        semRegistros: m.semRegistros,
        clampedNonNegative: false,
      })),
      errorMetrics: {
        mae: null,
        rmse: null,
        mapePct: null,
        wapePct: null,
        sampleSizeValidation: 0,
        mapeUnavailableReason: 'Amostra insuficiente para backtesting.',
      },
      candidateEvaluations: emptyEvals,
      clampedCount: 0,
      limitations,
      seasonalityNote,
      methodologySummary: {
        aggregation: `Dados agregados por mês (campo periodo) totalizando ${n} período(s) observado(s).`,
        validation: 'Validação temporal não executada devido à insuficiência de observações.',
        selection: 'Nenhum modelo selecionado por falta de massa histórica mínima.',
        limitations: limitations.join(' '),
      },
    };
  }

  // Evaluate all candidate models using chronological walk-forward validation
  const evalMap = new Map<ConcreteModelId, ReturnType<typeof evaluateModelWalkForward>>();
  for (const mId of candidates) {
    evalMap.set(mId, evaluateModelWalkForward(mId, values, allowNegative));
  }

  // Choose model: if requestedMode === 'auto', pick best validated RMSE with parsimony preference
  const simplicityOrder: ConcreteModelId[] = [
    'simple_exponential_smoothing',
    'moving_average',
    'linear_regression',
    'holt_trend',
    'seasonal_naive',
  ];

  let selectedModel: ConcreteModelId = 'moving_average';
  let selectionJustification = '';

  const validCandidates = candidates.filter((m) => evalMap.get(m)?.applicable && evalMap.get(m)?.rmse !== null);

  if (requestedMode !== 'auto' && evalMap.get(requestedMode)?.applicable) {
    selectedModel = requestedMode;
    const ev = evalMap.get(requestedMode)!;
    selectionJustification = `Modelo selecionado manualmente pelo gestor (${MODEL_NAMES[selectedModel]}), validado em ${ev.validationObs} passos cronológicos (RMSE: ${ev.rmse?.toFixed(2) ?? 'N/A'}).`;
  } else if (validCandidates.length > 0) {
    // Sort by RMSE ascending, applying a 2% parsimony tolerance to prefer simpler models
    const sortedByRmse = [...validCandidates].sort(
      (a, b) => (evalMap.get(a)!.rmse ?? Infinity) - (evalMap.get(b)!.rmse ?? Infinity),
    );
    const bestRaw = sortedByRmse[0];
    const bestRmse = evalMap.get(bestRaw)!.rmse!;

    // Check if a simpler model is within 2% of bestRmse
    const parsimonious = simplicityOrder.find(
      (m) =>
        validCandidates.includes(m) &&
        (evalMap.get(m)!.rmse ?? Infinity) <= bestRmse * 1.02,
    );
    selectedModel = parsimonious ?? bestRaw;
    const ev = evalMap.get(selectedModel)!;

    if (parsimonious && parsimonious !== bestRaw) {
      selectionJustification = `Selecionado automaticamente "${MODEL_NAMES[selectedModel]}" pelo critério de parcimônia e estabilidade: apresentou RMSE de ${ev.rmse?.toFixed(2)} (equivalente a <2% do menor erro bruto de ${MODEL_NAMES[bestRaw]}), com menor risco de sobreajuste.`;
    } else {
      selectionJustification = `Selecionado automaticamente "${MODEL_NAMES[selectedModel]}" por apresentar o menor erro na validação temporal walk-forward (${ev.validationObs} períodos de teste).`;
    }
  } else {
    selectedModel = n >= 4 ? 'simple_exponential_smoothing' : 'moving_average';
    selectionJustification = `Amostra reduzida (${n} meses); adotado modelo simples (${MODEL_NAMES[selectedModel]}) para projeção exploratória.`;
  }

  const selectedEval = evalMap.get(selectedModel)!;

  // Candidate comparison table
  const candidateEvaluations: CandidateModelEvaluation[] = candidates.map((mId) => {
    const ev = evalMap.get(mId)!;
    return {
      modelId: mId,
      modelName: MODEL_NAMES[mId],
      mae: ev.mae,
      rmse: ev.rmse,
      mapePct: ev.mapePct,
      wapePct: ev.wapePct,
      validationObs: ev.validationObs,
      trainingObs: ev.trainingObs,
      status: ev.status,
      selected: mId === selectedModel,
    };
  });

  // Fit 1-step in-sample series for visual reference & compute OLS slope for trend direction
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const relSlope = meanY !== 0 ? Math.abs(slope / meanY) : 0;
  let trendDirection: ForecastResult['trendDirection'] = 'Estável';
  if (relSlope >= 0.015) {
    trendDirection = slope > 0 ? 'Alta' : 'Queda';
  }

  // Generate future predictions using full observed history
  const rawFuture = runModelPredictor(selectedModel, values, horizon, true);
  let clampedCount = 0;

  // Validation error variability for prediction intervals (Section 6)
  // Prefer out-of-sample walk-forward RMSE when validationObs >= 2
  let sigmaPred = 0;
  if (selectedEval.validationObs >= 2 && selectedEval.rmse !== null) {
    sigmaPred = selectedEval.rmse;
  } else if (n >= 3) {
    // Fallback to 1-step training errors if validation window < 2
    const trainErrs: number[] = [];
    for (let t = 2; t < n; t++) {
      const [p] = runModelPredictor(selectedModel, values.slice(0, t), 1, allowNegative);
      trainErrs.push(values[t] - p);
    }
    const sq = trainErrs.reduce((acc, e) => acc + e * e, 0);
    sigmaPred = trainErrs.length > 0 ? Math.sqrt(sq / trainErrs.length) : 0;
  }

  const points: ForecastPoint[] = observedSpanSeries.map((m) => ({
    periodo: m.periodo,
    label: m.label,
    tipo: 'histórico',
    realizado: m.semRegistros ? null : valueSelector(m),
    previsto: null,
    limiteInferior: null,
    limiteSuperior: null,
    semRegistros: m.semRegistros,
    clampedNonNegative: false,
  }));

  const lastPeriodo = validHistory[n - 1].periodo;
  const lastObservedValue = values[n - 1];
  const futureValues: number[] = [];

  for (let h = 1; h <= horizon; h++) {
    const nextPeriodo = addMonths(lastPeriodo, h);
    const { val: predVal, clamped: predClamped } = clampVal(rawFuture[h - 1], allowNegative);
    if (predClamped) clampedCount++;
    futureValues.push(predVal);

    // Prediction interval: z_90 = 1.645 * sigma_val * sqrt(h)
    const halfWidth = sigmaPred > 0 ? 1.645 * sigmaPred * Math.sqrt(h) : 0;
    const rawLower = predVal - halfWidth;
    const { val: lowerVal, clamped: lowerClamped } = clampVal(rawLower, allowNegative);
    if (lowerClamped) clampedCount++;
    const upperVal = predVal + halfWidth;

    points.push({
      periodo: nextPeriodo,
      label: formatPeriodoLabel(nextPeriodo),
      tipo: 'previsão',
      realizado: null,
      previsto: predVal,
      limiteInferior: sigmaPred > 0 ? lowerVal : null,
      limiteSuperior: sigmaPred > 0 ? upperVal : null,
      semRegistros: false,
      clampedNonNegative: predClamped || lowerClamped,
    });
  }

  if (clampedCount > 0 && !allowNegative) {
    limitations.push(
      `Restrição de não negatividade aplicada: ${clampedCount} valor(es) previsto(s) ou limite(s) inferior(es) ajustado(s) para 0 por representarem grandezas não negativas.`,
    );
  }

  const nextMonthForecast = futureValues[0] ?? null;
  const accumulatedForecast = futureValues.reduce((a, b) => a + b, 0);
  const expectedVariationPct =
    nextMonthForecast !== null && lastObservedValue !== 0
      ? ((nextMonthForecast - lastObservedValue) / Math.abs(lastObservedValue)) * 100
      : null;

  return {
    metricKey,
    metricLabel,
    unit,
    requestedMode,
    selectedModel,
    selectedModelName: MODEL_NAMES[selectedModel],
    selectionJustification,
    horizon,
    historicalCount: n,
    missingMonthsCount,
    missingMonthsList,
    outlierPeriods,
    reliabilityTier,
    reliabilityLabel,
    trendDirection,
    expectedVariationPct,
    slopePerMonth: slope,
    lastObservedPeriodo: lastPeriodo,
    lastObservedValue,
    nextMonthForecast,
    accumulatedForecast,
    points,
    errorMetrics: {
      mae: selectedEval.mae,
      rmse: selectedEval.rmse,
      mapePct: selectedEval.mapePct,
      wapePct: selectedEval.wapePct,
      sampleSizeValidation: selectedEval.validationObs,
      mapeUnavailableReason: selectedEval.mapeUnavailableReason,
    },
    candidateEvaluations,
    clampedCount,
    limitations,
    seasonalityNote,
    methodologySummary: {
      aggregation: `Registros da aba Vendas somados cronologicamente por "periodo" (YYYY-MM), resultando em ${n} meses observados${missingMonthsCount > 0 ? ` e ${missingMonthsCount} lacuna(s) preservada(s)` : ''}.`,
      validation: selectedEval.applicable
        ? `Separação cronológica walk-forward (rolling-origin): treino inicial de ${selectedEval.trainingObs} meses e teste passo-a-passo nos ${selectedEval.validationObs} meses mais recentes, sem divisão aleatória.`
        : 'Amostra abaixo do mínimo para backtesting completo; projeção exploratória.',
      selection: selectionJustification,
      limitations:
        limitations.length > 0
          ? limitations.join(' ')
          : 'Previsões baseadas exclusivamente na continuidade estatística dos padrões históricos; eventos comerciais inéditos não são capturados automaticamente.',
    },
  };
}

// ============================================================================
// SEGMENTED FORECASTS (CATEGORIES & CHANNELS) + FINANCIAL COHERENCE + GOALS
// ============================================================================

export function buildSegmentedForecasts(
  vendas: VendaRecord[],
  metas: MetaRecord[],
  filters: GlobalFilters,
  segmentField: 'categoria' | 'unidade_negocio',
  requestedMode: ForecastModelType,
  horizon: ForecastHorizon,
): SegmentForecastSummary[] {
  const keys = Array.from(
    new Set(
      vendas
        .map((v) => v[segmentField])
        .filter((s) => Boolean(s && s.trim())),
    ),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const summaries: SegmentForecastSummary[] = keys.map((key) => {
    const segRows = vendas.filter((v) => v[segmentField] === key);
    const segFilters: GlobalFilters = {
      ...filters,
      [segmentField]: key,
    };
    const series = buildMonthlySeries(segRows, metas, segFilters);

    const volForecast = generateAdvancedForecast(
      series,
      (m) => m.volumeLitros,
      `volume_${segmentField}_${key}`,
      `Volume · ${key}`,
      'L',
      requestedMode,
      horizon,
      false,
    );
    const revForecast = generateAdvancedForecast(
      series,
      (m) => m.faturamentoBruto,
      `faturamento_${segmentField}_${key}`,
      `Faturamento · ${key}`,
      'BRL',
      requestedMode,
      horizon,
      false,
    );

    const validSeries = series.filter((s) => !s.semRegistros);
    const recentSlice = validSeries.slice(-horizon);
    const recentAvgVol =
      recentSlice.length > 0
        ? recentSlice.reduce((acc, s) => acc + s.volumeLitros, 0) / recentSlice.length
        : null;
    const recentAvgRev =
      recentSlice.length > 0
        ? recentSlice.reduce((acc, s) => acc + s.faturamentoBruto, 0) / recentSlice.length
        : null;

    const projVolAvg =
      volForecast.accumulatedForecast !== null
        ? volForecast.accumulatedForecast / horizon
        : null;
    const projRevAvg =
      revForecast.accumulatedForecast !== null
        ? revForecast.accumulatedForecast / horizon
        : null;

    return {
      nome: key,
      historicalCount: revForecast.historicalCount,
      lastObservedMonthlyVolume: volForecast.lastObservedValue,
      lastObservedMonthlyRevenue: revForecast.lastObservedValue,
      projectedVolumeSum: volForecast.accumulatedForecast,
      projectedRevenueSum: revForecast.accumulatedForecast,
      projectedMonthlyAvgVolume: projVolAvg,
      projectedMonthlyAvgRevenue: projRevAvg,
      expectedRevenueDeltaPct:
        projRevAvg !== null && recentAvgRev !== null && recentAvgRev > 0
          ? ((projRevAvg - recentAvgRev) / recentAvgRev) * 100
          : null,
      expectedVolumeDeltaPct:
        projVolAvg !== null && recentAvgVol !== null && recentAvgVol > 0
          ? ((projVolAvg - recentAvgVol) / recentAvgVol) * 100
          : null,
      projectedRevenueSharePct: null,
      trendDirection:
        segmentField === 'categoria' ? volForecast.trendDirection : revForecast.trendDirection,
      selectedModelName:
        segmentField === 'categoria'
          ? volForecast.selectedModelName
          : revForecast.selectedModelName,
      reliabilityTier: revForecast.reliabilityTier,
      volumeForecast: volForecast,
      revenueForecast: revForecast,
    };
  });

  const totalProjRevenue = summaries.reduce(
    (acc, s) => acc + (s.projectedRevenueSum ?? 0),
    0,
  );
  for (const s of summaries) {
    if (s.projectedRevenueSum !== null && totalProjRevenue > 0) {
      s.projectedRevenueSharePct = (s.projectedRevenueSum / totalProjRevenue) * 100;
    }
  }

  return summaries.sort(
    (a, b) => (b.projectedRevenueSum ?? 0) - (a.projectedRevenueSum ?? 0),
  );
}

export function buildCoherentFinancialForecast(
  monthlySeries: MonthlySeriesPoint[],
  requestedMode: ForecastModelType,
  horizon: ForecastHorizon,
): {
  revenue: ForecastResult;
  directCost: ForecastResult;
  opExpense: ForecastResult;
  opResult: ForecastResult;
  coherentRows: CoherentFinancialForecastRow[];
} {
  const revenue = generateAdvancedForecast(
    monthlySeries,
    (m) => m.faturamentoBruto,
    'faturamento_bruto',
    'Faturamento Mensal',
    'BRL',
    requestedMode,
    horizon,
    false,
  );
  const directCost = generateAdvancedForecast(
    monthlySeries,
    (m) => m.custoDireto,
    'custo_direto',
    'Custos Diretos',
    'BRL',
    requestedMode,
    horizon,
    false,
  );
  const opExpense = generateAdvancedForecast(
    monthlySeries,
    (m) => m.despesaOperacional,
    'despesa_operacional',
    'Despesas Operacionais',
    'BRL',
    requestedMode,
    horizon,
    false,
  );
  const opResult = generateAdvancedForecast(
    monthlySeries,
    (m) => m.resultadoOperacional,
    'resultado_operacional',
    'Resultado Operacional Estimado',
    'BRL',
    requestedMode,
    horizon,
    true,
  );

  const futRev = revenue.points.filter((p) => p.tipo === 'previsão');
  const futCost = directCost.points.filter((p) => p.tipo === 'previsão');
  const futExp = opExpense.points.filter((p) => p.tipo === 'previsão');
  const futRes = opResult.points.filter((p) => p.tipo === 'previsão');

  const coherentRows: CoherentFinancialForecastRow[] = futRev.map((r, idx) => {
    const fat = r.previsto;
    const custo = futCost[idx]?.previsto ?? null;
    const desp = futExp[idx]?.previsto ?? null;
    // Coherent operational result from forecasted revenue - cost - expense OR forecasted opResult when available
    const resFromIdentity =
      fat !== null && custo !== null && desp !== null ? fat - custo - desp : futRes[idx]?.previsto ?? null;
    const margemPct =
      fat !== null && fat > 0 && resFromIdentity !== null
        ? (resFromIdentity / fat) * 100
        : null;

    return {
      periodo: r.periodo,
      label: r.label,
      faturamentoPrevisto: fat,
      custoDiretoPrevisto: custo,
      despesaOperacionalPrevista: desp,
      resultadoOperacionalPrevisto: resFromIdentity,
      margemOperacionalProjetadaPct: margemPct,
    };
  });

  return { revenue, directCost, opExpense, opResult, coherentRows };
}

export function buildForecastGoalComparison(
  coherentFinancial: CoherentFinancialForecastRow[],
  volumeForecast: ForecastResult,
  metas: MetaRecord[],
  filters: GlobalFilters,
): ForecastGoalComparisonRow[] {
  const hasRecordFilter =
    filters.categoria !== 'ALL' ||
    filters.produto !== 'ALL' ||
    filters.forma_pagamento !== 'ALL' ||
    filters.status_pagamento !== 'ALL';

  // Filter goals only by unit_negocio when not restricted by product/category
  const unitMetas = hasRecordFilter
    ? []
    : filterMetas(metas, {
        ...filters,
        periodo: 'ALL',
        periodoInicio: 'ALL',
        periodoFim: 'ALL',
        ano: 'ALL',
        mes: 'ALL',
      });

  const futVol = volumeForecast.points.filter((p) => p.tipo === 'previsão');

  return coherentFinancial.map((row, idx) => {
    const vol = futVol[idx]?.previsto ?? null;
    const matchingMetas = unitMetas.filter((m) => m.periodo === row.periodo);

    if (matchingMetas.length === 0) {
      return {
        periodo: row.periodo,
        faturamentoPrevisto: row.faturamentoPrevisto,
        metaFaturamento: null,
        difFatAbs: null,
        difFatPct: null,
        atingFatPct: null,
        volumePrevisto: vol,
        metaVolume: null,
        difVolAbs: null,
        difVolPct: null,
        atingVolPct: null,
        margemProjetadaPct: row.margemOperacionalProjetadaPct,
        metaMargemPct: null,
        hasMeta: false,
      };
    }

    let metaFat = 0;
    let hasFat = false;
    let metaVol = 0;
    let hasVol = false;
    let targetOpProfit = 0;
    let targetFatForMargin = 0;

    for (const m of matchingMetas) {
      if (m.meta_faturamento !== null) {
        metaFat += m.meta_faturamento;
        hasFat = true;
      }
      if (m.meta_volume_litros !== null) {
        metaVol += m.meta_volume_litros;
        hasVol = true;
      }
      if (m.meta_faturamento !== null && m.meta_margem_operacional_pct !== null) {
        targetOpProfit += m.meta_faturamento * (m.meta_margem_operacional_pct / 100);
        targetFatForMargin += m.meta_faturamento;
      }
    }

    const mFatVal = hasFat ? metaFat : null;
    const mVolVal = hasVol ? metaVol : null;
    const mMargemVal = safeDivide(targetOpProfit * 100, targetFatForMargin);

    const difFatAbs = row.faturamentoPrevisto !== null && mFatVal !== null ? row.faturamentoPrevisto - mFatVal : null;
    const difFatPct = difFatAbs !== null && mFatVal ? (difFatAbs / Math.abs(mFatVal)) * 100 : null;
    const atingFatPct = row.faturamentoPrevisto !== null && mFatVal ? (row.faturamentoPrevisto / mFatVal) * 100 : null;

    const difVolAbs = vol !== null && mVolVal !== null ? vol - mVolVal : null;
    const difVolPct = difVolAbs !== null && mVolVal ? (difVolAbs / Math.abs(mVolVal)) * 100 : null;
    const atingVolPct = vol !== null && mVolVal ? (vol / mVolVal) * 100 : null;

    return {
      periodo: row.periodo,
      faturamentoPrevisto: row.faturamentoPrevisto,
      metaFaturamento: mFatVal,
      difFatAbs,
      difFatPct,
      atingFatPct,
      volumePrevisto: vol,
      metaVolume: mVolVal,
      difVolAbs,
      difVolPct,
      atingVolPct,
      margemProjetadaPct: row.margemOperacionalProjetadaPct,
      metaMargemPct: mMargemVal,
      hasMeta: true,
    };
  });
}

export function simulateForecastScenarios(
  coherentFinancial: CoherentFinancialForecastRow[],
  horizonMonths: ForecastHorizon,
  conservativeAdjPct: number,
  optimisticAdjPct: number,
  costElasticityPct = 55, // % of cost/expense that varies proportionally with revenue volume change
): ScenarioSimulationResult {
  const elas = costElasticityPct / 100;
  const consMult = 1 + conservativeAdjPct / 100;
  const optMult = 1 + optimisticAdjPct / 100;

  const rows = coherentFinancial.map((r) => {
    const baseRev = r.faturamentoPrevisto;
    const baseRes = r.resultadoOperacionalPrevisto;
    const baseCostTotal =
      (r.custoDiretoPrevisto ?? 0) + (r.despesaOperacionalPrevista ?? 0);

    const consRev = baseRev !== null ? Math.max(0, baseRev * consMult) : null;
    const optRev = baseRev !== null ? Math.max(0, baseRev * optMult) : null;

    const consCost = baseCostTotal * (1 + (consMult - 1) * elas);
    const optCost = baseCostTotal * (1 + (optMult - 1) * elas);

    const consRes = consRev !== null ? consRev - consCost : null;
    const optRes = optRev !== null ? optRev - optCost : null;

    return {
      periodo: r.periodo,
      label: r.label,
      baseRevenue: baseRev,
      conservativeRevenue: consRev,
      optimisticRevenue: optRev,
      baseOpResult: baseRes,
      conservativeOpResult: consRes,
      optimisticOpResult: optRes,
    };
  });

  const sumOrNull = (arr: Array<number | null>) => {
    if (arr.some((v) => v === null)) return null;
    return arr.reduce((a, b) => (a ?? 0) + (b ?? 0), 0);
  };

  return {
    horizonMonths,
    conservativeAdjPct,
    optimisticAdjPct,
    costElasticityPct,
    rows,
    totals: {
      baseRevenue: sumOrNull(rows.map((r) => r.baseRevenue)),
      conservativeRevenue: sumOrNull(rows.map((r) => r.conservativeRevenue)),
      optimisticRevenue: sumOrNull(rows.map((r) => r.optimisticRevenue)),
      baseOpResult: sumOrNull(rows.map((r) => r.baseOpResult)),
      conservativeOpResult: sumOrNull(rows.map((r) => r.conservativeOpResult)),
      optimisticOpResult: sumOrNull(rows.map((r) => r.optimisticOpResult)),
    },
  };
}
