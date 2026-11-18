import type {
  VendaRecord,
  MetaRecord,
  GlobalFilters,
  ExecutiveKpis,
  MonthlySeriesPoint,
  SegmentMetric,
  MetaComparisonRow,
  LoadedDataset,
} from '../types/bi';
import { safeDivide, formatPeriodoLabel, formatCurrencyBRL, formatLiters, formatPercent } from '../utils/formatters';

export const INITIAL_FILTERS: GlobalFilters = {
  periodo: 'ALL',
  periodoInicio: 'ALL',
  periodoFim: 'ALL',
  ano: 'ALL',
  mes: 'ALL',
  unidade_negocio: 'ALL',
  categoria: 'ALL',
  produto: 'ALL',
  forma_pagamento: 'ALL',
  status_pagamento: 'ALL',
};

export interface FilterOptions {
  periodos: string[];
  anos: number[];
  meses: number[];
  unidades: string[];
  categorias: string[];
  produtos: string[];
  formasPagamento: string[];
  statusPagamento: string[];
}

export function extractFilterOptions(vendas: VendaRecord[]): FilterOptions {
  const periodos = new Set<string>();
  const anos = new Set<number>();
  const meses = new Set<number>();
  const unidades = new Set<string>();
  const categorias = new Set<string>();
  const produtos = new Set<string>();
  const formasPagamento = new Set<string>();
  const statusPagamento = new Set<string>();

  for (const v of vendas) {
    if (v.periodo) periodos.add(v.periodo);
    if (v.ano !== null) anos.add(v.ano);
    if (v.mes !== null) meses.add(v.mes);
    if (v.unidade_negocio) unidades.add(v.unidade_negocio);
    if (v.categoria) categorias.add(v.categoria);
    if (v.produto) produtos.add(v.produto);
    if (v.forma_pagamento) formasPagamento.add(v.forma_pagamento);
    if (v.status_pagamento) statusPagamento.add(v.status_pagamento);
  }

  return {
    periodos: Array.from(periodos).sort(),
    anos: Array.from(anos).sort((a, b) => a - b),
    meses: Array.from(meses).sort((a, b) => a - b),
    unidades: Array.from(unidades).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    categorias: Array.from(categorias).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    produtos: Array.from(produtos).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    formasPagamento: Array.from(formasPagamento).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    statusPagamento: Array.from(statusPagamento).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}

export function filterVendas(vendas: VendaRecord[], filters: GlobalFilters): VendaRecord[] {
  return vendas.filter((v) => {
    if (filters.periodo !== 'ALL' && v.periodo !== filters.periodo) return false;
    if (filters.periodoInicio !== 'ALL' && (!v.periodo || v.periodo < filters.periodoInicio)) return false;
    if (filters.periodoFim !== 'ALL' && (!v.periodo || v.periodo > filters.periodoFim)) return false;
    if (filters.ano !== 'ALL' && String(v.ano) !== filters.ano) return false;
    if (filters.mes !== 'ALL' && String(v.mes) !== filters.mes) return false;
    if (filters.unidade_negocio !== 'ALL' && v.unidade_negocio !== filters.unidade_negocio) return false;
    if (filters.categoria !== 'ALL' && v.categoria !== filters.categoria) return false;
    if (filters.produto !== 'ALL' && v.produto !== filters.produto) return false;
    if (filters.forma_pagamento !== 'ALL' && v.forma_pagamento !== filters.forma_pagamento) return false;
    if (filters.status_pagamento !== 'ALL' && v.status_pagamento !== filters.status_pagamento) return false;
    return true;
  });
}

export function filterMetas(metas: MetaRecord[], filters: GlobalFilters): MetaRecord[] {
  return metas.filter((m) => {
    if (filters.periodo !== 'ALL' && m.periodo !== filters.periodo) return false;
    if (filters.periodoInicio !== 'ALL' && (!m.periodo || m.periodo < filters.periodoInicio)) return false;
    if (filters.periodoFim !== 'ALL' && (!m.periodo || m.periodo > filters.periodoFim)) return false;
    if (filters.ano !== 'ALL' && !m.periodo.startsWith(`${filters.ano}-`)) return false;
    if (filters.mes !== 'ALL') {
      const mStr = m.periodo.split('-')[1];
      if (Number(mStr) !== Number(filters.mes)) return false;
    }
    if (filters.unidade_negocio !== 'ALL' && m.unidade_negocio !== filters.unidade_negocio) return false;
    return true;
  });
}

function sumNullable(values: Array<number | null>): number {
  let acc = 0;
  for (const v of values) {
    if (v !== null && Number.isFinite(v)) acc += v;
  }
  return acc;
}

export function computeKpis(vendas: VendaRecord[], metas: MetaRecord[], filters: GlobalFilters): ExecutiveKpis {
  const faturamentoBruto = sumNullable(vendas.map((v) => v.faturamento_bruto));
  const resultadoOperacional = sumNullable(vendas.map((v) => v.resultado_operacional_estimado));
  const volumeLitros = sumNullable(vendas.map((v) => v.volume_litros));
  const quantidadeUnidades = sumNullable(vendas.map((v) => v.quantidade_unidades));
  const custoDiretoTotal = sumNullable(vendas.map((v) => v.custo_direto));
  const despesasOperacionaisTotal = sumNullable(vendas.map((v) => v.despesa_operacional));
  const valoresRecebidos = sumNullable(vendas.map((v) => v.valor_recebido));
  const valoresEmAberto = sumNullable(vendas.map((v) => v.valor_em_aberto));

  const satValues = vendas
    .map((v) => v.satisfacao_cliente_0a10)
    .filter((s): s is number => s !== null && Number.isFinite(s) && s >= 0 && s <= 10);
  const satisfacaoMedia = satValues.length > 0 ? satValues.reduce((a, b) => a + b, 0) / satValues.length : null;

  const hasProductLevelFilter =
    filters.categoria !== 'ALL' ||
    filters.produto !== 'ALL' ||
    filters.forma_pagamento !== 'ALL' ||
    filters.status_pagamento !== 'ALL';

  const filteredMetas = filterMetas(metas, filters);
  // Goals are defined per period + business unit. If filtering by product/category/payment method/status, goals are not directly comparable at record level.
  const metaFaturamentoTotal =
    !hasProductLevelFilter && filteredMetas.length > 0
      ? sumNullable(filteredMetas.map((m) => m.meta_faturamento))
      : null;
  const metaVolumeTotal =
    !hasProductLevelFilter && filteredMetas.length > 0
      ? sumNullable(filteredMetas.map((m) => m.meta_volume_litros))
      : null;

  const margemOperacionalRaw = safeDivide(resultadoOperacional, faturamentoBruto);
  const margemContribuicaoRaw = safeDivide(faturamentoBruto - custoDiretoTotal, faturamentoBruto);
  const percentualRecebimentoRaw = safeDivide(valoresRecebidos, faturamentoBruto);
  const percentualEmAbertoRaw = safeDivide(valoresEmAberto, faturamentoBruto);
  const atingimentoFatRaw = safeDivide(faturamentoBruto, metaFaturamentoTotal);
  const atingimentoVolRaw = safeDivide(volumeLitros, metaVolumeTotal);

  return {
    registrosCount: vendas.length,
    faturamentoBruto,
    resultadoOperacional,
    margemOperacionalPct: margemOperacionalRaw !== null ? margemOperacionalRaw * 100 : null,
    margemContribuicaoPct: margemContribuicaoRaw !== null ? margemContribuicaoRaw * 100 : null,
    volumeLitros,
    quantidadeUnidades,
    ticketMedioPorRegistro: safeDivide(faturamentoBruto, vendas.length),
    custoDiretoTotal,
    despesasOperacionaisTotal,
    custoPorLitro: safeDivide(custoDiretoTotal, volumeLitros),
    valoresRecebidos,
    valoresEmAberto,
    percentualRecebimentoPct: percentualRecebimentoRaw !== null ? percentualRecebimentoRaw * 100 : null,
    percentualEmAbertoPct: percentualEmAbertoRaw !== null ? percentualEmAbertoRaw * 100 : null,
    satisfacaoMedia,
    satisfacaoCount: satValues.length,
    metaFaturamentoTotal,
    metaVolumeTotal,
    atingimentoMetaFaturamentoPct: atingimentoFatRaw !== null ? atingimentoFatRaw * 100 : null,
    atingimentoMetaVolumePct: atingimentoVolRaw !== null ? atingimentoVolRaw * 100 : null,
  };
}

function enumerateMonths(minPeriodo: string, maxPeriodo: string): string[] {
  const m1 = minPeriodo.match(/^(\d{4})-(\d{2})$/);
  const m2 = maxPeriodo.match(/^(\d{4})-(\d{2})$/);
  if (!m1 || !m2) return [minPeriodo];
  let y = Number(m1[1]);
  let m = Number(m1[2]);
  const endY = Number(m2[1]);
  const endM = Number(m2[2]);
  const out: string[] = [];
  let guard = 0;
  while ((y < endY || (y === endY && m <= endM)) && guard < 120) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    guard++;
  }
  return out;
}

