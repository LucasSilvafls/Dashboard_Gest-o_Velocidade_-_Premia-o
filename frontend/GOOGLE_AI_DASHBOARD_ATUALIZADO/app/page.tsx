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
import LoginScreen from '@/components/screens/LoginScreen';
import UploadSpreadsheetModal from '@/components/UploadSpreadsheetModal';

import {
  INITIAL_INCIDENTS,
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
} from '@/lib/telemetry-rules';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('resumo-geral-e-horarios');
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);
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

  // Carrega dados em tempo real do Supabase acionado pelo usuário
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
    }
  }, [showToast]);

  // Carga inicial assíncrona com cancelamento seguro sem disparar cascading renders
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
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Período responsivo: obtém dinamicamente do Supabase (stats.periodo) ou calcula diretamente dos dados de telemetria
  const dynamicPeriodo = useMemo(() => {
    if (stats?.periodo) return stats.periodo;
    if (incidents && incidents.length > 0) {
      const { minTs, maxTs } = getDatasetDateBounds(incidents);
      return formatTimestampsToPeriodDisplay(minTs, maxTs);
    }
    return '26/09 a 25/10/2026';
  }, [stats?.periodo, incidents]);

  // Collapsible Sidebar state (collapses to icon rail, expands on toggle/command)
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

  // URL hash navigation support
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'login') {
        setIsAuthenticated(false);
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
        setIsAuthenticated(true);
        setCurrentScreen(hash as ScreenId);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSelectScreen = (screen: ScreenId) => {
    setIsAuthenticated(true);
    setCurrentScreen(screen);
    window.location.hash = screen;
  };

  const handleLoginSuccess = (user: { name: string; role: string; email: string }) => {
    setIsAuthenticated(true);
    window.location.hash = currentScreen;
    showToast(`Autenticação autorizada! Bem-vindo(a), ${user.name}`);
  };

  const handleLogout = () => {
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
    const newLog = createAuditLogEntry(
      `Salvar parâmetros globais: ${minHours}h mínimas, R$ ${baseBonus} bonificação`
    );
    appendAuditLog(newLog);
    showToast(`Parâmetros e regras propagados para os 35 veículos da frota!`);
  };

  // If unauthenticated, render the dedicated responsive Login screen
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
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

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
        stats={stats}
      />

      {/* Main Content Area - Responsive padding: 0 on mobile/tablet, 68px/272px on desktop */}
      <div
        className={`w-full transition-[padding-left] duration-240 ease-[cubic-bezier(0.23,1,0.32,1)] pl-0 ${
          isSidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-[272px]'
        }`}
      >
        {/* Fixed Top Header */}
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
                  periodo: stats.periodo || dynamicPeriodo,
                }
              : {
                  totalAlertas: incidents.length || 16068,
                  totalVelocidade: 9051,
                  totalVeiculos: 35,
                  periodo: dynamicPeriodo,
                }
          }
        />

        <main className="w-full min-w-0 pt-16 px-3 sm:px-4 md:px-6 bg-[#0c1017] min-h-screen transition-colors duration-200">
          {currentScreen === 'resumo-geral-e-horarios' && (
            <ExecutiveSummaryScreen incidents={incidents} />
          )}

          {currentScreen === 'rankings-frota-e-motoristas' && (
            <FleetRankingsScreen
              incidents={incidents}
              onSelectDriver={(driver) => setSelectedDriver(driver)}
              drivers={driverScores}
            />
          )}

          {currentScreen === 'central-de-ocorrencias-e-rodovias' && (
            <IncidentsHighwayScreen
              incidents={incidents}
              onSelectIncident={(inc) => setSelectedIncident(inc)}
            />
          )}

          {currentScreen === 'premiacao-e-compliance' && (
            <ComplianceBonusScreen
              incidents={incidents}
              onSelectDriver={(driver) => setSelectedDriver(driver)}
              drivers={driverScores}
            />
          )}

          {currentScreen === 'auditoria-sem-identificacao' && (
            <AuditUnidentifiedScreen
              incidents={incidents}
              onSelectIncident={(inc) => setSelectedIncident(inc)}
              onLinkDriver={handleLinkDriver}
            />
          )}

          {currentScreen === 'painel-admin-e-parametrizacoes' && (
            <AdminParamsScreen
              roadParams={roadParams}
              auditLogs={auditLogs}
              onOpenRoadModal={(param) => {
                setEditingRoadParam(param || null);
                setIsRoadModalOpen(true);
              }}
              onSaveRules={handleSaveRules}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <UploadSpreadsheetModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={(msg, details) => {
          showToast(msg);
          if (details) {
            const uploadLog = createAuditLogEntry(
              `Upload da planilha "${details.fileName}": ${details.inserted} novos eventos ingeridos, ${details.duplicates} duplicados ignorados`
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
        onClose={() => setIsProfileOpen(false)}
        onLogout={handleLogout}
      />
    </div>
  );
}
