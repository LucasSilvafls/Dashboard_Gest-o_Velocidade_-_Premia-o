'use client';

import React from 'react';
import Image from 'next/image';
import {
  Sidebar as BaseSidebar,
  SidebarHeader,
  SidebarNav,
  SidebarSection,
  SidebarItem,
  SidebarFooter,
  SidebarToggle,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  BarChart3,
  Trophy,
  AlertTriangle,
  Award,
  FileSearch,
  SlidersHorizontal,
} from 'lucide-react';

export type ScreenId =
  | 'resumo-geral-e-horarios'
  | 'rankings-frota-e-motoristas'
  | 'central-de-ocorrencias-e-rodovias'
  | 'premiacao-e-compliance'
  | 'auditoria-sem-identificacao'
  | 'painel-admin-e-parametrizacoes';

export const CASAGRANDE_LOGO_DARK_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAEIujuhH9JMAuF9o04kpPZ1s_jkb5OVLmj6AcsgHNzvrbXu7qF1bORKWBaQzp0IHrtQrg7iKg64QfLt94j1xXxNPUt3fJZTFlpm9zfxG1EEDHQUO5kSl9bpx63KX4o4T4mvEuvytnTPOYrKCew9WGhTbmbgQTSdwkwtjRi4ZGoyE2RZ2tqqOwJc1BTm1tBES1i6vy87c-rLmAszlmLd3Z87-oUrQQRX6yLr8iSX3nJq32keq9G3iqDJw';
export const CASAGRANDE_LOGO_LIGHT_URL = '/assets/aistudio/logo_casagrande_44acd938.png';
export const CASAGRANDE_LOGO_URL = CASAGRANDE_LOGO_DARK_URL;

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  currentScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  onOpenProfile: () => void;
  onLogout?: () => void;
  user?: { name: string; username: string } | null;
  stats?: {
    totalAlertas: number;
    totalVelocidade: number;
    semIdentificacao: number;
    totalMotoristas: number;
  } | null;
}

const NAV_ITEMS: {
  id: ScreenId;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}[] = [
  {
    id: 'resumo-geral-e-horarios',
    label: '1. Resumo Geral & Horários',
    icon: <BarChart3 className="size-[18px]" strokeWidth={1.8} />,
    badge: '9.051',
  },
  {
    id: 'rankings-frota-e-motoristas',
    label: '2. Rankings (Frota & Motoristas)',
    icon: <Trophy className="size-[18px]" strokeWidth={1.8} />,
    badge: '12',
  },
  {
    id: 'central-de-ocorrencias-e-rodovias',
    label: '3. Central de Ocorrências & Rodovias',
    icon: <AlertTriangle className="size-[18px]" strokeWidth={1.8} />,
    badge: 'MS-112',
    badgeColor: '#ef4444',
  },
  {
    id: 'premiacao-e-compliance',
    label: '4. Premiação & Compliance',
    icon: <Award className="size-[18px]" strokeWidth={1.8} />,
    badge: '80 km/h',
    badgeColor: '#34b344',
  },
  {
    id: 'auditoria-sem-identificacao',
    label: '5. Auditoria sem Identificação',
    icon: <FileSearch className="size-[18px]" strokeWidth={1.8} />,
    badge: '3.797',
    badgeColor: '#f59e0b',
  },
  {
    id: 'painel-admin-e-parametrizacoes',
    label: '6. Painel Admin & Parametrizações',
    icon: <SlidersHorizontal className="size-[18px]" strokeWidth={1.8} />,
  },
];

function CasagrandeBrandMark() {
  const { collapsed } = useSidebar();
  if (collapsed) {
    return null;
  }
  return (
    <div className="flex items-center min-w-0 overflow-hidden select-none">
      {/* Logotipo para Modo Claro (Texto escuro com contraste nítido) */}
      <Image
        src={CASAGRANDE_LOGO_LIGHT_URL}
        alt="Casagrande Locações & Transportes"
        data-logo="light"
        width={195}
        height={32}
        priority
        className="h-8 w-auto object-contain max-w-[195px]"
      />
      {/* Logotipo para Modo Escuro (Texto branco para contraste em fundo escuro) */}
      <Image
        src={CASAGRANDE_LOGO_DARK_URL}
        alt="Casagrande Locações & Transportes"
        data-logo="dark"
        width={195}
        height={32}
        priority
        className="h-8 w-auto object-contain max-w-[195px]"
      />
    </div>
  );
}

