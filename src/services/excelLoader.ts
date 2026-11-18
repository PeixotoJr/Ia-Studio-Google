import * as XLSX from 'xlsx';
import type {
  LoadedDataset,
  VendaRecord,
  MetaRecord,
  DecisaoRecord,
  QualidadeRecord,
  DatasetMetadata,
} from '../types/bi';
import { validateDataset } from './dataValidator';

const REQUIRED_VENDAS_COLS = [
  'id_registro',
  'data_registro',
  'ano',
  'mes',
  'periodo',
  'unidade_negocio',
  'categoria',
  'produto',
  'quantidade_unidades',
  'volume_litros',
  'preco_unitario',
  'faturamento_bruto',
  'custo_direto',
  'despesa_operacional',
  'resultado_operacional_estimado',
  'forma_pagamento',
  'status_pagamento',
  'valor_recebido',
  'valor_em_aberto',
];

const REQUIRED_METAS_COLS = [
  'periodo',
  'unidade_negocio',
  'meta_faturamento',
  'meta_volume_litros',
];

const REQUIRED_DECISOES_COLS = [
  'id_decisao',
  'tema',
  'analise_necessaria',
  'decisao_possivel',
  'responsavel',
  'periodicidade',
  'indicador_associado',
];

const REQUIRED_QUALIDADE_COLS = ['verificacao', 'resultado', 'status'];

function normalizeKey(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function findSheetName(sheetNames: string[], targetNormalized: string): string | undefined {
  return sheetNames.find((name) => normalizeKey(name) === targetNormalized);
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = v;
  }
  return out;
}

function toCleanString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return '';
    return val.toISOString().slice(0, 10);
  }
  return String(val).trim();
}

function toNullableNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  const str = String(val).trim();
  if (str === '' || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'na' || str.toLowerCase() === 'n/a') {
    return null;
  }

  // Handle Brazilian formatting like "R$ 1.234,56" or "12,5%" vs standard "1234.56"
  let cleaned = str.replace(/R\$/gi, '').replace(/%/g, '').replace(/\s+/g, '');
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // 1.234,56 -> 1234.56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 -> 1234.56
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    cleaned = cleaned.replace(',', '.');
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseExcelDate(val: unknown): { iso: string | null; raw: string } {
  if (val === null || val === undefined || val === '') {
    return { iso: null, raw: '' };
  }

  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) {
      return { iso: null, raw: String(val) };
    }
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    if (y < 1990 || y > 2100) {
      return { iso: null, raw: `${d}/${m}/${y}` };
    }
    return { iso: `${y}-${m}-${d}`, raw: `${y}-${m}-${d}` };
  }

  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y >= 1990 && parsed.y <= 2100) {
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      const iso = `${parsed.y}-${m}-${d}`;
      return { iso, raw: String(val) };
    }
    return { iso: null, raw: String(val) };
  }

  const raw = String(val).trim();
  if (!raw) return { iso: null, raw: '' };

  // YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return {
        iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        raw,
      };
    }
    return { iso: null, raw };
  }

  // DD/MM/YYYY
  const brMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (brMatch) {
    const d = Number(brMatch[1]);
    const m = Number(brMatch[2]);
    let y = Number(brMatch[3]);
    if (y < 100) y += 2000;
    if (isValidCalendarDate(y, m, d)) {
      return {
        iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        raw,
      };
    }
    return { iso: null, raw };
  }

  return { iso: null, raw };
}

function isValidCalendarDate(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function normalizePeriodo(periodoRaw: string, ano: number | null, mes: number | null, dateIso: string | null): string {
  const trimmed = periodoRaw.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}\/\d{2}$/.test(trimmed)) return trimmed.replace('/', '-');
  if (/^\d{2}\/\d{4}$/.test(trimmed)) {
    const [mm, yyyy] = trimmed.split('/');
    return `${yyyy}-${mm}`;
  }
  if (ano && mes && mes >= 1 && mes <= 12) {
    return `${ano}-${String(mes).padStart(2, '0')}`;
  }
  if (dateIso) {
    return dateIso.slice(0, 7);
  }
  return trimmed;
}

function checkColumns(rows: Record<string, unknown>[], requiredCols: string[], sheetLabel: string): string[] {
  if (rows.length === 0) return [];
  const presentKeys = new Set<string>();
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    Object.keys(rows[i]).forEach((k) => presentKeys.add(k));
  }
  return requiredCols.filter((col) => !presentKeys.has(col)).map((col) => `Coluna obrigatória "${col}" ausente na aba "${sheetLabel}".`);
}

