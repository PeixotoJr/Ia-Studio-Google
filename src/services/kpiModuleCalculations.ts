import type {
  VendaRecord,
  MetaRecord,
  GlobalFilters,
  ComparisonMode,
  KpiCardMetric,
  KpiDiagnosticItem,
  KpiPolarity,
  KpiSignalStatus,
  MonthlySeriesPoint,
  SegmentMetric,
} from '../types/bi';
import {
  computeKpis,
  buildMonthlySeries,
  buildSegmentMetrics,
  filterVendas,
  filterMetas,
} from './biCalculations';
import {
  safeDivide,
  formatCurrencyBRL,
  formatLiters,
  formatNumber,
  formatPercent,
  formatPeriodoLabel,
} from '../utils/formatters';

export interface StockProductRow {
  produto: string;
  categoria: string;
  registrosComEstoque: number;
  estoqueMedioAntes: number | null;
  estoqueMedioDepois: number | null;
  quantidadeVendida: number;
  indiceMovimentacao: number | null;
}

export interface StockCategoryRow {
  categoria: string;
  registrosComEstoque: number;
  estoqueMedioAntes: number | null;
  estoqueMedioDepois: number | null;
  quantidadeVendida: number;
  indiceMovimentacao: number | null;
}

export interface ProductionDemandRow {
  categoria: string;
  volumeLitros: number;
  participacaoVolumePct: number | null;
  faturamentoBruto: number;
  custoDireto: number;
  resultadoOperacional: number;
  margemOperacionalPct: number | null;
  precoMedioPorLitro: number | null;
}

export interface ChannelMixRow {
  canal: string;
  faturamentoBruto: number;
  participacaoFaturamentoPct: number | null;
  volumeLitros: number;
  participacaoVolumePct: number | null;
  precoMedioPorLitro: number | null;
  resultadoOperacional: number;
  margemOperacionalPct: number | null;
}

export interface SatisfactionBucket {
  faixa: string;
  quantidade: number;
  percentualPct: number | null;
}

export interface ConsolidatedMetaTargetRow {
  indicador: string;
  realizadoFormatted: string;
  metaFormatted: string;
  diferencaAbsFormatted: string;
  diferencaPctFormatted: string;
  atingimentoPct: number | null;
  situacao: KpiSignalStatus;
  situacaoLabel: string;
  observacao?: string;
}

export interface PeriodComparisonSeriesPoint {
  label: string;
  periodoAtual: string;
  faturamentoAtual: number | null;
  periodoAnterior: string | null;
  faturamentoAnterior: number | null;
}

export interface KpiModuleBundle {
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  comparisonCaveat: string | null;
  cards: KpiCardMetric[];
  monthlyCurrent: MonthlySeriesPoint[];
  comparisonSeries: PeriodComparisonSeriesPoint[];
  byCategory: SegmentMetric[];
  byUnit: SegmentMetric[];
  byProduct: SegmentMetric[];
  byPayment: SegmentMetric[];
  channelMix: ChannelMixRow[];
  productionDemand: ProductionDemandRow[];
  stockSummary: {
    registrosComEstoqueAntes: number;
    registrosComEstoqueDepois: number;
    estoqueMedioAntes: number | null;
    estoqueMedioDepois: number | null;
    indiceMovimentacaoObservada: number | null;
    byCategory: StockCategoryRow[];
    byProduct: StockProductRow[];
  };
  satisfactionSummary: {
    mediaGeral: number | null;
    avaliacoesValidas: number;
    avaliacoesAusentes: number;
    avaliacoesForaFaixa: number;
    buckets: SatisfactionBucket[];
    byCategory: SegmentMetric[];
    byUnit: SegmentMetric[];
  };
  metaTargetsSummary: ConsolidatedMetaTargetRow[];
  diagnostics: KpiDiagnosticItem[];
}

function shiftMonth(periodo: string, deltaMonths: number): string | null {
  const m = periodo.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + deltaMonths;
  if (total < 0) return null;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  return `${y}-${String(mo).padStart(2, '0')}`;
}

function resolveComparisonWindow(
  allVendas: VendaRecord[],
  filteredVendas: VendaRecord[],
  filters: GlobalFilters,
  mode: ComparisonMode,
): {
  currentPeriods: string[];
  previousPeriods: string[];
  currentLabel: string;
  previousLabel: string;
  caveat: string | null;
} {
  const currentPeriodSet = Array.from(
    new Set(filteredVendas.map((v) => v.periodo).filter((p) => /^\d{4}-\d{2}$/.test(p))),
  ).sort();

  const allPeriodSet = new Set(
    allVendas.map((v) => v.periodo).filter((p) => /^\d{4}-\d{2}$/.test(p)),
  );

  if (currentPeriodSet.length === 0) {
    return {
      currentPeriods: [],
      previousPeriods: [],
      currentLabel: 'Sem períodos',
      previousLabel: 'Indisponível',
      caveat: 'Nenhum período válido disponível nos registros filtrados.',
    };
  }

  let currentPeriods = currentPeriodSet;
  let previousPeriods: string[] = [];
  let caveat: string | null = null;

  if (mode === 'mom') {
    // Compare latest selected/available month against immediately preceding month
    const targetMonth = currentPeriodSet[currentPeriodSet.length - 1];
    currentPeriods = [targetMonth];
    const prevMonth = shiftMonth(targetMonth, -1);
    if (prevMonth && allPeriodSet.has(prevMonth)) {
      previousPeriods = [prevMonth];
    } else {
      caveat = `Sem registros no mês imediatamente anterior (${prevMonth ?? 'N/A'}) para comparação Mês contra Mês.`;
    }
    if (currentPeriodSet.length > 1) {
      const note = `Comparação Mês vs Mês anterior avaliada sobre o último mês completo do recorte (${targetMonth}) contra ${prevMonth ?? 'N/A'}.`;
      caveat = caveat ? `${note} ${caveat}` : note;
    }
  } else if (mode === 'yoy') {
    // Same month(s) in previous year
    const prevCandidates = currentPeriods
      .map((p) => shiftMonth(p, -12))
      .filter((p): p is string => p !== null);
    const availablePrev = prevCandidates.filter((p) => allPeriodSet.has(p));
    previousPeriods = availablePrev;

    if (availablePrev.length === 0) {
      caveat = 'Não existem registros no ano anterior equivalente para os meses selecionados.';
    } else if (availablePrev.length !== currentPeriods.length) {
      caveat = `Atenção: o recorte atual possui ${currentPeriods.length} mês(es), enquanto o mesmo período do ano anterior possui apenas ${availablePrev.length} mês(es) com registros.`;
    }
  } else {
    // equal_duration: immediately preceding window of equal length
    const minP = currentPeriods[0];
    const maxP = currentPeriods[currentPeriods.length - 1];
    const m1 = minP.match(/^(\d{4})-(\d{2})$/)!;
    const m2 = maxP.match(/^(\d{4})-(\d{2})$/)!;
    const spanMonths = (Number(m2[1]) - Number(m1[1])) * 12 + (Number(m2[2]) - Number(m1[2])) + 1;

    const prevList: string[] = [];
    for (let i = spanMonths; i >= 1; i--) {
      const shifted = shiftMonth(minP, -i);
      if (shifted) prevList.push(shifted);
    }
    const availablePrev = prevList.filter((p) => allPeriodSet.has(p));
    previousPeriods = availablePrev;

    if (availablePrev.length === 0) {
      caveat = `Não há registros no período imediatamente anterior de igual duração (${spanMonths} mês/meses antes de ${minP}).`;
    } else if (availablePrev.length !== currentPeriods.length) {
      caveat = `Limitação de comparabilidade: período atual tem ${currentPeriods.length} mês(es) com dados e o período anterior equivalente tem ${availablePrev.length} mês(es) com dados.`;
    }
  }

  const hasSingleDateFilter =
    filters.periodo !== 'ALL' || filters.mes !== 'ALL';
  if (hasSingleDateFilter && mode === 'equal_duration' && currentPeriods.length === 1) {
    // Clean single-month comparison label
  }

  const formatLabel = (list: string[]) => {
    if (list.length === 0) return 'Indisponível';
    if (list.length === 1) return list[0];
    return `${list[0]} a ${list[list.length - 1]}`;
  };

  return {
    currentPeriods,
    previousPeriods,
    currentLabel: formatLabel(currentPeriods),
    previousLabel: formatLabel(previousPeriods),
    caveat,
  };
}

