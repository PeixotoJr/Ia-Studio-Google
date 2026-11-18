import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  LoadedDataset,
  VendaRecord,
  GlobalFilters,
  AiExecutiveReport,
} from '../types/bi';
import {
  computeKpis,
  buildMonthlySeries,
  buildSegmentMetrics,
  buildMetaComparison,
} from './biCalculations';
import { exportObjectsToCsv } from './excelLoader';
import {
  formatCurrencyBRL,
  formatLiters,
  formatPercent,
  formatNumber,
  formatDateTimeBR,
} from '../utils/formatters';

export type ReportTypeId =
  | 'executivo_mensal'
  | 'desempenho_comercial'
  | 'rentabilidade_produto'
  | 'unidade_negocio'
  | 'analise_custos'
  | 'acompanhamento_metas'
  | 'relatorio_financeiro'
  | 'recomendacoes_ia';

export interface ReportDefinition {
  id: ReportTypeId;
  title: string;
  subtitle: string;
  description: string;
  supportsCsv: boolean;
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 'executivo_mensal',
    title: 'Relatório Executivo Mensal',
    subtitle: 'Visão consolidada de faturamento, margens, volume e metas',
    description: 'Síntese mensal com os 10 KPIs centrais, evolução temporal e conclusões gerenciais.',
    supportsCsv: true,
  },
  {
    id: 'desempenho_comercial',
    title: 'Desempenho Comercial',
    subtitle: 'Canais, categorias, ticket médio e giro de vendas',
    description: 'Detalhamento da performance por unidade de negócio, categoria de cerveja e crescimento.',
    supportsCsv: true,
  },
  {
    id: 'rentabilidade_produto',
    title: 'Rentabilidade por Produto',
    subtitle: 'Margem de contribuição, margem operacional e alertas negativos',
    description: 'Ranking completo de rótulos identificando produtos lucrativos e itens com margem reduzida ou negativa.',
    supportsCsv: true,
  },
  {
    id: 'unidade_negocio',
    title: 'Desempenho por Unidade de Negócio',
    subtitle: 'Comparativo de canais comerciais e eficiência operacional',
    description: 'Participação no faturamento, resultado operacional, ticket médio e adimplência por canal.',
    supportsCsv: true,
  },
  {
    id: 'analise_custos',
    title: 'Análise de Custos e Despesas',
    subtitle: 'Custo direto, custo por litro e estrutura de despesas operacionais',
    description: 'Avaliação da composição de custos produtivos e despesas operacionais ao longo dos períodos.',
    supportsCsv: true,
  },
  {
    id: 'acompanhamento_metas',
    title: 'Acompanhamento de Metas',
    subtitle: 'Realizado versus planejado por período e unidade',
    description: 'Atingimento percentual e desvios absolutos de faturamento e volume em litros.',
    supportsCsv: true,
  },
  {
    id: 'relatorio_financeiro',
    title: 'Relatório Financeiro e Recebíveis',
    subtitle: 'Recebimentos, valores em aberto e formas de pagamento',
    description: 'Fluxo de recebimento vs faturamento bruto, inadimplência/aberto e mix de pagamentos.',
    supportsCsv: true,
  },
  {
    id: 'recomendacoes_ia',
    title: 'Relatório de Recomendações da IA',
    subtitle: 'Diagnóstico consultivo fundamentado nos dados reais',
    description: 'Compilado das recomendações estratégicas, evidências quantitativas e prioridades geradas pela IA.',
    supportsCsv: true,
  },
];

function describeActiveFilters(filters: GlobalFilters): string {
  const parts: string[] = [];
  if (filters.periodo !== 'ALL') parts.push(`Período: ${filters.periodo}`);
  if (filters.ano !== 'ALL') parts.push(`Ano: ${filters.ano}`);
  if (filters.mes !== 'ALL') parts.push(`Mês: ${filters.mes}`);
  if (filters.unidade_negocio !== 'ALL') parts.push(`Unidade: ${filters.unidade_negocio}`);
  if (filters.categoria !== 'ALL') parts.push(`Categoria: ${filters.categoria}`);
  if (filters.produto !== 'ALL') parts.push(`Produto: ${filters.produto}`);
  if (filters.forma_pagamento !== 'ALL') parts.push(`Pagamento: ${filters.forma_pagamento}`);
  return parts.length > 0 ? parts.join(' | ') : 'Sem filtros (Base completa carregada)';
}

