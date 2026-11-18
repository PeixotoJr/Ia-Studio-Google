import React, { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, Eye } from 'lucide-react';
import type {
  LoadedDataset,
  VendaRecord,
  GlobalFilters,
  AiExecutiveReport,
} from '../types/bi';
import {
  REPORT_DEFINITIONS,
  exportReportCsv,
  exportReportPdf,
  type ReportTypeId,
} from '../services/reportGenerator';
import {
  computeKpis,
  buildMonthlySeries,
  buildSegmentMetrics,
  buildMetaComparison,
} from '../services/biCalculations';
import {
  formatCurrencyBRL,
  formatLiters,
  formatNumber,
  formatPercent,
} from '../utils/formatters';

interface ReportsPageProps {
  dataset: LoadedDataset;
  filteredVendas: VendaRecord[];
  filters: GlobalFilters;
  aiReport: AiExecutiveReport | null;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  dataset,
  filteredVendas,
  filters,
  aiReport,
}) => {
  const [selectedId, setSelectedId] = useState<ReportTypeId>('executivo_mensal');

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
  const metas = useMemo(
    () => buildMetaComparison(filteredVendas, dataset.metas, filters),
    [filteredVendas, dataset.metas, filters],
  );

  const selectedDef = REPORT_DEFINITIONS.find((r) => r.id === selectedId)!;

  return (
    <div className="space-y-6">
      {/* 8 Report Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORT_DEFINITIONS.map((rep) => {
          const isSelected = rep.id === selectedId;
          const aiMissing = rep.id === 'recomendacoes_ia' && !aiReport;
          return (
            <div
              key={rep.id}
              className={`p-4 rounded-xl bg-[#16120E] border flex flex-col justify-between space-y-4 transition-colors ${
                isSelected ? 'border-amber-400/70' : 'border-amber-500/15'
              }`}
            >
              <div className="space-y-1.5">
                <h3 className="font-display text-sm font-semibold text-[#F4EFE6]">{rep.title}</h3>
                <p className="text-xs text-[#B9AE9C] leading-relaxed">{rep.description}</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-amber-500/10">
                <button
                  type="button"
                  onClick={() => setSelectedId(rep.id)}
                  className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-[#0D0B09] text-[#B9AE9C] hover:text-[#F4EFE6] border border-amber-500/15'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isSelected ? 'Visualizando prévia' : 'Visualizar prévia'}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={filteredVendas.length === 0 || aiMissing}
                    onClick={() => exportReportPdf(rep.id, dataset, filteredVendas, filters, aiReport)}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-[#0D0B09] text-xs font-semibold cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    disabled={filteredVendas.length === 0 || aiMissing}
                    onClick={() => exportReportCsv(rep.id, dataset, filteredVendas, filters, aiReport)}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0D0B09] hover:bg-[#1E1813] disabled:opacity-40 text-[#F4EFE6] border border-amber-500/25 text-xs font-medium cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
                {aiMissing && (
                  <p className="text-[11px] text-amber-400">
                    Gere o diagnóstico na aba Inteligência Artificial para habilitar.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Preview of Selected Report */}
      <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-amber-500/15 pb-4">
          <div>
            <p className="text-xs text-amber-400 font-medium">Prévia Gerencial do Relatório</p>
            <h2 className="font-display text-lg font-semibold text-[#F4EFE6]">{selectedDef.title}</h2>
            <p className="text-xs text-[#847866] mt-0.5">
              Base: {dataset.metadata.fileName} · {filteredVendas.length} registros no recorte · Período{' '}
              {dataset.metadata.minPeriodo ?? 'N/A'} a {dataset.metadata.maxPeriodo ?? 'N/A'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={filteredVendas.length === 0 || (selectedId === 'recomendacoes_ia' && !aiReport)}
              onClick={() => exportReportPdf(selectedId, dataset, filteredVendas, filters, aiReport)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-[#0D0B09] text-xs font-semibold cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Exportar PDF</span>
            </button>
            <button
              type="button"
              disabled={filteredVendas.length === 0 || (selectedId === 'recomendacoes_ia' && !aiReport)}
              onClick={() => exportReportCsv(selectedId, dataset, filteredVendas, filters, aiReport)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0D0B09] hover:bg-[#1E1813] disabled:opacity-40 text-[#F4EFE6] border border-amber-500/25 text-xs font-medium cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Consolidated KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[#0D0B09] border border-amber-500/10">
            <span className="text-[#847866] block">Faturamento Bruto</span>
            <span className="font-mono tabular-nums font-semibold text-amber-300 text-sm">
              {formatCurrencyBRL(kpis.faturamentoBruto)}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[#0D0B09] border border-amber-500/10">
            <span className="text-[#847866] block">Resultado Operacional</span>
            <span className="font-mono tabular-nums font-semibold text-[#F4EFE6] text-sm">
              {formatCurrencyBRL(kpis.resultadoOperacional)}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[#0D0B09] border border-amber-500/10">
            <span className="text-[#847866] block">Margem Operacional</span>
            <span className="font-mono tabular-nums font-semibold text-[#F4EFE6] text-sm">
              {formatPercent(kpis.margemOperacionalPct)}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[#0D0B09] border border-amber-500/10">
            <span className="text-[#847866] block">Volume Total</span>
            <span className="font-mono tabular-nums font-semibold text-[#F4EFE6] text-sm">
              {formatLiters(kpis.volumeLitros)}
            </span>
          </div>
        </div>

        {/* Dynamic Preview Table */}
        <div className="overflow-x-auto max-h-[380px]">
          {selectedId === 'executivo_mensal' && (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-500/15 text-[#847866]">
                  <th className="py-2 px-3">Período</th>
                  <th className="py-2 px-3 text-right">Reg.</th>
                  <th className="py-2 px-3 text-right">Faturamento</th>
                  <th className="py-2 px-3 text-right">Meta</th>
                  <th className="py-2 px-3 text-right">Resultado Op.</th>
                  <th className="py-2 px-3 text-right">Margem Op.</th>
                  <th className="py-2 px-3 text-right">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {monthly.map((m) => (
                  <tr key={m.periodo}>
                    <td className="py-2 px-3 font-mono tabular-nums text-amber-300">{m.periodo}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{m.registros}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {m.semRegistros ? 'Sem registros' : formatCurrencyBRL(m.faturamentoBruto)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">
                      {formatCurrencyBRL(m.metaFaturamento)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {m.semRegistros ? 'N/A' : formatCurrencyBRL(m.resultadoOperacional)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatPercent(m.margemOperacionalPct)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatLiters(m.volumeLitros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedId === 'desempenho_comercial' && (
            <SegmentTable rows={byCategory} labelCol="Categoria" />
          )}

          {selectedId === 'rentabilidade_produto' && (
            <SegmentTable rows={byProduct} labelCol="Produto" />
          )}

          {selectedId === 'unidade_negocio' && (
            <SegmentTable rows={byUnit} labelCol="Unidade de Negócio" />
          )}

          {selectedId === 'analise_custos' && (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-500/15 text-[#847866]">
                  <th className="py-2 px-3">Período</th>
                  <th className="py-2 px-3 text-right">Faturamento</th>
                  <th className="py-2 px-3 text-right">Custo Direto</th>
                  <th className="py-2 px-3 text-right">Despesa Op.</th>
                  <th className="py-2 px-3 text-right">Volume (L)</th>
                  <th className="py-2 px-3 text-right">Custo/Litro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {monthly
                  .filter((m) => !m.semRegistros)
                  .map((m) => (
                    <tr key={m.periodo}>
                      <td className="py-2 px-3 font-mono tabular-nums text-amber-300">{m.periodo}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(m.faturamentoBruto)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(m.custoDireto)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(m.despesaOperacional)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{formatLiters(m.volumeLitros)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {m.volumeLitros > 0 ? formatCurrencyBRL(m.custoDireto / m.volumeLitros) : 'N/A'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {selectedId === 'acompanhamento_metas' && (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-500/15 text-[#847866]">
                  <th className="py-2 px-3">Período</th>
                  <th className="py-2 px-3">Unidade</th>
                  <th className="py-2 px-3 text-right">Realizado</th>
                  <th className="py-2 px-3 text-right">Meta Fat.</th>
                  <th className="py-2 px-3 text-right">Ating. %</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {metas.map((r) => (
                  <tr key={`${r.periodo}-${r.unidade_negocio}`}>
                    <td className="py-2 px-3 font-mono tabular-nums text-amber-300">{r.periodo}</td>
                    <td className="py-2 px-3">{r.unidade_negocio}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(r.faturamentoRealizado)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(r.metaFaturamento)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatPercent(r.atingimentoFaturamentoPct)}</td>
                    <td className="py-2 px-3">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedId === 'relatorio_financeiro' && (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-500/15 text-[#847866]">
                  <th className="py-2 px-3">Forma de Pagamento</th>
                  <th className="py-2 px-3 text-right">Reg.</th>
                  <th className="py-2 px-3 text-right">Faturamento</th>
                  <th className="py-2 px-3 text-right">Recebido</th>
                  <th className="py-2 px-3 text-right">Em Aberto</th>
                  <th className="py-2 px-3 text-right">% Recebido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {byPayment.map((p) => (
                  <tr key={p.nome}>
                    <td className="py-2 px-3 font-medium">{p.nome}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatNumber(p.registros)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(p.faturamentoBruto)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-400">{formatCurrencyBRL(p.valorRecebido)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-300">{formatCurrencyBRL(p.valorEmAberto)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatPercent(p.percentualRecebimentoPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedId === 'recomendacoes_ia' && (
            <div className="space-y-3 text-xs">
              {aiReport ? (
                <>
                  <p className="text-[#F4EFE6]">{aiReport.sinteseExecutiva}</p>
                  <div className="space-y-2">
                    {aiReport.recomendacoes.map((r, i) => (
                      <div key={i} className="p-3 rounded-lg bg-[#0D0B09] border border-amber-500/10">
                        <strong className="text-amber-300">[{r.prioridade}] {r.titulo}:</strong>{' '}
                        <span className="text-[#B9AE9C]">{r.acaoRecomendada}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[#847866]">
                  Acesse a página Inteligência Artificial e clique em "Gerar Diagnóstico Executivo" para incluir recomendações neste relatório.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const SegmentTable: React.FC<{
  rows: ReturnType<typeof buildSegmentMetrics>;
  labelCol: string;
}> = ({ rows, labelCol }) => (
  <table className="w-full text-xs text-left border-collapse">
    <thead>
      <tr className="border-b border-amber-500/15 text-[#847866]">
        <th className="py-2 px-3">{labelCol}</th>
        <th className="py-2 px-3 text-right">Reg.</th>
        <th className="py-2 px-3 text-right">Faturamento</th>
        <th className="py-2 px-3 text-right">Part. %</th>
        <th className="py-2 px-3 text-right">Resultado Op.</th>
        <th className="py-2 px-3 text-right">Margem Contrib.</th>
        <th className="py-2 px-3 text-right">Margem Op.</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-amber-500/10">
      {rows.map((r) => (
        <tr key={r.nome}>
          <td className="py-2 px-3 font-medium text-[#F4EFE6]">{r.nome}</td>
          <td className="py-2 px-3 text-right font-mono tabular-nums">{formatNumber(r.registros)}</td>
          <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(r.faturamentoBruto)}</td>
          <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-300">{formatPercent(r.participacaoFaturamentoPct)}</td>
          <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrencyBRL(r.resultadoOperacional)}</td>
          <td className="py-2 px-3 text-right font-mono tabular-nums">{formatPercent(r.margemContribuicaoPct)}</td>
          <td className="py-2 px-3 text-right font-mono tabular-nums">{formatPercent(r.margemOperacionalPct)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);
