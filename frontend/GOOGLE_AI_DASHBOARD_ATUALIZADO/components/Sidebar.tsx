'use client';

import React from 'react';
import Image from 'next/image';
import { useTheme } from '@/lib/ThemeContext';
import { isAdminRole } from '@/lib/auth-crypto';
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
  user?: { name: string; username: string; role?: string } | null;
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
    label: '1. Resumo Geral',
    icon: <BarChart3 className="size-[18px]" strokeWidth={1.8} />,
    badge: '9.051',
  },
  {
    id: 'rankings-frota-e-motoristas',
    label: '2. Rankings',
    icon: <Trophy className="size-[18px]" strokeWidth={1.8} />,
    badge: '12',
  },
  {
    id: 'central-de-ocorrencias-e-rodovias',
    label: '3. Ocorrências',
    icon: <AlertTriangle className="size-[18px]" strokeWidth={1.8} />,
    badge: 'MS-112',
    badgeColor: '#ef4444',
  },
  {
    id: 'premiacao-e-compliance',
    label: '4. Premiação',
    icon: <Award className="size-[18px]" strokeWidth={1.8} />,
    badge: '80 km/h',
    badgeColor: '#34b344',
  },
  {
    id: 'auditoria-sem-identificacao',
    label: '5. Sem Identificação',
    icon: <FileSearch className="size-[18px]" strokeWidth={1.8} />,
    badge: '3.797',
    badgeColor: '#f59e0b',
  },
  {
    id: 'painel-admin-e-parametrizacoes',
    label: '6. Painel admin',
    icon: <SlidersHorizontal className="size-[18px]" strokeWidth={1.8} />,
  },
];

function getSidebarBadgeClasses(badgeColor: string | undefined, isLight: boolean, isActive: boolean): string {
  const base = 'rounded px-1.5 py-0.5 text-[9.5px] font-bold font-tabular-data leading-none border transition-colors';
  if (isLight) {
    if (badgeColor === '#ef4444') {
      return `${base} bg-[#fee2e2] text-[#dc2626] border-[#fca5a5]`;
    }
    if (badgeColor === '#34b344') {
      return `${base} bg-[#dcfce7] text-[#15803d] border-[#86efac]`;
    }
    if (badgeColor === '#f59e0b') {
      return `${base} bg-[#fef3c7] text-[#b45309] border-[#fcd34d]`;
    }
    if (isActive) {
      return `${base} bg-[#dcfce7] text-[#15803d] border-[#86efac]`;
    }
    return `${base} bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]`;
  }

  // Dark mode
  if (badgeColor === '#ef4444') {
    return `${base} bg-[#0c1017] text-[#ef4444] border-[#ef4444]/30`;
  }
  if (badgeColor === '#34b344') {
    return `${base} bg-[#0c1017] text-[#34b344] border-[#34b344]/30`;
  }
  if (badgeColor === '#f59e0b') {
    return `${base} bg-[#0c1017] text-[#f59e0b] border-[#f59e0b]/30`;
  }
  return `${base} bg-[#0c1017] text-[#94a3b8] border-[#283548]`;
}

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
  user?: { name: string; username: string; role?: string } | null;
}) {
  const { collapsed } = useSidebar();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const isAdmin = isAdminRole(user?.role);
  const displayName = user?.name || (isAdmin ? 'Administrador CCO' : 'Operador CCO');
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
          <div
            className={`size-8 rounded-lg border transition-colors flex items-center justify-center ${
              isLight
                ? 'bg-[#ecfdf5] border-[#86efac] group-hover:border-[#16a34a] text-[#15803d]'
                : 'bg-[#0c1017] border-[#283548] group-hover:border-[#34b344] text-white'
            }`}
          >
            <span className={`font-bold text-xs ${isLight ? 'text-[#15803d]' : 'text-[#34b344]'}`}>
              CCO
            </span>
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-[#34b344] ring-2 animate-pulse ${
              isLight ? 'ring-[#f8fafc]' : 'ring-[#131923]'
            }`}
          />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div
              className={`truncate text-[12px] font-semibold leading-tight ${
                isLight ? 'text-[#0f172a]' : 'text-white'
              }`}
            >
              {displayName}
            </div>
            <div
              className={`truncate text-[10px] font-tabular-data font-bold leading-tight mt-0.5 ${
                isLight ? 'text-[#16a34a]' : 'text-[#34b344]'
              }`}
            >
              {isAdmin ? 'ADMIN • SISTEMA ONLINE' : 'VISUALIZADOR • ONLINE'}
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
          className={`p-1 rounded transition-colors cursor-pointer ${
            isLight
              ? 'text-[#64748b] hover:text-[#dc2626] hover:bg-[#fee2e2]'
              : 'text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#1c2432]'
          }`}
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
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const isAdmin = isAdminRole(user?.role);

  const handleItemClick = (id: ScreenId) => {
    onSelectScreen(id);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  // RBAC: oculta o Painel Admin (parametrizações/regras/cadastros) para operadores não-admin
  const navItems = NAV_ITEMS.filter(
    (item) => item.id !== 'painel-admin-e-parametrizacoes' || isAdmin
  ).map((item) => {
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
                  className={`lg:hidden size-9 min-h-[36px] min-w-[36px] rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                    isLight
                      ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                      : 'text-[#94a3b8] hover:text-white hover:bg-[#1c2432]'
                  }`}
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
                          data-slot="sidebar-badge"
                          className={getSidebarBadgeClasses(item.badgeColor, isLight, isActive)}
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