export function exportReportCsv(
  reportId: ReportTypeId,
  dataset: LoadedDataset,
  filteredVendas: VendaRecord[],
  filters: GlobalFilters,
  aiReport: AiExecutiveReport | null,
): void {
  const monthly = buildMonthlySeries(filteredVendas, dataset.metas, filters);
  const byUnit = buildSegmentMetrics(filteredVendas, (v) => v.unidade_negocio);
  const byProduct = buildSegmentMetrics(filteredVendas, (v) => v.produto);
  const byCategory = buildSegmentMetrics(filteredVendas, (v) => v.categoria);
  const byPayment = buildSegmentMetrics(filteredVendas, (v) => v.forma_pagamento);
  const metas = buildMetaComparison(filteredVendas, dataset.metas, filters);

  switch (reportId) {
    case 'executivo_mensal':
      exportObjectsToCsv(
        monthly.map((m) => ({
          periodo: m.periodo,
          registros: m.registros,
          faturamento_bruto: m.faturamentoBruto.toFixed(2),
          meta_faturamento: m.metaFaturamento !== null ? m.metaFaturamento.toFixed(2) : 'N/A',
          resultado_operacional: m.resultadoOperacional.toFixed(2),
          margem_operacional_pct: m.margemOperacionalPct !== null ? m.margemOperacionalPct.toFixed(2) : 'N/A',
          volume_litros: m.volumeLitros.toFixed(2),
          crescimento_mom_pct: m.crescimentoFaturamentoMoMPct !== null ? m.crescimentoFaturamentoMoMPct.toFixed(2) : 'N/A',
        })),
        'GalpaoBier_Relatorio_Executivo_Mensal.csv',
      );
      break;
    case 'desempenho_comercial':
      exportObjectsToCsv(
        byCategory.map((c) => ({
          categoria: c.nome,
          registros: c.registros,
          faturamento_bruto: c.faturamentoBruto.toFixed(2),
          participacao_pct: c.participacaoFaturamentoPct?.toFixed(2) ?? 'N/A',
          volume_litros: c.volumeLitros.toFixed(2),
          unidades: c.quantidadeUnidades,
          ticket_medio: c.ticketMedio?.toFixed(2) ?? 'N/A',
        })),
        'GalpaoBier_Desempenho_Comercial.csv',
      );
      break;
    case 'rentabilidade_produto':
      exportObjectsToCsv(
        byProduct.map((p) => ({
          produto: p.nome,
          registros: p.registros,
          faturamento_bruto: p.faturamentoBruto.toFixed(2),
          custo_direto: p.custoDireto.toFixed(2),
          despesa_operacional: p.despesaOperacional.toFixed(2),
          resultado_operacional: p.resultadoOperacional.toFixed(2),
          margem_contribuicao_pct: p.margemContribuicaoPct?.toFixed(2) ?? 'N/A',
          margem_operacional_pct: p.margemOperacionalPct?.toFixed(2) ?? 'N/A',
          volume_litros: p.volumeLitros.toFixed(2),
        })),
        'GalpaoBier_Rentabilidade_Produtos.csv',
      );
      break;
    case 'unidade_negocio':
      exportObjectsToCsv(
        byUnit.map((u) => ({
          unidade_negocio: u.nome,
          registros: u.registros,
          faturamento_bruto: u.faturamentoBruto.toFixed(2),
          participacao_pct: u.participacaoFaturamentoPct?.toFixed(2) ?? 'N/A',
          resultado_operacional: u.resultadoOperacional.toFixed(2),
          margem_operacional_pct: u.margemOperacionalPct?.toFixed(2) ?? 'N/A',
          ticket_medio: u.ticketMedio?.toFixed(2) ?? 'N/A',
          volume_litros: u.volumeLitros.toFixed(2),
          percentual_recebimento_pct: u.percentualRecebimentoPct?.toFixed(2) ?? 'N/A',
        })),
        'GalpaoBier_Unidades_Negocio.csv',
      );
      break;
    case 'analise_custos':
      exportObjectsToCsv(
        monthly.map((m) => ({
          periodo: m.periodo,
          faturamento_bruto: m.faturamentoBruto.toFixed(2),
          custo_direto: m.custoDireto.toFixed(2),
          despesa_operacional: m.despesaOperacional.toFixed(2),
          volume_litros: m.volumeLitros.toFixed(2),
          custo_por_litro: m.volumeLitros > 0 ? (m.custoDireto / m.volumeLitros).toFixed(2) : 'N/A',
          resultado_operacional: m.resultadoOperacional.toFixed(2),
        })),
        'GalpaoBier_Analise_Custos.csv',
      );
      break;
    case 'acompanhamento_metas':
      exportObjectsToCsv(
        metas.map((r) => ({
          periodo: r.periodo,
          unidade_negocio: r.unidade_negocio,
          faturamento_realizado: r.faturamentoRealizado.toFixed(2),
          meta_faturamento: r.metaFaturamento?.toFixed(2) ?? 'N/A',
          atingimento_fat_pct: r.atingimentoFaturamentoPct?.toFixed(2) ?? 'N/A',
          diferenca_fat: r.diferencaFaturamento?.toFixed(2) ?? 'N/A',
          volume_realizado: r.volumeRealizado.toFixed(2),
          meta_volume: r.metaVolumeLitros?.toFixed(2) ?? 'N/A',
          atingimento_vol_pct: r.atingimentoVolumePct?.toFixed(2) ?? 'N/A',
          status: r.status,
        })),
        'GalpaoBier_Acompanhamento_Metas.csv',
      );
      break;
    case 'relatorio_financeiro':
      exportObjectsToCsv(
        byPayment.map((p) => ({
          forma_pagamento: p.nome,
          registros: p.registros,
          faturamento_bruto: p.faturamentoBruto.toFixed(2),
          valor_recebido: p.valorRecebido.toFixed(2),
          valor_em_aberto: p.valorEmAberto.toFixed(2),
          percentual_recebimento_pct: p.percentualRecebimentoPct?.toFixed(2) ?? 'N/A',
        })),
        'GalpaoBier_Relatorio_Financeiro.csv',
      );
      break;
    case 'recomendacoes_ia':
      if (!aiReport) return;
      exportObjectsToCsv(
        aiReport.recomendacoes.map((r) => ({
          prioridade: r.prioridade,
          categoria: r.categoriaEstrategica,
          titulo: r.titulo,
          diagnostico: r.diagnostico,
          evidencia_quantitativa: r.evidenciaQuantitativa,
          impacto_potencial: r.impactoPotencial,
          acao_recomendada: r.acaoRecomendada,
          indicador_acompanhamento: r.indicadorAcompanhamento,
        })),
        'GalpaoBier_Recomendacoes_IA.csv',
      );
      break;
  }
}

