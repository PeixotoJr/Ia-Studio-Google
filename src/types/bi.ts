export type PageId =
  | 'dashboard'
  | 'kpis'
  | 'database'
  | 'performance'
  | 'predictive'
  | 'ai'
  | 'reports'
  | 'decisions'
  | 'quality';

export interface VendaRecord {
  _rowIndex: number;
  id_registro: string;
  data_registro: string | null; // ISO YYYY-MM-DD when valid
  data_registro_raw: string;
  ano: number | null;
  mes: number | null;
  periodo: string; // e.g., YYYY-MM
  unidade_negocio: string;
  categoria: string;
  produto: string;
  lote: string;
  quantidade_unidades: number | null;
  volume_litros: number | null;
  preco_unitario: number | null;
  faturamento_bruto: number | null;
  custo_direto: number | null;
  despesa_operacional: number | null;
  resultado_operacional_estimado: number | null;
  forma_pagamento: string;
  status_pagamento: string;
  valor_recebido: number | null;
  valor_em_aberto: number | null;
  satisfacao_cliente_0a10: number | null;
  estoque_unidades_antes: number | null;
  estoque_unidades_depois: number | null;
  origem_dados: string;
  observacao_qual: string;
}

export interface MetaRecord {
  _rowIndex: number;
  periodo: string;
  unidade_negocio: string;
  meta_faturamento: number | null;
  meta_volume_litros: number | null;
  meta_margem_operacional_pct: number | null;
  meta_perdas_producao_pct: number | null;
  origem_meta: string;
}

export type DecisionStatus = 'Planejada' | 'Em andamento' | 'Concluída' | 'Cancelada';
export type DecisionPriority = 'Alta' | 'Média' | 'Baixa';

export interface DecisaoHistoryEntry {
  timestamp: string;
  action: string;
  details: string;
}

export interface DecisaoRecord {
  id_decisao: string;
  tema: string;
  analise_necessaria: string;
  decisao_possivel: string;
  responsavel: string;
  periodicidade: string;
  indicador_associado: string;
  status: DecisionStatus;
  prioridade: DecisionPriority;
  data_decisao: string;
  justificativa: string;
  origem_registro: 'Planilha Original' | 'Novo Registro';
  updated_at: string;
  historico: DecisaoHistoryEntry[];
}

export interface QualidadeRecord {
  _rowIndex: number;
  verificacao: string;
  resultado: string;
  status: string;
}

export type ValidationSeverity = 'crítico' | 'atenção' | 'informativo';

export interface ValidationIssue {
  id: string;
  categoria: string;
  descricao: string;
  ocorrencias: number;
  severidade: ValidationSeverity;
  impactoPotencial: string;
  exemplos: string[];
}

export interface DatasetMetadata {
  fileName: string;
  loadedAt: string;
  vendasCount: number;
  metasCount: number;
  decisoesCount: number;
  qualidadeCount: number;
  minPeriodo: string | null;
  maxPeriodo: string | null;
  minDate: string | null;
  maxDate: string | null;
  validationStatus: 'Íntegro' | 'Com Ressalvas' | 'Inconsistências Críticas';
  sheetNamesFound: string[];
  missingSheets: string[];
  warnings: string[];
}

export interface LoadedDataset {
  metadata: DatasetMetadata;
  vendas: VendaRecord[];
  metas: MetaRecord[];
  decisoes: DecisaoRecord[];
  qualidade: QualidadeRecord[];
  validationIssues: ValidationIssue[];
}

export interface GlobalFilters {
  periodo: string; // 'ALL' or specific period
  periodoInicio: string; // 'ALL' or YYYY-MM
  periodoFim: string; // 'ALL' or YYYY-MM
  ano: string; // 'ALL' or '2025' etc.
  mes: string; // 'ALL' or '1'..'12'
  unidade_negocio: string;
  categoria: string;
  produto: string;
  forma_pagamento: string;
  status_pagamento: string;
}