export async function parseExcelFile(file: File): Promise<LoadedDataset> {
  const buffer = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch (err) {
    throw new Error(
      `Não foi possível ler o arquivo "${file.name}". Verifique se o arquivo é um Excel (.xlsx) válido e não está corrompido. Detalhe: ${
        err instanceof Error ? err.message : 'erro desconhecido'
      }`,
    );
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error(`O arquivo "${file.name}" não contém nenhuma aba.`);
  }

  const vendasSheetName = findSheetName(workbook.SheetNames, 'vendas');
  const metasSheetName = findSheetName(workbook.SheetNames, 'metas');
  const decisoesSheetName = findSheetName(workbook.SheetNames, 'decisoes');
  const qualidadeSheetName = findSheetName(workbook.SheetNames, 'qualidade');

  const missingSheets: string[] = [];
  if (!vendasSheetName) missingSheets.push('Vendas');
  if (!metasSheetName) missingSheets.push('Metas');
  if (!decisoesSheetName) missingSheets.push('Decisões');
  if (!qualidadeSheetName) missingSheets.push('Qualidade');

  if (missingSheets.length > 0) {
    throw new Error(
      `Abas obrigatórias ausentes no arquivo "${file.name}": ${missingSheets.join(', ')}. Abas encontradas: ${workbook.SheetNames.join(', ')}.`,
    );
  }

  const readSheet = (name: string): Record<string, unknown>[] => {
    const sheet = workbook.Sheets[name];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    });
    return rawRows.map(normalizeRowKeys);
  };

  const rawVendas = readSheet(vendasSheetName!);
  const rawMetas = readSheet(metasSheetName!);
  const rawDecisoes = readSheet(decisoesSheetName!);
  const rawQualidade = readSheet(qualidadeSheetName!);

  const warnings: string[] = [
    ...checkColumns(rawVendas, REQUIRED_VENDAS_COLS, vendasSheetName!),
    ...checkColumns(rawMetas, REQUIRED_METAS_COLS, metasSheetName!),
    ...checkColumns(rawDecisoes, REQUIRED_DECISOES_COLS, decisoesSheetName!),
    ...checkColumns(rawQualidade, REQUIRED_QUALIDADE_COLS, qualidadeSheetName!),
  ];

  if (rawVendas.length === 0) {
    throw new Error(`A aba "${vendasSheetName}" está vazia. Não é possível gerar indicadores sem registros de vendas.`);
  }

  const criticalColumnMissing = warnings.some((w) => w.includes(`aba "${vendasSheetName}"`));
  if (criticalColumnMissing && rawVendas.length > 0) {
    const missingList = warnings.filter((w) => w.includes(`aba "${vendasSheetName}"`)).join(' ');
    throw new Error(`Estrutura incompatível na aba Vendas: ${missingList}`);
  }

  const vendas: VendaRecord[] = rawVendas.map((r, idx) => {
    const parsedDate = parseExcelDate(r.data_registro);
    const ano = toNullableNumber(r.ano) ?? (parsedDate.iso ? Number(parsedDate.iso.slice(0, 4)) : null);
    const mes = toNullableNumber(r.mes) ?? (parsedDate.iso ? Number(parsedDate.iso.slice(5, 7)) : null);
    const periodo = normalizePeriodo(toCleanString(r.periodo), ano, mes, parsedDate.iso);

    return {
      _rowIndex: idx + 2,
      id_registro: toCleanString(r.id_registro),
      data_registro: parsedDate.iso,
      data_registro_raw: parsedDate.raw,
      ano,
      mes,
      periodo,
      unidade_negocio: toCleanString(r.unidade_negocio),
      categoria: toCleanString(r.categoria),
      produto: toCleanString(r.produto),
      lote: toCleanString(r.lote),
      quantidade_unidades: toNullableNumber(r.quantidade_unidades),
      volume_litros: toNullableNumber(r.volume_litros),
      preco_unitario: toNullableNumber(r.preco_unitario),
      faturamento_bruto: toNullableNumber(r.faturamento_bruto),
      custo_direto: toNullableNumber(r.custo_direto),
      despesa_operacional: toNullableNumber(r.despesa_operacional),
      resultado_operacional_estimado: toNullableNumber(r.resultado_operacional_estimado),
      forma_pagamento: toCleanString(r.forma_pagamento),
      status_pagamento: toCleanString(r.status_pagamento),
      valor_recebido: toNullableNumber(r.valor_recebido),
      valor_em_aberto: toNullableNumber(r.valor_em_aberto),
      satisfacao_cliente_0a10: toNullableNumber(r.satisfacao_cliente_0a10),
      estoque_unidades_antes: toNullableNumber(r.estoque_unidades_antes),
      estoque_unidades_depois: toNullableNumber(r.estoque_unidades_depois),
      origem_dados: toCleanString(r.origem_dados),
      observacao_qual: toCleanString(r.observacao_qual),
    };
  });

  const metas: MetaRecord[] = rawMetas.map((r, idx) => ({
    _rowIndex: idx + 2,
    periodo: normalizePeriodo(toCleanString(r.periodo), null, null, null),
    unidade_negocio: toCleanString(r.unidade_negocio),
    meta_faturamento: toNullableNumber(r.meta_faturamento),
    meta_volume_litros: toNullableNumber(r.meta_volume_litros),
    meta_margem_operacional_pct: toNullableNumber(r.meta_margem_operacional_pct),
    meta_perdas_producao_pct: toNullableNumber(r.meta_perdas_producao_pct),
    origem_meta: toCleanString(r.origem_meta),
  }));

  const nowIso = new Date().toISOString();
  const decisoes: DecisaoRecord[] = rawDecisoes.map((r, idx) => {
    const statusRaw = toCleanString(r.status);
    const validStatuses = ['Planejada', 'Em andamento', 'Concluída', 'Cancelada'];
    const status = (validStatuses.includes(statusRaw) ? statusRaw : 'Planejada') as DecisaoRecord['status'];
    const prioRaw = toCleanString(r.prioridade);
    const validPrio = ['Alta', 'Média', 'Baixa'];
    const prioridade = (validPrio.includes(prioRaw) ? prioRaw : 'Média') as DecisaoRecord['prioridade'];

    return {
      id_decisao: toCleanString(r.id_decisao) || `DEC-${idx + 1}`,
      tema: toCleanString(r.tema),
      analise_necessaria: toCleanString(r.analise_necessaria),
      decisao_possivel: toCleanString(r.decisao_possivel),
      responsavel: toCleanString(r.responsavel),
      periodicidade: toCleanString(r.periodicidade),
      indicador_associado: toCleanString(r.indicador_associado),
      status,
      prioridade,
      data_decisao: parseExcelDate(r.data_decisao).iso || '',
      justificativa: toCleanString(r.justificativa),
      origem_registro: 'Planilha Original',
      updated_at: nowIso,
      historico: [
        {
          timestamp: nowIso,
          action: 'Importação inicial',
          details: `Registro carregado da aba "${decisoesSheetName}" do arquivo ${file.name}.`,
        },
      ],
    };
  });

  const qualidade: QualidadeRecord[] = rawQualidade.map((r, idx) => ({
    _rowIndex: idx + 2,
    verificacao: toCleanString(r.verificacao),
    resultado: toCleanString(r.resultado),
    status: toCleanString(r.status),
  }));

  const validationIssues = validateDataset(vendas, metas, decisoes, qualidade);
  const hasCritical = validationIssues.some((i) => i.severidade === 'crítico' && i.ocorrencias > 0);
  const hasWarning = validationIssues.some((i) => i.severidade === 'atenção' && i.ocorrencias > 0) || warnings.length > 0;

  const periodos = vendas
    .map((v) => v.periodo)
    .filter((p) => /^\d{4}-\d{2}$/.test(p))
    .sort();
  const validDates = vendas
    .map((v) => v.data_registro)
    .filter((d): d is string => Boolean(d))
    .sort();

  const metadata: DatasetMetadata = {
    fileName: file.name,
    loadedAt: nowIso,
    vendasCount: vendas.length,
    metasCount: metas.length,
    decisoesCount: decisoes.length,
    qualidadeCount: qualidade.length,
    minPeriodo: periodos[0] ?? null,
    maxPeriodo: periodos[periodos.length - 1] ?? null,
    minDate: validDates[0] ?? null,
    maxDate: validDates[validDates.length - 1] ?? null,
    validationStatus: hasCritical ? 'Inconsistências Críticas' : hasWarning ? 'Com Ressalvas' : 'Íntegro',
    sheetNamesFound: workbook.SheetNames,
    missingSheets,
    warnings,
  };

  return {
    metadata,
    vendas,
    metas,
    decisoes,
    qualidade,
    validationIssues,
  };
}

export function exportDecisoesToExcel(decisoes: DecisaoRecord[], baseFileName = 'Galpao_Bier_Decisoes_Atualizadas.xlsx'): void {
  const rows = decisoes.map((d) => ({
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
    ultima_atualizacao: d.updated_at,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Decisões');
  XLSX.writeFile(workbook, baseFileName);
}

export function exportObjectsToCsv(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(';'),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(';')),
  ];

  // UTF-8 BOM so Excel PT-BR opens accents and semicolons properly
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
