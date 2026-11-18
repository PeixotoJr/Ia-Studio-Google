import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { VendaRecord } from '../types/bi';
import { exportObjectsToCsv } from '../services/excelLoader';
import {
  formatCurrencyBRL,
  formatDateBR,
  formatLiters,
  formatNumber,
} from '../utils/formatters';

interface DatabasePageProps {
  vendas: VendaRecord[];
}

type SortField =
  | 'id_registro'
  | 'data_registro'
  | 'unidade_negocio'
  | 'categoria'
  | 'produto'
  | 'quantidade_unidades'
  | 'volume_litros'
  | 'faturamento_bruto'
  | 'resultado_operacional_estimado'
  | 'satisfacao_cliente_0a10';

export const DatabasePage: React.FC<DatabasePageProps> = ({ vendas }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [colUnit, setColUnit] = useState('ALL');
  const [colCategory, setColCategory] = useState('ALL');
  const [colStatus, setColStatus] = useState('ALL');
  const [colPayment, setColPayment] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('data_registro');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<VendaRecord | null>(null);

  const uniqueValues = useMemo(() => {
    const units = new Set<string>();
    const categories = new Set<string>();
    const statuses = new Set<string>();
    const payments = new Set<string>();
    for (const v of vendas) {
      if (v.unidade_negocio) units.add(v.unidade_negocio);
      if (v.categoria) categories.add(v.categoria);
      if (v.status_pagamento) statuses.add(v.status_pagamento);
      if (v.forma_pagamento) payments.add(v.forma_pagamento);
    }
    return {
      units: Array.from(units).sort(),
      categories: Array.from(categories).sort(),
      statuses: Array.from(statuses).sort(),
      payments: Array.from(payments).sort(),
    };
  }, [vendas]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = vendas.filter((v) => {
      if (colUnit !== 'ALL' && v.unidade_negocio !== colUnit) return false;
      if (colCategory !== 'ALL' && v.categoria !== colCategory) return false;
      if (colStatus !== 'ALL' && v.status_pagamento !== colStatus) return false;
      if (colPayment !== 'ALL' && v.forma_pagamento !== colPayment) return false;
      if (q) {
        const haystack = [
          v.id_registro,
          v.periodo,
          v.unidade_negocio,
          v.categoria,
          v.produto,
          v.lote,
          v.forma_pagamento,
          v.status_pagamento,
          v.observacao_qual,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;

      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), 'pt-BR');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [vendas, searchQuery, colUnit, colCategory, colStatus, colPayment, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, safePage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleExportCsv = () => {
    const rows = filteredAndSorted.map((v) => ({
      id_registro: v.id_registro,
      data_registro: v.data_registro ?? v.data_registro_raw,
      ano: v.ano,
      mes: v.mes,
      periodo: v.periodo,
      unidade_negocio: v.unidade_negocio,
      categoria: v.categoria,
      produto: v.produto,
      lote: v.lote,
      quantidade_unidades: v.quantidade_unidades,
      volume_litros: v.volume_litros,
      preco_unitario: v.preco_unitario,
      faturamento_bruto: v.faturamento_bruto,
      custo_direto: v.custo_direto,
      despesa_operacional: v.despesa_operacional,
      resultado_operacional_estimado: v.resultado_operacional_estimado,
      forma_pagamento: v.forma_pagamento,
      status_pagamento: v.status_pagamento,
      valor_recebido: v.valor_recebido,
      valor_em_aberto: v.valor_em_aberto,
      satisfacao_cliente_0a10: v.satisfacao_cliente_0a10,
      estoque_unidades_antes: v.estoque_unidades_antes,
      estoque_unidades_depois: v.estoque_unidades_depois,
      origem_dados: v.origem_dados,
      observacao_qual: v.observacao_qual,
    }));
    exportObjectsToCsv(rows, 'GalpaoBier_Base_Vendas_Filtrada.csv');
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-[#847866]" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[#B9AE9C]">
            Registros filtrados:{' '}
            <strong className="text-[#F4EFE6] font-mono tabular-nums">
              {filteredAndSorted.length.toLocaleString('pt-BR')}
            </strong>{' '}
            de{' '}
            <strong className="text-amber-300 font-mono tabular-nums">
              {vendas.length.toLocaleString('pt-BR')}
            </strong>{' '}
            carregados da aba Vendas
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredAndSorted.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-[#0D0B09] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Exportar filtrados (CSV)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-[#847866] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar ID, produto, lote, observação..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6] placeholder:text-[#847866] focus:outline-none focus:border-amber-400"
            />
          </div>

          <select
            value={colUnit}
            onChange={(e) => {
              setColUnit(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por unidade de negócio"
            className="h-9 px-2.5 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6] focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">Unidade: Todas</option>
            {uniqueValues.units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <select
            value={colCategory}
            onChange={(e) => {
              setColCategory(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por categoria"
            className="h-9 px-2.5 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6] focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">Categoria: Todas</option>
            {uniqueValues.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={colPayment}
            onChange={(e) => {
              setColPayment(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por forma de pagamento"
            className="h-9 px-2.5 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6] focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">Pagamento: Todos</option>
            {uniqueValues.payments.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={colStatus}
            onChange={(e) => {
              setColStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por status de pagamento"
            className="h-9 px-2.5 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6] focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">Status Pgto: Todos</option>
            {uniqueValues.statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Interactive Data Grid */}
      <div className="rounded-xl bg-[#16120E] border border-amber-500/15 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-amber-500/15 bg-[#120E0B] text-[#B9AE9C]">
                <SortableTh label="ID" field="id_registro" onSort={handleSort} icon={renderSortIcon('id_registro')} />
                <SortableTh label="Data" field="data_registro" onSort={handleSort} icon={renderSortIcon('data_registro')} />
                <SortableTh label="Unidade" field="unidade_negocio" onSort={handleSort} icon={renderSortIcon('unidade_negocio')} />
                <SortableTh label="Categoria" field="categoria" onSort={handleSort} icon={renderSortIcon('categoria')} />
                <SortableTh label="Produto" field="produto" onSort={handleSort} icon={renderSortIcon('produto')} />
                <SortableTh label="Qtd." field="quantidade_unidades" align="right" onSort={handleSort} icon={renderSortIcon('quantidade_unidades')} />
                <SortableTh label="Volume (L)" field="volume_litros" align="right" onSort={handleSort} icon={renderSortIcon('volume_litros')} />
                <SortableTh label="Faturamento" field="faturamento_bruto" align="right" onSort={handleSort} icon={renderSortIcon('faturamento_bruto')} />
                <SortableTh label="Res. Operac." field="resultado_operacional_estimado" align="right" onSort={handleSort} icon={renderSortIcon('resultado_operacional_estimado')} />
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">Pgto / Status</th>
                <SortableTh label="Satisfação" field="satisfacao_cliente_0a10" align="right" onSort={handleSort} icon={renderSortIcon('satisfacao_cliente_0a10')} />
                <th className="py-2.5 px-3 font-medium text-right">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/10">
              {paginatedRows.map((row) => (
                <tr key={`${row._rowIndex}-${row.id_registro}`} className="hover:bg-[#1E1813] transition-colors">
                  <td className="py-2.5 px-3 font-mono tabular-nums text-amber-300 whitespace-nowrap">
                    {row.id_registro || 'N/A'}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-[#B9AE9C] whitespace-nowrap">
                    {row.data_registro ? formatDateBR(row.data_registro) : row.data_registro_raw || 'N/A'}
                  </td>
                  <td className="py-2.5 px-3 text-[#F4EFE6] whitespace-nowrap">{row.unidade_negocio || 'N/A'}</td>
                  <td className="py-2.5 px-3 text-[#B9AE9C] whitespace-nowrap">{row.categoria || 'N/A'}</td>
                  <td className="py-2.5 px-3 text-[#F4EFE6] font-medium whitespace-nowrap max-w-[200px] truncate" title={row.produto}>
                    {row.produto || 'N/A'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#F4EFE6]">
                    {formatNumber(row.quantidade_unidades)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">
                    {formatLiters(row.volume_litros)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#F4EFE6] font-medium">
                    {formatCurrencyBRL(row.faturamento_bruto)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono tabular-nums font-medium ${
                      (row.resultado_operacional_estimado ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {formatCurrencyBRL(row.resultado_operacional_estimado)}
                  </td>
                  <td className="py-2.5 px-3 text-[#B9AE9C] whitespace-nowrap">
                    {row.forma_pagamento || 'N/A'} ·{' '}
                    <span
                      className={
                        row.status_pagamento.toLowerCase().includes('aberto') ||
                        row.status_pagamento.toLowerCase().includes('pendente')
                          ? 'text-amber-400'
                          : 'text-[#F4EFE6]'
                      }
                    >
                      {row.status_pagamento || 'N/A'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#B9AE9C]">
                    {row.satisfacao_cliente_0a10 !== null ? row.satisfacao_cliente_0a10.toFixed(1) : 'N/A'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(row)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 cursor-pointer"
                      aria-label={`Ver detalhes de ${row.id_registro}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver</span>
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-sm text-[#847866]">
                    Nenhum registro corresponde aos filtros aplicados na tabela.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-amber-500/15 bg-[#120E0B] flex flex-wrap items-center justify-between gap-3 text-xs text-[#B9AE9C]">
          <div className="flex items-center gap-2">
            <span>Registros por página:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-8 px-2 rounded-md bg-[#0D0B09] border border-amber-500/20 text-[#F4EFE6]"
            >
              {[15, 25, 50, 100].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 font-mono tabular-nums">
            <span>
              Página {safePage} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-1.5 rounded-md border border-amber-500/20 disabled:opacity-40 hover:bg-[#1E1813] cursor-pointer"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded-md border border-amber-500/20 disabled:opacity-40 hover:bg-[#1E1813] cursor-pointer"
              aria-label="Próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Record Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-[#16120E] border border-amber-500/30 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-500/15 pb-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#F4EFE6]">
                  Registro {selectedRecord.id_registro || `Linha ${selectedRecord._rowIndex}`}
                </h3>
                <p className="text-xs text-[#847866]">
                  Linha original na planilha: {selectedRecord._rowIndex} · Origem: {selectedRecord.origem_dados || 'N/A'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-2 rounded-lg text-[#B9AE9C] hover:text-[#F4EFE6] hover:bg-[#1E1813] cursor-pointer"
                aria-label="Fechar detalhes"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <DetailItem label="data_registro" value={selectedRecord.data_registro ? formatDateBR(selectedRecord.data_registro) : selectedRecord.data_registro_raw || 'N/A'} />
              <DetailItem label="periodo (ano / mês)" value={`${selectedRecord.periodo || 'N/A'} (${selectedRecord.ano ?? 'N/A'} / ${selectedRecord.mes ?? 'N/A'})`} />
              <DetailItem label="unidade_negocio" value={selectedRecord.unidade_negocio || 'N/A'} />
              <DetailItem label="categoria" value={selectedRecord.categoria || 'N/A'} />
              <DetailItem label="produto" value={selectedRecord.produto || 'N/A'} />
              <DetailItem label="lote" value={selectedRecord.lote || 'N/A'} />
              <DetailItem label="quantidade_unidades" value={formatNumber(selectedRecord.quantidade_unidades)} mono />
              <DetailItem label="volume_litros" value={formatLiters(selectedRecord.volume_litros)} mono />
              <DetailItem label="preco_unitario" value={formatCurrencyBRL(selectedRecord.preco_unitario)} mono />
              <DetailItem label="faturamento_bruto" value={formatCurrencyBRL(selectedRecord.faturamento_bruto)} mono />
              <DetailItem label="custo_direto" value={formatCurrencyBRL(selectedRecord.custo_direto)} mono />
              <DetailItem label="despesa_operacional" value={formatCurrencyBRL(selectedRecord.despesa_operacional)} mono />
              <DetailItem label="resultado_operacional_estimado" value={formatCurrencyBRL(selectedRecord.resultado_operacional_estimado)} mono />
              <DetailItem label="forma_pagamento / status" value={`${selectedRecord.forma_pagamento || 'N/A'} · ${selectedRecord.status_pagamento || 'N/A'}`} />
              <DetailItem label="valor_recebido" value={formatCurrencyBRL(selectedRecord.valor_recebido)} mono />
              <DetailItem label="valor_em_aberto" value={formatCurrencyBRL(selectedRecord.valor_em_aberto)} mono />
              <DetailItem label="satisfacao_cliente_0a10" value={selectedRecord.satisfacao_cliente_0a10 !== null ? selectedRecord.satisfacao_cliente_0a10.toFixed(1) : 'N/A (ausente)'} mono />
              <DetailItem label="estoque (antes → depois)" value={`${formatNumber(selectedRecord.estoque_unidades_antes)} → ${formatNumber(selectedRecord.estoque_unidades_depois)}`} mono />
            </div>

            <div className="p-3 rounded-lg bg-[#0D0B09] border border-amber-500/15 text-xs space-y-1">
              <span className="text-[#847866] block">observacao_qual</span>
              <p className="text-[#F4EFE6]">{selectedRecord.observacao_qual || 'Sem observações registradas.'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SortableTh: React.FC<{
  label: string;
  field: SortField;
  align?: 'left' | 'right';
  onSort: (field: SortField) => void;
  icon: React.ReactNode;
}> = ({ label, field, align = 'left', onSort, icon }) => (
  <th className={`py-2.5 px-3 font-medium whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}>
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 hover:text-[#F4EFE6] cursor-pointer ${
        align === 'right' ? 'flex-row-reverse' : ''
      }`}
    >
      <span>{label}</span>
      {icon}
    </button>
  </th>
);

const DetailItem: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="p-2.5 rounded-lg bg-[#0D0B09] border border-amber-500/10">
    <span className="text-[11px] text-[#847866] block">{label}</span>
    <span className={`text-[#F4EFE6] font-medium block mt-0.5 ${mono ? 'font-mono tabular-nums' : ''}`}>
      {value}
    </span>
  </div>
);
