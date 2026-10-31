'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar, { ScreenId } from '@/components/Sidebar';
import TopHeader from '@/components/TopHeader';
import ExecutiveSummaryScreen from '@/components/screens/ExecutiveSummaryScreen';
import FleetRankingsScreen from '@/components/screens/FleetRankingsScreen';
import IncidentsHighwayScreen from '@/components/screens/IncidentsHighwayScreen';
import ComplianceBonusScreen from '@/components/screens/ComplianceBonusScreen';
import AuditUnidentifiedScreen from '@/components/screens/AuditUnidentifiedScreen';
import AdminParamsScreen from '@/components/screens/AdminParamsScreen';
import IncidentDetailModal from '@/components/IncidentDetailModal';
import DriverDetailModal from '@/components/DriverDetailModal';
import RoadParamModal from '@/components/RoadParamModal';
import NotificationsModal from '@/components/NotificationsModal';
import UserProfileModal from '@/components/UserProfileModal';
import LoginScreen, { AuthenticatedUser } from '@/components/screens/LoginScreen';
import FirstAccessPasswordModal from '@/components/FirstAccessPasswordModal';
import TelemetryPreloader from '@/components/TelemetryPreloader';
import UploadSpreadsheetModal from '@/components/UploadSpreadsheetModal';
import { supabase } from '@/lib/supabaseClient';

import {
  INITIAL_ROAD_PARAMETERS,
  INITIAL_AUDIT_LOGS,
  Incident,
  DriverScore,
  RoadParameter,
  AuditLog,
} from '@/lib/telemetry-data';
import {
  fetchTelemetrySummaryStats,
  fetchDriverComplianceScores,
  fetchIncidents,
  fetchUploadAuditLogs,
  TelemetrySummaryStats,
} from '@/lib/telemetry-service';
import {
  getDatasetDateBounds,
  formatTimestampsToPeriodDisplay,
  formatDatesToPeriodDisplay,
  BonusRules,
  DEFAULT_BONUS_RULES,
} from '@/lib/telemetry-rules';
import { useOperationalFilters } from '@/components/OperationalFilterBar';

function createAuditLogEntry(action: string, operator = 'Operador CCO (admin)', ip = '192.168.10.45'): AuditLog {
  const now = new Date();
  const dateStr =
    now.toLocaleDateString('pt-BR') +
    ' ' +
    now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const randomHex = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

  return {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    date: dateStr,
    operator,
    action,
    ip,
    hash: `sha256:${randomHex}...`,
  };
}