export function buildMonthlySeries(
  vendas: VendaRecord[],
  metas: MetaRecord[],
  filters: GlobalFilters,
): MonthlySeriesPoint[] {
  const grouped = new Map<string, VendaRecord[]>();
  for (const v of vendas) {
    if (!v.periodo) continue;
    const arr = grouped.get(v.periodo) || [];
    arr.push(v);
    grouped.set(v.periodo, arr);
  }

  const filteredMetas = filterMetas(metas, filters);
  const hasProductLevelFilter =
    filters.categoria !== 'ALL' ||
    filters.produto !== 'ALL' ||
    filters.forma_pagamento !== 'ALL' ||
    filters.status_pagamento !== 'ALL';

  const metasByPeriodo = new Map<string, { fat: number; vol: number; count: number }>();
  if (!hasProductLevelFilter) {
    for (const m of filteredMetas) {
      const cur = metasByPeriodo.get(m.periodo) || { fat: 0, vol: 0, count: 0 };
      if (m.meta_faturamento !== null) cur.fat += m.meta_faturamento;
      if (m.meta_volume_litros !== null) cur.vol += m.meta_volume_litros;
      cur.count++;
      metasByPeriodo.set(m.periodo, cur);
    }
  }

  const allKeys = Array.from(new Set([...grouped.keys(), ...metasByPeriodo.keys()]))
    .filter((k) => /^\d{4}-\d{2}$/.test(k))
    .sort();

  if (allKeys.length === 0) return [];

  // Only fill intermediate missing months when not explicitly filtered to a single month/period
  const timeline =
    filters.periodo === 'ALL' && filters.mes === 'ALL'
      ? enumerateMonths(allKeys[0], allKeys[allKeys.length - 1])
      : allKeys;

  const series: MonthlySeriesPoint[] = [];
  let prevFatWithData: number | null = null;

  for (const periodo of timeline) {
    const rows = grouped.get(periodo) || [];
    const semRegistros = rows.length === 0;
    const faturamentoBruto = sumNullable(rows.map((r) => r.faturamento_bruto));
    const resultadoOperacional = sumNullable(rows.map((r) => r.resultado_operacional_estimado));
    const custoDireto = sumNullable(rows.map((r) => r.custo_direto));
    const despesaOperacional = sumNullable(rows.map((r) => r.despesa_operacional));
    const volumeLitros = sumNullable(rows.map((r) => r.volume_litros));
    const quantidadeUnidades = sumNullable(rows.map((r) => r.quantidade_unidades));
    const valorRecebido = sumNullable(rows.map((r) => r.valor_recebido));
    const valorEmAberto = sumNullable(rows.map((r) => r.valor_em_aberto));

    const satValues = rows
      .map((r) => r.satisfacao_cliente_0a10)
      .filter((s): s is number => s !== null && Number.isFinite(s) && s >= 0 && s <= 10);
    const satisfacaoMedia =
      satValues.length > 0 ? satValues.reduce((a, b) => a + b, 0) / satValues.length : null;

    const estAntes = rows
      .map((r) => r.estoque_unidades_antes)
      .filter((e): e is number => e !== null && Number.isFinite(e));
    const estDepois = rows
      .map((r) => r.estoque_unidades_depois)
      .filter((e): e is number => e !== null && Number.isFinite(e));

    const margemRaw = safeDivide(resultadoOperacional, faturamentoBruto);
    const contribRaw = safeDivide(faturamentoBruto - custoDireto, faturamentoBruto);
    const metaInfo = metasByPeriodo.get(periodo);

    let crescimentoFaturamentoMoMPct: number | null = null;
    if (!semRegistros && prevFatWithData !== null && prevFatWithData !== 0) {
      crescimentoFaturamentoMoMPct = ((faturamentoBruto - prevFatWithData) / prevFatWithData) * 100;
    }
    if (!semRegistros) {
      prevFatWithData = faturamentoBruto;
    }

    series.push({
      periodo,
      label: formatPeriodoLabel(periodo),
      registros: rows.length,
      semRegistros,
      faturamentoBruto,
      resultadoOperacional,
      custoDireto,
      despesaOperacional,
      volumeLitros,
      quantidadeUnidades,
      valorRecebido,
      valorEmAberto,
      custoPorLitro: safeDivide(custoDireto, volumeLitros),
      precoMedioPorLitro: safeDivide(faturamentoBruto, volumeLitros),
      margemOperacionalPct: margemRaw !== null ? margemRaw * 100 : null,
      margemContribuicaoPct: contribRaw !== null ? contribRaw * 100 : null,
      satisfacaoMedia,
      satisfacaoCount: satValues.length,
      estoqueMedioAntes: estAntes.length > 0 ? estAntes.reduce((a, b) => a + b, 0) / estAntes.length : null,
      estoqueMedioDepois: estDepois.length > 0 ? estDepois.reduce((a, b) => a + b, 0) / estDepois.length : null,
      metaFaturamento: metaInfo && metaInfo.count > 0 ? metaInfo.fat : null,
      metaVolumeLitros: metaInfo && metaInfo.count > 0 ? metaInfo.vol : null,
      crescimentoFaturamentoMoMPct,
    });
  }

  return series;
}

