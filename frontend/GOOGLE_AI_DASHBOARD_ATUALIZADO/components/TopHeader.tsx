'use client';

import React from 'react';
import { useTheme } from '@/lib/ThemeContext';

interface TopHeaderProps {
  isSidebarCollapsed: boolean;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onToggleMobileMenu?: () => void;
  onRefreshData?: () => void;
  onOpenUpload?: () => void;
  isRefreshing?: boolean;
  stats?: {
    totalAlertas: number;
    totalVelocidade: number;
    totalVeiculos: number;
    periodo: string;
  };
}

export default function TopHeader({
  isSidebarCollapsed,
  onOpenNotifications,
  onOpenProfile,
  onToggleMobileMenu,
  onRefreshData,
  onOpenUpload,
  isRefreshing = false,
  stats,
}: TopHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  const periodoDisplay = stats?.periodo || '26/09 a 25/10/2026';
  const frotaDisplay = `${stats?.totalVeiculos ?? 35} Veículos`;
  const excessosDisplay = `${(stats?.totalVelocidade ?? 9051).toLocaleString('pt-BR')} / ${(stats?.totalAlertas ?? 16068).toLocaleString('pt-BR')}`;
  const pctDisplay = stats?.totalAlertas
    ? `${((stats.totalVelocidade / stats.totalAlertas) * 100).toFixed(1)}%`
    : '56,3%';

  return (
    <header
      className={`fixed top-0 right-0 h-14 bg-[#0c1017]/95 backdrop-blur-md z-40 border-b border-[#283548] flex items-center justify-between px-3 sm:px-6 select-none transition-[left] duration-240 ease-[cubic-bezier(0.23,1,0.32,1)] left-0 ${
        isSidebarCollapsed ? 'lg:left-[68px]' : 'lg:left-[272px]'
      }`}
      style={{
        borderBottom: '1px solid #283548',
      }}
    >
      {/* Mobile Menu Trigger & System Ticker */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
        {/* Botão Hambúrguer para telas mobile & tablet (< lg) com touch target otimizado */}
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden flex items-center justify-center size-9 rounded-lg bg-[#1c2432] border border-[#283548] text-[#94a3b8] hover:text-[#34b344] hover:border-[#34b344] transition-colors cursor-pointer shrink-0 touch-target"
            aria-label="Abrir menu de navegação"
            title="Menu"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
        )}

        {/* Brand Tag no Mobile */}
        <div className="lg:hidden flex items-center gap-1.5 shrink-0 mr-0.5">
          <span className="font-bold text-xs tracking-wider text-[#34b344]">CSG</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#34b344] animate-pulse" />
        </div>

        {/* Telemetric System Ticker com rolagem suave por toque e sem barra feia */}
        <div className="flex items-center gap-2 sm:gap-3.5 overflow-x-auto scrollbar-none touch-scroll-x py-1 text-xs font-tabular-data pr-1 mask-fade-right">
          <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <span className="material-symbols-outlined text-[#94a3b8] text-[15px]">
              calendar_today
            </span>
            <span className="text-[#94a3b8] font-bold text-[10px] tracking-wider uppercase hidden sm:inline">
              PERÍODO:
            </span>
            <span className="text-[#f1f5f9] font-semibold text-[11px]">
              {periodoDisplay}
            </span>
          </div>

          <div className="h-4 w-px bg-[#283548] shrink-0 hidden sm:block" />

          <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <span className="material-symbols-outlined text-[#94a3b8] text-[15px]">
              rv_hookup
            </span>
            <span className="text-[#94a3b8] font-bold text-[10px] tracking-wider uppercase hidden sm:inline">
              FROTA:
            </span>
            <span className="text-[#f1f5f9] font-semibold text-[11px]">
              {frotaDisplay}
            </span>
          </div>

          <div className="h-4 w-px bg-[#283548] shrink-0 hidden md:block" />

          <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <span className="material-symbols-outlined text-[#f59e0b] text-[15px]">
              speed
            </span>
            <span className="text-[#94a3b8] font-bold text-[10px] tracking-wider uppercase hidden md:inline">
              EXCESSOS:
            </span>
            <span className="text-[#f1f5f9] font-semibold text-[11px]">
              {excessosDisplay}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#f59e0b]/20 text-[#f59e0b] text-[10px] border border-[#f59e0b]/40 font-bold ml-0.5">
              {pctDisplay}
            </span>
          </div>

          <div className="h-4 w-px bg-[#283548] shrink-0 hidden lg:block" />

          <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#34b344] shadow-[0_0_8px_#34b344] animate-pulse" />
            <span className="text-[#34b344] font-bold text-[10px] tracking-wider uppercase">
              SUPABASE ONLINE
            </span>
          </div>
        </div>
      </div>

      {/* Action Controls com espaçamento responsivo e touch targets */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 ml-2 sm:ml-3 flex-shrink-0">
        {/* Upload Planilha Button */}
        {onOpenUpload && (
          <button
            type="button"
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#2ca03a] hover:bg-[#34b344] text-white text-xs font-bold transition-all shadow-[0_0_12px_rgba(44,160,58,0.35)] cursor-pointer"
            title="Importar novo lote de telemetria (.xlsx/.csv)"
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            <span className="hidden md:inline">Upload Planilha</span>
          </button>
        )}

        {/* Refresh Sync Button */}
        {onRefreshData && (
          <button
            type="button"
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="size-8.5 sm:size-8 rounded-lg border border-[#283548] bg-[#1c2432] text-[#94a3b8] hover:text-[#34b344] hover:bg-[#283548] transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 touch-target"
            title="Sincronizar com Supabase"
            aria-label="Sincronizar dados"
          >
            <span className={`material-symbols-outlined text-[17px] ${isRefreshing ? 'animate-spin text-[#34b344]' : ''}`}>
              sync
            </span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          className="size-8.5 sm:size-8 rounded-lg border border-[#283548] bg-[#1c2432] text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#283548] transition-colors flex items-center justify-center cursor-pointer touch-target"
          title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
          type="button"
          onClick={toggleTheme}
          aria-label="Alternar modo claro ou escuro"
        >
          <span className="material-symbols-outlined text-[17px]">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* Notifications Button */}
        <button
          className="relative size-8.5 sm:size-8 rounded-lg border border-[#283548] bg-[#1c2432] text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#283548] transition-colors flex items-center justify-center cursor-pointer touch-target"
          title="Notificações Operacionais CCO"
          type="button"
          onClick={onOpenNotifications}
          aria-label="Ver notificações"
        >
          <span className="material-symbols-outlined text-[18px]">notifications</span>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#ef4444] text-[9px] font-bold text-white rounded-full flex items-center justify-center border-2 border-[#0c1017] font-tabular-data">
            3
          </span>
        </button>

        {/* Profile Button */}
        <button
          className="flex items-center gap-2 pl-1 pr-1.5 sm:pr-2 py-1 rounded-lg bg-[#1c2432] border border-[#283548] hover:border-[#34b344] transition-colors cursor-pointer"
          title="Perfil CCO"
          type="button"
          onClick={onOpenProfile}
          aria-label="Perfil do usuário"
        >
          <div className="w-6 h-6 rounded bg-[#2ca03a] flex items-center justify-center text-white font-bold text-xs">
            N
          </div>
          <span className="text-xs font-semibold text-[#f1f5f9] hidden lg:inline">
            CCO Admin
          </span>
        </button>
      </div>
    </header>
  );
}
