import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import type { LoadedDataset, ValidationIssue } from '../types/bi';
import { formatDateTimeBR, formatNumber } from '../utils/formatters';

interface QualityPageProps {
  dataset: LoadedDataset;
}

export const QualityPage: React.FC<QualityPageProps> = ({ dataset }) => {
  const { metadata, qualidade, validationIssues } = dataset;

  const criticalCount = validationIssues.filter((i) => i.severidade === 'crítico' && i.ocorrencias > 0).length;
  const warningCount = validationIssues.filter((i) => i.severidade === 'atenção' && i.ocorrencias > 0).length;

  return (
    <div className="space-y-6">
      {/* Reliability Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1">
          <span className="text-xs text-[#847866]">Status Geral de Validação</span>
          <p
            className={`text-lg font-semibold flex items-center gap-2 ${
              metadata.validationStatus === 'Íntegro'
                ? 'text-emerald-400'
                : metadata.validationStatus === 'Com Ressalvas'
                ? 'text-amber-300'
                : 'text-red-400'
            }`}
          >
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>{metadata.validationStatus}</span>
          </p>
          <span className="text-[11px] text-[#B9AE9C] block">
            {criticalCount} ponto(s) crítico(s) · {warningCount} ressalva(s)
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1">
          <span className="text-xs text-[#847866]">Registros Preservados (Vendas)</span>
          <p className="text-lg font-mono tabular-nums font-semibold text-[#F4EFE6]">
            {formatNumber(metadata.vendasCount)}
          </p>
          <span className="text-[11px] text-[#B9AE9C] block">Nenhum registro excluído ou alterado</span>
        </div>

        <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1">
          <span className="text-xs text-[#847866]">Abas Lidas do Arquivo</span>
          <p className="text-lg font-mono tabular-nums font-semibold text-amber-300">
            {metadata.sheetNamesFound.length} aba(s)
          </p>
          <span className="text-[11px] text-[#B9AE9C] block truncate" title={metadata.sheetNamesFound.join(', ')}>
            {metadata.sheetNamesFound.join(', ')}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-1">
          <span className="text-xs text-[#847866]">Última Leitura</span>
          <p className="text-sm font-mono tabular-nums font-semibold text-[#F4EFE6]">
            {formatDateTimeBR(metadata.loadedAt)}
          </p>
          <span className="text-[11px] text-[#B9AE9C] block truncate">{metadata.fileName}</span>
        </div>
      </div>

      {/* Automatic Audit Results */}
      <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold text-[#F4EFE6]">
            Auditoria Automática de Consistência e Integridade
          </h2>
          <p className="text-xs text-[#847866] mt-0.5">
            Verificações executadas na importação sem alterar ou excluir registros originais.
          </p>
        </div>

        <div className="space-y-3">
          {validationIssues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      </section>

      {/* Official Aba 4 - Qualidade Table */}
      <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold text-[#F4EFE6]">
            Verificações Registradas na Aba Qualidade (Planilha Oficial)
          </h2>
          <p className="text-xs text-[#847866] mt-0.5">
            {qualidade.length} verificação(ões) importadas diretamente da quarta aba do arquivo Excel.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-amber-500/15 text-[#847866]">
                <th className="py-2 px-3">Verificação</th>
                <th className="py-2 px-3">Resultado</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/10">
              {qualidade.map((q) => (
                <tr key={q._rowIndex} className="hover:bg-[#1E1813]">
                  <td className="py-2.5 px-3 font-medium text-[#F4EFE6]">{q.verificacao || 'N/A'}</td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-[#B9AE9C]">{q.resultado || 'N/A'}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`font-medium ${
                        q.status.toLowerCase().includes('ok') ||
                        q.status.toLowerCase().includes('aprov') ||
                        q.status.toLowerCase().includes('íntegr')
                          ? 'text-emerald-400'
                          : q.status.toLowerCase().includes('aten') || q.status.toLowerCase().includes('alerta')
                          ? 'text-amber-300'
                          : 'text-[#F4EFE6]'
                      }`}
                    >
                      {q.status || 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
              {qualidade.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-[#847866]">
                    A aba Qualidade não possui registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const IssueCard: React.FC<{ issue: ValidationIssue }> = ({ issue }) => {
  const Icon =
    issue.ocorrencias === 0
      ? CheckCircle2
      : issue.severidade === 'crítico'
      ? XCircle
      : AlertTriangle;
  const color =
    issue.ocorrencias === 0
      ? 'text-emerald-400'
      : issue.severidade === 'crítico'
      ? 'text-red-400'
      : 'text-amber-300';

  return (
    <div className="p-4 rounded-xl bg-[#0D0B09] border border-amber-500/15 space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={`flex items-center gap-2 font-semibold ${color}`}>
          <Icon className="w-4 h-4 shrink-0" />
          <span>{issue.categoria}</span>
        </div>
        <span className="font-mono tabular-nums text-[#F4EFE6]">
          {formatNumber(issue.ocorrencias)} ocorrência(s)
        </span>
      </div>
      <p className="text-[#F4EFE6]">{issue.descricao}</p>
      <p className="text-[#B9AE9C]">
        <strong className="text-[#847866]">Impacto potencial:</strong> {issue.impactoPotencial}
      </p>
      {issue.exemplos.length > 0 && (
        <p className="text-[11px] font-mono text-amber-200/80 pt-1">
          Exemplos: {issue.exemplos.join(' · ')}
        </p>
      )}
    </div>
  );
};
