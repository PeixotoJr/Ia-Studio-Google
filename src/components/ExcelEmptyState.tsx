import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, ShieldCheck, AlertCircle, Beer } from 'lucide-react';

interface ExcelEmptyStateProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  error: string | null;
}

export const ExcelEmptyState: React.FC<ExcelEmptyStateProps> = ({
  onFileSelected,
  isLoading,
  error,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [imgError, setImgError] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Hero Split */}
      <div className="rounded-2xl overflow-hidden bg-[#16120E] border border-amber-500/20 grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-medium text-amber-400">
              Plataforma de Inteligência Gerencial · Microcervejaria Galpão Bier
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4EFE6] leading-tight">
              Decisões estratégicas baseadas exclusivamente nos dados oficiais da operação
            </h2>
            <p className="text-sm text-[#B9AE9C] leading-relaxed">
              Importe a planilha oficial da Galpão Bier (.xlsx) contendo as abas{' '}
              <strong className="text-[#F4EFE6]">Vendas</strong>,{' '}
              <strong className="text-[#F4EFE6]">Metas</strong>,{' '}
              <strong className="text-[#F4EFE6]">Decisões</strong> e{' '}
              <strong className="text-[#F4EFE6]">Qualidade</strong>. Nenhum indicador ou gráfico é simulado — todos os cálculos são executados dinamicamente a partir dos registros reais carregados.
            </p>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-amber-400 bg-amber-500/10'
                : 'border-amber-500/30 bg-[#0D0B09]/70 hover:border-amber-400/60 hover:bg-[#1A140F]'
            }`}
          >
            <div className="w-12 h-12 mx-auto rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-[#F4EFE6]">
              {isLoading ? 'Processando e validando abas da planilha...' : 'Arraste sua planilha Excel (.xlsx) aqui ou clique para selecionar'}
            </p>
            <p className="text-xs text-[#847866] mt-1">
              Leitura local segura com preservação integral dos registros e valores nulos
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 relative min-h-[240px] bg-[#1C1611]">
          {!imgError ? (
            <img
              src="/src/assets/images/brewery_cellar_banner_1794662002024.jpg"
              alt="Tanques de fermentação e barris de carvalho da microcervejaria Galpão Bier"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#231A12] to-[#0D0B09] text-amber-400/70">
              <Beer className="w-12 h-12 mb-2" />
              <span className="text-sm font-medium">Galpão Bier</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0B09]/85 via-[#0D0B09]/25 to-transparent flex items-end p-6">
            <p className="text-xs text-[#F4EFE6]/90 leading-relaxed">
              Controle integrado de faturamento, rentabilidade por rótulo, canais comerciais, recebíveis, previsão estatística e decisões gerenciais.
            </p>
          </div>
        </div>
      </div>

      {/* Structure Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SheetSpecCard
          title="1. Aba Vendas"
          description="Transações comerciais com período, unidade de negócio, categoria, produto, volume, faturamento, custos, despesas, resultado, pagamentos e estoque."
        />
        <SheetSpecCard
          title="2. Aba Metas"
          description="Metas mensais por unidade de negócio (meta_faturamento, meta_volume_litros, margem e perdas de produção) para confronto realizado vs planejado."
        />
        <SheetSpecCard
          title="3. Aba Decisões"
          description="Registro estruturado de temas, análises necessárias, decisões possíveis, responsáveis, periodicidade e indicadores associados."
        />
        <SheetSpecCard
          title="4. Aba Qualidade"
          description="Verificações oficiais de confiabilidade e integridade da base, combinadas com auditoria automática na importação."
        />
      </div>

      <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 flex items-start gap-3 text-xs text-[#B9AE9C]">
        <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-[#F4EFE6]">Garantia de integridade:</strong> Valores vazios (como notas de satisfação ausentes) são mantidos como nulos, nunca convertidos em zero. Em divisões sem base, o sistema exibe <span className="font-mono text-amber-300">N/A</span>.
        </p>
      </div>
    </div>
  );
};

const SheetSpecCard: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="p-4 rounded-xl bg-[#16120E] border border-amber-500/15 space-y-2">
    <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
      <FileSpreadsheet className="w-4 h-4 shrink-0" />
      <span>{title}</span>
    </div>
    <p className="text-xs text-[#B9AE9C] leading-relaxed">{description}</p>
  </div>
);