export function buildSegmentMetrics(
  vendas: VendaRecord[],
  keyFn: (v: VendaRecord) => string,
): SegmentMetric[] {
  const totalFaturamento = sumNullable(vendas.map((v) => v.faturamento_bruto));
  const groups = new Map<string, VendaRecord[]>();

  for (const v of vendas) {
    const key = keyFn(v) || 'Não informado';
    const arr = groups.get(key) || [];
    arr.push(v);
    groups.set(key, arr);
  }

  const results: SegmentMetric[] = [];
  for (const [nome, rows] of groups.entries()) {
    const faturamentoBruto = sumNullable(rows.map((r) => r.faturamento_bruto));
    const custoDireto = sumNullable(rows.map((r) => r.custo_direto));
    const despesaOperacional = sumNullable(rows.map((r) => r.despesa_operacional));
    const resultadoOperacional = sumNullable(rows.map((r) => r.resultado_operacional_estimado));
    const volumeLitros = sumNullable(rows.map((r) => r.volume_litros));
    const quantidadeUnidades = sumNullable(rows.map((r) => r.quantidade_unidades));
    const valorRecebido = sumNullable(rows.map((r) => r.valor_recebido));
    const valorEmAberto = sumNullable(rows.map((r) => r.valor_em_aberto));

    const satValues = rows
      .map((r) => r.satisfacao_cliente_0a10)
      .filter((s): s is number => s !== null && Number.isFinite(s) && s >= 0 && s <= 10);

    const margemOpRaw = safeDivide(resultadoOperacional, faturamentoBruto);
    const margemContRaw = safeDivide(faturamentoBruto - custoDireto, faturamentoBruto);
    const shareRaw = safeDivide(faturamentoBruto, totalFaturamento);
    const recRaw = safeDivide(valorRecebido, faturamentoBruto);

    results.push({
      nome,
      registros: rows.length,
      faturamentoBruto,
      custoDireto,
      despesaOperacional,
      resultadoOperacional,
      margemOperacionalPct: margemOpRaw !== null ? margemOpRaw * 100 : null,
      margemContribuicaoPct: margemContRaw !== null ? margemContRaw * 100 : null,
      volumeLitros,
      quantidadeUnidades,
      ticketMedio: safeDivide(faturamentoBruto, rows.length),
      participacaoFaturamentoPct: shareRaw !== null ? shareRaw * 100 : null,
      valorRecebido,
      valorEmAberto,
      percentualRecebimentoPct: recRaw !== null ? recRaw * 100 : null,
      satisfacaoMedia: satValues.length > 0 ? satValues.reduce((a, b) => a + b, 0) / satValues.length : null,
    });
  }

  return results.sort((a, b) => b.faturamentoBruto - a.faturamentoBruto);
}