export default function Home() {
  // Autenticação e Gestão de Sessão Corporativa
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
  const [isFirstAccessModalOpen, setIsFirstAccessModalOpen] = useState<boolean>(false);

  // Pré-carregador telemétrico: previne exibição de métricas mock ou travamentos iniciais
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  const [currentScreen, setCurrentScreen] = useState<ScreenId>('resumo-geral-e-horarios');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [roadParams, setRoadParams] = useState<RoadParameter[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('csg_road_params_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Erro ao carregar roadParams locais:', e);
      }
    }
    return INITIAL_ROAD_PARAMETERS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('csg_audit_logs_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Erro ao carregar auditLogs locais:', e);
      }
    }
    return INITIAL_AUDIT_LOGS;
  });

  const [driverScores, setDriverScores] = useState<DriverScore[]>([]);
  const [stats, setStats] = useState<TelemetrySummaryStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  // Regras de Bonificação e Parâmetros da Frota (Persistido no LocalStorage)
  const [bonusRules, setBonusRules] = useState<BonusRules>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('csg_bonus_rules_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed.minHours === 'number' && parsed.baseBonus) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar bonusRules locais:', e);
      }
    }
    return DEFAULT_BONUS_RULES;
  });

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  const appendAuditLog = useCallback((log: AuditLog) => {
    setAuditLogs((prev) => {
      const exists = prev.some(
        (l) => l.id === log.id || (l.action === log.action && l.date === log.date)
      );
      if (exists) return prev;
      const updated = [log, ...prev];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('csg_audit_logs_v1', JSON.stringify(updated.slice(0, 100)));
        } catch {}
      }
      return updated;
    });
  }, []);

  // 1. Verificação de Sessão Inicial (LocalStorage + Supabase Auth)
  useEffect(() => {
    let isCancelled = false;

    const checkInitialSession = async () => {
      try {
        // Verificar sessão em cache local
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('csg_session_user_v1');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.username) {
              if (!isCancelled) {
                setCurrentUser(parsed);
                setIsAuthenticated(true);
                if (parsed.primeiroAcesso) {
                  setIsFirstAccessModalOpen(true);
                }
              }
            }
          }
        }

        // Verificar sessão ativa no Supabase Auth
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !isCancelled) {
          const email = session.user.email || '';
          const uname = session.user.user_metadata?.username || email.split('@')[0] || 'admincasagrande';
          const name = session.user.user_metadata?.nome || (uname.includes('rafael') ? 'Rafael Casagrande' : 'Administrador CCO');
          const isDefault = session.user.user_metadata?.primeiro_acesso ?? false;

          const userObj: AuthenticatedUser = {
            id: session.user.id,
            name,
            username: uname,
            email,
            role: session.user.user_metadata?.role || 'admin',
            primeiroAcesso: isDefault,
          };

          setCurrentUser(userObj);
          setIsAuthenticated(true);
          try {
            localStorage.setItem('csg_session_user_v1', JSON.stringify(userObj));
          } catch {}
          if (isDefault) {
            setIsFirstAccessModalOpen(true);
          }
        }
      } catch (err) {
        console.warn('Aviso: erro ao verificar sessão ativa:', err);
      } finally {
        if (!isCancelled) {
          setIsCheckingSession(false);
        }
      }
    };

    checkInitialSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Carrega dados em tempo real do Supabase
  const loadSupabaseData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [fetchedStats, fetchedIncidents, fetchedDrivers, fetchedLogs] = await Promise.all([
        fetchTelemetrySummaryStats(),
        fetchIncidents(10000),
        fetchDriverComplianceScores(),
        fetchUploadAuditLogs(),
      ]);

      if (fetchedStats) setStats(fetchedStats);
      if (fetchedIncidents && fetchedIncidents.length > 0) setIncidents(fetchedIncidents);
      if (fetchedDrivers && fetchedDrivers.length > 0) setDriverScores(fetchedDrivers);
      if (fetchedLogs && fetchedLogs.length > 0) {
        setAuditLogs((prev) => {
          const existingIds = new Set(prev.map((l) => l.id));
          const existingActions = new Set(prev.map((l) => `${l.action}_${l.date}`));
          const newRemote = fetchedLogs.filter(
            (r) => !existingIds.has(r.id) && !existingActions.has(`${r.action}_${r.date}`)
          );
          if (newRemote.length === 0) return prev;
          const merged = [...newRemote, ...prev];
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('csg_audit_logs_v1', JSON.stringify(merged.slice(0, 100)));
            } catch {}
          }
          return merged;
        });
      }

      if (!silent) {
        showToast('Dados sincronizados com o Supabase com sucesso!');
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do Supabase:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  }, [showToast]);

  // Carga inicial assíncrona automática
  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const [fetchedStats, fetchedIncidents, fetchedDrivers, fetchedLogs] = await Promise.all([
          fetchTelemetrySummaryStats(),
          fetchIncidents(10000),
          fetchDriverComplianceScores(),
          fetchUploadAuditLogs(),
        ]);

        if (!isCancelled) {
          if (fetchedStats) setStats(fetchedStats);
          if (fetchedIncidents && fetchedIncidents.length > 0) setIncidents(fetchedIncidents);
          if (fetchedDrivers && fetchedDrivers.length > 0) setDriverScores(fetchedDrivers);
          if (fetchedLogs && fetchedLogs.length > 0) {
            setAuditLogs((prev) => {
              const existingIds = new Set(prev.map((l) => l.id));
              const existingActions = new Set(prev.map((l) => `${l.action}_${l.date}`));
              const newRemote = fetchedLogs.filter(
                (r) => !existingIds.has(r.id) && !existingActions.has(`${r.action}_${r.date}`)
              );
              if (newRemote.length === 0) return prev;
              const merged = [...newRemote, ...prev];
              if (typeof window !== 'undefined') {
                try {
                  localStorage.setItem('csg_audit_logs_v1', JSON.stringify(merged.slice(0, 100)));
                } catch {}
              }
              return merged;
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar dados iniciais do Supabase:', err);
      } finally {
        if (!isCancelled) {
          setIsInitialLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Estado Global dos Filtros Operacionais compartilhado entre todas as telas
  const filterState = useOperationalFilters(incidents);

  // Período responsivo: atualiza dinamicamente e "responde" ao filtro ativo (competência, datas, período)
  const dynamicPeriodo = useMemo(() => {
    // 1. Se competência estiver selecionada, reflete o período da competência (ex: 26/09 a 25/10/2026)
    if (filterState.selectedCompetenceInfo) {
      return formatDatesToPeriodDisplay(
        filterState.selectedCompetenceInfo.startDateStr,
        filterState.selectedCompetenceInfo.endDateStr
      );
    }
    // 2. Se dia específico estiver selecionado
    if (filterState.specificDay !== 'all') {
      return filterState.specificDay;
    }
    // 3. Se filtro de período relativo (7d, 15d, 30d, etc.) estiver selecionado
    if (filterState.period !== 'all' && filterState.filteredIncidents.length > 0) {
      const { minTs, maxTs } = getDatasetDateBounds(filterState.filteredIncidents);
      return formatTimestampsToPeriodDisplay(minTs, maxTs);
    }
    // 4. Se incidents carregados, calcula datas reais do dataset completo (ex: 26/09 a 30/10/2026)
    if (incidents && incidents.length > 0) {
      const { minTs, maxTs } = getDatasetDateBounds(incidents);
      return formatTimestampsToPeriodDisplay(minTs, maxTs);
    }
    if (stats?.periodo) return stats.periodo;
    return '26/09 a 30/10/2026';
  }, [
    filterState.selectedCompetenceInfo,
    filterState.specificDay,
    filterState.period,
    filterState.filteredIncidents,
    incidents,
    stats?.periodo,
  ]);

  // Collapsible Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Modals state
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverScore | null>(null);
  const [isRoadModalOpen, setIsRoadModalOpen] = useState(false);
  const [editingRoadParam, setEditingRoadParam] = useState<RoadParameter | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Keyboard shortcut listener ('M', 'Ctrl+B' / 'Cmd+B', 'Escape')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      if ((e.key === 'm' || e.key === 'M') && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      } else if (e.key === 'Escape' && !isSidebarCollapsed) {
        setIsSidebarCollapsed(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarCollapsed]);

  // URL hash navigation support: só navega nas telas se estiver autenticado
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'login') {
        handleLogout();
        return;
      }
      if (
        hash &&
        [
          'resumo-geral-e-horarios',
          'rankings-frota-e-motoristas',
          'central-de-ocorrencias-e-rodovias',
          'premiacao-e-compliance',
          'auditoria-sem-identificacao',
          'painel-admin-e-parametrizacoes',
        ].includes(hash)
      ) {
        setCurrentScreen(hash as ScreenId);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSelectScreen = (screen: ScreenId) => {
    setCurrentScreen(screen);
    window.location.hash = screen;
  };

  const handleLoginSuccess = (user: AuthenticatedUser) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('csg_session_user_v1', JSON.stringify(user));
    } catch {}
    if (user.primeiroAcesso) {
      setIsFirstAccessModalOpen(true);
    }
    showToast(`Autenticação autorizada! Bem-vindo(a), ${user.name}`);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      localStorage.removeItem('csg_session_user_v1');
    } catch {}
    setCurrentUser(null);
    setIsAuthenticated(false);
    window.location.hash = 'login';
    showToast('Sessão encerrada com sucesso no CCO.');
  };

  // Conciliation action: Link driver to an anonymous incident
  const handleLinkDriver = (incidentId: string) => {
    setIncidents((prev) =>
      prev.map((item) => {
        if (item.id === incidentId) {
          const suggestedName = item.suggestedDriver?.name || 'Condutor Conciliado';
          return {
            ...item,
            hasDriver: true,
            driver: suggestedName,
            ibutton: 'CONCILIADO-CCO',
            conciliationStatus: 'CONCILIADO',
          };
        }
        return item;
      })
    );

    // Add audit log entry
    const newLog = createAuditLogEntry(
      `Conciliação retroativa realizada para o evento ${incidentId}`
    );
    appendAuditLog(newLog);

    showToast(`Condutor vinculado com sucesso ao evento telemétrico!`);
    if (selectedIncident && selectedIncident.id === incidentId) {
      setSelectedIncident(null);
    }
  };

  // Save/Update Road parameters
  const handleSaveRoadParam = (param: RoadParameter) => {
    setRoadParams((prev) => {
      const exists = prev.some((p) => p.id === param.id);
      const updated = exists ? prev.map((p) => (p.id === param.id ? param : p)) : [...prev, param];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('csg_road_params_v1', JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });

    const newLog = createAuditLogEntry(
      `Atualização de parâmetros para o trecho ${param.road} (${param.section})`
    );
    appendAuditLog(newLog);

    showToast(`Parâmetros da rodovia ${param.road} atualizados com sucesso!`);
  };

  // Rule settings update
  const handleSaveRules = (minHours: number, baseBonus: string) => {
    const updated: BonusRules = { minHours, baseBonus };
    setBonusRules(updated);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('csg_bonus_rules_v1', JSON.stringify(updated));
      } catch (e) {
        console.warn('Erro ao salvar bonusRules no localStorage:', e);
      }
    }

    const newLog = createAuditLogEntry(
      `Atualização de regras globais: Carga mínima ${minHours}h/mês, Bonificação base R$ ${baseBonus}`
    );
    appendAuditLog(newLog);
    showToast(`Parâmetros e regras salvos com sucesso! Bonificação: R$ ${baseBonus}`);
  };

  // 1. Enquanto checa sessão inicial do navegador
  if (isCheckingSession) {
    return (
      <TelemetryPreloader
        statusText="Validando Sessão Operacional CCO..."
        subText="Verificando credenciais e integridade com o Supabase"
      />
    );
  }

  // 2. Se não autenticado, renderiza obrigatoriamente a tela de login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#090d14] dark:bg-[#090d14] light:bg-[#f1f5f9] text-[#f1f5f9] transition-colors duration-200">
        {toastMessage && (
          <div className="fixed top-6 right-6 z-50 bg-[#1c2432] border border-[#34b344] text-white px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in text-xs font-semibold">
            <span className="material-symbols-outlined text-[#34b344] text-[18px]">
              check_circle
            </span>
            <span>{toastMessage}</span>
          </div>
        )}
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // 3. Se autenticado mas ainda carregando telemetria inicial, exibe o Preloader corporativo
  if (isInitialLoading && incidents.length === 0) {
    return (
      <TelemetryPreloader
        statusText="Sincronizando Telemetria da Frota CSG..."
        subText="Consolidando 9.051 excessos de velocidade, apuração SESMT e conformidade dos 35 veículos"
      />
    );
  }

  // 4. Painel Operacional Carregado
  return (
    <div className="min-h-screen bg-[#0c1017] text-[#f1f5f9]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[#1c2432] border border-[#34b344] text-white px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in text-xs font-semibold">
          <span className="material-symbols-outlined text-[#34b344] text-[18px]">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Corporate Sidebar (Collapsible with Base UI + Framer Motion + Casagrande Identity) */}
      <Sidebar
        collapsed={isSidebarCollapsed}
        onCollapsedChange={setIsSidebarCollapsed}
        mobileOpen={isMobileDrawerOpen}
        onMobileClose={() => setIsMobileDrawerOpen(false)}
        currentScreen={currentScreen}
        onSelectScreen={handleSelectScreen}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
        user={currentUser}
        stats={stats}
      />

      {/* Main Content Area */}
      <div
        className={`w-full transition-[padding-left] duration-240 ease-[cubic-bezier(0.23,1,0.32,1)] pl-0 ${
          isSidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-[272px]'
        }`}
      >
        {/* Fixed Top Header com métricas consistentes */}
        <TopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleMobileMenu={() => setIsMobileDrawerOpen((prev) => !prev)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          onRefreshData={() => loadSupabaseData(false)}
          isRefreshing={isRefreshing}
          stats={
            stats
              ? {
                  totalAlertas: stats.totalAlertas,
                  totalVelocidade: stats.totalVelocidade,
                  totalVeiculos: stats.totalVeiculos,
                  periodo: dynamicPeriodo,
                }
              : {
                  totalAlertas: 16068,
                  totalVelocidade: 9051,
                  totalVeiculos: 35,
                  periodo: dynamicPeriodo,
                }
          }
        />

        <main className="w-full min-w-0 pt-16 px-3 sm:px-4 md:px-6 bg-[#0c1017] min-h-screen transition-colors duration-200">
          {currentScreen === 'resumo-geral-e-horarios' && (
            <ExecutiveSummaryScreen incidents={incidents} filterState={filterState} />
          )}

          {currentScreen === 'rankings-frota-e-motoristas' && (
            <FleetRankingsScreen
              incidents={incidents}
              onSelectDriver={(driver) => setSelectedDriver(driver)}
              drivers={driverScores}
              filterState={filterState}
            />
          )}

          {currentScreen === 'central-de-ocorrencias-e-rodovias' && (
            <IncidentsHighwayScreen
              incidents={incidents}
              onSelectIncident={(inc) => setSelectedIncident(inc)}
              filterState={filterState}
            />
          )}

          {currentScreen === 'premiacao-e-compliance' && (
            <ComplianceBonusScreen
              onSelectDriver={(driver) => setSelectedDriver(driver)}
              drivers={driverScores}
              incidents={incidents}
              filterState={filterState}
              bonusRules={bonusRules}
            />
          )}

          {currentScreen === 'auditoria-sem-identificacao' && (
            <AuditUnidentifiedScreen
              incidents={incidents}
              onSelectIncident={(inc) => setSelectedIncident(inc)}
              onLinkDriver={handleLinkDriver}
              filterState={filterState}
            />
          )}

          {currentScreen === 'painel-admin-e-parametrizacoes' && (
            <AdminParamsScreen
              roadParams={roadParams}
              auditLogs={auditLogs}
              bonusRules={bonusRules}
              onOpenRoadModal={(param) => {
                setEditingRoadParam(param || null);
                setIsRoadModalOpen(true);
              }}
              onSaveRules={handleSaveRules}
            />
          )}
        </main>
      </div>

      {/* Modals Corporativos */}
      <FirstAccessPasswordModal
        isOpen={isFirstAccessModalOpen}
        user={currentUser}
        onPasswordChanged={() => {
          setIsFirstAccessModalOpen(false);
          if (currentUser) {
            const updated: AuthenticatedUser = { ...currentUser, primeiroAcesso: false };
            setCurrentUser(updated);
            try {
              localStorage.setItem('csg_session_user_v1', JSON.stringify(updated));
              localStorage.setItem(`csg_pw_changed_${currentUser.username}`, 'true');
            } catch {}
          }
          showToast('Senha de acesso pessoal gravada com sucesso!');
        }}
        onLogout={handleLogout}
      />

      <UploadSpreadsheetModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={(msg, details) => {
          showToast(msg);
          if (details) {
            const uploadLog = createAuditLogEntry(
              `Upload da planilha "${details.fileName}": ${details.inserted} novos eventos ingeridos, ${details.duplicates} duplicados ignorados`,
              currentUser?.name || 'Operador CCO'
            );
            appendAuditLog(uploadLog);
          }
          loadSupabaseData(true);
        }}
      />

      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onLinkDriver={handleLinkDriver}
      />

      <DriverDetailModal
        driver={selectedDriver}
        onClose={() => setSelectedDriver(null)}
        bonusAmount={bonusRules.baseBonus}
      />

      <RoadParamModal
        param={editingRoadParam}
        isOpen={isRoadModalOpen}
        onClose={() => {
          setIsRoadModalOpen(false);
          setEditingRoadParam(null);
        }}
        onSave={handleSaveRoadParam}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onSelectAlert={(code) => {
          const inc = incidents.find((i) => i.code === code);
          if (inc) setSelectedIncident(inc);
        }}
      />

      <UserProfileModal
        isOpen={isProfileOpen}
        user={currentUser}
        onClose={() => setIsProfileOpen(false)}
        onLogout={handleLogout}
        onChangePassword={() => setIsFirstAccessModalOpen(true)}
      />
    </div>
  );
}
