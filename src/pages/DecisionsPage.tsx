import React, { useMemo, useState } from 'react';
import {
  Plus,
  Edit3,
  Download,
  FileSpreadsheet,
  History,
  X,
  Info,
} from 'lucide-react';
import type {
  DecisaoRecord,
  DecisionPriority,
  DecisionStatus,
  ExecutiveKpis,
} from '../types/bi';
import { exportDecisoesToExcel, exportObjectsToCsv } from '../services/excelLoader';
import { formatCurrencyBRL, formatDateTimeBR, formatPercent } from '../utils/formatters';

interface DecisionsPageProps {
  decisoes: DecisaoRecord[];
  onSaveDecision: (decision: DecisaoRecord, isNew: boolean) => void;
  currentKpis: ExecutiveKpis;
}

const STATUS_OPTIONS: DecisionStatus[] = ['Planejada', 'Em andamento', 'Concluída', 'Cancelada'];
const PRIORITY_OPTIONS: DecisionPriority[] = ['Alta', 'Média', 'Baixa'];

export const DecisionsPage: React.FC<DecisionsPageProps> = ({
  decisoes,
  onSaveDecision,
  currentKpis,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingDecision, setEditingDecision] = useState<DecisaoRecord | null>(null);
  const [isNewModal, setIsNewModal] = useState(false);
  const [historyModalDecision, setHistoryModalDecision] = useState<DecisaoRecord | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return decisoes.filter((d) => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && d.prioridade !== priorityFilter) return false;
      if (q) {
        const text = [
          d.id_decisao,
          d.tema,
          d.analise_necessaria,
          d.decisao_possivel,
          d.responsavel,
          d.indicador_associado,
          d.justificativa,
        ]
          .join(' ')
          .toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [decisoes, statusFilter, priorityFilter, searchQuery]);

  const openNewModal = () => {
    const now = new Date().toISOString();
    setIsNewModal(true);
    setEditingDecision({
      id_decisao: `DEC-${String(decisoes.length + 1).padStart(3, '0')}`,
      tema: '',
      analise_necessaria: '',
      decisao_possivel: '',
      responsavel: '',
      periodicidade: 'Mensal',
      indicador_associado: 'Margem Operacional (%)',
      status: 'Planejada',
      prioridade: 'Média',
      data_decisao: now.slice(0, 10),
      justificativa: '',
      origem_registro: 'Novo Registro',
      updated_at: now,
      historico: [],
    });
  };

  const openEditModal = (d: DecisaoRecord) => {
    setIsNewModal(false);
    setEditingDecision({ ...d });
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDecision) return;
    const now = new Date().toISOString();
    const updated: DecisaoRecord = {
      ...editingDecision,
      updated_at: now,
      historico: [
        ...editingDecision.historico,
        {
          timestamp: now,
          action: isNewModal ? 'Criação de decisão' : 'Atualização de decisão',
          details: `Status: ${editingDecision.status} | Prioridade: ${editingDecision.prioridade} | Responsável: ${editingDecision.responsavel || 'N/A'}`,
        },
      ],
    };
    onSaveDecision(updated, isNewModal);
    setEditingDecision(null);
  };

  const handleAttachKpiSnapshot = () => {
    if (!editingDecision) return;
    const snap = `Evidência do recorte atual: Faturamento ${formatCurrencyBRL(currentKpis.faturamentoBruto)}, Resultado Op. ${formatCurrencyBRL(currentKpis.resultadoOperacional)}, Margem Op. ${formatPercent(currentKpis.margemOperacionalPct)}, Recebimento ${formatPercent(currentKpis.percentualRecebimentoPct)}.`;
    setEditingDecision({
      ...editingDecision,
      justificativa: editingDecision.justificativa ? `${editingDecision.justificativa}\n${snap}` : snap,
    });
  };

  return (
    <div className="space-y-5">
      {/* Honest Persistence & Export Notice */}
      <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-2.5 text-xs text-[#B9AE9C] max-w-2xl">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            As alterações e novas decisões registradas aqui são mantidas na sessão atual para gestão e{' '}
            <strong className="text-[#F4EFE6]">não modificam automaticamente o arquivo Excel original no seu computador</strong>. Utilize os botões de exportação ao lado para baixar a aba Decisões atualizada em <span className="font-mono">.xlsx</span> ou <span className="font-mono">.csv</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-[#0D0B09] text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Decisão</span>
          </button>
          <button
            type="button"
            onClick={() => exportDecisoesToExcel(decisoes)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D0B09] hover:bg-[#1E1813] text-[#F4EFE6] border border-amber-500/25 text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            <span>Exportar Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() =>
              exportObjectsToCsv(
                decisoes.map((d) => ({
                  id_decisao: d.id_decisao,
                  tema: d.tema,
                  analise_necessaria: d.analise_necessaria,
                  decisao_possivel: d.decisao_possivel,
                  responsavel: d.responsavel,
                  periodicidade: d.periodicidade,
                  indicador_associado: d.indicador_associado,
                  status: d.status,
                  prioridade: d.prioridade,
                  data_decisao: d.data_decisao,
                  justificativa: d.justificativa,
                  origem_registro: d.origem_registro,
                })),
                'GalpaoBier_Decisoes_Atualizadas.csv',
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D0B09] hover:bg-[#1E1813] text-[#F4EFE6] border border-amber-500/25 text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar tema, responsável, indicador..."
          className="sm:col-span-2 h-9 px-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6] placeholder:text-[#847866]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-2.5 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6]"
        >
          <option value="ALL">Status: Todos</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-9 px-2.5 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6]"
        >
          <option value="ALL">Prioridade: Todas</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Decisions Table */}
      <div className="rounded-xl bg-[#16120E] border border-amber-500/15 overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-amber-500/15 bg-[#120E0B] text-[#847866]">
              <th className="py-2.5 px-3">ID</th>
              <th className="py-2.5 px-3">Tema & Decisão Possível</th>
              <th className="py-2.5 px-3">Indicador Associado</th>
              <th className="py-2.5 px-3">Responsável</th>
              <th className="py-2.5 px-3">Prioridade</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Data</th>
              <th className="py-2.5 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-500/10">
            {filtered.map((d) => (
              <tr key={d.id_decisao} className="hover:bg-[#1E1813]">
                <td className="py-3 px-3 font-mono tabular-nums text-amber-300 whitespace-nowrap align-top">
                  {d.id_decisao}
                  <span className="block text-[10px] text-[#847866] font-sans">{d.origem_registro}</span>
                </td>
                <td className="py-3 px-3 align-top max-w-md space-y-1">
                  <p className="font-semibold text-[#F4EFE6]">{d.tema || 'Sem tema'}</p>
                  <p className="text-[#B9AE9C]">{d.decisao_possivel}</p>
                  {d.analise_necessaria && (
                    <p className="text-[11px] text-[#847866]">Análise: {d.analise_necessaria}</p>
                  )}
                  {d.justificativa && (
                    <p className="text-[11px] text-amber-200/80 pt-1">Justificativa: {d.justificativa}</p>
                  )}
                </td>
                <td className="py-3 px-3 align-top text-[#B9AE9C]">{d.indicador_associado || 'N/A'}</td>
                <td className="py-3 px-3 align-top text-[#F4EFE6] whitespace-nowrap">
                  {d.responsavel || 'Não definido'}
                  <span className="block text-[11px] text-[#847866]">{d.periodicidade}</span>
                </td>
                <td className="py-3 px-3 align-top whitespace-nowrap">
                  <span
                    className={`font-medium ${
                      d.prioridade === 'Alta'
                        ? 'text-red-400'
                        : d.prioridade === 'Média'
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                    }`}
                  >
                    {d.prioridade}
                  </span>
                </td>
                <td className="py-3 px-3 align-top whitespace-nowrap">
                  <span
                    className={`font-medium ${
                      d.status === 'Concluída'
                        ? 'text-emerald-400'
                        : d.status === 'Em andamento'
                        ? 'text-amber-300'
                        : d.status === 'Cancelada'
                        ? 'text-red-400'
                        : 'text-[#B9AE9C]'
                    }`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="py-3 px-3 align-top font-mono tabular-nums text-[#B9AE9C] whitespace-nowrap">
                  {d.data_decisao || 'N/A'}
                </td>
                <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(d)}
                      className="p-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 cursor-pointer"
                      aria-label={`Editar ${d.id_decisao}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryModalDecision(d)}
                      className="p-1.5 rounded-md bg-[#0D0B09] hover:bg-[#1E1813] text-[#B9AE9C] border border-amber-500/20 cursor-pointer"
                      aria-label={`Histórico de ${d.id_decisao}`}
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-[#847866]">
                  Nenhuma decisão encontrada para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {editingDecision && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitForm}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#16120E] border border-amber-500/30 p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-amber-500/15 pb-3">
              <h3 className="font-display text-lg font-semibold text-[#F4EFE6]">
                {isNewModal ? 'Registrar Nova Decisão Gerencial' : `Editar Decisão ${editingDecision.id_decisao}`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingDecision(null)}
                className="p-1.5 text-[#B9AE9C] hover:text-[#F4EFE6] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[#B9AE9C] block">ID da Decisão</span>
                <input
                  required
                  type="text"
                  value={editingDecision.id_decisao}
                  onChange={(e) => setEditingDecision({ ...editingDecision, id_decisao: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-[#F4EFE6] font-mono"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[#B9AE9C] block">Tema</span>
                <input
                  required
                  type="text"
                  value={editingDecision.tema}
                  onChange={(e) => setEditingDecision({ ...editingDecision, tema: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-[#F4EFE6]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[#B9AE9C] block">Responsável</span>
                <input
                  required
                  type="text"
                  value={editingDecision.responsavel}
                  onChange={(e) => setEditingDecision({ ...editingDecision, responsavel: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-[#F4EFE6]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[#B9AE9C] block">Indicador Associado</span>
                <input
                  required
                  type="text"
                  value={editingDecision.indicador_associado}
                  onChange={(e) => setEditingDecision({ ...editingDecision, indicador_associado: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-[#F4EFE6]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[#B9AE9C] block">Status</span>
                <select
                  value={editingDecision.status}
                  onChange={(e) => setEditingDecision({ ...editingDecision, status: e.target.value as DecisionStatus })}
                  className="w-full h-9 px-2.5 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-[#F4EFE6]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[#B9AE9C] block">Prioridade</span>
                <select
                  value={editingDecision.prioridade}
                  onChange={(e) =>
                    setEditingDecision({ ...editingDecision, prioridade: e.target.value as DecisionPriority })
                  }
                  className="w-full h-9 px-2.5 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-[#F4EFE6]"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[#B9AE9C] block">Data da Decisão</span>
                <input
                  type="date"
                  value={editingDecision.data_decisao}
                  onChange={(e) => setEditingDecision({ ...editingDecision, data_decisao: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-[#F4EFE6]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[#B9AE9C] block">Periodicidade</span>
                <input
                  type="text"
                  value={editingDecision.periodicidade}
                  onChange={(e) => setEditingDecision({ ...editingDecision, periodicidade: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-[#F4EFE6]"
                />
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="text-[#B9AE9C] block">Análise Necessária</span>
              <textarea
                rows={2}
                value={editingDecision.analise_necessaria}
                onChange={(e) => setEditingDecision({ ...editingDecision, analise_necessaria: e.target.value })}
                className="w-full p-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-[#F4EFE6]"
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-[#B9AE9C] block">Decisão / Ação Definida</span>
              <textarea
                required
                rows={2}
                value={editingDecision.decisao_possivel}
                onChange={(e) => setEditingDecision({ ...editingDecision, decisao_possivel: e.target.value })}
                className="w-full p-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-[#F4EFE6]"
              />
            </label>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#B9AE9C]">Justificativa Baseada nos Dados</span>
                <button
                  type="button"
                  onClick={handleAttachKpiSnapshot}
                  className="text-amber-300 hover:underline cursor-pointer"
                >
                  + Anexar indicadores atuais
                </button>
              </div>
              <textarea
                rows={3}
                value={editingDecision.justificativa}
                onChange={(e) => setEditingDecision({ ...editingDecision, justificativa: e.target.value })}
                className="w-full p-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-[#F4EFE6]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingDecision(null)}
                className="px-4 py-2 rounded-lg border border-amber-500/20 text-[#B9AE9C] hover:text-[#F4EFE6] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-[#0D0B09] font-semibold cursor-pointer"
              >
                Salvar na Sessão
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History Modal */}
      {historyModalDecision && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#16120E] border border-amber-500/30 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-amber-500/15 pb-3">
              <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
                Histórico de Alterações · {historyModalDecision.id_decisao}
              </h3>
              <button
                type="button"
                onClick={() => setHistoryModalDecision(null)}
                className="p-1 text-[#B9AE9C] hover:text-[#F4EFE6] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 max-h-[320px] overflow-y-auto">
              {historyModalDecision.historico.map((h, i) => (
                <div key={i} className="p-3 rounded-lg bg-[#0D0B09] border border-amber-500/15 space-y-1">
                  <div className="flex justify-between text-[#847866]">
                    <span className="font-semibold text-amber-300">{h.action}</span>
                    <span className="font-mono">{formatDateTimeBR(h.timestamp)}</span>
                  </div>
                  <p className="text-[#B9AE9C]">{h.details}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
