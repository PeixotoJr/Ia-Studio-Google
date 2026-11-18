import { useMemo, useState } from 'react';
import type {
  AiExecutiveReport,
  AiRecommendationItem,
  DecisaoRecord,
  DecisionPriority,
  GlobalFilters,
  LoadedDataset,
  PageId,
} from './types/bi';
import { parseExcelFile } from './services/excelLoader';
import {
  INITIAL_FILTERS,
  computeKpis,
  extractFilterOptions,
  filterVendas,
} from './services/biCalculations';
import { Layout } from './components/Layout';
import { GlobalFilterBar } from './components/GlobalFilterBar';
import { ExcelEmptyState } from './components/ExcelEmptyState';
import { DashboardExecutivePage } from './pages/DashboardExecutivePage';
import { KpiIndicatorsPage } from './pages/KpiIndicatorsPage';
import { DatabasePage } from './pages/DatabasePage';
import { PerformanceAnalysisPage } from './pages/PerformanceAnalysisPage';
import { PredictiveAnalysisPage } from './pages/PredictiveAnalysisPage';
import { AiConsultantPage } from './pages/AiConsultantPage';
import { ReportsPage } from './pages/ReportsPage';
import { DecisionsPage } from './pages/DecisionsPage';
import { QualityPage } from './pages/QualityPage';

const PAGES_WITH_GLOBAL_FILTERS: PageId[] = [
  'dashboard',
  'kpis',
  'performance',
  'predictive',
  'ai',
  'reports',
];