function CasagrandeUserFooter({
  onOpenProfile,
  onLogout,
  user,
}: {
  onOpenProfile: () => void;
  onLogout?: () => void;
  user?: { name: string; username: string } | null;
}) {
  const { collapsed } = useSidebar();
  const displayName = user?.name || 'Administrador CCO';
  return (
    <div
      className={`flex w-full items-center cursor-pointer group ${
        collapsed ? 'justify-center' : 'gap-2.5 justify-between min-w-0'
      }`}
      onClick={onOpenProfile}
      title={`Perfil CCO (${displayName})`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative shrink-0">
          <div className="size-8 rounded-lg bg-[#0c1017] border border-[#283548] group-hover:border-[#34b344] transition-colors flex items-center justify-center text-white">
            <span className="font-bold text-xs text-[#34b344]">CCO</span>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-[#34b344] ring-2 ring-[#131923] animate-pulse" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold text-white leading-tight">
              {displayName}
            </div>
            <div className="truncate text-[10px] font-tabular-data text-[#34b344] font-bold leading-tight mt-0.5">
              SISTEMA ONLINE
            </div>
          </div>
        )}
      </div>
      {!collapsed && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLogout?.();
          }}
          className="p-1 rounded text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#1c2432] transition-colors cursor-pointer"
          title="Encerrar Sessão (Logout)"
          aria-label="Encerrar Sessão"
        >
          <span className="material-symbols-outlined text-[17px]">logout</span>
        </button>
      )}
    </div>
  );
}

export default function Sidebar({
  collapsed,
  onCollapsedChange,
  mobileOpen = false,
  onMobileClose,
  currentScreen,
  onSelectScreen,
  onOpenProfile,
  onLogout,
  user,
  stats,
}: SidebarProps) {
  const handleItemClick = (id: ScreenId) => {
    onSelectScreen(id);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const navItems = NAV_ITEMS.map((item) => {
    if (item.id === 'resumo-geral-e-horarios' && stats?.totalVelocidade) {
      return { ...item, badge: stats.totalVelocidade.toLocaleString('pt-BR') };
    }
    if (item.id === 'auditoria-sem-identificacao' && stats?.semIdentificacao) {
      return { ...item, badge: stats.semIdentificacao.toLocaleString('pt-BR') };
    }
    return item;
  });

  return (
    <>
      {/* Backdrop para telas mobile & tablet (< lg) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Drawer deslizante no mobile (< lg) e barra fixa retrátil no desktop (lg+) */}
      <div
        className={`fixed left-0 top-0 bottom-0 z-50 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <BaseSidebar
          variant="collapsible"
          collapsed={collapsed}
          onCollapsedChange={onCollapsedChange}
          width={272}
          collapsedWidth={68}
          aria-label="Menu de Navegação Casagrande"
        >
          <SidebarHeader>
            <CasagrandeBrandMark />
            <div className={`flex items-center gap-1 ${collapsed ? 'mx-auto' : 'ml-auto'}`}>
              {onMobileClose && (
                <button
                  type="button"
                  onClick={onMobileClose}
                  className="lg:hidden size-9 min-h-[36px] min-w-[36px] rounded-lg text-[#94a3b8] hover:text-white hover:bg-[#1c2432] transition-colors cursor-pointer flex items-center justify-center"
                  aria-label="Fechar menu"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              )}
              <SidebarToggle className="hidden lg:flex" />
            </div>
          </SidebarHeader>

          <SidebarNav>
            <SidebarSection label="TELEMETRIA E OPERAÇÃO">
              {navItems.map((item) => {
                const isActive = currentScreen === item.id;
                return (
                  <SidebarItem
                    key={item.id}
                    icon={item.icon}
                    active={isActive}
                    badge={
                      item.badge ? (
                        <span
                          className="rounded px-1.5 py-0.5 text-[9.5px] font-bold font-tabular-data leading-none bg-[#0c1017] border border-[#283548]"
                          style={{
                            color: item.badgeColor || '#94a3b8',
                            borderColor: item.badgeColor ? `${item.badgeColor}40` : '#283548',
                          }}
                        >
                          {item.badge}
                        </span>
                      ) : undefined
                    }
                    onClick={() => handleItemClick(item.id)}
                  >
                    {item.label}
                  </SidebarItem>
                );
              })}
            </SidebarSection>
          </SidebarNav>

          <SidebarFooter>
            <CasagrandeUserFooter onOpenProfile={onOpenProfile} onLogout={onLogout} user={user} />
          </SidebarFooter>
        </BaseSidebar>
      </div>
    </>
  );
}
