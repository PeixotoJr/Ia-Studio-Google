import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function createAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildConsultantSystemInstruction(): string {
  return [
    'Você é um consultor sênior especializado em gestão de microcervejarias artesanais, análise financeira, planejamento produtivo e estratégia comercial da Galpão Bier.',
    'Responda sempre em Português do Brasil com linguagem executiva, clara, objetiva e fundamentada.',
    '',
    'REGRAS INVIOLÁVEIS DE RIGOR ANALÍTICO:',
    '1. Utilize EXCLUSIVAMENTE os números e fatos presentes no contexto quantitativo real da planilha Excel fornecido na requisição.',
    '2. Apresente sempre os valores exatos (em R$, litros, %, quantidades) que fundamentam cada diagnóstico e recomendação.',
    '3. Identifique explicitamente o período analisado e os filtros/segmentos ativos.',
    '4. NUNCA crie indicadores inexistentes ou invente números que não constem nos dados fornecidos.',
    '5. NUNCA afirme causalidade sem evidências; diferencie explicitamente FATOS (observados nos dados), HIPÓTESES (explicações plausíveis a investigar) e RECOMENDAÇÕES (ações sugeridas).',
    '6. Se os dados fornecidos forem insuficientes para responder algum ponto, declare isso abertamente sem preencher lacunas com suposições.',
    '7. Lembre-se da distinção técnica: Margem de Contribuição = (Faturamento Bruto - Custo Direto) / Faturamento Bruto; Margem Operacional = Resultado Operacional Estimado / Faturamento Bruto. Não confunda faturamento com valor recebido ou valor em aberto.',
  ].join('\n');
}

