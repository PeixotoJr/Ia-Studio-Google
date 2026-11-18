import React, { useRef, useState } from 'react';
import {
  LayoutDashboard,
  Database,
  TrendingUp,
  LineChart,
  BrainCircuit,
  FileSpreadsheet,
  ClipboardCheck,
  ShieldCheck,
  Upload,
  Menu,
  X,
  Beer,
  AlertTriangle,
  CheckCircle2,
  Gauge,
} from 'lucide-react';
import type { DatasetMetadata, PageId } from '../types/bi';
import { formatDateTimeBR, formatNumber } from '../utils/formatters';

interface LayoutProps {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  metadata: DatasetMetadata | null;
  isLoadingFile: boolean;
  loadError: string | null;
  onFileSelected: (file: File) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: PageId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard Executivo', icon: LayoutDashboard },
  { id: 'kpis', label: 'Indicadores de Desempenho', icon: Gauge },
  { id: 'database', label: 'Base de Dados', icon: Database },
  { id: 'performance', label: 'Análise de Desempenho', icon: TrendingUp },
  { id: 'predictive', label: 'Análise Preditiva', icon: LineChart },
  { id: 'ai', label: 'Inteligência Artificial', icon: BrainCircuit },
  { id: 'reports', label: 'Relatórios', icon: FileSpreadsheet },
  { id: 'decisions', label: 'Decisões Gerenciais', icon: ClipboardCheck },
  { id: 'quality', label: 'Qualidade dos Dados', icon: ShieldCheck },
];

export const Layout: React.FC<LayoutProps> = ({
  activePage,
  onSelectPage,
  metadata,
  isLoadingFile,
  loadError,
  onFileSelected,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    e.target.value = '';
  };

  const activeNav = NAV_ITEMS.find((n) => n.id === activePage);

  return (
    <div className="min-h-screen bg-[#0D0B09] text-[#F4EFE6] flex">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Selecionar arquivo Excel (.xlsx)"
      />

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Fixed Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[264px] bg-[#14100C] border-r border-amber-500/15 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-amber-500/15 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Beer className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="font-display font-semibold text-base tracking-tight text-[#F4EFE6] block truncate">
                Galpão Bier
              </span>
              <span className="text-[11px] text-amber-400/90 font-medium block truncate">
                Intelligence BI
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-2 text-[#B9AE9C] hover:text-[#F4EFE6] rounded-md"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectPage(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-[#B9AE9C] hover:text-[#F4EFE6] hover:bg-[#1E1813] border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-[#847866]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Dataset sidebar summary */}
        <div className="p-4 border-t border-amber-500/15 bg-[#110D0A] text-xs space-y-2 shrink-0">
          {metadata ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#847866]">Fonte oficial</span>
                <span
                  className={`inline-flex items-center gap-1 font-medium ${
                    metadata.validationStatus === 'Íntegro'
                      ? 'text-emerald-400'
                      : metadata.validationStatus === 'Com Ressalvas'
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}
                >
                  {metadata.validationStatus === 'Íntegro' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{metadata.validationStatus}</span>
                </span>
              </div>
              <p className="text-[#F4EFE6] font-medium truncate" title={metadata.fileName}>
                {metadata.fileName}
              </p>
              <div className="text-[#B9AE9C] space-y-1 font-mono text-[11px] tabular-nums">
                <div className="flex justify-between">
                  <span className="font-sans text-[#847866]">Vendas</span>
                  <span>{formatNumber(metadata.vendasCount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[#847866]">Metas / Decisões</span>
                  <span>
                    {formatNumber(metadata.metasCount)} / {formatNumber(metadata.decisoesCount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[#847866]">Qualidade</span>
                  <span>{formatNumber(metadata.qualidadeCount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[#847866]">Período</span>
                  <span>
                    {metadata.minPeriodo ?? 'N/A'} – {metadata.maxPeriodo ?? 'N/A'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-[#847866] leading-relaxed">
              Nenhuma planilha carregada. Importe o arquivo Excel oficial (.xlsx) para iniciar.
            </div>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 lg:pl-[264px] flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-[#0D0B09]/95 backdrop-blur border-b border-amber-500/15 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-amber-500/20 text-[#F4EFE6] hover:bg-[#1E1813]"
              aria-label="Abrir menu lateral"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-semibold text-[#F4EFE6] truncate">
                {activeNav?.label || 'Galpão Bier Intelligence'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleTriggerUpload}
              disabled={isLoadingFile}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-[#0D0B09] font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>{isLoadingFile ? 'Lendo Excel...' : 'Importar / Atualizar Excel'}</span>
            </button>
          </div>
        </header>

        {/* Loaded File Metadata Strip */}
        {metadata && (
          <div className="bg-[#130F0C] border-b border-amber-500/10 px-4 sm:px-6 py-2.5 text-xs text-[#B9AE9C] flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[#F4EFE6] font-medium">{metadata.fileName}</span>
            <span aria-hidden="true" className="text-[#847866]">·</span>
            <span>Atualizado em {formatDateTimeBR(metadata.loadedAt)}</span>
            <span aria-hidden="true" className="text-[#847866]">·</span>
            <span className="font-mono tabular-nums">
              {formatNumber(metadata.vendasCount)} vendas · {formatNumber(metadata.metasCount)} metas ·{' '}
              {formatNumber(metadata.decisoesCount)} decisões · {formatNumber(metadata.qualidadeCount)} checks
            </span>
            <span aria-hidden="true" className="text-[#847866]">·</span>
            <span className="font-mono tabular-nums">
              Período: {metadata.minPeriodo ?? 'N/A'} até {metadata.maxPeriodo ?? 'N/A'}
            </span>
            <span aria-hidden="true" className="text-[#847866]">·</span>
            <button
              type="button"
              onClick={() => onSelectPage('quality')}
              className={`font-medium underline-offset-4 hover:underline cursor-pointer ${
                metadata.validationStatus === 'Íntegro'
                  ? 'text-emerald-400'
                  : metadata.validationStatus === 'Com Ressalvas'
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              Validação: {metadata.validationStatus}
            </button>
          </div>
        )}

        {/* Load Error Banner */}
        {loadError && (
          <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-100">Falha na leitura ou validação do arquivo Excel</p>
              <p className="mt-1 text-red-200/90">{loadError}</p>
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
