'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Incident } from '@/lib/telemetry-data';
import { convertToCSV, parseDateBR } from '@/lib/telemetry-rules';
import { OperationalFilterBar, useOperationalFilters, OperationalFilterState } from '@/components/OperationalFilterBar';

interface IncidentsHighwayScreenProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  filterState?: OperationalFilterState;
}

export default function IncidentsHighwayScreen({
  incidents,
  onSelectIncident,
  filterState: externalFilterState,
}: IncidentsHighwayScreenProps) {
  const [quickFilter, setQuickFilter] = useState<'all' | 'grave' | 'rodovias' | 'anon' | 'continuo'>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting state for table columns
  type TableSortField =
    | 'code'
    | 'dateTime'
    | 'plate'
    | 'vehicleCategory'
    | 'driver'
    | 'speedLimit'
    | 'recordedSpeed'
    | 'deltaSpeed'
    | 'duration'
    | 'severity'
    | 'highway';

  const [sortField, setSortField] = useState<TableSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  const handleSort = (field: TableSortField) => {
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

  // Apply quick filter preset on top of the 6 operational filters
  const filteredList = useMemo(() => {
    let list = filteredIncidents;
    if (quickFilter === 'grave') {
      list = list.filter((i) => i.severityBand === 4 || i.deltaSpeed > 30);
    } else if (quickFilter === 'rodovias') {
      list = list.filter(
        (i) =>
          i.highway.toUpperCase().includes('MS-112') ||
          i.highway.toUpperCase().includes('MS-377') ||
          i.highway.toUpperCase().includes('BR-')
      );
    } else if (quickFilter === 'anon') {
      list = list.filter((i) => !i.hasDriver);
    } else if (quickFilter === 'continuo') {
      list = list.filter((i) => (i.durationSeconds || 0) >= 300);
    }
    return list;
  }, [filteredIncidents, quickFilter]);

  // Reset pagination during render when filters change (sem cascading renders de useEffect)
  const [prevFilterKey, setPrevFilterKey] = useState('');
  const currentFilterKey = `${filterState.competence}|${filterState.period}|${filterState.specificDay}|${filterState.vehicleCategory}|${filterState.excessType}|${filterState.plate}|${filterState.driverIdStatus}|${filterState.searchQuery}|${quickFilter}`;

  if (currentFilterKey !== prevFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setCurrentPage(1);
  }

  // Dynamic Highway & Shift stats
  const { topHighways, shiftStats } = useMemo(() => {
    const hwMap = new Map<
      string,
      {
        name: string;
        total: number;
        b1: number;
        b2: number;
        b3: number;
        maxSpeed: number;
        maxPlate: string;
      }
    >();

    let diurnoTotal = 0;
    let diurnoSevere = 0;
    let noturnoTotal = 0;
    let noturnoSevere = 0;

    for (let i = 0; i < filteredList.length; i++) {
      const inc = filteredList[i];
      const hw = inc.highway || 'Rodovia Operacional';
      let entry = hwMap.get(hw);
      if (!entry) {
        entry = {
          name: hw,
          total: 0,
          b1: 0,
          b2: 0,
          b3: 0,
          maxSpeed: 0,
          maxPlate: inc.plate,
        };
        hwMap.set(hw, entry);
      }
      entry.total += 1;
      if (inc.deltaSpeed > 30) entry.b3 += 1;
      else if (inc.deltaSpeed > 10) entry.b2 += 1;
      else entry.b1 += 1;
      if (inc.recordedSpeed > entry.maxSpeed) {
        entry.maxSpeed = inc.recordedSpeed;
        entry.maxPlate = inc.plate;
      }

      if (inc.shift === 'Diurno') {
        diurnoTotal += 1;
        if (inc.deltaSpeed > 30) diurnoSevere += 1;
      } else {
        noturnoTotal += 1;
        if (inc.deltaSpeed > 30) noturnoSevere += 1;
      }
    }

    const total = Math.max(filteredList.length, 1);
    const hwList = Array.from(hwMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 4)
      .map((h, idx) => {
        const tot = Math.max(h.total, 1);
        const p3 = Math.round((h.b3 / tot) * 100);
        const p2 = Math.round((h.b2 / tot) * 100);
        const p1 = Math.max(0, 100 - p3 - p2);
        return {
          rank: idx + 1,
          name: h.name,
          total: h.total,
          sharePct: ((h.total / total) * 100).toFixed(1).replace('.', ','),
          p3,
          p2,
          p1,
          maxSpeed: Math.round(h.maxSpeed),
          maxPlate: h.maxPlate,
        };
      });

    const dSeverPct = diurnoTotal > 0 ? Math.round((diurnoSevere / diurnoTotal) * 100) : 0;
    const nSeverPct = noturnoTotal > 0 ? Math.round((noturnoSevere / noturnoTotal) * 100) : 0;

    return {
      topHighways: hwList,
      shiftStats: {
        diurnoTotal,
        diurnoShare: ((diurnoTotal / total) * 100).toFixed(1).replace('.', ','),
        diurnoSeverePct: dSeverPct,
        diurnoNormalPct: 100 - dSeverPct,
        noturnoTotal,
        noturnoShare: ((noturnoTotal / total) * 100).toFixed(1).replace('.', ','),
        noturnoSeverePct: nSeverPct,
        noturnoNormalPct: 100 - nSeverPct,
      },
    };
  }, [filteredList]);

  // Dynamic 24-hour Infractions Curve (00h - 23h) based on filteredList
  const hourlyCurve = useMemo(() => {
    const counts = new Array(24).fill(0);
    for (let i = 0; i < filteredList.length; i++) {
      const inc = filteredList[i];
      const h =
        typeof inc.hour === 'number'
          ? inc.hour
          : parseInt((inc.time || '12:00').split(':')[0] || '12', 10);
      if (h >= 0 && h < 24) {
        counts[h] += 1;
      }
    }
    const maxCount = Math.max(...counts, 1);
    let peakHour = 0;
    let peakCount = 0;

    for (let h = 0; h < 24; h++) {
      if (counts[h] > peakCount) {
        peakCount = counts[h];
        peakHour = h;
      }
    }

    // Coordinates: viewBox="0 0 600 110"
    // Baseline y=95, max height peak y=18
    const points = counts.map((c, h) => {
      const x = (h / 23) * 580 + 10;
      const ratio = filteredList.length === 0 ? 0 : c / maxCount;
      const y = 95 - ratio * 77;
      return { x, y, count: c, hour: h };
    });

    // Catmull-Rom to Cubic Bezier curve
    let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = Math.min(95, Math.max(12, p1.y + (p2.y - p0.y) / 6));
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = Math.min(95, Math.max(12, p2.y - (p3.y - p1.y) / 6));

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    const areaD = `${d} L 590,110 L 10,110 Z`;

    return {
      counts,
      peakHour,
      peakCount,
      points,
      lineD: d,
      areaD,
    };
  }, [filteredList]);

  // Helper function to convert time string HH:MM:SS to total seconds for sorting
  const parseTimeToSeconds = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
    return 0;
  };

  // Sort filteredList dynamically according to user selection
  const sortedList = useMemo(() => {
    if (!sortField || !sortDirection) return filteredList;
    const list = [...filteredList];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'code': {
          const numA = parseInt(a.code.replace(/\D/g, ''), 10) || 0;
          const numB = parseInt(b.code.replace(/\D/g, ''), 10) || 0;
          cmp = numA - numB;
          break;
        }
        case 'dateTime': {
          const tsA = (parseDateBR(a.date) || 0) + parseTimeToSeconds(a.time);
          const tsB = (parseDateBR(b.date) || 0) + parseTimeToSeconds(b.time);
          cmp = tsA - tsB;
          break;
        }
        case 'plate':
          cmp = (a.plate || '').localeCompare(b.plate || '');
          break;
        case 'vehicleCategory':
          cmp = (a.vehicleCategory || '').localeCompare(b.vehicleCategory || '');
          break;
        case 'driver': {
          const nameA = a.hasDriver ? a.driver || '' : 'ZZZ';
          const nameB = b.hasDriver ? b.driver || '' : 'ZZZ';
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case 'speedLimit':
          cmp = a.speedLimit - b.speedLimit;
          break;
        case 'recordedSpeed':
          cmp = a.recordedSpeed - b.recordedSpeed;
          break;
        case 'deltaSpeed':
          cmp = a.deltaSpeed - b.deltaSpeed;
          break;
        case 'duration':
          cmp = (a.durationSeconds || 0) - (b.durationSeconds || 0);
          break;
        case 'severity':
          cmp = (a.severityBand || 0) - (b.severityBand || 0);
          break;
        case 'highway':
          cmp = (a.highway || '').localeCompare(b.highway || '');
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredList, sortField, sortDirection]);

  const totalFiltered = sortedList.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const paginatedList = sortedList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1000);
  };

  const handleExportCSV = () => {
    const exportData = filteredList.map((i) => ({
      Numero: i.code,
      DataHora: i.timestamp,
      Placa: i.plate,
      Modelo: i.vehicleModel,
      Categoria: i.vehicleCategory,
      TipoExcesso: i.excessType || 'EXCESSO_VELOCIDADE',
      Motorista: i.driver,
      Limite: `${i.speedLimit} km/h`,
      VelocidadeRegistrada: `${i.recordedSpeed} km/h`,
      AcimaDoLimite: `+${i.deltaSpeed} km/h`,
      TempoExcesso: i.duration,
      Gravidade: i.severity,
      Rodovia: i.highway,
      Localizacao: i.locationDetails,
      Latitude: i.lat,
      Longitude: i.lng,
    }));
    const csv = convertToCSV(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `central_ocorrencias_casagrande_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col w-full text-on-surface pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-7 bg-[#34b344] rounded-full shadow-[0_0_8px_#34b344]" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-headline-lg text-xl tracking-tight text-white font-bold">
                Central de Ocorrências &amp; Rodovias
              </h1>
            </div>
            <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
              Monitoramento analítico de infrações por rodovia e data / Tabela detalhada
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
            <span>{isSyncing ? 'Atualizando...' : 'Atualizar Dados'}</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#2ca03a] text-white font-semibold text-xs hover:bg-[#34b344] transition shadow-[0_0_12px_rgba(44,160,58,0.35)] cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Exportar Relatório</span>
          </button>
        </div>
      </div>

      {/* Unified 6-Option Operational Filter Bar */}
      <div className="mb-3">
        <OperationalFilterBar
          filterState={filterState}
          totalIncidents={incidents.length}
          title="Filtros Operacionais • Central de Ocorrências & Rodovias"
          onResetExtra={() => setQuickFilter('all')}
        />
      </div>

      {/* Fast Quick Filters Presets */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none touch-scroll-x pb-2 mb-3 text-xs">
        <button
          type="button"
          onClick={() => setQuickFilter('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-semibold whitespace-nowrap cursor-pointer shrink-0 ${
            quickFilter === 'all'
              ? 'bg-[#2ca03a] text-white shadow-[0_0_10px_rgba(44,160,58,0.3)]'
              : 'bg-[#131923] border border-[#283548] text-[#94a3b8] hover:text-[#f1f5f9]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">list_alt</span>
          <span>Todas no Filtro ({filteredIncidents.length.toLocaleString('pt-BR')})</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('grave')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#283548] transition-colors whitespace-nowrap cursor-pointer ${
            quickFilter === 'grave'
              ? 'bg-[#ef4444]/25 text-[#ef4444] border-[#ef4444]/40 font-bold'
              : 'bg-[#131923] text-[#94a3b8] hover:text-[#f1f5f9]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] text-[#ef4444]">
            local_fire_department
          </span>
          <span>Ocorrências Graves (&gt;30 km/h)</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('rodovias')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#283548] transition-colors whitespace-nowrap cursor-pointer ${
            quickFilter === 'rodovias'
              ? 'bg-[#f59e0b]/25 text-[#f59e0b] border-[#f59e0b]/40 font-bold'
              : 'bg-[#131923] text-[#94a3b8] hover:text-[#f1f5f9]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] text-[#f59e0b]">warning</span>
          <span>Rodovias Estaduais / Federais</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('anon')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#283548] transition-colors whitespace-nowrap cursor-pointer ${
            quickFilter === 'anon'
              ? 'bg-[#34b344]/25 text-[#34b344] border-[#34b344]/40 font-bold'
              : 'bg-[#131923] text-[#94a3b8] hover:text-[#f1f5f9]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] text-[#34b344]">key_off</span>
          <span>Sem Identificação / iButton Pendente</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickFilter('continuo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#283548] transition-colors whitespace-nowrap cursor-pointer ${
            quickFilter === 'continuo'
              ? 'bg-[#34b344]/25 text-[#34b344] border-[#34b344]/40 font-bold'
              : 'bg-[#131923] text-[#94a3b8] hover:text-[#f1f5f9]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] text-[#34b344]">timer</span>
          <span>Excessos Contínuos (&gt;5 min)</span>
        </button>
      </div>

      {/* Highway & Hotspot Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-4">
        {/* Left: Concentração por Rodovia */}
        <div
          className="lg:col-span-7 rounded-xl p-4 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548]"
          style={{ backgroundColor: '#131923', border: '1px solid #283548' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#34b344] text-[18px]">
                  add_road
                </span>
                <span className="font-headline-sm text-sm text-white font-bold tracking-tight">
                  CONCENTRAÇÃO POR RODOVIA &amp; TRECHO CRÍTICO
                </span>
              </div>
              <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
                Top 4 logradouros/rodovias no recorte filtrado atual
              </span>
            </div>
            <span className="font-tabular-data text-[10px] px-2 py-0.5 rounded bg-[#1c2432] text-[#34b344] border border-[#283548] font-bold">
              GEO CCO
            </span>
          </div>

          <div className="space-y-3 py-1">
            {topHighways.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#64748b]">
                Nenhuma ocorrência para os filtros selecionados.
              </div>
            ) : (
              topHighways.map((hw) => (
                <div
                  key={hw.name}
                  className="space-y-1 p-2 rounded-lg bg-[#0c1017] border border-[#283548]"
                >
                  <div className="flex items-center justify-between font-tabular-data text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                          hw.rank === 1
                            ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40'
                            : hw.rank === 2
                              ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/40'
                              : 'bg-[#34b344]/20 text-[#34b344] border-[#34b344]/40'
                        }`}
                      >
                        TOP {hw.rank}
                      </span>
                      <span className="font-semibold text-white truncate">{hw.name}</span>
                    </div>
                    <span className="text-[#f1f5f9] font-bold text-xs whitespace-nowrap">
                      {hw.total.toLocaleString('pt-BR')} ({hw.sharePct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-[#1c2432] rounded-full overflow-hidden flex">
                    <div className="bg-[#ef4444] h-full" style={{ width: `${hw.p3}%` }} />
                    <div className="bg-[#f59e0b] h-full" style={{ width: `${hw.p2}%` }} />
                    <div className="bg-[#34b344] h-full" style={{ width: `${hw.p1}%` }} />
                  </div>
                  <div className="flex justify-between font-tabular-data text-[10px] text-[#94a3b8]">
                    <span>
                      Graves: {hw.p3}% • Médias: {hw.p2}% • Leves: {hw.p1}%
                    </span>
                    <span className="text-[#ef4444] font-semibold">
                      Pico: {hw.maxSpeed} km/h ({hw.maxPlate})
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#283548] mt-2">
            <div className="flex items-center gap-3 text-xs font-tabular-data">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444]" />
                <span className="text-[#f1f5f9]">Gravíssima (&gt;30 km/h)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]" />
                <span className="text-[#f1f5f9]">Média / Alerta (11-30)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#34b344]" />
                <span className="text-[#f1f5f9]">Leve (1-10)</span>
              </div>
            </div>
            <span className="font-tabular-data text-[10px] text-[#34b344] font-semibold">
              TOLERÂNCIA HOMOLOGADA CONTRAN
            </span>
          </div>
        </div>

        {/* Right: Gravidade por Turno & Curva 24h */}
        <div
          className="lg:col-span-5 rounded-xl p-4 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548]"
          style={{ backgroundColor: '#131923', border: '1px solid #283548' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-1 pb-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#f59e0b] text-[18px]">
                  query_builder
                </span>
                <span className="font-headline-sm text-sm text-white font-bold tracking-tight">
                  GRAVIDADE POR TURNO &amp; CURVA 24H
                </span>
              </div>
              <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
                Comportamento de condução em trânsito noturno e diurno
              </span>
            </div>
            <div className="px-2 py-0.5 rounded bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444] font-tabular-data text-[10px] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
              <span>MONITORAMENTO 24H</span>
            </div>
          </div>

          {/* Turnos Diurno / Noturno */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-1">
            <div className="p-2.5 rounded-lg bg-[#0c1017] border border-[#283548] space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[#34b344] text-[16px]">
                    wb_sunny
                  </span>
                  <span className="font-semibold text-white text-xs">Diurno (06h-18h)</span>
                </div>
                <span className="font-tabular-data text-xs text-[#34b344] font-bold">
                  {shiftStats.diurnoTotal.toLocaleString('pt-BR')} ({shiftStats.diurnoShare}%)
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between font-tabular-data text-[9px] text-[#94a3b8]">
                  <span>Leve / Médio: {shiftStats.diurnoNormalPct}%</span>
                  <span className="text-[#ef4444]">Grave: {shiftStats.diurnoSeverePct}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#1c2432] rounded-full overflow-hidden flex">
                  <div
                    className="bg-[#34b344] h-full"
                    style={{ width: `${shiftStats.diurnoNormalPct}%` }}
                  />
                  <div
                    className="bg-[#ef4444] h-full"
                    style={{ width: `${shiftStats.diurnoSeverePct}%` }}
                  />
                </div>
              </div>
              <p className="font-body-sm text-[10px] text-[#94a3b8] leading-tight">
                Operação diurna (06h às 18h) no filtro selecionado.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0c1017] border border-[#283548] space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[#f59e0b] text-[16px]">
                    nights_stay
                  </span>
                  <span className="font-semibold text-white text-xs">Noturno (18h-06h)</span>
                </div>
                <span className="font-tabular-data text-xs text-[#ef4444] font-bold">
                  {shiftStats.noturnoTotal.toLocaleString('pt-BR')} ({shiftStats.noturnoShare}%)
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between font-tabular-data text-[9px] text-[#94a3b8]">
                  <span>Leve / Médio: {shiftStats.noturnoNormalPct}%</span>
                  <span className="text-[#ef4444] font-bold">
                    Grave: {shiftStats.noturnoSeverePct}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#1c2432] rounded-full overflow-hidden flex">
                  <div
                    className="bg-[#34b344] h-full"
                    style={{ width: `${shiftStats.noturnoNormalPct}%` }}
                  />
                  <div
                    className="bg-[#ef4444] h-full"
                    style={{ width: `${shiftStats.noturnoSeverePct}%` }}
                  />
                </div>
              </div>
              <p className="font-body-sm text-[10px] text-[#ef4444] leading-tight">
                Operação noturna e madrugada no filtro selecionado.
              </p>
            </div>
          </div>

          {/* SVG Telemetry Curve - Dinâmica e responsiva ao filtro */}
          <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548] flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34b344]" />
                <span className="font-tabular-data text-[10px] text-white font-bold uppercase tracking-wider">
                  CURVA HORÁRIA DE INFRAÇÕES (00H - 23H)
                </span>
              </div>
              {filteredList.length > 0 && (
                <span className="font-tabular-data text-[10px] text-[#ef4444] font-bold bg-[#ef4444]/15 px-2 py-0.5 rounded border border-[#ef4444]/30">
                  Pico {String(hourlyCurve.peakHour).padStart(2, '0')}h: {hourlyCurve.peakCount.toLocaleString('pt-BR')} excessos
                </span>
              )}
            </div>

            <div className="w-full h-28 relative">
              <svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 600 110">
                <line stroke="#1c2432" strokeDasharray="3,3" strokeWidth="1" x1="0" x2="600" y1="25" y2="25" />
                <line stroke="#1c2432" strokeDasharray="3,3" strokeWidth="1" x1="0" x2="600" y1="58" y2="58" />
                <line stroke="#1c2432" strokeDasharray="3,3" strokeWidth="1" x1="0" x2="600" y1="90" y2="90" />

                <defs>
                  <linearGradient id="casagrandeCurve" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#34b344" stopOpacity="0.45" />
                    <stop offset="50%" stopColor="#34b344" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#34b344" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                <path
                  d={hourlyCurve.areaD}
                  fill="url(#casagrandeCurve)"
                />

                <path
                  d={hourlyCurve.lineD}
                  stroke="#34b344"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />

                {filteredList.length > 0 && hourlyCurve.peakCount > 0 && (
                  <circle
                    cx={hourlyCurve.points[hourlyCurve.peakHour].x}
                    cy={hourlyCurve.points[hourlyCurve.peakHour].y}
                    r="4"
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
              </svg>
            </div>

            <div className="grid grid-cols-7 font-tabular-data text-[9px] text-[#94a3b8] pt-1 border-t border-[#1c2432]">
              <span className="text-left text-[#64748b]">00:00</span>
              <span className={`text-center font-bold ${hourlyCurve.peakHour >= 3 && hourlyCurve.peakHour <= 5 ? 'text-[#ef4444]' : 'text-[#94a3b8]'}`}>
                04:00
              </span>
              <span className="text-center text-[#94a3b8]">08:00</span>
              <span className={`text-center font-bold ${hourlyCurve.peakHour >= 10 && hourlyCurve.peakHour <= 12 ? 'text-[#f59e0b]' : 'text-[#94a3b8]'}`}>
                11:00
              </span>
              <span className="text-center text-[#94a3b8]">15:00</span>
              <span className="text-center text-[#94a3b8]">19:00</span>
              <span className="text-right text-[#64748b]">23:59</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Data Grid Section */}
      <div
        className="rounded-xl shadow-sm border border-[#283548] overflow-hidden flex flex-col mb-4 bg-[#131923]"
        style={{ backgroundColor: '#131923', border: '1px solid #283548' }}
      >
        {/* Table Toolbar */}
        <div className="p-3 bg-[#131923] border-b border-[#283548] flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-[18px] pointer-events-none flex items-center">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite placa, categoria, motorista, rodovia ou velocidade..."
              className="w-full bg-[#1c2432] border border-[#283548] rounded pl-9 pr-3 py-1.5 font-body-sm text-xs text-[#f1f5f9] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#34b344] transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
            <div className="flex items-center gap-1 font-tabular-data text-xs text-[#94a3b8]">
              <span className="font-bold text-[10px] uppercase">LINHAS:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-[#1c2432] text-[#f1f5f9] border border-[#283548] rounded px-2 py-1 focus:outline-none focus:border-[#34b344] font-semibold text-xs cursor-pointer"
              >
                <option value={25}>25 Linhas</option>
                <option value={50}>50 Linhas</option>
                <option value={100}>100 Linhas</option>
              </select>
            </div>

            <span className="font-tabular-data text-xs text-[#94a3b8] hidden lg:inline">
              Página {currentPage} de {totalPages} ({totalFiltered.toLocaleString('pt-BR')} registros)
            </span>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2ca03a] hover:bg-[#34b344] text-white font-semibold text-xs transition-all shadow-[0_0_10px_rgba(44,160,58,0.3)] cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Baixar Lista em Excel (CSV)</span>
            </button>
          </div>
        </div>

        {/* High-Density Telemetry Table */}
        <div className="overflow-x-auto scrollbar-visible touch-scroll-x w-full">
          <table className="w-full text-left font-tabular-data text-xs whitespace-nowrap min-w-[1050px]">
            <thead>
              <tr className="bg-[#0c1017] text-[#94a3b8] text-[10px] tracking-wider uppercase border-b border-[#283548]">
                <th
                  onClick={() => handleSort('code')}
                  className="py-2.5 px-3 font-bold cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Nº (menor/maior)"
                >
                  <div className="flex items-center gap-1">
                    <span>Nº</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'code' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'code' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('dateTime')}
                  className="py-2.5 px-3 font-bold cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Data e Hora (menor/maior)"
                >
                  <div className="flex items-center gap-1">
                    <span>DATA E HORA</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'dateTime' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'dateTime' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('plate')}
                  className="py-2.5 px-3 font-bold cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Veículo (Placa) (A-Z / Z-A)"
                >
                  <div className="flex items-center gap-1">
                    <span>VEÍCULO (PLACA)</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'plate' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'plate' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('vehicleCategory')}
                  className="py-2.5 px-3 font-bold cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Categoria / Tipo de Veículo (A-Z / Z-A)"
                >
                  <div className="flex items-center gap-1">
                    <span>CATEGORIA</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'vehicleCategory' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'vehicleCategory' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('driver')}
                  className="py-2.5 px-3 font-bold cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Motorista (A-Z / Z-A)"
                >
                  <div className="flex items-center gap-1">
                    <span>MOTORISTA</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'driver' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'driver' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('speedLimit')}
                  className="py-2.5 px-3 font-bold text-center cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Limite da Via (menor/maior)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>LIMITE</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'speedLimit' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'speedLimit' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('recordedSpeed')}
                  className="py-2.5 px-3 font-bold text-center cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Vel. Registrada / Velocidade Atingida (menor/maior)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>VEL. REGISTRADA</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'recordedSpeed' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'recordedSpeed' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('deltaSpeed')}
                  className="py-2.5 px-3 font-bold text-right cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Acima do Limite (menor/maior)"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>ACIMA DO LIMITE</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'deltaSpeed' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'deltaSpeed' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('duration')}
                  className="py-2.5 px-3 font-bold text-center cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Tempo Correndo / Duração (menor/maior)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>TEMPO CORRENDO</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'duration' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'duration' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('severity')}
                  className="py-2.5 px-3 font-bold text-center cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Gravidade (menor/maior)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>GRAVIDADE</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'severity' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'severity' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('highway')}
                  className="py-2.5 px-3 font-bold cursor-pointer select-none hover:text-white transition-colors group"
                  title="Ordenar por Local / Rodovia (A-Z / Z-A)"
                >
                  <div className="flex items-center gap-1">
                    <span>LOCAL / RODOVIA</span>
                    <span className={`text-[11px] font-normal transition-colors ${sortField === 'highway' ? 'text-[#34b344] font-bold' : 'text-[#64748b] group-hover:text-white'}`}>
                      {sortField === 'highway' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="py-2.5 px-3 font-bold text-center">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#283548]">
              {paginatedList.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-[#1c2432]/70 transition-colors ${
                    item.severityBand === 4 ? 'bg-[#ef4444]/10' : 'bg-[#131923]'
                  }`}
                >
                  <td
                    className={`py-2 px-3 font-bold ${
                      item.severityBand === 4 ? 'text-[#ef4444]' : 'text-white'
                    }`}
                  >
                    {item.code}
                  </td>
                  <td className="py-2 px-3 text-[#f1f5f9]">
                    {item.date} <span className="text-[#94a3b8] font-normal">{item.time}</span>
                  </td>
                  <td
                    className={`py-2 px-3 font-bold ${
                      item.severityBand === 4 ? 'text-[#ef4444]' : 'text-white'
                    }`}
                  >
                    {item.plate}
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-[#1c2432] text-[#34b344] border-[#283548]">
                      {item.vehicleCategory}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-semibold text-white">
                    {item.hasDriver ? (
                      item.driver
                    ) : (
                      <span className="text-[#ef4444] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">person_off</span>
                        SEM IDENTIFICAÇÃO
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center text-[#94a3b8]">{item.speedLimit} km/h</td>
                  <td
                    className={`py-2 px-3 text-center font-bold text-xs ${
                      item.severityBand === 4
                        ? 'text-[#ef4444]'
                        : item.severityBand >= 2
                          ? 'text-[#f59e0b]'
                          : 'text-white'
                    }`}
                  >
                    {item.recordedSpeed} km/h
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-bold ${
                      item.deltaSpeed > 30
                        ? 'text-[#ef4444]'
                        : item.deltaSpeed > 10
                          ? 'text-[#f59e0b]'
                          : 'text-[#34b344]'
                    }`}
                  >
                    +{item.deltaSpeed} km/h
                  </td>
                  <td className="py-2 px-3 text-center text-white">{item.duration}</td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        item.severityBand === 4
                          ? 'bg-[#ef4444]/25 text-[#ef4444] border-[#ef4444]/50 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                          : item.severityBand >= 2
                            ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/40'
                            : 'bg-[#34b344]/20 text-[#34b344] border-[#34b344]/40'
                      }`}
                    >
                      {item.severity}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-white truncate max-w-[220px]">
                    {item.highway}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onSelectIncident(item)}
                      className="p-1 rounded hover:bg-[#283548] text-[#34b344] transition-colors cursor-pointer"
                      title="Ver Dossiê da Infração"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        {item.severityBand === 4 ? 'crisis_alert' : 'visibility'}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="p-3 bg-[#0c1017] border-t border-[#283548] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="font-tabular-data text-[#94a3b8]">
            Exibindo{' '}
            <strong className="text-white">
              {totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, totalFiltered)}
            </strong>{' '}
            de <strong className="text-white">{totalFiltered.toLocaleString('pt-BR')}</strong>{' '}
            registros georreferenciados
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded bg-[#1c2432] text-[#94a3b8] hover:text-white hover:bg-[#283548] border border-[#283548] font-tabular-data disabled:opacity-50 transition-colors cursor-pointer"
            >
              Anterior
            </button>
            <span className="px-3 py-1 rounded bg-[#2ca03a] text-white font-tabular-data font-bold">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded bg-[#1c2432] text-[#94a3b8] hover:text-white hover:bg-[#283548] border border-[#283548] font-tabular-data disabled:opacity-50 transition-colors cursor-pointer"
            >
              Próximo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