function evaluateStatus(
  currentVal: number | null,
  previousVal: number | null,
  attainmentPct: number | null,
  polarity: KpiPolarity,
  isMarginMetaCheck?: { metaMarginPct: number | null },
): { status: KpiSignalStatus; statusText: string } {
  if (currentVal === null || !Number.isFinite(currentVal)) {
    return { status: 'insufficient', statusText: 'Dados insuficientes' };
  }

  // If comparing margin directly against target margin
  if (isMarginMetaCheck && isMarginMetaCheck.metaMarginPct !== null) {
    const diff = currentVal - isMarginMetaCheck.metaMarginPct;
    if (diff >= 0) return { status: 'favorable', statusText: 'Acima da meta de margem' };
    if (diff >= -3) return { status: 'attention', statusText: 'Próximo à meta de margem' };
    return { status: 'unfavorable', statusText: 'Abaixo da meta de margem' };
  }

  // If goal attainment exists
  if (attainmentPct !== null && Number.isFinite(attainmentPct)) {
    if (attainmentPct >= 100) return { status: 'favorable', statusText: 'Meta atingida' };
    if (attainmentPct >= 85) return { status: 'attention', statusText: 'Atenção (85%–99% da meta)' };
    return { status: 'unfavorable', statusText: 'Abaixo da meta (< 85%)' };
  }

  if (previousVal === null || !Number.isFinite(previousVal) || previousVal === 0) {
    return { status: 'insufficient', statusText: 'Sem base comparativa' };
  }

  if (polarity === 'neutral') {
    return { status: 'attention', statusText: 'Monitoramento contínuo' };
  }

  const deltaPct = ((currentVal - previousVal) / Math.abs(previousVal)) * 100;
  if (Math.abs(deltaPct) < 2) {
    return { status: 'attention', statusText: 'Estável frente ao período anterior' };
  }

  if (polarity === 'higher_is_better') {
    return deltaPct > 0
      ? { status: 'favorable', statusText: 'Evolução favorável' }
      : { status: 'unfavorable', statusText: 'Retração frente ao período anterior' };
  } else {
    // lower_is_better (custos, despesas, valores em aberto)
    return deltaPct < 0
      ? { status: 'favorable', statusText: 'Redução favorável' }
      : { status: 'unfavorable', statusText: 'Elevação desfavorável' };
  }
}

function buildCard(params: {
  id: string;
  group: KpiCardMetric['group'];
  name: string;
  currentValue: number | null;
  previousValue: number | null;
  metaValue?: number | null;
  attainmentPct?: number | null;
  polarity: KpiPolarity;
  unitLabel: string;
  formatter: (v: number | null) => string;
  deltaAbsFormatter?: (v: number | null) => string;
  note?: string;
  sparkline: Array<{ label: string; value: number | null }>;
  isMarginMetaCheck?: { metaMarginPct: number | null };
}): KpiCardMetric {
  const {
    id,
    group,
    name,
    currentValue,
    previousValue,
    metaValue = null,
    attainmentPct = null,
    polarity,
    unitLabel,
    formatter,
    deltaAbsFormatter = formatter,
    note,
    sparkline,
    isMarginMetaCheck,
  } = params;

  const deltaAbs =
    currentValue !== null && previousValue !== null && Number.isFinite(currentValue - previousValue)
      ? currentValue - previousValue
      : null;

  const deltaPct =
    deltaAbs !== null && previousValue !== null && previousValue !== 0
      ? (deltaAbs / Math.abs(previousValue)) * 100
      : null;

  const { status, statusText } = evaluateStatus(
    currentValue,
    previousValue,
    attainmentPct,
    polarity,
    isMarginMetaCheck,
  );

  return {
    id,
    group,
    name,
    currentValue,
    formattedValue: formatter(currentValue),
    unitLabel,
    previousValue,
    formattedPreviousValue: formatter(previousValue),
    deltaAbs,
    formattedDeltaAbs: deltaAbsFormatter(deltaAbs),
    deltaPct,
    metaValue,
    formattedMetaValue: metaValue !== null ? formatter(metaValue) : 'Meta não cadastrada',
    attainmentPct,
    polarity,
    status,
    statusText,
    note,
    sparkline,
  };
}