export function exportReportPdf(
  reportId: ReportTypeId,
  dataset: LoadedDataset,
  filteredVendas: VendaRecord[],
  filters: GlobalFilters,
  aiReport: AiExecutiveReport | null,
): void {
  const def = REPORT_DEFINITIONS.find((d) => d.id === reportId)!;
  const kpis = computeKpis(filteredVendas, dataset.metas, filters);
  const monthly = buildMonthlySeries(filteredVendas, dataset.metas, filters);
  const byUnit = buildSegmentMetrics(filteredVendas, (v) => v.unidade_negocio);
  const byCategory = buildSegmentMetrics(filteredVendas, (v) => v.categoria);
  const byProduct = buildSegmentMetrics(filteredVendas, (v) => v.produto);
  const byPayment = buildSegmentMetrics(filteredVendas, (v) => v.forma_pagamento);
  const metas = buildMetaComparison(filteredVendas, dataset.metas, filters);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(20, 17, 14);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('GALPÃO BIER INTELLIGENCE', 14, 12);

  doc.setTextColor(244, 239, 230);
  doc.setFontSize(16);
  doc.text(def.title, 14, 20);

  doc.setTextColor(185, 174, 156);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fonte: ${dataset.metadata.fileName} | Gerado em: ${formatDateTimeBR(new Date().toISOString())}`, 14, 27);

  // Filters & Period box
  doc.setTextColor(35, 30, 26);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Escopo Analisado', 14, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Período da Base: ${dataset.metadata.minPeriodo ?? 'N/A'} a ${dataset.metadata.maxPeriodo ?? 'N/A'} | Registros no recorte: ${filteredVendas.length} de ${dataset.metadata.vendasCount}`, 14, 47);
  doc.text(`Filtros aplicados: ${describeActiveFilters(filters)}`, 14, 52, { maxWidth: pageWidth - 28 });

  // KPI summary table
  autoTable(doc, {
    startY: 58,
    head: [['Indicador', 'Valor', 'Indicador', 'Valor']],
    body: [
      ['Faturamento Bruto', formatCurrencyBRL(kpis.faturamentoBruto), 'Resultado Operacional', formatCurrencyBRL(kpis.resultadoOperacional)],
      ['Margem Operacional', formatPercent(kpis.margemOperacionalPct), 'Margem de Contribuição', formatPercent(kpis.margemContribuicaoPct)],
      ['Volume Comercializado', formatLiters(kpis.volumeLitros), 'Unidades Vendidas', formatNumber(kpis.quantidadeUnidades)],
      ['Custo Direto Total', formatCurrencyBRL(kpis.custoDiretoTotal), 'Despesas Operacionais', formatCurrencyBRL(kpis.despesasOperacionaisTotal)],
      ['Valores Recebidos', `${formatCurrencyBRL(kpis.valoresRecebidos)} (${formatPercent(kpis.percentualRecebimentoPct)})`, 'Valores em Aberto', `${formatCurrencyBRL(kpis.valoresEmAberto)} (${formatPercent(kpis.percentualEmAbertoPct)})`],
    ],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 24, 19], textColor: [245, 158, 11] },
    alternateRowStyles: { fillColor: [249, 247, 243] },
  });

  const nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (reportId === 'executivo_mensal') {
    autoTable(doc, {
      startY: nextY,
      head: [['Período', 'Reg.', 'Faturamento', 'Meta Fat.', 'Res. Operacional', 'Margem Op.', 'Volume (L)']],
      body: monthly.map((m) => [
        m.periodo,
        m.semRegistros ? '0 (sem reg.)' : String(m.registros),
        m.semRegistros ? 'N/A' : formatCurrencyBRL(m.faturamentoBruto),
        formatCurrencyBRL(m.metaFaturamento),
        m.semRegistros ? 'N/A' : formatCurrencyBRL(m.resultadoOperacional),
        formatPercent(m.margemOperacionalPct),
        m.semRegistros ? 'N/A' : formatLiters(m.volumeLitros),
      ]),
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255] },
    });
  } else if (reportId === 'desempenho_comercial') {
    autoTable(doc, {
      startY: nextY,
      head: [['Categoria', 'Reg.', 'Faturamento', 'Part. %', 'Volume (L)', 'Ticket Médio']],
      body: byCategory.map((c) => [
        c.nome,
        String(c.registros),
        formatCurrencyBRL(c.faturamentoBruto),
        formatPercent(c.participacaoFaturamentoPct),
        formatLiters(c.volumeLitros),
        formatCurrencyBRL(c.ticketMedio),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255] },
    });
  } else if (reportId === 'rentabilidade_produto') {
    autoTable(doc, {
      startY: nextY,
      head: [['Produto', 'Faturamento', 'Custo Direto', 'Res. Operacional', 'Margem Contrib.', 'Margem Op.']],
      body: byProduct.map((p) => [
        p.nome,
        formatCurrencyBRL(p.faturamentoBruto),
        formatCurrencyBRL(p.custoDireto),
        formatCurrencyBRL(p.resultadoOperacional),
        formatPercent(p.margemContribuicaoPct),
        formatPercent(p.margemOperacionalPct),
      ]),
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255] },
    });
  } else if (reportId === 'unidade_negocio') {
    autoTable(doc, {
      startY: nextY,
      head: [['Unidade de Negócio', 'Faturamento', 'Part. %', 'Res. Operacional', 'Margem Op.', 'Recebimento %']],
      body: byUnit.map((u) => [
        u.nome,
        formatCurrencyBRL(u.faturamentoBruto),
        formatPercent(u.participacaoFaturamentoPct),
        formatCurrencyBRL(u.resultadoOperacional),
        formatPercent(u.margemOperacionalPct),
        formatPercent(u.percentualRecebimentoPct),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255] },
    });
  } else if (reportId === 'analise_custos') {
    autoTable(doc, {
      startY: nextY,
      head: [['Período', 'Faturamento', 'Custo Direto', 'Desp. Operacional', 'Volume (L)', 'Custo/Litro']],
      body: monthly
        .filter((m) => !m.semRegistros)
        .map((m) => [
          m.periodo,
          formatCurrencyBRL(m.faturamentoBruto),
          formatCurrencyBRL(m.custoDireto),
          formatCurrencyBRL(m.despesaOperacional),
          formatLiters(m.volumeLitros),
          m.volumeLitros > 0 ? formatCurrencyBRL(m.custoDireto / m.volumeLitros) : 'N/A',
        ]),
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255] },
    });
  } else if (reportId === 'acompanhamento_metas') {
    autoTable(doc, {
      startY: nextY,
      head: [['Período', 'Unidade', 'Realizado', 'Meta Fat.', 'Ating. %', 'Diferença', 'Status']],
      body: metas.map((r) => [
        r.periodo,
        r.unidade_negocio,
        formatCurrencyBRL(r.faturamentoRealizado),
        formatCurrencyBRL(r.metaFaturamento),
        formatPercent(r.atingimentoFaturamentoPct),
        formatCurrencyBRL(r.diferencaFaturamento),
        r.status,
      ]),
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255] },
    });
  } else if (reportId === 'relatorio_financeiro') {
    autoTable(doc, {
      startY: nextY,
      head: [['Forma de Pagamento', 'Reg.', 'Faturamento', 'Recebido', 'Em Aberto', '% Receb.']],
      body: byPayment.map((p) => [
        p.nome,
        String(p.registros),
        formatCurrencyBRL(p.faturamentoBruto),
        formatCurrencyBRL(p.valorRecebido),
        formatCurrencyBRL(p.valorEmAberto),
        formatPercent(p.percentualRecebimentoPct),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255] },
    });
  } else if (reportId === 'recomendacoes_ia') {
    if (aiReport) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Síntese Executiva da IA', 14, nextY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const splitSynth = doc.splitTextToSize(aiReport.sinteseExecutiva, pageWidth - 28);
      doc.text(splitSynth, 14, nextY + 5);

      autoTable(doc, {
        startY: nextY + 8 + splitSynth.length * 4,
        head: [['Prioridade', 'Título', 'Diagnóstico & Evidência', 'Ação Recomendada & Indicador']],
        body: aiReport.recomendacoes.map((r) => [
          `${r.prioridade}\n(${r.categoriaEstrategica})`,
          r.titulo,
          `${r.diagnostico}\n\nEvidência: ${r.evidenciaQuantitativa}`,
          `${r.acaoRecomendada}\n\nIndicador: ${r.indicadorAcompanhamento}`,
        ]),
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255] },
      });
    } else {
      doc.setFontSize(9);
      doc.text('Gere o diagnóstico na página "Inteligência Artificial" antes de exportar o relatório completo da IA.', 14, nextY);
    }
  }

  // Footer conclusion
  const finalY = Math.min(272, ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? nextY) + 10);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Conclusão Gerencial Automática:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  const topUnit = byUnit[0];
  const negativeProds = byProduct.filter((p) => (p.margemOperacionalPct ?? 0) < 0);
  const conclusionText = `No recorte analisado, o faturamento bruto totalizou ${formatCurrencyBRL(kpis.faturamentoBruto)} com margem operacional de ${formatPercent(kpis.margemOperacionalPct)} e recebimento de ${formatPercent(kpis.percentualRecebimentoPct)}.${
    topUnit ? ` O principal canal em faturamento foi "${topUnit.nome}" (${formatPercent(topUnit.participacaoFaturamentoPct)}).` : ''
  }${
    negativeProds.length > 0
      ? ` Atenção: ${negativeProds.length} produto(s) operam com margem operacional negativa (${negativeProds.slice(0, 3).map((p) => p.nome).join(', ')}).`
      : ' Todos os produtos do recorte apresentam margem operacional não negativa.'
  }`;
  doc.text(conclusionText, 14, finalY + 5, { maxWidth: pageWidth - 28 });

  doc.save(`GalpaoBier_${reportId}.pdf`);
}
