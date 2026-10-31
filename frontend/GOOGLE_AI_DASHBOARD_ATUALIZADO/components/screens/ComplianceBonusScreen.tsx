'use client';

import React, { useState, useMemo } from 'react';
import {
  INITIAL_DRIVERS,
  INITIAL_INCIDENTS,
  DriverScore,
  Incident,
} from '@/lib/telemetry-data';
import { filterDrivers, convertToCSV, isHeavyVehicleCategory } from '@/lib/telemetry-rules';
import { OperationalFilterBar, useOperationalFilters, OperationalFilterState } from '@/components/OperationalFilterBar';

interface ComplianceBonusScreenProps {
  onSelectDriver: (driver: DriverScore) => void;
  drivers?: DriverScore[];
  incidents?: Incident[];
  filterState?: OperationalFilterState;
}

export default function ComplianceBonusScreen({
  onSelectDriver,
  drivers = INITIAL_DRIVERS,
  incidents = INITIAL_INCIDENTS,
  filterState: externalFilterState,
}: ComplianceBonusScreenProps) {
  const [filterType, setFilterType] = useState<'TODOS' | 'APTOS' | 'INAPTOS'>('TODOS');
  const [isSyncing, setIsSyncing] = useState(false);

  // Sorting state for table columns
  type DriverSortField =
    | 'status'
    | 'name'
    | 'plate'
    | 'limitSpeed'
    | 'maxSpeed'
    | 'deltaSpeed'
    | 'totalAlerts'
    | 'violationsAbove80'
    | 'worstEventLocation';

  const [sortField, setSortField] = useState<DriverSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  const handleSort = (field: DriverSortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortField(null);
      setSortDirection(null);
    }
  };

  const localFilterState = useOperationalFilters(incidents);
  const filterState = externalFilterState || localFilterState;
  const { filteredIncidents, searchQuery, setSearchQuery } = filterState;

  // Dynamically compute DriverScore[] from filteredIncidents (or fallback to INITIAL_DRIVERS)
  const { computedDrivers, kpis, categoryCompliance } = useMemo(() => {
    const dMap = new Map<
      string,
      {
        name: string;
        ibutton: string;
        plate: string;
        vehicleType: string;
        maxSpeed: number;
        totalAlerts: number;
        violationsAbove80: number;
        worstEventLocation: string;
      }
    >();

    const plateMaxMap = new Map<string, { category: string; maxSpeed: number }>();

    for (let i = 0; i < filteredIncidents.length; i++) {
      const inc = filteredIncidents[i];
      const cat = inc.vehicleCategory || 'CAVALO';

      const prevPlate = plateMaxMap.get(inc.plate);
      if (!prevPlate) {
        plateMaxMap.set(inc.plate, { category: cat, maxSpeed: inc.recordedSpeed });
      } else if (inc.recordedSpeed > prevPlate.maxSpeed) {
        prevPlate.maxSpeed = inc.recordedSpeed;
      }

      const drvName = inc.hasDriver ? inc.driver : 'SEM IDENTIFICAÇÃO (TACÓGRAFO)';
      // If driverIdStatus is 'all' or 'identificado', prioritize identified drivers for bonus table,
      // unless user explicitly selected 'sem_identificacao'
      if (!inc.hasDriver && filterState.driverIdStatus !== 'sem_identificacao') {
        continue;
      }

      let dEntry = dMap.get(drvName);
      if (!dEntry) {
        dEntry = {
          name: drvName,
          ibutton: inc.ibutton,
          plate: inc.plate,
          vehicleType: cat,
          maxSpeed: inc.recordedSpeed,
          totalAlerts: 0,
          violationsAbove80: 0,
          worstEventLocation: `${inc.highway} • ${inc.date} ${inc.time}`,
        };
        dMap.set(drvName, dEntry);
      }
      const isHeavy = isHeavyVehicleCategory(cat);
      dEntry.totalAlerts += 1;
      // Contabiliza violações ao teto de 80 km/h estritamente em veículos pesados (Regulamento Seção 2)
      if (isHeavy && inc.recordedSpeed > 80) {
        dEntry.violationsAbove80 += 1;
      }
      if (inc.recordedSpeed > dEntry.maxSpeed) {
        dEntry.maxSpeed = inc.recordedSpeed;
        dEntry.plate = inc.plate;
        dEntry.vehicleType = cat;
        dEntry.worstEventLocation = `${inc.highway} • ${inc.date} ${inc.time}`;
      }
    }

    let list: DriverScore[] = Array.from(dMap.values())
      .sort((a, b) => a.maxSpeed - b.maxSpeed)
      .map((d, idx) => {
        const isCompliant = d.violationsAbove80 === 0 && d.maxSpeed <= 80;
        return {
          rank: idx + 1,
          name: d.name,
          ibutton: d.ibutton,
          plate: d.plate,
          vehicleType: d.vehicleType,
          maxSpeed: Math.round(d.maxSpeed),
          limitSpeed: 80,
          totalAlerts: d.totalAlerts,
          violationsAbove80: d.violationsAbove80,
          worstEventLocation: d.worstEventLocation,
          hoursWorked: 160,
          status: isCompliant ? 'APTO' : 'INAPTO',
          deltaSpeed: Math.round(d.maxSpeed - 80),
        };
      });

    if (list.length === 0 && filteredIncidents.length > 0 && drivers.length > 0) {
      list = drivers;
    }

    const totalDrivers = list.length;
    const aptosCount = list.filter((d) => d.status === 'APTO').length;
    const inaptosCount = list.filter((d) => d.status === 'INAPTO').length;
    const aptosPct =
      totalDrivers > 0 ? ((aptosCount / totalDrivers) * 100).toFixed(1).replace('.', ',') : '0,0';
    const inaptosPct =
      totalDrivers > 0 ? ((inaptosCount / totalDrivers) * 100).toFixed(1).replace('.', ',') : '0,0';

    const worstDriver = [...list].sort((a, b) => b.maxSpeed - a.maxSpeed)[0];
    const bestDriver = list[0];

    // Category compliance breakdown
    const catMap = new Map<string, { total: number; conforme: number; inconforme: number }>();
    plateMaxMap.forEach((info) => {
      let c = catMap.get(info.category);
      if (!c) {
        c = { total: 0, conforme: 0, inconforme: 0 };
        catMap.set(info.category, c);
      }
      c.total += 1;
      if (info.maxSpeed <= 80) c.conforme += 1;
      else c.inconforme += 1;
    });

    const catStats = Array.from(catMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 4)
      .map(([cat, st]) => {
        const confPct = st.total > 0 ? Math.round((st.conforme / st.total) * 100) : 0;
        const incPct = 100 - confPct;
        return {
          category: cat,
          total: st.total,
          conforme: st.conforme,
          inconforme: st.inconforme,
          confPct,
          incPct,
        };
      });

    const totalPlates = plateMaxMap.size;
    const compliantPlates = Array.from(plateMaxMap.values()).filter((p) => p.maxSpeed <= 80).length;

    return {
      computedDrivers: list,
      kpis: {
        totalDrivers,
        aptosCount,
        aptosPct: `${aptosPct}%`,
        inaptosCount,
        inaptosPct: `${inaptosPct}%`,
        compliantPlates,
        totalPlates,
        maxSpeed: worstDriver?.maxSpeed || 0,
        maxPlate: worstDriver?.plate || '--',
        maxDelta: worstDriver?.deltaSpeed || 0,
        bestDriverName: bestDriver?.name || '--',
        bestDriverSpeed: bestDriver?.maxSpeed || 0,
        worstDriverName: worstDriver?.name || '--',
      },
      categoryCompliance: catStats,
    };
  }, [filteredIncidents, drivers, filterState.driverIdStatus]);

  const filteredDrivers = useMemo(() => {
    return filterDrivers(computedDrivers, filterType, searchQuery);
  }, [computedDrivers, filterType, searchQuery]);

  // Dynamic sorting for driver table
  const sortedDrivers = useMemo(() => {
    if (!sortField || !sortDirection) return filteredDrivers;
    const list = [...filteredDrivers];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '');
          break;
        case 'name':
          cmp = (a.name || '').localeCompare(b.name || '');
          break;
        case 'plate':
          cmp = (a.plate || '').localeCompare(b.plate || '');
          break;
        case 'limitSpeed':
          cmp = a.limitSpeed - b.limitSpeed;
          break;
        case 'maxSpeed':
          cmp = a.maxSpeed - b.maxSpeed;
          break;
        case 'deltaSpeed':
          cmp = a.deltaSpeed - b.deltaSpeed;
          break;
        case 'totalAlerts':
          cmp = a.totalAlerts - b.totalAlerts;
          break;
        case 'violationsAbove80':
          cmp = a.violationsAbove80 - b.violationsAbove80;
          break;
        case 'worstEventLocation':
          cmp = (a.worstEventLocation || '').localeCompare(b.worstEventLocation || '');
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredDrivers, sortField, sortDirection]);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1000);
  };

  const handleExportCSV = () => {
    const data = filteredDrivers.map((d) => ({
      StatusPremiacao: d.status === 'APTO' ? 'APTO À BONIFICAÇÃO' : 'INAPTO (>80 KM/H)',
      Motorista: d.name,
      iButton: d.ibutton,
      CaminhaoPlaca: d.plate,
      Categoria: d.vehicleType,
      LimiteTeto: `${d.limitSpeed} km/h`,
      VelocidadeMaxima: `${d.maxSpeed} km/h`,
      DeltaTeto: `${d.deltaSpeed > 0 ? `+${d.deltaSpeed}` : d.deltaSpeed} km/h`,
      TotalAlertas: d.totalAlerts,
      ViolacoesAcima80: d.violationsAbove80,
      PiorRegistro: d.worstEventLocation,
      ValorBonificacao: d.status === 'APTO' ? 'R$ 1.200,00' : 'R$ 0,00',
    }));
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `premiacao_compliance_casagrande_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const chartDrivers = useMemo(() => {
    return computedDrivers.slice(0, 10);
  }, [computedDrivers]);

  return (
    <div className="flex flex-col w-full text-on-surface pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-7 bg-[#34b344] rounded-full shadow-[0_0_8px_#34b344]" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-headline-lg text-xl tracking-tight text-white font-bold">
                Programa de Premiação &amp; Compliance
              </h1>
            </div>
            <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
              Apuração de conformidade de velocidade para bonificação de direção segura. O condutor está apto quando não ultrapassa 80 km/h.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSync}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1c2432] text-[#f1f5f9] border border-[#283548] hover:bg-[#283548] hover:border-[#34b344] transition-colors font-body-sm text-xs cursor-pointer"
            type="button"
          >
            <span
              className={`material-symbols-outlined text-[16px] text-[#34b344] ${
                isSyncing ? 'animate-spin' : ''
              }`}
            >
              sync
            </span>
            <span>{isSyncing ? 'Atualizando...' : 'Atualizar Apuração'}</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#2ca03a] text-white font-semibold text-xs hover:bg-[#34b344] transition shadow-[0_0_12px_rgba(44,160,58,0.35)] cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Exportar Relatório Premiação (CSV)</span>
          </button>
        </div>
      </div>

      {/* Unified 6-Option Operational Filter Bar */}
      <div className="mb-4">
        <OperationalFilterBar
          filterState={filterState}
          totalIncidents={incidents.length}
          title="Filtros Operacionais • Premiação & Compliance"
          onResetExtra={() => setFilterType('TODOS')}
        />
      </div>

      {/* KPI Cards (Industrial Telemetry Grid - Mobile First) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#34b344]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              CONDUTORES AUDITADOS
            </span>
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#2ca03a]/20 border border-[#34b344]/30 text-[#34b344]">
              <span className="material-symbols-outlined text-[15px]">badge</span>
            </div>
          </div>
          <div className="my-1">
            <div className="font-tabular-data text-2xl text-white font-bold tracking-tight">
              {kpis.totalDrivers}
            </div>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">No filtro atual:</span>
            <span className="font-semibold text-[#34b344] text-[11px]">Auditados</span>
          </div>
        </div>

        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#34b344]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              APTOS À BONIFICAÇÃO
            </span>
            <div className="w-6 h-6 rounded bg-[#2ca03a]/20 border border-[#34b344]/30 flex items-center justify-center text-[#34b344]">
              <span className="material-symbols-outlined text-[15px]">verified</span>
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="font-tabular-data text-2xl text-[#34b344] font-bold">
              {kpis.aptosCount}
            </span>
            <span className="font-tabular-data text-[10px] text-[#34b344] font-bold">
              ({kpis.aptosPct})
            </span>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Velocidade:</span>
            <span className="font-tabular-data text-[9px] px-1.5 py-0.2 rounded bg-[#34b344]/20 text-[#34b344] border border-[#34b344]/40 font-bold">
              ≤ 80 KM/H
            </span>
          </div>
        </div>

        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#ef4444]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              INAPTOS / VIOLAÇÃO
            </span>
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#ef4444]/20 border border-[#ef4444]/30 text-[#ef4444]">
              <span className="material-symbols-outlined text-[15px]">cancel</span>
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="font-tabular-data text-2xl text-[#ef4444] font-bold">
              {kpis.inaptosCount}
            </span>
            <span className="font-tabular-data text-[10px] text-[#ef4444] font-bold">
              ({kpis.inaptosPct})
            </span>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Desvio:</span>
            <span className="font-tabular-data text-[9px] px-1.5 py-0.2 rounded bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 font-bold">
              &gt; 80 KM/H
            </span>
          </div>
        </div>

        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#f59e0b]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              VEÍCULOS CONFORMES
            </span>
            <div className="w-6 h-6 rounded bg-[#f59e0b]/20 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b]">
              <span className="material-symbols-outlined text-[15px]">rv_hookup</span>
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1">
            <span className="font-tabular-data text-2xl text-white font-bold">
              {kpis.compliantPlates}
            </span>
            <span className="font-tabular-data text-xs text-[#94a3b8]">/ {kpis.totalPlates}</span>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Placas ≤ 80 km/h:</span>
            <span className="text-white font-medium text-[11px]">No filtro</span>
          </div>
        </div>

        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#ef4444]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              MAIOR PICO REGISTRADO
            </span>
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#ef4444]/20 border border-[#ef4444]/30 text-[#ef4444]">
              <span className="material-symbols-outlined text-[15px]">speed</span>
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1">
            <span className="font-tabular-data text-2xl text-[#ef4444] font-bold">
              {kpis.maxSpeed}
            </span>
            <span className="font-tabular-data text-xs text-[#ef4444]/80">km/h</span>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-white font-semibold text-[11px]">{kpis.maxPlate}</span>
            <span className="text-[#ef4444] font-bold text-[11px]">
              {kpis.maxDelta > 0 ? `+${kpis.maxDelta}` : kpis.maxDelta} km/h
            </span>
          </div>
        </div>

        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#34b344]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              CONFORMIDADE GERAL
            </span>
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#2ca03a]/20 border border-[#34b344]/30 text-[#34b344]">
              <span className="material-symbols-outlined text-[15px]">pie_chart</span>
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="font-tabular-data text-2xl font-bold text-white">{kpis.aptosPct}</span>
            <span className="font-tabular-data text-[10px] text-[#34b344] font-bold">ADESÃO</span>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Regra de ouro:</span>
            <span className="text-[#34b344] font-semibold text-[11px]">Bonificação Ativa</span>
          </div>
        </div>
      </div>

      {/* Primary SVG Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-4">
        {/* Left: Velocidade Máxima vs Teto 80 km/h */}
        <div className="lg:col-span-8 rounded-xl p-4 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548]">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#34b344] text-[18px]">
                  leaderboard
                </span>
                <h2 className="font-headline-sm text-sm text-white font-bold tracking-tight">
                  VELOCIDADE MÁXIMA POR MOTORISTA VS TETO (80 KM/H)
                </h2>
              </div>
              <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
                Comparativo de velocidade máxima atingida no filtro contra o teto regulamentar de 80 km/h
              </span>
            </div>

            <div className="flex items-center gap-2 font-tabular-data text-[10px] flex-wrap">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1c2432] text-[#34b344] border border-[#283548] font-bold">
                <span className="w-2 h-2 rounded-sm bg-[#34b344]" />
                Aptos (≤ 80 km/h)
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1c2432] text-[#ef4444] border border-[#283548] font-bold">
                <span className="w-2 h-2 rounded-sm bg-[#ef4444]" />
                Inaptos (&gt; 80 km/h)
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 font-bold">
                <span className="w-2.5 h-0.5 border-t border-dashed border-[#ef4444]" />
                Corte: 80 km/h
              </span>
            </div>
          </div>

          <span className="sm:hidden text-[9px] text-[#34b344] font-semibold text-center block mt-1">
            ← Deslize para visualizar todos os condutores auditados →
          </span>
          <div className="relative w-full pt-3 mt-1 overflow-x-auto scrollbar-none touch-scroll-x">
            <svg
              className="w-full h-auto min-w-[700px] overflow-visible select-none"
              preserveAspectRatio="none"
              viewBox="0 0 860 300"
            >
              <defs>
                <linearGradient id="gradAptoVerde" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#34b344" />
                  <stop offset="100%" stopColor="#166534" />
                </linearGradient>
                <linearGradient id="gradInaptoVermelho" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#991b1b" />
                </linearGradient>
              </defs>

              <line stroke="#1c2432" strokeWidth="1" x1="50" x2="840" y1="240" y2="240" />
              <text fill="#94a3b8" fontFamily="JetBrains Mono" fontSize="10" textAnchor="end" x="40" y="244">
                0
              </text>

              <line stroke="#1c2432" strokeDasharray="2,3" strokeWidth="1" x1="50" x2="840" y1="180" y2="180" />
              <text fill="#94a3b8" fontFamily="JetBrains Mono" fontSize="10" textAnchor="end" x="40" y="184">
                40
              </text>

              <line stroke="#ef4444" strokeDasharray="4,4" strokeWidth="2" x1="50" x2="840" y1="120" y2="120" />
              <text fill="#ef4444" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700" textAnchor="end" x="40" y="124">
                80
              </text>

              <line stroke="#1c2432" strokeDasharray="2,3" strokeWidth="1" x1="50" x2="840" y1="60" y2="60" />
              <text fill="#94a3b8" fontFamily="JetBrains Mono" fontSize="10" textAnchor="end" x="40" y="64">
                120
              </text>

              {chartDrivers.map((drv, idx) => {
                const slotWidth = 760 / Math.max(chartDrivers.length, 1);
                const barWidth = Math.min(56, slotWidth - 14);
                const x = 65 + idx * slotWidth;
                const centerX = x + barWidth / 2;
                const barH = Math.min(200, Math.max(20, Math.round(drv.maxSpeed * 1.5)));
                const y = 240 - barH;
                const isApto = drv.status === 'APTO';
                const shortName = drv.name.split(' ').slice(0, 2).join(' ').slice(0, 12);

                return (
                  <g
                    key={`${drv.name}-${idx}`}
                    className="cursor-pointer"
                    onClick={() => onSelectDriver(drv)}
                  >
                    <rect
                      fill={isApto ? 'url(#gradAptoVerde)' : 'url(#gradInaptoVermelho)'}
                      height={barH}
                      rx="3"
                      width={barWidth}
                      x={x}
                      y={y}
                    />
                    <text
                      fill={isApto ? '#ffffff' : '#ef4444'}
                      fontFamily="JetBrains Mono"
                      fontSize="11"
                      fontWeight="700"
                      textAnchor="middle"
                      x={centerX}
                      y={y - 7}
                    >
                      {drv.maxSpeed}
                    </text>
                    <text
                      fill="#f1f5f9"
                      fontFamily="Inter"
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                      x={centerX}
                      y="260"
                    >
                      {shortName}
                    </text>
                    <text
                      fill={isApto ? '#34b344' : '#ef4444'}
                      fontFamily="JetBrains Mono"
                      fontSize="9"
                      fontWeight="700"
                      textAnchor="middle"
                      x={centerX}
                      y="275"
                    >
                      {isApto ? 'APTO' : `+${drv.deltaSpeed} km/h`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-3 pt-2 border-t border-[#283548] flex items-center justify-between text-xs font-tabular-data">
            <span className="flex items-center gap-1.5 text-[#34b344]">
              <span className="material-symbols-outlined text-[16px]">speed</span>
              Menor velocidade máxima:{' '}
              <strong className="text-white">{kpis.bestDriverSpeed} km/h</strong> ({kpis.bestDriverName})
            </span>
            <span className="flex items-center gap-1.5 text-[#ef4444]">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              Maior velocidade: <strong className="text-white">{kpis.maxSpeed} km/h</strong> ({kpis.worstDriverName})
            </span>
          </div>
        </div>

        {/* Right: Conformidade por Categoria */}
        <div className="lg:col-span-4 rounded-xl p-4 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548]">
          <div className="flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#283548]">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#f59e0b] text-[18px]">category</span>
                <h2 className="font-headline-sm text-sm text-white font-bold tracking-tight">
                  CONFORMIDADE POR CATEGORIA
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#1c2432] text-[#34b344] border border-[#283548] font-tabular-data text-[10px] font-bold">
                FROTA FILTRADA
              </span>
            </div>

            <p className="font-body-sm text-xs text-[#94a3b8] mb-3">
              Proporção de placas com velocidade máxima ≤ 80 km/h por categoria:
            </p>

            <div className="space-y-3">
              {categoryCompliance.length === 0 ? (
                <div className="text-xs text-[#64748b] py-6 text-center">
                  Sem registros no filtro atual.
                </div>
              ) : (
                categoryCompliance.map((cat) => (
                  <div key={cat.category} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-[#34b344]">
                          local_shipping
                        </span>
                        {cat.category} ({cat.total} placas)
                      </span>
                      <span className="font-tabular-data text-[#f59e0b] font-bold">
                        {cat.confPct}% Conformes
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#1c2432] overflow-hidden flex">
                      <div className="h-full bg-[#34b344]" style={{ width: `${cat.confPct}%` }} />
                      <div className="h-full bg-[#ef4444]" style={{ width: `${cat.incPct}%` }} />
                    </div>
                    <div className="flex justify-between font-tabular-data text-[10px] text-[#94a3b8]">
                      <span className="text-[#34b344] font-semibold">
                        {cat.conforme} Conformes ({cat.confPct}%)
                      </span>
                      <span className="text-[#ef4444] font-semibold">
                        {cat.inconforme} Inconformes ({cat.incPct}%)
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 p-2.5 rounded-lg bg-[#0c1017] border border-[#283548] flex items-start gap-2 shadow-sm">
              <span className="material-symbols-outlined text-[#34b344] text-[18px] flex-shrink-0 mt-0.5">
                gavel
              </span>
              <div className="flex flex-col text-xs">
                <span className="font-semibold text-white">Critério Rígido de Bonificação</span>
                <span className="text-[#94a3b8] text-[11px]">
                  Qualquer velocidade &gt; 80 km/h registrada desclassifica o condutor para o ciclo mensal.
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-[#283548] flex items-center justify-between font-tabular-data text-xs">
            <span className="text-[#94a3b8] text-[10px] uppercase">LOTE DE FECHAMENTO:</span>
            <span className="text-[#34b344] font-bold">2026.10-CASAGRANDE</span>
          </div>
        </div>
      </div>

      {/* Matriz Analítica: Motorista x Caminhão Conduzido */}
      <div className="rounded-xl shadow-sm border border-[#283548] overflow-hidden flex flex-col mb-4 bg-[#131923]">
        <div className="p-3 bg-[#131923] border-b border-[#283548] flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-[18px] pointer-events-none flex items-center">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar condutor, caminhão ou placa..."
              className="w-full bg-[#1c2432] border border-[#283548] rounded pl-9 pr-3 py-1.5 font-body-sm text-xs text-[#f1f5f9] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#34b344] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap">
            <div className="flex items-center gap-1 bg-[#0c1017] p-0.5 rounded border border-[#283548]">
              <button
                type="button"
                onClick={() => setFilterType('TODOS')}
                className={`px-3 py-1 rounded font-tabular-data text-[10px] font-bold cursor-pointer ${
                  filterType === 'TODOS'
                    ? 'bg-[#2ca03a] text-white shadow-sm'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                TODOS ({kpis.totalDrivers})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('APTOS')}
                className={`px-3 py-1 rounded font-tabular-data text-[10px] font-bold cursor-pointer ${
                  filterType === 'APTOS'
                    ? 'bg-[#2ca03a] text-white shadow-sm'
                    : 'text-[#34b344] hover:text-white'
                }`}
              >
                APTOS ({kpis.aptosCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('INAPTOS')}
                className={`px-3 py-1 rounded font-tabular-data text-[10px] font-bold cursor-pointer ${
                  filterType === 'INAPTOS'
                    ? 'bg-[#ef4444] text-white shadow-sm'
                    : 'text-[#ef4444] hover:text-white'
                }`}
              >
                INAPTOS ({kpis.inaptosCount})
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#2ca03a] hover:bg-[#34b344] text-white font-semibold text-xs transition-all shadow-[0_0_10px_rgba(44,160,58,0.3)] cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* High Density Table */}
        <div className="w-full overflow-x-auto scrollbar-visible touch-scroll-x">
          <table className="w-full text-left font-tabular-data text-xs whitespace-nowrap min-w-[1050px]">
            <thead>
              <tr className="bg-[#0c1017] text-[#94a3b8] text-[10px] tracking-wider uppercase border-b border-[#283548]">
                <th
                  onClick={() => handleSort('status')}
                  className="py-2.5 px-3 font-bold text-center cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Status Premiação (menor/maior)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>STATUS PREMIAÇÃO</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'status' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-2.5 px-3 font-bold cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Motorista (A-Z / Z-A)"
                >
                  <div className="flex items-center gap-1">
                    <span>MOTORISTA IDENTIFICADO</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'name' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('plate')}
                  className="py-2.5 px-3 font-bold cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Veículo / Placa (A-Z / Z-A)"
                >
                  <div className="flex items-center gap-1">
                    <span>VEÍCULO / PLACA</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'plate' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'plate' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('limitSpeed')}
                  className="py-2.5 px-3 font-bold text-center cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Limite Teto (menor/maior)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>LIMITE TETO</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'limitSpeed' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'limitSpeed' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('maxSpeed')}
                  className="py-2.5 px-3 font-bold text-center cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Vel. Máxima (menor/maior)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>VEL. MÁXIMA</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'maxSpeed' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'maxSpeed' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('deltaSpeed')}
                  className="py-2.5 px-3 font-bold text-right cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Delta Teto (menor/maior)"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>DELTA TETO</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'deltaSpeed' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'deltaSpeed' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalAlerts')}
                  className="py-2.5 px-3 font-bold text-center cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Total Alertas (menor/maior)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>TOTAL ALERTAS</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'totalAlerts' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'totalAlerts' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('violationsAbove80')}
                  className="py-2.5 px-3 font-bold text-center cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Violações (>80) (menor/maior)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>VIOLAÇÕES (&gt;80)</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'violationsAbove80' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'violationsAbove80' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('worstEventLocation')}
                  className="py-2.5 px-3 font-bold cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Pior Registro Em (A-Z / Z-A)"
                >
                  <div className="flex items-center gap-1">
                    <span>PIOR REGISTRO EM</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'worstEventLocation' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'worstEventLocation' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="py-2.5 px-3 font-bold text-center">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#283548]">
              {sortedDrivers.map((item) => (
                <tr
                  key={`${item.name}-${item.rank}`}
                  className={`hover:bg-[#1c2432]/70 transition-colors ${
                    item.status === 'APTO' ? 'bg-[#131923]' : 'bg-[#ef4444]/10'
                  }`}
                >
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border font-bold text-[10px] ${
                        item.status === 'APTO'
                          ? 'bg-[#2ca03a]/20 text-[#34b344] border-[#34b344]/40 shadow-[0_0_8px_rgba(52,179,68,0.2)]'
                          : 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {item.status === 'APTO' ? 'verified' : 'cancel'}
                      </span>
                      <span>
                        {item.status === 'APTO' ? 'APTO À BONIFICAÇÃO' : 'INAPTO (> 80 KM/H)'}
                      </span>
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                          item.status === 'APTO'
                            ? 'bg-[#2ca03a]/20 border border-[#34b344]/40 text-[#34b344]'
                            : 'bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444]'
                        }`}
                      >
                        {item.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{item.name}</span>
                        <span className="text-[#94a3b8] text-[10px]">iButton: {item.ibutton}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        item.status === 'APTO'
                          ? 'bg-[#1c2432] text-[#34b344] border-[#283548]'
                          : 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40'
                      }`}
                    >
                      {item.plate} ({item.vehicleType})
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center text-[#94a3b8]">{item.limitSpeed} km/h</td>
                  <td
                    className={`py-2 px-3 text-center font-bold text-xs ${
                      item.status === 'APTO' ? 'text-[#34b344]' : 'text-[#ef4444]'
                    }`}
                  >
                    {item.maxSpeed} km/h
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-bold ${
                      item.status === 'APTO' ? 'text-[#34b344]' : 'text-[#ef4444]'
                    }`}
                  >
                    {item.deltaSpeed > 0 ? `+${item.deltaSpeed}` : item.deltaSpeed} km/h
                  </td>
                  <td className="py-2 px-3 text-center font-semibold text-white">
                    {item.totalAlerts}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                        item.violationsAbove80 === 0
                          ? 'bg-[#2ca03a]/20 text-[#34b344] border-[#34b344]/30'
                          : 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40'
                      }`}
                    >
                      {item.violationsAbove80}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-[#94a3b8]">{item.worstEventLocation}</td>
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onSelectDriver(item)}
                      className={`px-2.5 py-1 rounded border font-semibold text-xs cursor-pointer ${
                        item.status === 'APTO'
                          ? 'bg-[#1c2432] text-[#34b344] border-[#283548] hover:bg-[#283548]'
                          : 'bg-[#1c2432] text-[#ef4444] border-[#283548] hover:bg-[#283548]'
                      }`}
                    >
                      Ver Dossiê
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0c1017] border-t border-[#283548] flex flex-col md:flex-row items-center justify-between gap-2 text-xs">
          <span className="font-tabular-data text-[#94a3b8]">
            Exibindo <strong className="text-white">{filteredDrivers.length}</strong> de{' '}
            <strong className="text-white">{kpis.totalDrivers}</strong> condutores auditados no filtro
          </span>
          <div className="flex items-center gap-1 font-tabular-data text-xs">
            <span className="text-[#34b344] font-semibold">
              Valor Total Previsto em Bonificação:{' '}
            </span>
            <strong className="text-white">
              {' '}
              R$ {(kpis.aptosCount * 1200).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({kpis.aptosCount} condutores x R$ 1.200,00)
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