export function buildKpiModuleBundle(
  allVendas: VendaRecord[],
  allMetas: MetaRecord[],
  filters: GlobalFilters,
  comparisonMode: ComparisonMode,
): KpiModuleBundle {
  const filteredVendas = filterVendas(allVendas, filters);
  const window = resolveComparisonWindow(allVendas, filteredVendas, filters, comparisonMode);

  const curPeriodSet = new Set(window.currentPeriods);
  const prevPeriodSet = new Set(window.previousPeriods);

  // For 'mom', currentVendas is restricted to the compared month so period-over-period math is apples-to-apples!
  // Wait: the user also expects filters to reflect the selected slice. If comparisonMode === 'mom' and multiple months are selected,
  // we compute card KPIs on the full filteredVendas OR on currentPeriods?
  // Wait: Section 7 says: "Cada KPI deverá apresentar: Valor atual, Valor do período anterior equivalente... Permitir comparação: Mês contra mês anterior, Mesmo mês contra ano anterior, Período selecionado contra período imediatamente anterior de igual duração."
  // If mode === 'mom' and >1 month is selected, restricting currentVendas to the latest month ensures Current vs Previous Month are both 1-month durations!
  const currentScopeVendas =
    comparisonMode === 'mom'
      ? filteredVendas.filter((v) => curPeriodSet.has(v.periodo))
      : filteredVendas;

  const nonPeriodFilters: GlobalFilters = {
    ...filters,
    periodo: 'ALL',
    periodoInicio: 'ALL',
    periodoFim: 'ALL',
    ano: 'ALL',
    mes: 'ALL',
  };
  const previousScopeVendas =
    window.previousPeriods.length > 0
      ? filterVendas(allVendas, nonPeriodFilters).filter((v) => prevPeriodSet.has(v.periodo))
      : [];

  const curFilters: GlobalFilters =
    comparisonMode === 'mom' && window.currentPeriods.length === 1
      ? { ...filters, periodo: window.currentPeriods[0] }
      : filters;
  const prevFilters: GlobalFilters = {
    ...nonPeriodFilters,
    periodo: window.previousPeriods.length === 1 ? window.previousPeriods[0] : 'ALL',
  };
  const prevMetasFiltered = filterMetas(allMetas, prevFilters).filter((m) =>
    prevPeriodSet.has(m.periodo),
  );

  const curKpis = computeKpis(currentScopeVendas, allMetas, curFilters);
  const prevKpis =
    previousScopeVendas.length > 0
      ? computeKpis(previousScopeVendas, prevMetasFiltered, prevFilters)
      : null;

  const monthlyCurrent = buildMonthlySeries(filteredVendas, allMetas, filters);

  // Build aligned comparison chart series (current vs previous period)
  const prevMonthlyAll =
    previousScopeVendas.length > 0
      ? buildMonthlySeries(previousScopeVendas, prevMetasFiltered, prevFilters)
      : [];
  const validCurMonths = monthlyCurrent.filter((m) => !m.semRegistros);
  const validPrevMonths = prevMonthlyAll.filter((m) => !m.semRegistros);
  const comparisonSeries: PeriodComparisonSeriesPoint[] = validCurMonths.map((curM, idx) => {
    const prevM = validPrevMonths[idx] ?? null;
    return {
      label: curM.label,
      periodoAtual: curM.periodo,
      faturamentoAtual: curM.faturamentoBruto,
      periodoAnterior: prevM ? prevM.periodo : null,
      faturamentoAnterior: prevM ? prevM.faturamentoBruto : null,
    };
  });

  // Meta weighted margin calculation (strictly from totals, never simple average!)
  const hasRecordLevelFilter =
    filters.categoria !== 'ALL' ||
    filters.produto !== 'ALL' ||
    filters.forma_pagamento !== 'ALL' ||
    filters.status_pagamento !== 'ALL';

  const curMetasFiltered = filterMetas(allMetas, curFilters).filter((m) =>
    curPeriodSet.has(m.periodo),
  );

  let weightedMetaMarginPct: number | null = null;
  let metaPerdasRefPct: number | null = null;
  if (!hasRecordLevelFilter && curMetasFiltered.length > 0) {
    let targetOpProfitSum = 0;
    let targetFatForMarginSum = 0;
    let targetLossWeightedSum = 0;
    let targetVolForLossSum = 0;
    for (const m of curMetasFiltered) {
      if (m.meta_faturamento !== null && m.meta_margem_operacional_pct !== null) {
        targetOpProfitSum += m.meta_faturamento * (m.meta_margem_operacional_pct / 100);
        targetFatForMarginSum += m.meta_faturamento;
      }
      if (m.meta_volume_litros !== null && m.meta_perdas_producao_pct !== null) {
        targetLossWeightedSum += m.meta_volume_litros * m.meta_perdas_producao_pct;
        targetVolForLossSum += m.meta_volume_litros;
      }
    }
    weightedMetaMarginPct = safeDivide(targetOpProfitSum * 100, targetFatForMarginSum);
    metaPerdasRefPct = safeDivide(targetLossWeightedSum, targetVolForLossSum);
  }

  // Stock & Production calculations (strictly non-null observations)
  const computeStockStats = (rows: VendaRecord[]) => {
    const antes = rows
      .map((r) => r.estoque_unidades_antes)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const depois = rows
      .map((r) => r.estoque_unidades_depois)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const avgAntes = antes.length > 0 ? antes.reduce((a, b) => a + b, 0) / antes.length : null;
    const avgDepois = depois.length > 0 ? depois.reduce((a, b) => a + b, 0) / depois.length : null;

    // Observed stock movement index = sum(qty sold where stock_antes > 0) / sum(stock_antes)
    let qtyWithStock = 0;
    let stockAntesSum = 0;
    for (const r of rows) {
      if (
        r.estoque_unidades_antes !== null &&
        r.estoque_unidades_antes > 0 &&
        r.quantidade_unidades !== null
      ) {
        qtyWithStock += r.quantidade_unidades;
        stockAntesSum += r.estoque_unidades_antes;
      }
    }
    const movIndex = safeDivide(qtyWithStock, stockAntesSum);

    return {
      registrosComEstoqueAntes: antes.length,
      registrosComEstoqueDepois: depois.length,
      estoqueMedioAntes: avgAntes,
      estoqueMedioDepois: avgDepois,
      indiceMovimentacaoObservada: movIndex !== null ? movIndex * 100 : null,
    };
  };

  const curStock = computeStockStats(currentScopeVendas);
  const prevStock = previousScopeVendas.length > 0 ? computeStockStats(previousScopeVendas) : null;

  // Stock by category & product
  const stockByCatMap = new Map<string, VendaRecord[]>();
  const stockByProdMap = new Map<string, VendaRecord[]>();
  for (const v of currentScopeVendas) {
    const cat = v.categoria || 'Não informado';
    const prod = v.produto || 'Não informado';
    stockByCatMap.set(cat, [...(stockByCatMap.get(cat) || []), v]);
    stockByProdMap.set(`${cat}::${prod}`, [...(stockByProdMap.get(`${cat}::${prod}`) || []), v]);
  }

  const stockByCategory: StockCategoryRow[] = Array.from(stockByCatMap.entries()).map(
    ([categoria, rows]) => {
      const s = computeStockStats(rows);
      const qtd = rows.reduce((acc, r) => acc + (r.quantidade_unidades ?? 0), 0);
      return {
        categoria,
        registrosComEstoque: s.registrosComEstoqueAntes,
        estoqueMedioAntes: s.estoqueMedioAntes,
        estoqueMedioDepois: s.estoqueMedioDepois,
        quantidadeVendida: qtd,
        indiceMovimentacao: s.indiceMovimentacaoObservada,
      };
    },
  );

  const stockByProduct: StockProductRow[] = Array.from(stockByProdMap.entries())
    .map(([key, rows]) => {
      const [categoria, produto] = key.split('::');
      const s = computeStockStats(rows);
      const qtd = rows.reduce((acc, r) => acc + (r.quantidade_unidades ?? 0), 0);
      return {
        produto,
        categoria,
        registrosComEstoque: s.registrosComEstoqueAntes,
        estoqueMedioAntes: s.estoqueMedioAntes,
        estoqueMedioDepois: s.estoqueMedioDepois,
        quantidadeVendida: qtd,
        indiceMovimentacao: s.indiceMovimentacaoObservada,
      };
    })
    .sort((a, b) => b.quantidadeVendida - a.quantidadeVendida);

  // Commercial segmentations
  const byCategory = buildSegmentMetrics(currentScopeVendas, (v) => v.categoria);
  const byUnit = buildSegmentMetrics(currentScopeVendas, (v) => v.unidade_negocio);
  const byProduct = buildSegmentMetrics(currentScopeVendas, (v) => v.produto);
  const byPayment = buildSegmentMetrics(currentScopeVendas, (v) => v.forma_pagamento);

  const totalVol = curKpis.volumeLitros;
  const totalFat = curKpis.faturamentoBruto;

  const channelMix: ChannelMixRow[] = byUnit.map((u) => {
    const shareFat = safeDivide(u.faturamentoBruto, totalFat);
    const shareVol = safeDivide(u.volumeLitros, totalVol);
    return {
      canal: u.nome,
      faturamentoBruto: u.faturamentoBruto,
      participacaoFaturamentoPct: shareFat !== null ? shareFat * 100 : null,
      volumeLitros: u.volumeLitros,
      participacaoVolumePct: shareVol !== null ? shareVol * 100 : null,
      precoMedioPorLitro: safeDivide(u.faturamentoBruto, u.volumeLitros),
      resultadoOperacional: u.resultadoOperacional,
      margemOperacionalPct: u.margemOperacionalPct,
    };
  });

  const productionDemand: ProductionDemandRow[] = [...byCategory]
    .sort((a, b) => b.volumeLitros - a.volumeLitros)
    .map((c) => {
      const shareVol = safeDivide(c.volumeLitros, totalVol);
      return {
        categoria: c.nome,
        volumeLitros: c.volumeLitros,
        participacaoVolumePct: shareVol !== null ? shareVol * 100 : null,
        faturamentoBruto: c.faturamentoBruto,
        custoDireto: c.custoDireto,
        resultadoOperacional: c.resultadoOperacional,
        margemOperacionalPct: c.margemOperacionalPct,
        precoMedioPorLitro: safeDivide(c.faturamentoBruto, c.volumeLitros),
      };
    });

  // Satisfaction distribution
  const validSat: number[] = [];
  let missingSat = 0;
  let outOfRangeSat = 0;
  for (const v of currentScopeVendas) {
    if (v.satisfacao_cliente_0a10 === null) {
      missingSat++;
    } else if (v.satisfacao_cliente_0a10 < 0 || v.satisfacao_cliente_0a10 > 10) {
      outOfRangeSat++;
    } else {
      validSat.push(v.satisfacao_cliente_0a10);
    }
  }
  const bucketDefs = [
    { faixa: '0,0 – 4,9 (Crítica)', min: 0, max: 4.9999 },
    { faixa: '5,0 – 6,9 (Neutra)', min: 5, max: 6.9999 },
    { faixa: '7,0 – 8,9 (Satisfeita)', min: 7, max: 8.9999 },
    { faixa: '9,0 – 10,0 (Promotora)', min: 9, max: 10.0001 },
  ];
  const buckets: SatisfactionBucket[] = bucketDefs.map((b) => {
    const qty = validSat.filter((s) => s >= b.min && s <= b.max).length;
    const pct = safeDivide(qty, validSat.length);
    return {
      faixa: b.faixa,
      quantidade: qty,
      percentualPct: pct !== null ? pct * 100 : null,
    };
  });

  // Preço médio por litro & Participação despesas no faturamento
  const curPrecoLitro = safeDivide(curKpis.faturamentoBruto, curKpis.volumeLitros);
  const prevPrecoLitro = prevKpis ? safeDivide(prevKpis.faturamentoBruto, prevKpis.volumeLitros) : null;
  const curDespSharePct = safeDivide(curKpis.despesasOperacionaisTotal * 100, curKpis.faturamentoBruto);
  const prevDespSharePct = prevKpis
    ? safeDivide(prevKpis.despesasOperacionaisTotal * 100, prevKpis.faturamentoBruto)
    : null;

  // Sparkline helper from monthlyCurrent
  const spark = (extractor: (m: MonthlySeriesPoint) => number | null) =>
    monthlyCurrent
      .filter((m) => !m.semRegistros)
      .slice(-10)
      .map((m) => ({ label: m.label, value: extractor(m) }));

  const formatDeltaCurrency = (v: number | null) =>
    v === null ? 'N/A' : `${v >= 0 ? '+' : ''}${formatCurrencyBRL(v)}`;
  const formatDeltaPctPts = (v: number | null) =>
    v === null ? 'N/A' : `${v >= 0 ? '+' : ''}${formatNumber(v, 1)} p.p.`;
  const formatDeltaLiters = (v: number | null) =>
    v === null ? 'N/A' : `${v >= 0 ? '+' : ''}${formatLiters(v)}`;
  const formatDeltaNum = (v: number | null) =>
    v === null ? 'N/A' : `${v >= 0 ? '+' : ''}${formatNumber(v, 1)}`;

  const cards: KpiCardMetric[] = [
    // GRUPO 1: FINANCEIRO
    buildCard({
      id: 'fat-bruto',
      group: 'financeiro',
      name: 'Faturamento Bruto Total',
      currentValue: currentScopeVendas.length > 0 ? curKpis.faturamentoBruto : null,
      previousValue: prevKpis ? prevKpis.faturamentoBruto : null,
      metaValue: curKpis.metaFaturamentoTotal,
      attainmentPct: curKpis.atingimentoMetaFaturamentoPct,
      polarity: 'higher_is_better',
      unitLabel: 'R$',
      formatter: formatCurrencyBRL,
      deltaAbsFormatter: formatDeltaCurrency,
      sparkline: spark((m) => m.faturamentoBruto),
    }),
    buildCard({
      id: 'res-op',
      group: 'financeiro',
      name: 'Resultado Operacional Estimado',
      currentValue: currentScopeVendas.length > 0 ? curKpis.resultadoOperacional : null,
      previousValue: prevKpis ? prevKpis.resultadoOperacional : null,
      polarity: 'higher_is_better',
      unitLabel: 'R$',
      formatter: formatCurrencyBRL,
      deltaAbsFormatter: formatDeltaCurrency,
      sparkline: spark((m) => m.resultadoOperacional),
    }),
    buildCard({
      id: 'margem-op',
      group: 'financeiro',
      name: 'Margem Operacional',
      currentValue: curKpis.margemOperacionalPct,
      previousValue: prevKpis ? prevKpis.margemOperacionalPct : null,
      metaValue: weightedMetaMarginPct,
      attainmentPct:
        weightedMetaMarginPct !== null &&
        weightedMetaMarginPct > 0 &&
        curKpis.margemOperacionalPct !== null
          ? (curKpis.margemOperacionalPct / weightedMetaMarginPct) * 100
          : null,
      polarity: 'higher_is_better',
      unitLabel: '%',
      formatter: (v) => formatPercent(v),
      deltaAbsFormatter: formatDeltaPctPts,
      note: 'Margem consolidada ponderada pelos totais (Resultado Op. / Faturamento).',
      isMarginMetaCheck: { metaMarginPct: weightedMetaMarginPct },
      sparkline: spark((m) => m.margemOperacionalPct),
    }),
    buildCard({
      id: 'margem-contrib',
      group: 'financeiro',
      name: 'Margem de Contribuição Estimada',
      currentValue: curKpis.margemContribuicaoPct,
      previousValue: prevKpis ? prevKpis.margemContribuicaoPct : null,
      polarity: 'higher_is_better',
      unitLabel: '%',
      formatter: (v) => formatPercent(v),
      deltaAbsFormatter: formatDeltaPctPts,
      note: 'Distinta da Margem Operacional: desconta apenas custo_direto antes das despesas operacionais.',
      sparkline: spark((m) => m.margemContribuicaoPct),
    }),
    buildCard({
      id: 'custo-direto',
      group: 'financeiro',
      name: 'Custo Direto Total',
      currentValue: currentScopeVendas.length > 0 ? curKpis.custoDiretoTotal : null,
      previousValue: prevKpis ? prevKpis.custoDiretoTotal : null,
      polarity: 'lower_is_better',
      unitLabel: 'R$',
      formatter: formatCurrencyBRL,
      deltaAbsFormatter: formatDeltaCurrency,
      note: 'Sinalização invertida: redução de custo direto tende a ser favorável.',
      sparkline: spark((m) => m.custoDireto),
    }),
    buildCard({
      id: 'desp-op',
      group: 'financeiro',
      name: 'Despesas Operacionais',
      currentValue: currentScopeVendas.length > 0 ? curKpis.despesasOperacionaisTotal : null,
      previousValue: prevKpis ? prevKpis.despesasOperacionaisTotal : null,
      polarity: 'lower_is_better',
      unitLabel: 'R$',
      formatter: formatCurrencyBRL,
      deltaAbsFormatter: formatDeltaCurrency,
      note: `Participação sobre faturamento: ${formatPercent(curDespSharePct)} (anterior: ${formatPercent(prevDespSharePct)}).`,
      sparkline: spark((m) => m.despesaOperacional),
    }),
    buildCard({
      id: 'custo-litro',
      group: 'financeiro',
      name: 'Custo de Produção por Litro',
      currentValue: curKpis.custoPorLitro,
      previousValue: prevKpis ? prevKpis.custoPorLitro : null,
      polarity: 'lower_is_better',
      unitLabel: 'R$/L',
      formatter: formatCurrencyBRL,
      deltaAbsFormatter: formatDeltaCurrency,
      note: 'Soma de custo_direto / soma de volume_litros.',
      sparkline: spark((m) => m.custoPorLitro),
    }),
    buildCard({
      id: 'valor-recebido',
      group: 'financeiro',
      name: 'Valores Recebidos',
      currentValue: currentScopeVendas.length > 0 ? curKpis.valoresRecebidos : null,
      previousValue: prevKpis ? prevKpis.valoresRecebidos : null,
      polarity: 'higher_is_better',
      unitLabel: 'R$',
      formatter: formatCurrencyBRL,
      deltaAbsFormatter: formatDeltaCurrency,
      note: `Percentual de recebimento: ${formatPercent(curKpis.percentualRecebimentoPct)} do faturamento.`,
      sparkline: spark((m) => m.valorRecebido),
    }),
    buildCard({
      id: 'valor-aberto',
      group: 'financeiro',
      name: 'Valores em Aberto',
      currentValue: currentScopeVendas.length > 0 ? curKpis.valoresEmAberto : null,
      previousValue: prevKpis ? prevKpis.valoresEmAberto : null,
      polarity: 'lower_is_better',
      unitLabel: 'R$',
      formatter: formatCurrencyBRL,
      deltaAbsFormatter: formatDeltaCurrency,
      note: `Percentual em aberto: ${formatPercent(curKpis.percentualEmAbertoPct)} do faturamento (menor é melhor).`,
      sparkline: spark((m) => m.valorEmAberto),
    }),

    // GRUPO 2: COMERCIAL
    buildCard({
      id: 'volume-litros',
      group: 'comercial',
      name: 'Volume Comercializado',
      currentValue: currentScopeVendas.length > 0 ? curKpis.volumeLitros : null,
      previousValue: prevKpis ? prevKpis.volumeLitros : null,
      metaValue: curKpis.metaVolumeTotal,
      attainmentPct: curKpis.atingimentoMetaVolumePct,
      polarity: 'higher_is_better',
      unitLabel: 'Litros',
      formatter: formatLiters,
      deltaAbsFormatter: formatDeltaLiters,
      sparkline: spark((m) => m.volumeLitros),
    }),
    buildCard({
      id: 'qtd-unidades',
      group: 'comercial',
      name: 'Quantidade de Unidades Vendidas',
      currentValue: currentScopeVendas.length > 0 ? curKpis.quantidadeUnidades : null,
      previousValue: prevKpis ? prevKpis.quantidadeUnidades : null,
      polarity: 'higher_is_better',
      unitLabel: 'Unidades',
      formatter: (v) => formatNumber(v, 0),
      deltaAbsFormatter: (v) => (v === null ? 'N/A' : `${v >= 0 ? '+' : ''}${formatNumber(v, 0)}`),
      sparkline: spark((m) => m.quantidadeUnidades),
    }),
    buildCard({
      id: 'ticket-registro',
      group: 'comercial',
      name: 'Ticket Médio por Registro',
      currentValue: curKpis.ticketMedioPorRegistro,
      previousValue: prevKpis ? prevKpis.ticketMedioPorRegistro : null,
      polarity: 'higher_is_better',
      unitLabel: 'R$/reg.',
      formatter: formatCurrencyBRL,
      deltaAbsFormatter: formatDeltaCurrency,
      note: 'Calculado por registro de venda (a planilha não possui ID único de cliente).',
      sparkline: spark((m) => (m.registros > 0 ? m.faturamentoBruto / m.registros : null)),
    }),
    buildCard({
      id: 'preco-litro',
      group: 'comercial',
      name: 'Preço Médio por Litro',
      currentValue: curPrecoLitro,
      previousValue: prevPrecoLitro,
      polarity: 'higher_is_better',
      unitLabel: 'R$/L',
      formatter: formatCurrencyBRL,
      deltaAbsFormatter: formatDeltaCurrency,
      note: 'Faturamento bruto / volume comercializado em litros.',
      sparkline: spark((m) => m.precoMedioPorLitro),
    }),

    // GRUPO 3: PRODUÇÃO E ESTOQUE
    buildCard({
      id: 'estoque-antes',
      group: 'producao',
      name: 'Estoque Médio Antes das Vendas',
      currentValue: curStock.estoqueMedioAntes,
      previousValue: prevStock ? prevStock.estoqueMedioAntes : null,
      polarity: 'neutral',
      unitLabel: 'Unid./reg.',
      formatter: (v) => formatNumber(v, 1),
      deltaAbsFormatter: formatDeltaNum,
      note: `Média sobre ${curStock.registrosComEstoqueAntes} observações transacionais (não representa inventário consolidado).`,
      sparkline: spark((m) => m.estoqueMedioAntes),
    }),
    buildCard({
      id: 'estoque-depois',
      group: 'producao',
      name: 'Estoque Médio Depois das Vendas',
      currentValue: curStock.estoqueMedioDepois,
      previousValue: prevStock ? prevStock.estoqueMedioDepois : null,
      polarity: 'neutral',
      unitLabel: 'Unid./reg.',
      formatter: (v) => formatNumber(v, 1),
      deltaAbsFormatter: formatDeltaNum,
      note: `Média sobre ${curStock.registrosComEstoqueDepois} observações transacionais após saída.`,
      sparkline: spark((m) => m.estoqueMedioDepois),
    }),
    buildCard({
      id: 'mov-estoque',
      group: 'producao',
      name: 'Índice de Movimentação Observada',
      currentValue: curStock.indiceMovimentacaoObservada,
      previousValue: prevStock ? prevStock.indiceMovimentacaoObservada : null,
      polarity: 'neutral',
      unitLabel: '%',
      formatter: (v) => formatPercent(v),
      deltaAbsFormatter: formatDeltaPctPts,
      note: 'Relação Qtd. vendida / Estoque observado antes. Não equivale a giro real sem histórico de entradas e inventário.',
      sparkline: spark((m) =>
        m.estoqueMedioAntes && m.estoqueMedioAntes > 0 && m.registros > 0
          ? ((m.quantidadeUnidades / m.registros) / m.estoqueMedioAntes) * 100
          : null,
      ),
    }),

    // GRUPO 4: SATISFAÇÃO
    buildCard({
      id: 'satisfacao-media',
      group: 'satisfacao',
      name: 'Satisfação Média dos Clientes',
      currentValue: curKpis.satisfacaoMedia,
      previousValue: prevKpis ? prevKpis.satisfacaoMedia : null,
      polarity: 'higher_is_better',
      unitLabel: '0–10',
      formatter: (v) => (v === null ? 'N/A' : `${formatNumber(v, 2)} / 10`),
      deltaAbsFormatter: formatDeltaNum,
      note: `${validSat.length} avaliações válidas (${missingSat} nulas ignoradas; nunca convertidas em zero).`,
      sparkline: spark((m) => m.satisfacaoMedia),
    }),
  ];

  // GRUPO 5: METAS E RESULTADOS CONSOLIDADOS
  const makeTargetRow = (
    indicador: string,
    realized: number | null,
    target: number | null,
    formatter: (v: number | null) => string,
    isPercentMetric = false,
    observacao?: string,
  ): ConsolidatedMetaTargetRow => {
    if (target === null || realized === null) {
      return {
        indicador,
        realizadoFormatted: realized !== null ? formatter(realized) : 'N/A',
        metaFormatted: target !== null ? formatter(target) : 'Meta não cadastrada',
        diferencaAbsFormatted: 'N/A',
        diferencaPctFormatted: 'N/A',
        atingimentoPct: null,
        situacao: 'insufficient',
        situacaoLabel: target === null ? 'Meta não cadastrada' : 'Sem base',
        observacao,
      };
    }

    const diffAbs = realized - target;
    const diffPct = target !== 0 ? (diffAbs / Math.abs(target)) * 100 : null;
    const atingPct = target !== 0 ? (realized / target) * 100 : null;
    let situacao: KpiSignalStatus = 'insufficient';
    let situacaoLabel = 'Sem base';

    if (isPercentMetric) {
      if (diffAbs >= 0) {
        situacao = 'favorable';
        situacaoLabel = 'Satisfatório';
      } else if (diffAbs >= -3) {
        situacao = 'attention';
        situacaoLabel = 'Atenção';
      } else {
        situacao = 'unfavorable';
        situacaoLabel = 'Abaixo do esperado';
      }
    } else if (atingPct !== null) {
      if (atingPct >= 100) {
        situacao = 'favorable';
        situacaoLabel = 'Satisfatório';
      } else if (atingPct >= 85) {
        situacao = 'attention';
        situacaoLabel = 'Atenção';
      } else {
        situacao = 'unfavorable';
        situacaoLabel = 'Abaixo do esperado';
      }
    }

    return {
      indicador,
      realizadoFormatted: formatter(realized),
      metaFormatted: formatter(target),
      diferencaAbsFormatted: isPercentMetric
        ? formatDeltaPctPts(diffAbs)
        : `${diffAbs >= 0 ? '+' : ''}${formatter(diffAbs)}`,
      diferencaPctFormatted: diffPct !== null ? `${diffPct >= 0 ? '+' : ''}${formatPercent(diffPct)}` : 'N/A',
      atingimentoPct: atingPct,
      situacao,
      situacaoLabel,
      observacao,
    };
  };

  const metaTargetsSummary: ConsolidatedMetaTargetRow[] = [
    makeTargetRow(
      'Faturamento Bruto',
      currentScopeVendas.length > 0 ? curKpis.faturamentoBruto : null,
      curKpis.metaFaturamentoTotal,
      formatCurrencyBRL,
      false,
      hasRecordLevelFilter ? 'Metas da aba Metas são definidas por período/unidade (desabilitadas sob filtro de categoria/produto/pagamento).' : undefined,
    ),
    makeTargetRow(
      'Volume Comercializado (L)',
      currentScopeVendas.length > 0 ? curKpis.volumeLitros : null,
      curKpis.metaVolumeTotal,
      formatLiters,
      false,
    ),
    makeTargetRow(
      'Margem Operacional (%)',
      curKpis.margemOperacionalPct,
      weightedMetaMarginPct,
      (v) => formatPercent(v),
      true,
      'Meta consolidada ponderada pelo faturamento planejado de cada unidade.',
    ),
    {
      indicador: 'Perdas de Produção (%)',
      realizadoFormatted: 'N/A (sem medição)',
      metaFormatted: metaPerdasRefPct !== null ? formatPercent(metaPerdasRefPct) : 'Meta não cadastrada',
      diferencaAbsFormatted: 'N/A',
      diferencaPctFormatted: 'N/A',
      atingimentoPct: null,
      situacao: 'insufficient',
      situacaoLabel: 'Não comparável com Vendas',
      observacao: 'A aba Vendas não registra medições reais de perdas produtivas; meta exibida apenas como referência.',
    },
  ];

  // SECTION 11: AUTOMATED DETERMINISTIC KPI DIAGNOSTICS
  const diagnostics: KpiDiagnosticItem[] = [];

  const cardById = (id: string) => cards.find((c) => c.id === id)!;
  const fatCard = cardById('fat-bruto');
  const margemCard = cardById('margem-op');
  const custoCard = cardById('custo-direto');
  const abertoCard = cardById('valor-aberto');
  const satCard = cardById('satisfacao-media');

  // 1. Revenue growth / drop
  diagnostics.push({
    id: 'diag-rev',
    indicadorAnalisado: 'Faturamento Bruto',
    valorObservado: fatCard.formattedValue,
    comparacaoReferencia:
      fatCard.deltaPct !== null
        ? `${fatCard.deltaPct >= 0 ? '+' : ''}${formatPercent(fatCard.deltaPct)} vs ${window.previousLabel}`
        : fatCard.metaValue !== null
        ? `${formatPercent(fatCard.attainmentPct)} da meta (${fatCard.formattedMetaValue})`
        : 'Sem período anterior equivalente',
    interpretacao:
      fatCard.deltaPct === null
        ? 'Não há base comparativa no período anterior equivalente para medir variação.'
        : fatCard.deltaPct >= 0
        ? `Crescimento de ${formatPercent(fatCard.deltaPct)} (${fatCard.formattedDeltaAbs}) em relação ao período anterior.`
        : `Retração de ${formatPercent(Math.abs(fatCard.deltaPct))} (${fatCard.formattedDeltaAbs}) em relação ao período anterior.`,
    recomendacaoAcao:
      fatCard.deltaPct !== null && fatCard.deltaPct < 0
        ? 'Revisar campanhas comerciais nos canais com maior queda de volume e priorizar mix de maior giro.'
        : 'Sustentar ritmo comercial avaliando capacidade de produção para os rótulos líderes.',
    status: fatCard.status,
  });

  // 2. Most profitable category
  const sortedCatByMargin = [...byCategory].sort(
    (a, b) => (b.margemOperacionalPct ?? -999) - (a.margemOperacionalPct ?? -999),
  );
  if (sortedCatByMargin.length > 0) {
    const bestCat = sortedCatByMargin[0];
    const worstCat = sortedCatByMargin[sortedCatByMargin.length - 1];
    diagnostics.push({
      id: 'diag-cat',
      indicadorAnalisado: 'Rentabilidade por Categoria',
      valorObservado: `${bestCat.nome}: ${formatPercent(bestCat.margemOperacionalPct)}`,
      comparacaoReferencia: `Menor margem: ${worstCat.nome} (${formatPercent(worstCat.margemOperacionalPct)})`,
      interpretacao: `A categoria ${bestCat.nome} lidera a rentabilidade operacional (${formatCurrencyBRL(bestCat.resultadoOperacional)}), enquanto ${worstCat.nome} apresenta a menor margem do recorte.`,
      recomendacaoAcao: `Ampliar destaque comercial de ${bestCat.nome} e revisar ficha técnica/precificação de ${worstCat.nome}.`,
      status: (bestCat.margemOperacionalPct ?? 0) >= 10 ? 'favorable' : 'attention',
    });
  }

  // 3. Business units below goal
  if (!hasRecordLevelFilter && curMetasFiltered.length > 0) {
    const unitTotals = new Map<string, { fat: number; meta: number }>();
    for (const v of currentScopeVendas) {
      const cur = unitTotals.get(v.unidade_negocio) || { fat: 0, meta: 0 };
      cur.fat += v.faturamento_bruto ?? 0;
      unitTotals.set(v.unidade_negocio, cur);
    }
    for (const m of curMetasFiltered) {
      const cur = unitTotals.get(m.unidade_negocio) || { fat: 0, meta: 0 };
      cur.meta += m.meta_faturamento ?? 0;
      unitTotals.set(m.unidade_negocio, cur);
    }
    const underUnits = Array.from(unitTotals.entries())
      .map(([u, d]) => ({ unidade: u, fat: d.fat, meta: d.meta, ating: d.meta > 0 ? (d.fat / d.meta) * 100 : null }))
      .filter((x) => x.ating !== null && x.ating < 100)
      .sort((a, b) => (a.ating ?? 999) - (b.ating ?? 999));

    if (underUnits.length > 0) {
      const worst = underUnits[0];
      diagnostics.push({
        id: 'diag-unit-meta',
        indicadorAnalisado: 'Unidades Abaixo da Meta de Faturamento',
        valorObservado: `${underUnits.length} unidade(s) abaixo de 100%`,
        comparacaoReferencia: `Menor atingimento: ${worst.unidade} (${formatPercent(worst.ating)})`,
        interpretacao: `${underUnits.map((u) => `${u.unidade} (${formatPercent(u.ating)})`).join(', ')} não atingiram integralmente a meta planejada no período.`,
        recomendacaoAcao: `Executar plano de recuperação comercial focado em ${worst.unidade} e revisar metas vs demanda observada.`,
        status: (worst.ating ?? 0) < 85 ? 'unfavorable' : 'attention',
      });
    } else {
      diagnostics.push({
        id: 'diag-unit-meta-ok',
        indicadorAnalisado: 'Atingimento de Metas por Unidade',
        valorObservado: '100% das unidades na meta',
        comparacaoReferencia: `Meta consolidada: ${formatPercent(curKpis.atingimentoMetaFaturamentoPct)}`,
        interpretacao: 'Todas as unidades de negócio com meta cadastrada superaram ou igualaram o objetivo de faturamento.',
        recomendacaoAcao: 'Avaliar recalibração progressiva das metas para o próximo ciclo.',
        status: 'favorable',
      });
    }
  }

  // 4. Cost & Operating Margin shift
  diagnostics.push({
    id: 'diag-costs',
    indicadorAnalisado: 'Custos Diretos e Margem Operacional',
    valorObservado: `Custo: ${custoCard.formattedValue} | Margem Op.: ${margemCard.formattedValue}`,
    comparacaoReferencia:
      custoCard.deltaPct !== null
        ? `Custo ${custoCard.deltaPct >= 0 ? '+' : ''}${formatPercent(custoCard.deltaPct)} | Margem ${margemCard.formattedDeltaAbs}`
        : `Custo/Litro: ${formatCurrencyBRL(curKpis.custoPorLitro)}`,
    interpretacao:
      custoCard.deltaPct !== null && custoCard.deltaPct > 3
        ? `Custo direto subiu ${formatPercent(custoCard.deltaPct)} frente ao período anterior, pressionando a margem operacional (${margemCard.formattedValue}).`
        : `Estrutura de custo direto em ${formatCurrencyBRL(curKpis.custoPorLitro)}/L com margem operacional de ${margemCard.formattedValue}.`,
    recomendacaoAcao: 'Auditar insumos de maior peso no custo/litro e eficiência de envase/lotes nos produtos de menor margem.',
    status: margemCard.status,
  });

  // 5. Products with low/negative operating result
  const lowProducts = byProduct.filter((p) => p.resultadoOperacional < 0 || (p.margemOperacionalPct ?? 999) < 8);
  diagnostics.push({
    id: 'diag-low-prod',
    indicadorAnalisado: 'Produtos com Baixo Resultado Operacional',
    valorObservado: `${lowProducts.length} produto(s) com margem < 8% ou prejuízo`,
    comparacaoReferencia:
      lowProducts.length > 0
        ? `Menor resultado: ${[...lowProducts].sort((a, b) => a.resultadoOperacional - b.resultadoOperacional)[0].nome}`
        : 'Todos os produtos acima de 8% de margem',
    interpretacao:
      lowProducts.length > 0
        ? `Rótulos críticos identificados: ${lowProducts.slice(0, 4).map((p) => `${p.nome} (${formatPercent(p.margemOperacionalPct)})`).join(', ')}.`
        : 'Portfólio sem produtos operando em prejuízo ou margem crítica no recorte.',
    recomendacaoAcao:
      lowProducts.length > 0
        ? 'Reajustar tabela de preço, renegociar insumos ou avaliar descontinuação/substituição dos rótulos deficitários.'
        : 'Manter acompanhamento mensal da rentabilidade por lote.',
    status: lowProducts.some((p) => p.resultadoOperacional < 0)
      ? 'unfavorable'
      : lowProducts.length > 0
      ? 'attention'
      : 'favorable',
  });

  // 6. Open receivables
  diagnostics.push({
    id: 'diag-receivables',
    indicadorAnalisado: 'Valores em Aberto e Recebimento',
    valorObservado: `${abertoCard.formattedValue} (${formatPercent(curKpis.percentualEmAbertoPct)})`,
    comparacaoReferencia:
      abertoCard.deltaPct !== null
        ? `${abertoCard.deltaPct >= 0 ? '+' : ''}${formatPercent(abertoCard.deltaPct)} vs período anterior`
        : `Recebimento: ${formatPercent(curKpis.percentualRecebimentoPct)}`,
    interpretacao:
      (curKpis.percentualEmAbertoPct ?? 0) > 15 || (abertoCard.deltaPct ?? 0) > 5
        ? 'Parcela relevante do faturamento permanece em aberto, exigindo atenção ao fluxo de caixa e cobrança.'
        : 'Índice de recebimento sob controle frente ao faturamento emitido.',
    recomendacaoAcao: 'Priorizar cobrança nos canais/formas de pagamento com maior saldo em aberto e revisar política de prazo.',
    status: abertoCard.status,
  });

  // 7. Customer satisfaction
  diagnostics.push({
    id: 'diag-sat',
    indicadorAnalisado: 'Satisfação Média dos Clientes',
    valorObservado: satCard.formattedValue,
    comparacaoReferencia:
      satCard.deltaAbs !== null
        ? `${satCard.formattedDeltaAbs} pts vs ${window.previousLabel} (${validSat.length} avaliações)`
        : `${validSat.length} avaliações válidas (${missingSat} sem resposta)`,
    interpretacao:
      curKpis.satisfacaoMedia === null
        ? 'Não há avaliações válidas (0–10) suficientes no recorte selecionado.'
        : curKpis.satisfacaoMedia >= 8.5
        ? 'Excelente percepção de qualidade nos registros avaliados.'
        : curKpis.satisfacaoMedia >= 7
        ? 'Satisfação adequada, com espaço para melhorias em canais ou estilos específicos.'
        : 'Nota média abaixo de 7,0 indica risco de perda de recompra.',
    recomendacaoAcao: 'Cruzar avaliações abaixo de 7,0 com lote, produto e canal de venda para atuar na causa raiz.',
    status: satCard.status,
  });

  return {
    currentPeriodLabel: window.currentLabel,
    previousPeriodLabel: window.previousLabel,
    comparisonCaveat: window.caveat,
    cards,
    monthlyCurrent,
    comparisonSeries,
    byCategory,
    byUnit,
    byProduct,
    byPayment,
    channelMix,
    productionDemand,
    stockSummary: {
      ...curStock,
      byCategory: stockByCategory,
      byProduct: stockByProduct,
    },
    satisfactionSummary: {
      mediaGeral: curKpis.satisfacaoMedia,
      avaliacoesValidas: validSat.length,
      avaliacoesAusentes: missingSat,
      avaliacoesForaFaixa: outOfRangeSat,
      buckets,
      byCategory,
      byUnit,
    },
    metaTargetsSummary,
    diagnostics,
  };
}
