import type {
  VendaRecord,
  MetaRecord,
  DecisaoRecord,
  QualidadeRecord,
  ValidationIssue,
} from '../types/bi';

export function validateDataset(
  vendas: VendaRecord[],
  metas: MetaRecord[],
  _decisoes: DecisaoRecord[],
  _qualidade: QualidadeRecord[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Duplicate IDs
  const idCounts = new Map<string, number>();
  const duplicateIds: string[] = [];
  let duplicateRows = 0;
  for (const v of vendas) {
    if (!v.id_registro) continue;
    const count = (idCounts.get(v.id_registro) || 0) + 1;
    idCounts.set(v.id_registro, count);
    if (count === 2) duplicateIds.push(v.id_registro);
    if (count > 1) duplicateRows++;
  }
  issues.push({
    id: 'dup-ids',
    categoria: 'Unicidade de Registros',
    descricao: 'Verificação de id_registro duplicados na aba Vendas.',
    ocorrencias: duplicateRows,
    severidade: duplicateRows > 0 ? 'crítico' : 'informativo',
    impactoPotencial:
      duplicateRows > 0
        ? 'Pode inflar faturamento, volume e contagem de pedidos se forem transações repetidas.'
        : 'Nenhum ID duplicado encontrado.',
    exemplos: duplicateIds.slice(0, 5),
  });

  // 2. Missing critical fields
  const missingExamples: string[] = [];
  let missingCount = 0;
  for (const v of vendas) {
    const missing: string[] = [];
    if (!v.id_registro) missing.push('id_registro');
    if (!v.unidade_negocio) missing.push('unidade_negocio');
    if (!v.categoria) missing.push('categoria');
    if (!v.produto) missing.push('produto');
    if (v.faturamento_bruto === null) missing.push('faturamento_bruto');
    if (v.volume_litros === null) missing.push('volume_litros');
    if (missing.length > 0) {
      missingCount++;
      if (missingExamples.length < 5) {
        missingExamples.push(`Linha ${v._rowIndex} (${v.id_registro || 'sem ID'}): ${missing.join(', ')}`);
      }
    }
  }
  issues.push({
    id: 'missing-fields',
    categoria: 'Completude de Campos',
    descricao: 'Registros com campos operacionais ou financeiros essenciais ausentes (nulos).',
    ocorrencias: missingCount,
    severidade: missingCount > 0 ? 'atenção' : 'informativo',
    impactoPotencial:
      missingCount > 0
        ? 'Registros incompletos permanecem preservados como nulos e reduzem a cobertura das segmentações.'
        : 'Todos os campos essenciais estão preenchidos.',
    exemplos: missingExamples,
  });

  // 3. Zero or negative unit prices
  const badPriceExamples: string[] = [];
  let badPriceCount = 0;
  for (const v of vendas) {
    if (v.preco_unitario !== null && v.preco_unitario <= 0) {
      badPriceCount++;
      if (badPriceExamples.length < 5) {
        badPriceExamples.push(`${v.id_registro || `Linha ${v._rowIndex}`}: R$ ${v.preco_unitario}`);
      }
    }
  }
  issues.push({
    id: 'invalid-prices',
    categoria: 'Validade de Preços',
    descricao: 'Preços unitários negativos ou iguais a zero (preco_unitario <= 0).',
    ocorrencias: badPriceCount,
    severidade: badPriceCount > 0 ? 'atenção' : 'informativo',
    impactoPotencial:
      badPriceCount > 0
        ? 'Bonificações, cortesias ou erros de digitação podem distorcer preço médio e margem por produto.'
        : 'Todos os preços unitários informados são positivos.',
    exemplos: badPriceExamples,
  });

  // 4. Satisfaction out of 0..10 (ignoring nulls!)
  const badSatExamples: string[] = [];
  let badSatCount = 0;
  let nullSatCount = 0;
  for (const v of vendas) {
    if (v.satisfacao_cliente_0a10 === null) {
      nullSatCount++;
    } else if (v.satisfacao_cliente_0a10 < 0 || v.satisfacao_cliente_0a10 > 10) {
      badSatCount++;
      if (badSatExamples.length < 5) {
        badSatExamples.push(`${v.id_registro || `Linha ${v._rowIndex}`}: nota ${v.satisfacao_cliente_0a10}`);
      }
    }
  }
  issues.push({
    id: 'satisfaction-range',
    categoria: 'Satisfação do Cliente',
    descricao: `Notas fora da faixa de 0 a 10 (${nullSatCount} registros sem nota preservados como nulos, não convertidos em zero).`,
    ocorrencias: badSatCount,
    severidade: badSatCount > 0 ? 'atenção' : 'informativo',
    impactoPotencial:
      badSatCount > 0
        ? 'Notas fora da escala comprometem a média de satisfação por canal e produto.'
        : 'Todas as avaliações preenchidas respeitam a escala de 0 a 10.',
    exemplos: badSatExamples,
  });

  // 5. Invalid dates
  const badDateExamples: string[] = [];
  let badDateCount = 0;
  for (const v of vendas) {
    if (!v.data_registro) {
      badDateCount++;
      if (badDateExamples.length < 5) {
        badDateExamples.push(`Linha ${v._rowIndex}: "${v.data_registro_raw || 'vazio'}"`);
      }
    }
  }
  issues.push({
    id: 'invalid-dates',
    categoria: 'Validade Temporal',
    descricao: 'Registros com data_registro ausente ou em formato inválido.',
    ocorrencias: badDateCount,
    severidade: badDateCount > 0 ? 'crítico' : 'informativo',
    impactoPotencial:
      badDateCount > 0
        ? 'Afeta séries temporais mensais, sazonalidade e projeções preditivas.'
        : 'Todas as datas de venda são válidas.',
    exemplos: badDateExamples,
  });

  // 6. Financial consistency: resultado_operacional_estimado vs (faturamento - custo - despesa) AND recebimento vs faturamento
  const finExamples: string[] = [];
  let finCount = 0;
  const TOLERANCE = 1.0; // R$ 1,00 rounding tolerance
  for (const v of vendas) {
    let hasInconsistency = false;
    const details: string[] = [];

    if (
      v.faturamento_bruto !== null &&
      v.custo_direto !== null &&
      v.despesa_operacional !== null &&
      v.resultado_operacional_estimado !== null
    ) {
      const calcResult = v.faturamento_bruto - v.custo_direto - v.despesa_operacional;
      if (Math.abs(calcResult - v.resultado_operacional_estimado) > TOLERANCE) {
        hasInconsistency = true;
        details.push(
          `Res.Op. informado ${v.resultado_operacional_estimado.toFixed(2)} ≠ calculado ${calcResult.toFixed(2)}`,
        );
      }
    }

    if (v.faturamento_bruto !== null && v.valor_recebido !== null && v.valor_em_aberto !== null) {
      const sumPay = v.valor_recebido + v.valor_em_aberto;
      if (Math.abs(sumPay - v.faturamento_bruto) > TOLERANCE) {
        hasInconsistency = true;
        details.push(`Recebido+Aberto (${sumPay.toFixed(2)}) ≠ Faturamento (${v.faturamento_bruto.toFixed(2)})`);
      }
    }

    if (hasInconsistency) {
      finCount++;
      if (finExamples.length < 5) {
        finExamples.push(`${v.id_registro || `Linha ${v._rowIndex}`}: ${details.join(' | ')}`);
      }
    }
  }
  issues.push({
    id: 'financial-consistency',
    categoria: 'Consistência Financeira',
    descricao: 'Divergências entre faturamento, custos/despesas, resultado operacional e soma recebido + em aberto (tolerância R$ 1,00).',
    ocorrencias: finCount,
    severidade: finCount > 0 ? 'atenção' : 'informativo',
    impactoPotencial:
      finCount > 0
        ? 'Pode indicar descontos não registrados, impostos embutidos ou lançamentos divergentes no ERP/planilha.'
        : 'Equações financeiras consistentes dentro da tolerância.',
    exemplos: finExamples,
  });

  // 7. Referential integrity between Vendas and Metas (periodo + unidade_negocio)
  const metaKeys = new Set(metas.map((m) => `${m.periodo}::${m.unidade_negocio.toLowerCase()}`));
  const orphanPairs = new Set<string>();
  let orphanSalesCount = 0;
  for (const v of vendas) {
    if (!v.periodo || !v.unidade_negocio) continue;
    const key = `${v.periodo}::${v.unidade_negocio.toLowerCase()}`;
    if (!metaKeys.has(key)) {
      orphanSalesCount++;
      orphanPairs.add(`${v.periodo} · ${v.unidade_negocio}`);
    }
  }
  issues.push({
    id: 'vendas-metas-integrity',
    categoria: 'Integridade Vendas ↔ Metas',
    descricao: 'Combinações de período e unidade de negócio presentes em Vendas sem meta correspondente na aba Metas.',
    ocorrencias: orphanPairs.size,
    severidade: orphanPairs.size > 0 ? 'atenção' : 'informativo',
    impactoPotencial:
      orphanPairs.size > 0
        ? `${orphanSalesCount} registros de venda pertencem a combinações período/unidade sem meta cadastrada (exibidos como N/A no atingimento).`
        : '100% das combinações período/unidade em Vendas possuem meta correspondente.',
    exemplos: Array.from(orphanPairs).slice(0, 6),
  });

  return issues;
}