export interface ExecutiveKpis {
  registrosCount: number;
  faturamentoBruto: number;
  resultadoOperacional: number;
  margemOperacionalPct: number | null;
  margemContribuicaoPct: number | null;
  volumeLitros: number;
  quantidadeUnidades: number;
  ticketMedioPorRegistro: number | null;
  custoDiretoTotal: number;
  despesasOperacionaisTotal: number;
  custoPorLitro: number | null;
  valoresRecebidos: number;
  valoresEmAberto: number;
  percentualRecebimentoPct: number | null;
  percentualEmAbertoPct: number | null;
  satisfacaoMedia: number | null;
  satisfacaoCount: number;
  metaFaturamentoTotal: number | null;
  metaVolumeTotal: number | null;
  atingimentoMetaFaturamentoPct: number | null;
  atingimentoMetaVolumePct: number | null;
}

export interface MonthlySeriesPoint {
  periodo: string;
  label: string;
  registros: number;
  semRegistros: boolean;
  faturamentoBruto: number;
  resultadoOperacional: number;
  custoDireto: number;
  despesaOperacional: number;
  volumeLitros: number;
  quantidadeUnidades: number;
  valorRecebido: number;
  valorEmAberto: number;
  custoPorLitro: number | null;
  precoMedioPorLitro: number | null;
  margemOperacionalPct: number | null;
  margemContribuicaoPct: number | null;
  satisfacaoMedia: number | null;
  satisfacaoCount: number;
  estoqueMedioAntes: number | null;
  estoqueMedioDepois: number | null;
  metaFaturamento: number | null;
  metaVolumeLitros: number | null;
  crescimentoFaturamentoMoMPct: number | null;
}

export interface SegmentMetric {
  nome: string;
  registros: number;
  faturamentoBruto: number;
  custoDireto: number;
  despesaOperacional: number;
  resultadoOperacional: number;
  margemOperacionalPct: number | null;
  margemContribuicaoPct: number | null;
  volumeLitros: number;
  quantidadeUnidades: number;
  ticketMedio: number | null;
  participacaoFaturamentoPct: number | null;
  valorRecebido: number;
  valorEmAberto: number;
  percentualRecebimentoPct: number | null;
  satisfacaoMedia: number | null;
}

export interface MetaComparisonRow {
  periodo: string;
  unidade_negocio: string;
  faturamentoRealizado: number;
  metaFaturamento: number | null;
  atingimentoFaturamentoPct: number | null;
  diferencaFaturamento: number | null;
  volumeRealizado: number;
  metaVolumeLitros: number | null;
  atingimentoVolumePct: number | null;
  diferencaVolume: number | null;
  margemRealizadaPct: number | null;
  metaMargemPct: number | null;
  status: 'Satisfatório' | 'Atenção' | 'Abaixo do esperado' | 'Sem meta';
}

export interface AiRecommendationItem {
  titulo: string;
  diagnostico: string;
  evidenciaQuantitativa: string;
  impactoPotencial: string;
  acaoRecomendada: string;
  prioridade: string;
  indicadorAcompanhamento: string;
  categoriaEstrategica: string;
}

export interface AiExecutiveReport {
  periodoAnalisado: string;
  sinteseExecutiva: string;
  fatosPrincipais: string[];
  hipotesesInvestigacao: string[];
  limitacoesDados: string;
  recomendacoes: AiRecommendationItem[];
}

export type ComparisonMode = 'mom' | 'yoy' | 'equal_duration';
export type KpiPolarity = 'higher_is_better' | 'lower_is_better' | 'neutral';
export type KpiSignalStatus = 'favorable' | 'attention' | 'unfavorable' | 'insufficient';

export interface KpiCardMetric {
  id: string;
  group: 'financeiro' | 'comercial' | 'producao' | 'satisfacao' | 'metas';
  name: string;
  currentValue: number | null;
  formattedValue: string;
  unitLabel: string;
  previousValue: number | null;
  formattedPreviousValue: string;
  deltaAbs: number | null;
  formattedDeltaAbs: string;
  deltaPct: number | null;
  metaValue: number | null;
  formattedMetaValue: string;
  attainmentPct: number | null;
  polarity: KpiPolarity;
  status: KpiSignalStatus;
  statusText: string;
  note?: string;
  sparkline: Array<{ label: string; value: number | null }>;
}

export interface KpiDiagnosticItem {
  id: string;
  indicadorAnalisado: string;
  valorObservado: string;
  comparacaoReferencia: string;
  interpretacao: string;
  recomendacaoAcao: string;
  status: KpiSignalStatus;
}

