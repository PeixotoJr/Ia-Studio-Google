import React, { useMemo, useState } from 'react';
import {
  BrainCircuit,
  Send,
  Sparkles,
  AlertCircle,
  ArrowRightCircle,
  Loader2,
} from 'lucide-react';
import type {
  LoadedDataset,
  VendaRecord,
  GlobalFilters,
  AiExecutiveReport,
  AiRecommendationItem,
} from '../types/bi';
import { buildAiContextSummary } from '../services/biCalculations';

interface AiConsultantPageProps {
  dataset: LoadedDataset;
  filteredVendas: VendaRecord[];
  filters: GlobalFilters;
  aiReport: AiExecutiveReport | null;
  onAiReportGenerated: (report: AiExecutiveReport) => void;
  onConvertRecommendationToDecision: (rec: AiRecommendationItem) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const EXAMPLE_QUESTIONS = [
  'Qual categoria de cerveja apresenta maior rentabilidade?',
  'Qual unidade de negócio possui o melhor desempenho?',
  'O faturamento está crescendo?',
  'Quais produtos apresentam margem operacional negativa?',
  'Estamos atingindo nossas metas mensais?',
  'Quais canais de venda precisam de atenção?',
  'Como podemos melhorar o resultado operacional?',
  'Qual categoria deveria receber prioridade comercial?',
];

const FOCUS_AREAS = [
  'Diagnóstico Executivo Completo (Comercial, Rentabilidade, Custos, Produção, Metas e Recebíveis)',
  'Oportunidades de Crescimento e Prioridade Comercial por Canal/Categoria',
  'Produtos com Baixa Rentabilidade, Margem Negativa e Otimização de Custos/Produção',
  'Desvios em Relação às Metas e Análise de Recebíveis / Valores em Aberto',
];

export const AiConsultantPage: React.FC<AiConsultantPageProps> = ({
  dataset,
  filteredVendas,
  filters,
  aiReport,
  onAiReportGenerated,
  onConvertRecommendationToDecision,
}) => {
  const [focusArea, setFocusArea] = useState(FOCUS_AREAS[0]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const contextSummary = useMemo(
    () => buildAiContextSummary(dataset, filteredVendas, filters),
    [dataset, filteredVendas, filters],
  );

  const handleGenerateDiagnosis = async () => {
    setIsGeneratingReport(true);
    setReportError(null);
    try {
      const resp = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextSummary, focusArea }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Falha ao gerar diagnóstico com a IA.');
      }
      onAiReportGenerated(data as AiExecutiveReport);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Erro ao consultar serviço de IA.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleAskQuestion = async (qText?: string) => {
    const question = (qText ?? questionInput).trim();
    if (!question || isSendingChat) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: question,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!qText) setQuestionInput('');
    setIsSendingChat(true);
    setChatError(null);

    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          contextSummary,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Erro ao obter resposta da IA.');
      }
      setMessages([
        ...nextHistory,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Erro ao consultar o consultor IA.');
    } finally {
      setIsSendingChat(false);
    }
  };

  if (filteredVendas.length === 0) {
    return (
      <div className="p-8 rounded-xl bg-[#16120E] border border-amber-500/20 text-center text-sm text-[#B9AE9C]">
        Não há registros no recorte filtrado para fundamentar a análise da IA.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Diagnostic Generator */}
      <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
              <BrainCircuit className="w-4 h-4 shrink-0" />
              <span>Consultor Estratégico Galpão Bier (IA Fundamentada em Dados Reais)</span>
            </div>
            <p className="text-xs text-[#B9AE9C]">
              Analisa os {filteredVendas.length.toLocaleString('pt-BR')} registros do recorte ativo, diferenciando explicitamente fatos, hipóteses e recomendações com evidências quantitativas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              aria-label="Área de foco do diagnóstico"
              className="h-9 px-3 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs text-[#F4EFE6] max-w-xs"
            >
              {FOCUS_AREAS.map((fa) => (
                <option key={fa} value={fa}>
                  {fa}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleGenerateDiagnosis}
              disabled={isGeneratingReport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-[#0D0B09] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {isGeneratingReport ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{isGeneratingReport ? 'Analisando base...' : 'Gerar Diagnóstico Executivo'}</span>
            </button>
          </div>
        </div>

        {reportError && (
          <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{reportError}</span>
          </div>
        )}

        {aiReport && (
          <div className="space-y-5 pt-2 border-t border-amber-500/15">
            <div className="space-y-2">
              <p className="text-xs text-[#847866]">
                Escopo avaliado: <span className="text-[#F4EFE6] font-medium">{aiReport.periodoAnalisado}</span>
              </p>
              <p className="text-sm text-[#F4EFE6] leading-relaxed bg-[#0D0B09] p-4 rounded-xl border border-amber-500/15">
                {aiReport.sinteseExecutiva}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-[#0D0B09] border border-amber-500/15 space-y-2">
                <h4 className="font-semibold text-emerald-400">Fatos Quantitativos Observados</h4>
                <ul className="space-y-1.5 text-[#B9AE9C] list-disc pl-4">
                  {aiReport.fatosPrincipais.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-[#0D0B09] border border-amber-500/15 space-y-2">
                <h4 className="font-semibold text-amber-300">Hipóteses a Investigar & Limitações</h4>
                <ul className="space-y-1.5 text-[#B9AE9C] list-disc pl-4">
                  {aiReport.hipotesesInvestigacao.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
                {aiReport.limitacoesDados && (
                  <p className="text-[11px] text-[#847866] pt-2 border-t border-amber-500/10">
                    Limitações: {aiReport.limitacoesDados}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-display text-sm font-semibold text-[#F4EFE6]">
                Recomendações Estratégicas Priorizadas
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {aiReport.recomendacoes.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#0D0B09] border border-amber-500/20 flex flex-col justify-between space-y-3 text-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#847866] font-medium">{rec.categoriaEstrategica}</span>
                        <span
                          className={`font-semibold ${
                            rec.prioridade.toLowerCase().includes('alta')
                              ? 'text-red-400'
                              : rec.prioridade.toLowerCase().includes('média') || rec.prioridade.toLowerCase().includes('media')
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                          }`}
                        >
                          Prioridade: {rec.prioridade}
                        </span>
                      </div>
                      <h5 className="font-display text-sm font-semibold text-[#F4EFE6]">{rec.titulo}</h5>
                      <p className="text-[#B9AE9C]">
                        <strong className="text-[#F4EFE6]">Diagnóstico:</strong> {rec.diagnostico}
                      </p>
                      <p className="text-[#B9AE9C]">
                        <strong className="text-amber-300">Evidência quantitativa:</strong> {rec.evidenciaQuantitativa}
                      </p>
                      <p className="text-[#B9AE9C]">
                        <strong className="text-[#F4EFE6]">Impacto potencial:</strong> {rec.impactoPotencial}
                      </p>
                      <p className="text-[#B9AE9C]">
                        <strong className="text-emerald-400">Ação recomendada:</strong> {rec.acaoRecomendada}
                      </p>
                      <p className="text-[#847866]">
                        <strong className="text-[#B9AE9C]">Indicador para acompanhamento:</strong>{' '}
                        {rec.indicadorAcompanhamento}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-amber-500/10 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onConvertRecommendationToDecision(rec)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 cursor-pointer"
                      >
                        <ArrowRightCircle className="w-3.5 h-3.5" />
                        <span>Registrar como Decisão Gerencial</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Interactive Manager Q&A */}
      <section className="p-5 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-4">
        <div>
          <h3 className="font-display text-base font-semibold text-[#F4EFE6]">
            Perguntas ao Consultor de Gestão
          </h3>
          <p className="text-xs text-[#847866] mt-0.5">
            Consulte qualquer aspecto comercial, produtivo ou financeiro do recorte atual com base nos números reais da planilha.
          </p>
        </div>

        {/* Example prompt buttons */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleAskQuestion(q)}
              disabled={isSendingChat}
              className="px-3 py-1.5 rounded-lg bg-[#0D0B09] hover:bg-[#1E1813] border border-amber-500/20 text-xs text-[#B9AE9C] hover:text-[#F4EFE6] transition-colors text-left cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Conversation history */}
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`p-3.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-amber-500/10 border border-amber-500/25 text-[#F4EFE6] ml-8'
                  : 'bg-[#0D0B09] border border-amber-500/15 text-[#F4EFE6] mr-4'
              }`}
            >
              <span className="block text-[11px] font-semibold mb-1 text-amber-300">
                {m.role === 'user' ? 'Gestor Galpão Bier' : 'Consultor IA'}
              </span>
              {m.content}
            </div>
          ))}
          {isSendingChat && (
            <div className="p-3.5 rounded-xl bg-[#0D0B09] border border-amber-500/15 text-xs text-[#B9AE9C] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>Consultando indicadores reais e elaborando parecer...</span>
            </div>
          )}
        </div>

        {chatError && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{chatError}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskQuestion();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder="Faça uma pergunta gerencial sobre os dados da Galpão Bier..."
            className="flex-1 h-10 px-3.5 rounded-lg bg-[#0D0B09] border border-amber-500/20 text-xs sm:text-sm text-[#F4EFE6] placeholder:text-[#847866] focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={isSendingChat || !questionInput.trim()}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-[#0D0B09] font-semibold text-xs sm:text-sm transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Enviar</span>
          </button>
        </form>
      </section>
    </div>
  );
};