function formatGeminiError(error: unknown): { status: number; message: string } {
  const errObj = error as { status?: number; message?: string };
  const msg = errObj?.message || 'Erro desconhecido ao consultar o serviço de IA.';
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'Chave de API inválida ou sem permissão. Verifique a variável GEMINI_API_KEY no painel Settings > Secrets.',
    };
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Limite de requisições da API Gemini atingido no momento. Aguarde alguns instantes e tente novamente.',
    };
  }
  if (msg.includes('404') || msg.includes('NOT_FOUND')) {
    return {
      status: 404,
      message: 'Modelo de IA não encontrado ou indisponível. Verifique a configuração do modelo no servidor.',
    };
  }
  return { status: 500, message: msg };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'galpao-bier-intelligence' });
  });

  app.post('/api/ai/recommendations', async (req: Request, res: Response) => {
    const ai = createAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Chave GEMINI_API_KEY não configurada no servidor. Configure-a em Settings > Secrets para ativar a consultoria por IA.',
      });
      return;
    }

    const { contextSummary, focusArea } = req.body as {
      contextSummary?: string;
      focusArea?: string;
    };

    if (!contextSummary) {
      res.status(400).json({ error: 'Contexto analítico dos dados não informado.' });
      return;
    }

    try {
      const prompt = [
        `Área de foco solicitada: ${focusArea || 'Diagnóstico Executivo Completo (Comercial, Rentabilidade, Custos, Produção, Metas e Recebíveis)'}.`,
        '',
        'Abaixo estão os dados reais consolidados da planilha Excel da Galpão Bier:',
        contextSummary,
        '',
        'Gere um diagnóstico executivo estruturado e 6 recomendações estratégicas prioritárias fundamentadas exclusivamente nesses dados.',
        'Cada recomendação deve separar claramente fatos, hipóteses e recomendações e preencher todos os campos do esquema JSON.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: buildConsultantSystemInstruction(),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              periodoAnalisado: {
                type: Type.STRING,
                description: 'Período e filtros analisados conforme os dados.',
              },
              sinteseExecutiva: {
                type: Type.STRING,
                description: 'Resumo executivo respondendo se a Galpão Bier está produzindo e comercializando os produtos certos nos canais adequados com rentabilidade sustentável.',
              },
              fatosPrincipais: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Lista de 4 a 6 fatos quantitativos diretamente observados nos dados.',
              },
              hipotesesInvestigacao: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Lista de 2 a 4 hipóteses gerenciais a investigar sem afirmar causalidade.',
              },
              limitacoesDados: {
                type: Type.STRING,
                description: 'Observações sobre lacunas, campos ausentes ou limitações amostrais identificadas.',
              },
              recomendacoes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    titulo: { type: Type.STRING },
                    diagnostico: { type: Type.STRING },
                    evidenciaQuantitativa: { type: Type.STRING },
                    impactoPotencial: { type: Type.STRING },
                    acaoRecomendada: { type: Type.STRING },
                    prioridade: { type: Type.STRING, description: 'Alta, Média ou Baixa' },
                    indicadorAcompanhamento: { type: Type.STRING },
                    categoriaEstrategica: {
                      type: Type.STRING,
                      description: 'Rentabilidade, Comercial, Custos, Produção, Metas ou Financeiro',
                    },
                  },
                  required: [
                    'titulo',
                    'diagnostico',
                    'evidenciaQuantitativa',
                    'impactoPotencial',
                    'acaoRecomendada',
                    'prioridade',
                    'indicadorAcompanhamento',
                    'categoriaEstrategica',
                  ],
                },
              },
            },
            required: [
              'periodoAnalisado',
              'sinteseExecutiva',
              'fatosPrincipais',
              'hipotesesInvestigacao',
              'limitacoesDados',
              'recomendacoes',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    const ai = createAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Chave GEMINI_API_KEY não configurada no servidor. Configure-a em Settings > Secrets para ativar a consultoria por IA.',
      });
      return;
    }

    const { question, contextSummary, history } = req.body as {
      question?: string;
      contextSummary?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!question || !contextSummary) {
      res.status(400).json({ error: 'Pergunta ou contexto dos dados não informado.' });
      return;
    }

    try {
      const historyBlock = (history || [])
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'Gestor' : 'Consultor IA'}: ${m.content}`)
        .join('\n');

      const prompt = [
        'CONTEXTO QUANTITATIVO REAL DA PLANILHA GALPÃO BIER:',
        contextSummary,
        '',
        historyBlock ? `HISTÓRICO RECENTE DA CONVERSA:\n${historyBlock}\n` : '',
        `PERGUNTA DO GESTOR:\n${question}`,
        '',
        'Responda estruturando claramente: (1) Fatos e Evidências Quantitativas, (2) Hipóteses ou Ressalvas (se houver limitações amostrais), e (3) Recomendação Prática (com Prioridade e Indicador de Acompanhamento).',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: buildConsultantSystemInstruction(),
        },
      });

      res.json({ answer: response.text || 'Não foi possível gerar uma resposta com os dados atuais.' });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/kpi-diagnose', async (req: Request, res: Response) => {
    const ai = createAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Chave GEMINI_API_KEY não configurada no servidor. Configure-a em Settings > Secrets para ativar a interpretação por IA.',
      });
      return;
    }

    const { kpiPayload } = req.body as { kpiPayload?: string };
    if (!kpiPayload) {
      res.status(400).json({ error: 'Resumo dos KPIs já calculados não informado.' });
      return;
    }

    try {
      const prompt = [
        'Os KPIs abaixo já foram calculados matematicamente pelo sistema a partir da planilha oficial da Galpão Bier.',
        'NÃO recalcule nem invente números. Interprete exclusivamente os indicadores fornecidos, apontando desvios positivos/negativos, riscos e recomendações práticas por prioridade.',
        '',
        kpiPayload,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: buildConsultantSystemInstruction(),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                indicadorAnalisado: { type: Type.STRING },
                valorObservado: { type: Type.STRING },
                comparacaoReferencia: { type: Type.STRING },
                interpretacao: { type: Type.STRING },
                recomendacaoAcao: { type: Type.STRING },
              },
              required: [
                'indicadorAnalisado',
                'valorObservado',
                'comparacaoReferencia',
                'interpretacao',
                'recomendacaoAcao',
              ],
            },
          },
        },
      });

      const items = JSON.parse((response.text ?? '[]').trim());
      res.json({ items });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/predictive-diagnose', async (req: Request, res: Response) => {
    const ai = createAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Chave GEMINI_API_KEY não configurada no servidor. Configure-a em Settings > Secrets para ativar a interpretação por IA.',
      });
      return;
    }

    const { predictivePayload } = req.body as { predictivePayload?: string };
    if (!predictivePayload) {
      res.status(400).json({ error: 'Resumo das previsões calculadas não informado.' });
      return;
    }

    try {
      const prompt = [
        'Os modelos estatísticos da aplicação já executaram a agregação mensal, backtesting cronológico (walk-forward), seleção de modelo, previsões e intervalos de incerteza.',
        'REGRA FUNDAMENTAL: NÃO calcule regressões, médias móveis, previsões, métricas de erro ou intervalos. Interprete EXCLUSIVAMENTE os números pré-calculados fornecidos abaixo.',
        'Gere de 4 a 6 recomendações gerenciais respondendo: tendência esperada de faturamento, categoria com maior potencial, canal de maior contribuição, risco de redução de margem operacional, ajustes comerciais necessários e decisões gerenciais prioritárias.',
        '',
        predictivePayload,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: buildConsultantSystemInstruction(),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                indicadorAnalisado: { type: Type.STRING },
                previsaoCalculada: { type: Type.STRING },
                evidenciaHistorica: { type: Type.STRING },
                grauIncerteza: { type: Type.STRING },
                interpretacao: { type: Type.STRING },
                recomendacaoGerencial: { type: Type.STRING },
              },
              required: [
                'indicadorAnalisado',
                'previsaoCalculada',
                'evidenciaHistorica',
                'grauIncerteza',
                'interpretacao',
                'recomendacaoGerencial',
              ],
            },
          },
        },
      });

      const items = JSON.parse((response.text ?? '[]').trim());
      res.json({ items });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Galpão Bier Intelligence rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
