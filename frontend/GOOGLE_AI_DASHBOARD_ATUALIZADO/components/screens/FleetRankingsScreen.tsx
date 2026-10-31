'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  INITIAL_DRIVERS,
  INITIAL_INCIDENTS,
  DriverScore,
  Incident,
} from '@/lib/telemetry-data';
import { convertToCSV } from '@/lib/telemetry-rules';
import { OperationalFilterBar, useOperationalFilters } from '@/components/OperationalFilterBar';

interface FleetRankingsScreenProps {
  onSelectDriver: (driver: DriverScore) => void;
  drivers?: DriverScore[];
  incidents?: Incident[];
}

export default function FleetRankingsScreen({
  onSelectDriver,
  drivers = INITIAL_DRIVERS,
  incidents = INITIAL_INCIDENTS,
}: FleetRankingsScreenProps) {
  const [rankingMode, setRankingMode] = useState<'plate' | 'category'>('plate');
  const [selectedPlate, setSelectedPlate] = useState<string>('SMB0C86');
  const [isSyncing, setIsSyncing] = useState(false);

  const filterState = useOperationalFilters(incidents);
  const { filteredIncidents, plate: filterPlate } = filterState;

  // Sync quick lookup plate when Filter 5 (Placa do Veículo) is chosen (sem cascading renders)
  const [prevFilterPlate, setPrevFilterPlate] = useState<string | null>(null);
  if (filterPlate && filterPlate !== 'all' && filterPlate !== prevFilterPlate) {
    setPrevFilterPlate(filterPlate);
    setSelectedPlate(filterPlate);
  }

  // Dynamic aggregation by Vehicle Plate and by Category from filteredIncidents
  const {
    vehicleStatsList,
    categoryStatsList,
    driverStatsList,
    kpis,
  } = useMemo(() => {
    const vMap = new Map<
      string,
      {
        plate: string;
        model: string;
        category: string;
        total: number;
        b1: number;
        b2: number;
        b3: number;
        maxSpeed: number;
        sumDelta: number;
        highwayCounts: Map<string, number>;
        driversMap: Map<
          string,
          { name: string; ibutton: string; lastSeen: string; count: number; maxSpeed: number }
        >;
      }
    >();

    const cMap = new Map<
      string,
      { category: string; total: number; b1: number; b2: number; b3: number }
    >();

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
        severeCount: number;
        worstEventLocation: string;
      }
    >();

    let identifiedEvents = 0;
    let unidentifiedEvents = 0;

    for (let i = 0; i < filteredIncidents.length; i++) {
      const inc = filteredIncidents[i];
      const cat = inc.vehicleCategory || 'CAVALO';

      // Vehicle stats
      let vEntry = vMap.get(inc.plate);
      if (!vEntry) {
        vEntry = {
          plate: inc.plate,
          model: inc.vehicleModel || cat,
          category: cat,
          total: 0,
          b1: 0,
          b2: 0,
          b3: 0,
          maxSpeed: 0,
          sumDelta: 0,
          highwayCounts: new Map(),
          driversMap: new Map(),
        };
        vMap.set(inc.plate, vEntry);
      }
      vEntry.total += 1;
      if (inc.deltaSpeed > 30) vEntry.b3 += 1;
      else if (inc.deltaSpeed > 10) vEntry.b2 += 1;
      else vEntry.b1 += 1;
      if (inc.recordedSpeed > vEntry.maxSpeed) vEntry.maxSpeed = inc.recordedSpeed;
      vEntry.sumDelta += inc.deltaSpeed;
      vEntry.highwayCounts.set(inc.highway, (vEntry.highwayCounts.get(inc.highway) || 0) + 1);

      const drvKey = inc.hasDriver ? inc.driver : 'NÃO IDENTIFICADO (SEM CRACHÁ)';
      const drvPrev = vEntry.driversMap.get(drvKey);
      if (!drvPrev) {
        vEntry.driversMap.set(drvKey, {
          name: drvKey,
          ibutton: inc.ibutton,
          lastSeen: `${inc.date} ${inc.time} (${inc.highway})`,
          count: 1,
          maxSpeed: inc.recordedSpeed,
        });
      } else {
        drvPrev.count += 1;
        if (inc.recordedSpeed > drvPrev.maxSpeed) drvPrev.maxSpeed = inc.recordedSpeed;
      }

      // Category stats
      let cEntry = cMap.get(cat);
      if (!cEntry) {
        cEntry = { category: cat, total: 0, b1: 0, b2: 0, b3: 0 };
        cMap.set(cat, cEntry);
      }
      cEntry.total += 1;
      if (inc.deltaSpeed > 30) cEntry.b3 += 1;
      else if (inc.deltaSpeed > 10) cEntry.b2 += 1;
      else cEntry.b1 += 1;

      // Driver stats
      if (inc.hasDriver) {
        identifiedEvents += 1;
        let dEntry = dMap.get(inc.driver);
        if (!dEntry) {
          dEntry = {
            name: inc.driver,
            ibutton: inc.ibutton,
            plate: inc.plate,
            vehicleType: cat,
            maxSpeed: inc.recordedSpeed,
            totalAlerts: 0,
            violationsAbove80: 0,
            severeCount: 0,
            worstEventLocation: `${inc.highway} • ${inc.date} ${inc.time}`,
          };
          dMap.set(inc.driver, dEntry);
        }
        dEntry.totalAlerts += 1;
        if (inc.recordedSpeed > 80) dEntry.violationsAbove80 += 1;
        if (inc.deltaSpeed > 10) dEntry.severeCount += 1;
        if (inc.recordedSpeed > dEntry.maxSpeed) {
          dEntry.maxSpeed = inc.recordedSpeed;
          dEntry.worstEventLocation = `${inc.highway} • ${inc.date} ${inc.time}`;
        }
      } else {
        unidentifiedEvents += 1;
      }
    }

    const vList = Array.from(vMap.values()).sort((a, b) => b.total - a.total);
    const cList = Array.from(cMap.values()).sort((a, b) => b.total - a.total);
    const dList: DriverScore[] = Array.from(dMap.values())
      .sort((a, b) => b.totalAlerts - a.totalAlerts)
      .map((d, index) => ({
        rank: index + 1,
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
        status: d.maxSpeed <= 80 ? 'APTO' : 'INAPTO',
        deltaSpeed: Math.round(d.maxSpeed - 80),
      }));

    const finalDrivers = dList.length > 0 ? dList : drivers;
    const totalEvents = Math.max(filteredIncidents.length, 1);
    const topVehicle = vList[0];
    const topDriver = dList[0];
    const mostSevereVehicle = [...vList].sort((a, b) => b.b3 - a.b3)[0];
    const highRiskDrivers = dList.filter((d) => d.totalAlerts >= 20).length;
    const recurrencePct =
      dList.length > 0 ? ((highRiskDrivers / dList.length) * 100).toFixed(1).replace('.', ',') : '0,0';

    return {
      vehicleStatsList: vList,
      categoryStatsList: cList,
      driverStatsList: finalDrivers,
      kpis: {
        auditedDriversCount: dList.length,
        highRiskDrivers,
        recurrencePct: `${recurrencePct}%`,
        criticalPlate: topVehicle?.plate || '--',
        criticalPlateModel: topVehicle?.category || '--',
        criticalPlateTotal: topVehicle?.total || 0,
        criticalDriverName: topDriver?.name || 'NENHUM CONDUTOR ID.',
        criticalDriverTotal: topDriver?.totalAlerts || 0,
        severeFocusedCount: mostSevereVehicle?.b3 || 0,
        severeFocusedPlate: mostSevereVehicle?.plate || '--',
        severeFocusedMaxSpeed: Math.round(mostSevereVehicle?.maxSpeed || 0),
        identifiedEvents,
        identifiedPct: `${((identifiedEvents / totalEvents) * 100).toFixed(1).replace('.', ',')}%`,
        unidentifiedEvents,
        unidentifiedPct: `${((unidentifiedEvents / totalEvents) * 100).toFixed(1).replace('.', ',')}%`,
      },
    };
  }, [filteredIncidents, drivers]);

  // Ensure selectedPlate defaults to a valid plate in current list
  const activeVehicleSummary = useMemo(() => {
    const found =
      vehicleStatsList.find((v) => v.plate === selectedPlate) || vehicleStatsList[0];
    if (!found) {
      return {
        plate: selectedPlate,
        model: 'Sem ocorrências no filtro atual',
        category: '--',
        totalExcesses: 0,
        maxSpeed: 0,
        avgAboveLimit: 0,
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        lowSeverityCount: 0,
        fleetSharePercent: 0,
        criticalHighway: '--',
        recentDrivers: [],
      };
    }

    let topHighway = 'Rodovia Operacional';
    let topHCount = 0;
    found.highwayCounts.forEach((cnt, hw) => {
      if (cnt > topHCount) {
        topHCount = cnt;
        topHighway = hw;
      }
    });

    const recentDrivers = Array.from(found.driversMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((d) => ({
        name: d.name,
        ibutton: d.ibutton,
        lastSeen: d.lastSeen,
        excessesOnPlate: d.count,
        maxSpeed: Math.round(d.maxSpeed),
        complianceStatus:
          d.name.includes('NÃO IDENTIFICADO')
            ? ('AUDITORIA CCO' as const)
            : d.maxSpeed <= 80
              ? ('CONFORME' as const)
              : ('ADVERTÊNCIA' as const),
      }));

    return {
      plate: found.plate,
      model: found.model,
      category: found.category,
      totalExcesses: found.total,
      maxSpeed: Math.round(found.maxSpeed),
      avgAboveLimit: Number((found.sumDelta / Math.max(found.total, 1)).toFixed(1)),
      highSeverityCount: found.b3,
      mediumSeverityCount: found.b2,
      lowSeverityCount: found.b1,
      fleetSharePercent: Number(
        ((found.total / Math.max(filteredIncidents.length, 1)) * 100).toFixed(1)
      ),
      criticalHighway: topHighway,
      recentDrivers,
    };
  }, [vehicleStatsList, selectedPlate, filteredIncidents.length]);

  const maxDriverAlerts = useMemo(() => {
    return driverStatsList[0]?.totalAlerts || 1;
  }, [driverStatsList]);

  const topBarsData = useMemo(() => {
    const source =
      rankingMode === 'plate'
        ? vehicleStatsList.slice(0, 10).map((v) => ({
            key: v.plate,
            label: v.plate,
            total: v.total,
            b1: v.b1,
            b2: v.b2,
            b3: v.b3,
            active: v.plate === activeVehicleSummary.plate,
          }))
        : categoryStatsList.slice(0, 10).map((c) => ({
            key: c.category,
            label: c.category,
            total: c.total,
            b1: c.b1,
            b2: c.b2,
            b3: c.b3,
            active: filterState.vehicleCategory === c.category,
          }));

    const maxTot = Math.max(...source.map((s) => s.total), 1);
    return source.map((s) => {
      const tot = Math.max(s.total, 1);
      const f3 = Math.round((s.b3 / tot) * 100);
      const f2 = Math.round((s.b2 / tot) * 100);
      const f1 = Math.max(0, 100 - f3 - f2);
      const h = `${Math.max(12, Math.round((s.total / maxTot) * 95))}%`;
      return { ...s, f3, f2, f1, h };
    });
  }, [rankingMode, vehicleStatsList, categoryStatsList, activeVehicleSummary.plate, filterState.vehicleCategory]);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1000);
  };

  const handleExportRanking = () => {
    const data = driverStatsList.map((d) => ({
      Ranking: d.rank,
      Motorista: d.name,
      iButton: d.ibutton,
      Placa: d.plate,
      VelocidadeMaxima: `${d.maxSpeed} km/h`,
      Alertas: d.totalAlerts,
      ViolacoesAcima80: d.violationsAbove80,
      Status: d.status,
    }));
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ranking_motoristas_casagrande_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const bestDriver = useMemo(() => {
    if (driverStatsList.length === 0) return null;
    return [...driverStatsList].sort((a, b) => a.totalAlerts - b.totalAlerts)[0];
  }, [driverStatsList]);

  return (
    <div className="flex flex-col w-full text-on-surface pb-6 animate-fade-in">
      {/* Screen Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-7 bg-[#34b344] rounded-full shadow-[0_0_8px_#34b344]" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-headline-lg text-xl tracking-tight text-white font-bold">
                Painel de Rankings &amp; Performance
              </h1>
            </div>
            <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
              Ranking e desempenho de placas e condutores auditados
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
            <span>{isSyncing ? 'Atualizando...' : 'Atualizar Telemetria'}</span>
          </button>
          <button
            onClick={handleExportRanking}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#2ca03a] text-white font-semibold text-xs hover:bg-[#34b344] transition shadow-[0_0_12px_rgba(44,160,58,0.35)] cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Exportar Ranking</span>
          </button>
        </div>
      </div>

      {/* Unified 6-Option Operational Filter Bar */}
      <div className="mb-4">
        <OperationalFilterBar
          filterState={filterState}
          totalIncidents={incidents.length}
          title="Filtros Operacionais • Rankings Frota & Motoristas"
          showSearch={true}
        />
      </div>

      {/* KPI Cards (Industrial Telemetry Grid - Mobile First) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {/* Card 1 */}
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#34b344]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              CONDUTORES COM CRACHÁ
            </span>
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#2ca03a]/20 text-[#34b344] border border-[#34b344]/30">
              <span className="material-symbols-outlined text-[15px]">badge</span>
            </div>
          </div>
          <div className="my-1">
            <div className="font-tabular-data text-2xl text-white font-bold tracking-tight">
              {kpis.auditedDriversCount}
            </div>
            <div className="font-tabular-data text-[11px] text-[#94a3b8]">Motoristas no filtro</div>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Status:</span>
            <span className="font-semibold text-[#34b344] text-[11px]">iButton Ativo</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#f59e0b]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              ÍNDICE DE REINCIDÊNCIA
            </span>
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
              <span className="material-symbols-outlined text-[15px]">repeat</span>
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1">
            <span className="font-tabular-data text-2xl font-bold text-[#f59e0b]">
              {kpis.recurrencePct}
            </span>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Coorte:</span>
            <span className="font-tabular-data text-[9px] px-1.5 py-0.2 rounded bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30 font-bold">
              {kpis.highRiskDrivers} DE {kpis.auditedDriversCount} REINCIDENTES
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#ef4444]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              PLACA MAIS CRÍTICA
            </span>
            <div className="w-6 h-6 rounded bg-[#ef4444]/20 border border-[#ef4444]/30 flex items-center justify-center text-[#ef4444]">
              <span className="material-symbols-outlined text-[15px]">local_shipping</span>
            </div>
          </div>
          <div className="my-1">
            <div className="font-tabular-data text-xl text-white font-bold">{kpis.criticalPlate}</div>
            <div className="font-tabular-data text-[11px] text-[#94a3b8] truncate">
              Categoria: {kpis.criticalPlateModel}
            </div>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Total excessos:</span>
            <span className="font-semibold text-[#ef4444] text-[11px]">
              {kpis.criticalPlateTotal.toLocaleString('pt-BR')} ocorrências
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#ef4444]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              CONDUTOR MAIS CRÍTICO
            </span>
            <div className="w-6 h-6 rounded bg-[#ef4444]/20 border border-[#ef4444]/30 flex items-center justify-center text-[#ef4444]">
              <span className="material-symbols-outlined text-[15px]">warning</span>
            </div>
          </div>
          <div className="my-1">
            <div className="font-headline-sm text-xs text-white font-bold uppercase truncate">
              {kpis.criticalDriverName}
            </div>
            <div className="font-tabular-data text-[11px] text-[#94a3b8]">
              {kpis.criticalDriverTotal.toLocaleString('pt-BR')} infrações c/ iButton
            </div>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">No filtro atual:</span>
            <span className="font-tabular-data text-[9px] px-1.5 py-0.2 rounded bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30 font-bold">
              TOP 1
            </span>
          </div>
        </div>

        {/* Card 5 */}
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#f59e0b]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              GRAVES CONCENTRADAS
            </span>
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
              <span className="material-symbols-outlined text-[15px]">report_problem</span>
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="font-tabular-data text-2xl text-[#ef4444] font-bold">
              {kpis.severeFocusedCount}
            </span>
            <span className="font-tabular-data text-[10px] text-[#94a3b8]">
              no {kpis.severeFocusedPlate}
            </span>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Velocidade pico:</span>
            <span className="font-semibold text-[#ef4444] text-[11px]">
              {kpis.severeFocusedMaxSpeed} km/h
            </span>
          </div>
        </div>

        {/* Card 6 */}
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#34b344]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              TAXA DE IDENTIFICAÇÃO
            </span>
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#2ca03a]/20 border border-[#34b344]/30 text-[#34b344]">
              <span className="material-symbols-outlined text-[15px]">fingerprint</span>
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="font-tabular-data text-2xl text-[#34b344] font-bold">
              {kpis.identifiedPct}
            </span>
            <span className="font-tabular-data text-[10px] text-[#94a3b8]">
              {kpis.identifiedEvents.toLocaleString('pt-BR')} id.
            </span>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Sem Crachá:</span>
            <span className="font-tabular-data text-[9px] px-1.5 py-0.2 rounded font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
              {kpis.unidentifiedPct} ({kpis.unidentifiedEvents.toLocaleString('pt-BR')})
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Grid: Top Vehicles + Drivers Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-4">
        {/* Left: Top 10 Veículos / Categorias */}
        <div
          className="lg:col-span-7 rounded-xl p-4 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548]"
          style={{ backgroundColor: '#131923', border: '1px solid #283548' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#34b344] text-[18px]">
                  local_shipping
                </span>
                <span className="font-headline-sm text-sm text-white font-bold tracking-tight">
                  {rankingMode === 'plate'
                    ? 'OS 10 VEÍCULOS COM MAIS OCORRÊNCIAS'
                    : 'OCORRÊNCIAS POR CATEGORIA DE VEÍCULO'}
                </span>
              </div>
              <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
                {rankingMode === 'plate'
                  ? 'Clique em uma placa para inspecionar sua ficha abaixo'
                  : 'Clique em uma categoria para filtrar toda a página'}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[#0c1017] p-0.5 rounded border border-[#283548]">
              <button
                type="button"
                onClick={() => setRankingMode('plate')}
                className={`px-2 py-0.5 rounded font-tabular-data text-[10px] font-bold transition-colors cursor-pointer ${
                  rankingMode === 'plate'
                    ? 'bg-[#2ca03a] text-white shadow-sm'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                POR PLACA
              </button>
              <button
                type="button"
                onClick={() => setRankingMode('category')}
                className={`px-2 py-0.5 rounded font-tabular-data text-[10px] font-bold transition-colors cursor-pointer ${
                  rankingMode === 'category'
                    ? 'bg-[#2ca03a] text-white shadow-sm'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                POR CATEGORIA
              </button>
            </div>
          </div>

          <div className="relative w-full h-72 mt-2 flex flex-col justify-end bg-[#0c1017] rounded-lg p-3 overflow-hidden border border-[#283548]">
            <span className="sm:hidden text-[9px] text-[#34b344] font-semibold text-center block mb-1">
              ← Deslize para visualizar o ranking completo →
            </span>
            <div className="w-full overflow-x-auto scrollbar-none touch-scroll-x">
              <div className="relative z-10 min-w-[480px] sm:min-w-0 w-full h-52 sm:h-56 flex items-end justify-between gap-2 px-1">
                {topBarsData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[#64748b]">
                    Nenhum veículo para os filtros selecionados.
                  </div>
                ) : (
                  topBarsData.map((v) => (
                    <div
                      key={v.key}
                      onClick={() => {
                        if (rankingMode === 'plate') {
                          setSelectedPlate(v.key);
                        } else {
                          filterState.setVehicleCategory(
                            filterState.vehicleCategory === v.key ? 'all' : v.key
                          );
                        }
                      }}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer min-w-0"
                      title={`${v.label}: ${v.total.toLocaleString('pt-BR')} ocorrências`}
                    >
                      <span className="text-[9px] font-mono text-[#94a3b8] mb-1">
                        {v.total.toLocaleString('pt-BR')}
                      </span>
                      <div
                        className={`w-full rounded-t-sm flex flex-col justify-end overflow-hidden transition-all group-hover:scale-105 ${
                          v.active ? 'ring-2 ring-[#34b344]' : ''
                        }`}
                        style={{ height: v.h }}
                      >
                        <div className="w-full bg-[#ef4444]" style={{ height: `${v.f3}%` }} />
                        <div className="w-full bg-[#f59e0b]" style={{ height: `${v.f2}%` }} />
                        <div className="w-full bg-[#34b344]" style={{ height: `${v.f1}%` }} />
                      </div>
                      <span
                        className={`text-[9px] font-tabular-data mt-1 truncate max-w-full ${
                          v.active ? 'text-[#34b344] font-bold' : 'text-[#f1f5f9]'
                        }`}
                      >
                        {v.label}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#283548] mt-2">
            <div className="flex items-center gap-4 text-xs font-tabular-data">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444]" />
                <span className="text-[#f1f5f9]">Alta (&gt; 30 km/h)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]" />
                <span className="text-[#f1f5f9]">Média (11-30 km/h)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#34b344]" />
                <span className="text-[#f1f5f9]">Baixa (1-10 km/h)</span>
              </div>
            </div>
            <span className="font-tabular-data text-[10px] text-[#34b344] font-semibold">
              {vehicleStatsList.length} PLACAS NO FILTRO ATUAL
            </span>
          </div>
        </div>

        {/* Right: Motoristas com Mais Excessos */}
        <div
          className="lg:col-span-5 rounded-xl p-4 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548]"
          style={{ backgroundColor: '#131923', border: '1px solid #283548' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-1 pb-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#34b344] text-[18px]">badge</span>
                <span className="font-headline-sm text-sm text-white font-bold tracking-tight">
                  MOTORISTAS COM MAIS EXCESSOS
                </span>
              </div>
              <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
                Ranking dos condutores identificados no recorte filtrado
              </span>
            </div>
            <div className="px-2 py-0.5 rounded bg-[#2ca03a]/20 border border-[#34b344]/40 text-[#34b344] font-tabular-data text-[10px] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34b344] animate-pulse" />
              <span>COM CRACHÁ ({driverStatsList.length})</span>
            </div>
          </div>

          {/* Ranked list */}
          <div className="space-y-1.5 mt-2 bg-[#0c1017] p-3 rounded-lg border border-[#283548] max-h-72 overflow-y-auto">
            {driverStatsList.map((driver) => {
              const isCompliant = driver.status === 'APTO';
              const barWidth = Math.max(
                4,
                Math.min(100, Math.round((driver.totalAlerts / maxDriverAlerts) * 100))
              );
              return (
                <div
                  key={`${driver.name}-${driver.rank}`}
                  onClick={() => onSelectDriver(driver)}
                  className="flex items-center text-xs gap-2 py-0.5 hover:bg-[#1c2432] px-1 rounded transition-colors cursor-pointer group"
                >
                  <span
                    className={`w-40 truncate font-headline-sm text-[11px] ${
                      isCompliant
                        ? 'text-[#34b344] font-bold'
                        : driver.totalAlerts > 250
                          ? 'text-white font-semibold'
                          : 'text-[#94a3b8]'
                    }`}
                  >
                    {driver.name}
                  </span>
                  <div className="flex-1 h-3 rounded-sm overflow-hidden flex items-center bg-[#1c2432]">
                    <div
                      className={`h-full rounded-sm transition-all group-hover:brightness-125 ${
                        isCompliant
                          ? 'bg-[#34b344]'
                          : driver.totalAlerts > 250
                            ? 'bg-[#ef4444]'
                            : driver.totalAlerts > 100
                              ? 'bg-[#f59e0b]'
                              : 'bg-[#34b344]'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span
                    className={`w-12 text-right font-tabular-data font-bold text-xs ${
                      isCompliant
                        ? 'text-[#34b344]'
                        : driver.totalAlerts > 250
                          ? 'text-[#ef4444]'
                          : driver.totalAlerts > 100
                            ? 'text-[#f59e0b]'
                            : 'text-[#f1f5f9]'
                    }`}
                  >
                    {driver.totalAlerts}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#283548] font-tabular-data text-xs text-[#94a3b8] mt-2">
            <span>
              Menor volume:{' '}
              <strong className="text-[#34b344]">
                {bestDriver ? `${bestDriver.name} (${bestDriver.totalAlerts})` : '--'}
              </strong>
            </span>
            {bestDriver && (
              <button
                type="button"
                onClick={() => onSelectDriver(bestDriver)}
                className="text-[#34b344] font-semibold cursor-pointer hover:underline text-xs"
              >
                Ver Ficha Completa →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Consulta Rápida por Veículo (Ficha da Placa) */}
      <div
        className="p-4 rounded-xl shadow-sm flex flex-col gap-4 bg-[#131923] border border-[#283548]"
        style={{ backgroundColor: '#131923', border: '1px solid #283548' }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded flex items-center justify-center border border-[#34b344]/30 bg-[#2ca03a]/20 text-[#34b344]">
              <span className="material-symbols-outlined text-[18px]">manage_search</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-sm text-white font-bold tracking-tight">
                CONSULTA RÁPIDA POR VEÍCULO (FICHA DA PLACA)
              </h3>
              <p className="font-body-sm text-xs text-[#94a3b8]">
                Resumo completo de telemetria pontual e histórico de condutores associados no filtro atual
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase font-bold">
              ESCOLHER PLACA:
            </span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0c1017] border border-[#283548]">
              <select
                value={activeVehicleSummary.plate}
                onChange={(e) => setSelectedPlate(e.target.value)}
                className="bg-transparent text-white font-tabular-data font-bold text-sm tracking-wider focus:outline-none cursor-pointer"
              >
                {vehicleStatsList.map((v) => (
                  <option key={v.plate} value={v.plate} className="bg-[#131923]">
                    {v.plate} ({v.total})
                  </option>
                ))}
              </select>
              <span className="font-tabular-data text-[10px] px-1.5 py-0.5 rounded bg-[#2ca03a]/20 text-[#34b344] border border-[#34b344]/30 font-bold uppercase">
                {activeVehicleSummary.category}
              </span>
            </div>
          </div>
        </div>

        {/* 5 Vehicle Detail Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <div className="p-3 rounded-lg flex flex-col justify-between bg-[#0c1017] border border-[#283548]">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase">
              IDENTIFICAÇÃO:
            </span>
            <div className="my-1">
              <div className="font-tabular-data text-lg text-white font-bold tracking-wider">
                {activeVehicleSummary.plate}
              </div>
              <div className="font-tabular-data text-[10px] text-[#34b344] font-bold mt-0.5">
                {activeVehicleSummary.model}
              </div>
            </div>
            <div className="font-tabular-data text-xs text-[#94a3b8]">Frota CSG Florestal</div>
          </div>

          <div className="p-3 rounded-lg flex flex-col justify-between bg-[#0c1017] border border-[#283548]">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase">
              TOTAL DE EXCESSOS:
            </span>
            <div className="my-1">
              <div className="font-tabular-data text-2xl text-white font-bold">
                {activeVehicleSummary.totalExcesses.toLocaleString('pt-BR')}
              </div>
              <div className="font-tabular-data text-[11px] text-[#94a3b8]">
                Ocorrências registradas
              </div>
            </div>
            <div className="font-tabular-data text-[10px] text-[#94a3b8]">
              No período filtrado
            </div>
          </div>

          <div className="p-3 rounded-lg flex flex-col justify-between bg-[#0c1017] border border-[#283548]">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase">
              VELOCIDADE MÁXIMA:
            </span>
            <div className="my-1">
              <div className="flex items-baseline gap-1">
                <span className="font-tabular-data text-2xl text-[#ef4444] font-bold">
                  {activeVehicleSummary.maxSpeed}
                </span>
                <span className="font-tabular-data text-xs text-[#ef4444]/80">km/h</span>
              </div>
              <div className="font-tabular-data text-[11px] text-[#94a3b8]">
                Média: +{activeVehicleSummary.avgAboveLimit} km/h acima
              </div>
            </div>
            <div className="font-tabular-data text-[10px] text-[#94a3b8] font-semibold truncate">
              {activeVehicleSummary.criticalHighway}
            </div>
          </div>

          <div className="p-3 rounded-lg flex flex-col justify-between bg-[#0c1017] border border-[#283548]">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase">
              SEVERIDADE DE PICO:
            </span>
            <div className="my-1">
              <div className="font-tabular-data text-2xl text-[#f59e0b] font-bold">
                {activeVehicleSummary.highSeverityCount}
              </div>
              <div className="font-tabular-data text-[11px] text-[#94a3b8]">
                Infrações Graves (&gt;30 km/h)
              </div>
            </div>
            <div className="font-tabular-data text-[10px] text-[#94a3b8]">
              Média: {activeVehicleSummary.mediumSeverityCount} | Leve: {activeVehicleSummary.lowSeverityCount}
            </div>
          </div>

          <div className="p-3 rounded-lg flex flex-col justify-between bg-[#0c1017] border border-[#283548]">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase">
              PARTICIPAÇÃO NO FILTRO:
            </span>
            <div className="my-1">
              <div className="font-tabular-data text-2xl text-[#34b344] font-bold">
                {activeVehicleSummary.fleetSharePercent}%
              </div>
              <div className="font-tabular-data text-[11px] text-[#94a3b8]">
                Do volume filtrado
              </div>
            </div>
            <div className="font-tabular-data text-[10px] text-[#34b344] font-bold uppercase">
              {activeVehicleSummary.fleetSharePercent < 5 ? 'BAIXO IMPACTO RELATIVO' : 'ALTO VOLUME'}
            </div>
          </div>
        </div>

        {/* Associated Drivers Table */}
        <div className="rounded-lg p-3 flex flex-col gap-2 bg-[#0c1017] border border-[#283548]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#34b344]">history</span>
              <span className="font-tabular-data text-xs text-white font-bold uppercase">
                CONDUTORES ASSOCIADOS À PLACA {activeVehicleSummary.plate}
              </span>
            </div>
            <span className="font-tabular-data text-[10px] text-[#94a3b8] px-2 py-0.5 rounded bg-[#1c2432] border border-[#283548]">
              Base Filtrada
            </span>
          </div>

          <div className="overflow-x-auto scrollbar-none touch-scroll-x w-full">
            <table className="w-full text-left font-tabular-data text-xs min-w-[650px]">
              <thead>
                <tr className="text-[#94a3b8] text-[10px] uppercase border-b border-[#283548] bg-[#131923]">
                  <th className="py-2 px-3">MOTORISTA AUDITADO</th>
                  <th className="py-2 px-3">IDENTIFICAÇÃO</th>
                  <th className="py-2 px-3">REGISTRO</th>
                  <th className="py-2 px-3 text-right">EXCESSOS NA PLACA</th>
                  <th className="py-2 px-3 text-right">VELOCIDADE MAX</th>
                  <th className="py-2 px-3 text-center">STATUS COMPLIANCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#283548] text-[#f1f5f9]">
                {activeVehicleSummary.recentDrivers.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#1c2432] transition-colors">
                    <td className="py-2 px-3 font-semibold flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.complianceStatus === 'CONFORME'
                            ? 'bg-[#34b344] shadow-[0_0_6px_#34b344]'
                            : item.complianceStatus === 'ADVERTÊNCIA'
                              ? 'bg-[#f59e0b]'
                              : 'bg-[#ef4444]'
                        }`}
                      />
                      <span>{item.name}</span>
                    </td>
                    <td className="py-2 px-3 text-[#94a3b8] text-[11px]">{item.ibutton}</td>
                    <td className="py-2 px-3 text-[#94a3b8] text-[11px]">{item.lastSeen}</td>
                    <td className="py-2 px-3 text-right font-bold text-white">
                      {item.excessesOnPlate}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-bold ${
                        item.maxSpeed > 100 ? 'text-[#ef4444]' : 'text-[#34b344]'
                      }`}
                    >
                      {item.maxSpeed} km/h
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded border font-bold ${
                          item.complianceStatus === 'CONFORME'
                            ? 'bg-[#2ca03a]/20 text-[#34b344] border-[#34b344]/30'
                            : item.complianceStatus === 'ADVERTÊNCIA'
                              ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30'
                              : 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30'
                        }`}
                      >
                        {item.complianceStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