export function buildMetaComparison(
  vendas: VendaRecord[],
  metas: MetaRecord[],
  filters: GlobalFilters,
): MetaComparisonRow[] {
  const filteredMetas = filterMetas(metas, filters);
  const vendasByKey = new Map<string, VendaRecord[]>();

  for (const v of vendas) {
    if (!v.periodo || !v.unidade_negocio) continue;
    const key = `${v.periodo}::${v.unidade_negocio}`;
    const arr = vendasByKey.get(key) || [];
    arr.push(v);
    vendasByKey.set(key, arr);
  }

  const metasByKey = new Map<string, MetaRecord>();
  for (const m of filteredMetas) {
    const key = `${m.periodo}::${m.unidade_negocio}`;
    metasByKey.set(key, m);
  }

  const allKeys = Array.from(new Set([...vendasByKey.keys(), ...metasByKey.keys()])).sort();
  const rows: MetaComparisonRow[] = [];

  for (const key of allKeys) {
    const [periodo, unidade_negocio] = key.split('::');
    const vRows = vendasByKey.get(key) || [];
    const meta = metasByKey.get(key);

    const faturamentoRealizado = sumNullable(vRows.map((r) => r.faturamento_bruto));
    const volumeRealizado = sumNullable(vRows.map((r) => r.volume_litros));
    const resultadoRealizado = sumNullable(vRows.map((r) => r.resultado_operacional_estimado));

    const margemRaw = safeDivide(resultadoRealizado, faturamentoRealizado);
    const margemRealizadaPct = margemRaw !== null ? margemRaw * 100 : null;

    const metaFat = meta?.meta_faturamento ?? null;
    const metaVol = meta?.meta_volume_litros ?? null;

    const atingFatRaw = safeDivide(faturamentoRealizado, metaFat);
    const atingimentoFaturamentoPct = atingFatRaw !== null ? atingFatRaw * 100 : null;
    const atingVolRaw = safeDivide(volumeRealizado, metaVol);
    const atingimentoVolumePct = atingVolRaw !== null ? atingVolRaw * 100 : null;

    let status: MetaComparisonRow['status'] = 'Sem meta';
    if (atingimentoFaturamentoPct !== null) {
      if (atingimentoFaturamentoPct >= 100) status = 'Satisfatório';
      else if (atingimentoFaturamentoPct >= 85) status = 'Atenção';
      else status = 'Abaixo do esperado';
    }

    rows.push({
      periodo,
      unidade_negocio,
      faturamentoRealizado,
      metaFaturamento: metaFat,
      atingimentoFaturamentoPct,
      diferencaFaturamento: metaFat !== null ? faturamentoRealizado - metaFat : null,
      volumeRealizado,
      metaVolumeLitros: metaVol,
      atingimentoVolumePct,
      diferencaVolume: metaVol !== null ? volumeRealizado - metaVol : null,
      margemRealizadaPct,
      metaMargemPct: meta?.meta_margem_operacional_pct ?? null,
      status,
    });
  }

  return rows;
}