export default function App() {
  const [dataset, setDataset] = useState<LoadedDataset | null>(null);
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [filters, setFilters] = useState<GlobalFilters>(INITIAL_FILTERS);
  const [aiReport, setAiReport] = useState<AiExecutiveReport | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const handleFileSelected = async (file: File) => {
    setIsLoadingFile(true);
    setLoadError(null);
    setStatusNotice(null);
    try {
      const parsed = await parseExcelFile(file);
      setDataset(parsed);
      setFilters(INITIAL_FILTERS);
      setAiReport(null);
      setActivePage('dashboard');
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Erro desconhecido ao processar a planilha Excel.',
      );
    } finally {
      setIsLoadingFile(false);
    }
  };

  const filterOptions = useMemo(
    () => (dataset ? extractFilterOptions(dataset.vendas) : null),
    [dataset],
  );

  const filteredVendas = useMemo(
    () => (dataset ? filterVendas(dataset.vendas, filters) : []),
    [dataset, filters],
  );

  const currentKpis = useMemo(
    () => (dataset ? computeKpis(filteredVendas, dataset.metas, filters) : null),
    [dataset, filteredVendas, filters],
  );

  const handleSaveDecision = (updatedDecision: DecisaoRecord, isNew: boolean) => {
    setDataset((prev) => {
      if (!prev) return prev;
      const nextDecisoes = isNew
        ? [updatedDecision, ...prev.decisoes]
        : prev.decisoes.map((d) =>
            d.id_decisao === updatedDecision.id_decisao ? updatedDecision : d,
          );
      return {
        ...prev,
        decisoes: nextDecisoes,
        metadata: {
          ...prev.metadata,
          decisoesCount: nextDecisoes.length,
        },
      };
    });
  };

  const handleConvertRecommendationToDecision = (rec: AiRecommendationItem) => {
    if (!dataset) return;
    const now = new Date().toISOString();
    const prioNorm: DecisionPriority = rec.prioridade.toLowerCase().includes('alta')
      ? 'Alta'
      : rec.prioridade.toLowerCase().includes('baixa')
      ? 'Baixa'
      : 'Média';

    const newDec: DecisaoRecord = {
      id_decisao: `DEC-IA-${String(dataset.decisoes.length + 1).padStart(3, '0')}`,
      tema: `${rec.categoriaEstrategica}: ${rec.titulo}`,
      analise_necessaria: rec.diagnostico,
      decisao_possivel: rec.acaoRecomendada,
      responsavel: 'Gestão Galpão Bier',
      periodicidade: 'Mensal',
      indicador_associado: rec.indicadorAcompanhamento,
      status: 'Planejada',
      prioridade: prioNorm,
      data_decisao: now.slice(0, 10),
      justificativa: `Evidência quantitativa: ${rec.evidenciaQuantitativa} | Impacto potencial: ${rec.impactoPotencial}`,
      origem_registro: 'Novo Registro',
      updated_at: now,
      historico: [
        {
          timestamp: now,
          action: 'Originada da Consultoria IA',
          details: `Recomendação convertida em decisão gerencial (${prioNorm}).`,
        },
      ],
    };

    handleSaveDecision(newDec, true);
    setStatusNotice(`Decisão ${newDec.id_decisao} registrada em Decisões Gerenciais.`);
    setActivePage('decisions');
  };

  return (
    <Layout
      activePage={activePage}
      onSelectPage={(page) => {
        setStatusNotice(null);
        setActivePage(page);
      }}
      metadata={dataset?.metadata ?? null}
      isLoadingFile={isLoadingFile}
      loadError={dataset ? loadError : null}
      onFileSelected={handleFileSelected}
    >
      {!dataset ? (
        <ExcelEmptyState
          onFileSelected={handleFileSelected}
          isLoading={isLoadingFile}
          error={loadError}
        />
      ) : (
        <>
          {statusNotice && (
            <div className="mb-4 px-4 py-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-200 flex items-center justify-between gap-2">
              <span>{statusNotice}</span>
              <button
                type="button"
                onClick={() => setStatusNotice(null)}
                className="text-emerald-300 hover:underline cursor-pointer"
              >
                Dispensar
              </button>
            </div>
          )}

          {PAGES_WITH_GLOBAL_FILTERS.includes(activePage) && filterOptions && (
            <GlobalFilterBar
              filters={filters}
              options={filterOptions}
              onChange={(next) => {
                setFilters(next);
                setAiReport(null);
              }}
              onReset={() => {
                setFilters(INITIAL_FILTERS);
                setAiReport(null);
              }}
              totalCount={dataset.vendas.length}
              filteredCount={filteredVendas.length}
            />
          )}

          {activePage === 'dashboard' && (
            <DashboardExecutivePage
              dataset={dataset}
              filteredVendas={filteredVendas}
              filters={filters}
            />
          )}

          {activePage === 'kpis' && (
            <KpiIndicatorsPage dataset={dataset} filters={filters} />
          )}

          {activePage === 'database' && <DatabasePage vendas={dataset.vendas} />}

          {activePage === 'performance' && (
            <PerformanceAnalysisPage
              dataset={dataset}
              filteredVendas={filteredVendas}
              filters={filters}
            />
          )}

          {activePage === 'predictive' && (
            <PredictiveAnalysisPage
              dataset={dataset}
              filteredVendas={filteredVendas}
              filters={filters}
              onCreateDecision={(dec) => {
                handleSaveDecision(dec, true);
                setStatusNotice(`Decisão ${dec.id_decisao} registrada em Decisões Gerenciais.`);
                setActivePage('decisions');
              }}
            />
          )}

          {activePage === 'ai' && (
            <AiConsultantPage
              dataset={dataset}
              filteredVendas={filteredVendas}
              filters={filters}
              aiReport={aiReport}
              onAiReportGenerated={setAiReport}
              onConvertRecommendationToDecision={handleConvertRecommendationToDecision}
            />
          )}

          {activePage === 'reports' && (
            <ReportsPage
              dataset={dataset}
              filteredVendas={filteredVendas}
              filters={filters}
              aiReport={aiReport}
            />
          )}

          {activePage === 'decisions' && currentKpis && (
            <DecisionsPage
              decisoes={dataset.decisoes}
              onSaveDecision={handleSaveDecision}
              currentKpis={currentKpis}
            />
          )}

          {activePage === 'quality' && <QualityPage dataset={dataset} />}
        </>
      )}
    </Layout>
  );
}