export function buildAiContextSummary(
  dataset: LoadedDataset,
  filteredVendas: VendaRecord[],
  filters: GlobalFilters,
): string {
  const kpis = computeKpis(filteredVendas, dataset.metas, filters);
  const monthly = buildMonthlySeries(filteredVendas, dataset.metas, filters);
  const byUnit = buildSegmentMetrics(filteredVendas, (v) => v.unidade_negocio);
  const byCategory = buildSegmentMetrics(filteredVendas, (v) => v.categoria);
  const byProduct = buildSegmentMetrics(filteredVendas, (v) => v.produto);
  const byPayment = buildSegmentMetrics(filteredVendas, (v) => v.forma_pagamento);
  const metaComp = buildMetaComparison(filteredVendas, dataset.metas, filters);

  const activeFiltersList = Object.entries(filters)
    .filter(([, val]) => val !== 'ALL')
    .map(([k, val]) => `${k}=${val}`);

  const negativeProducts = byProduct.filter((p) => (p.margemOperacionalPct ?? 0) < 0);
  const lowMarginProducts = byProduct.filter((p) => (p.margemOperacionalPct ?? 999) >= 0 && (p.margemOperacionalPct ?? 999) < 10);
  const emptyMonths = monthly.filter((m) => m.semRegistros).map((m) => m.periodo);

  const lines: string[] = [
    `Arquivo: ${dataset.metadata.fileName} | Total na base: ${dataset.metadata.vendasCount} registros | Filtrados no recorte atual: ${filteredVendas.length} registros`,
    `Período completo da base: ${dataset.metadata.minPeriodo ?? 'N/A'} a ${dataset.metadata.maxPeriodo ?? 'N/A'}`,
    `Filtros ativos: ${activeFiltersList.length > 0 ? activeFiltersList.join(', ') : 'Nenhum (base completa)'}`,
    `Status de validação: ${dataset.metadata.validationStatus}`,
    '',
    'INDICADORES CONSOLIDADOS DO RECORTE:',
    `- Faturamento Bruto: ${formatCurrencyBRL(kpis.faturamentoBruto)}`,
    `- Custo Direto Total: ${formatCurrencyBRL(kpis.custoDiretoTotal)} (Custo/Litro: ${formatCurrencyBRL(kpis.custoPorLitro)})`,
    `- Despesas Operacionais: ${formatCurrencyBRL(kpis.despesasOperacionaisTotal)}`,
    `- Resultado Operacional Estimado: ${formatCurrencyBRL(kpis.resultadoOperacional)}`,
    `- Margem de Contribuição Estimada: ${formatPercent(kpis.margemContribuicaoPct)}`,
    `- Margem Operacional: ${formatPercent(kpis.margemOperacionalPct)}`,
    `- Volume Comercializado: ${formatLiters(kpis.volumeLitros)} | Unidades Vendidas: ${kpis.quantidadeUnidades.toLocaleString('pt-BR')}`,
    `- Ticket Médio por Registro: ${formatCurrencyBRL(kpis.ticketMedioPorRegistro)}`,
    `- Valores Recebidos: ${formatCurrencyBRL(kpis.valoresRecebidos)} (${formatPercent(kpis.percentualRecebimentoPct)})`,
    `- Valores em Aberto: ${formatCurrencyBRL(kpis.valoresEmAberto)} (${formatPercent(kpis.percentualEmAbertoPct)})`,
    `- Satisfação Média (escala 0-10, ${kpis.satisfacaoCount} avaliações válidas): ${kpis.satisfacaoMedia !== null ? kpis.satisfacaoMedia.toFixed(2) : 'N/A'}`,
    `- Meta de Faturamento (recorte): ${formatCurrencyBRL(kpis.metaFaturamentoTotal)} | Atingimento: ${formatPercent(kpis.atingimentoMetaFaturamentoPct)}`,
    `- Meta de Volume (recorte): ${formatLiters(kpis.metaVolumeTotal)} | Atingimento: ${formatPercent(kpis.atingimentoMetaVolumePct)}`,
    '',
    'DESEMPENHO POR UNIDADE DE NEGÓCIO (CANAIS):',
    ...byUnit.map(
      (u) =>
        `- ${u.nome}: Fat=${formatCurrencyBRL(u.faturamentoBruto)} (${formatPercent(u.participacaoFaturamentoPct)}), Res.Op=${formatCurrencyBRL(u.resultadoOperacional)}, Margem Op=${formatPercent(u.margemOperacionalPct)}, Vol=${formatLiters(u.volumeLitros)}, Ticket=${formatCurrencyBRL(u.ticketMedio)}, Recebimento=${formatPercent(u.percentualRecebimentoPct)}, Em Aberto=${formatCurrencyBRL(u.valorEmAberto)}`,
    ),
    '',
    'DESEMPENHO POR CATEGORIA DE CERVEJA:',
    ...byCategory.map(
      (c) =>
        `- ${c.nome}: Fat=${formatCurrencyBRL(c.faturamentoBruto)} (${formatPercent(c.participacaoFaturamentoPct)}), Res.Op=${formatCurrencyBRL(c.resultadoOperacional)}, Margem Contrib=${formatPercent(c.margemContribuicaoPct)}, Margem Op=${formatPercent(c.margemOperacionalPct)}, Vol=${formatLiters(c.volumeLitros)}`,
    ),
    '',
    'TOP 5 PRODUTOS POR FATURAMENTO:',
    ...byProduct.slice(0, 5).map(
      (p) =>
        `- ${p.nome}: Fat=${formatCurrencyBRL(p.faturamentoBruto)}, Res.Op=${formatCurrencyBRL(p.resultadoOperacional)}, Margem Op=${formatPercent(p.margemOperacionalPct)}, Vol=${formatLiters(p.volumeLitros)}`,
    ),
    '',
    `PRODUTOS COM MARGEM OPERACIONAL NEGATIVA (${negativeProducts.length}):`,
    ...(negativeProducts.length > 0
      ? negativeProducts.map(
          (p) =>
            `- ${p.nome}: Fat=${formatCurrencyBRL(p.faturamentoBruto)}, Custo=${formatCurrencyBRL(p.custoDireto)}, Desp=${formatCurrencyBRL(p.despesaOperacional)}, Res.Op=${formatCurrencyBRL(p.resultadoOperacional)}, Margem Op=${formatPercent(p.margemOperacionalPct)}`,
        )
      : ['- Nenhum produto com margem operacional negativa neste recorte.']),
    '',
    `PRODUTOS COM MARGEM OPERACIONAL REDUZIDA ENTRE 0% E 10% (${lowMarginProducts.length}):`,
    ...(lowMarginProducts.length > 0
      ? lowMarginProducts.slice(0, 8).map(
          (p) => `- ${p.nome}: Margem Op=${formatPercent(p.margemOperacionalPct)}, Fat=${formatCurrencyBRL(p.faturamentoBruto)}`,
        )
      : ['- Nenhum produto nessa faixa neste recorte.']),
    '',
    'FORMAS DE PAGAMENTO:',
    ...byPayment.map(
      (p) =>
        `- ${p.nome}: Fat=${formatCurrencyBRL(p.faturamentoBruto)} (${formatPercent(p.participacaoFaturamentoPct)}), Recebido=${formatPercent(p.percentualRecebimentoPct)}, Em Aberto=${formatCurrencyBRL(p.valorEmAberto)}`,
    ),
    '',
    'EVOLUÇÃO MENSAL (ÚLTIMOS 12 MESES COM DADOS):',
    ...monthly
      .filter((m) => !m.semRegistros)
      .slice(-12)
      .map(
        (m) =>
          `- ${m.periodo}: Fat=${formatCurrencyBRL(m.faturamentoBruto)}, Meta=${formatCurrencyBRL(m.metaFaturamento)}, Res.Op=${formatCurrencyBRL(m.resultadoOperacional)}, Margem=${formatPercent(m.margemOperacionalPct)}, Vol=${formatLiters(m.volumeLitros)}, MoM=${formatPercent(m.crescimentoFaturamentoMoMPct)}`,
      ),
    emptyMonths.length > 0 ? `Meses sem registros no intervalo: ${emptyMonths.join(', ')}` : 'Sem lacunas mensais no intervalo.',
    '',
    'RESUMO DE METAS POR UNIDADE (CONSOLIDADO NO RECORTE):',
    ...Array.from(
      metaComp.reduce((acc, row) => {
        const cur = acc.get(row.unidade_negocio) || { fat: 0, meta: 0, vol: 0, metaVol: 0, hasMeta: false };
        cur.fat += row.faturamentoRealizado;
        cur.vol += row.volumeRealizado;
        if (row.metaFaturamento !== null) {
          cur.meta += row.metaFaturamento;
          cur.hasMeta = true;
        }
        if (row.metaVolumeLitros !== null) {
          cur.metaVol += row.metaVolumeLitros;
        }
        acc.set(row.unidade_negocio, cur);
        return acc;
      }, new Map<string, { fat: number; meta: number; vol: number; metaVol: number; hasMeta: boolean }>()),
    ).map(([unit, d]) => {
      const pct = d.hasMeta && d.meta > 0 ? ((d.fat / d.meta) * 100).toFixed(1) + '%' : 'N/A';
      return `- ${unit}: Realizado=${formatCurrencyBRL(d.fat)} vs Meta=${d.hasMeta ? formatCurrencyBRL(d.meta) : 'N/A'} (${pct})`;
    }),
    '',
    'PRINCIPAIS ACHADOS DE QUALIDADE DOS DADOS:',
    ...dataset.validationIssues
      .filter((i) => i.ocorrencias > 0)
      .map((i) => `- [${i.severidade.toUpperCase()}] ${i.categoria}: ${i.ocorrencias} ocorrência(s) — ${i.descricao}`),
  ];

  return lines.join('\n');
}
