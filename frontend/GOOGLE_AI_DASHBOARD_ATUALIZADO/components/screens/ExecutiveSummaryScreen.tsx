'use client';

import React, { useState, useMemo } from 'react';
import { INITIAL_INCIDENTS, Incident } from '@/lib/telemetry-data';
import { convertToCSV, parseDateBR } from '@/lib/telemetry-rules';
import { OperationalFilterBar, useOperationalFilters } from '@/components/OperationalFilterBar';

interface ExecutiveSummaryScreenProps {
  incidents?: Incident[];
}

export default function ExecutiveSummaryScreen({
  incidents = INITIAL_INCIDENTS,
}: ExecutiveSummaryScreenProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [hourlySortOrder, setHourlySortOrder] = useState<'desc' | 'cron'>('desc');
  const [isSyncing, setIsSyncing] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  const filterState = useOperationalFilters(incidents);
  const { filteredIncidents } = filterState;

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 1000);
  };

  // Dynamic KPIs & Breakdown calculations from filteredIncidents
  const metrics = useMemo(() => {
    const total = filteredIncidents.length;
    if (total === 0) {
      return {
        total: 0,
        shareOfBase: '0,0%',
        maxSpeed: 0,
        maxPlate: '--',
        maxHighway: '--',
        avgDelta: '0,0',
        severeCount: 0,
        severePct: '0,0%',
        totalHoursStr: '0h 00m',
        longDurationCount: 0,
        unidentifiedCount: 0,
        unidentifiedPct: '0,0%',
        lim80Count: 0,
        lim80Pct: 0,
        lim60Count: 0,
        lim60Pct: 0,
        lim40Count: 0,
        lim40Pct: 0,
        band1: 0,
        band2: 0,
        band3: 0,
        band4: 0,
        dur1: 0,
        dur2: 0,
        dur3: 0,
        dur4: 0,
      };
    }

    let maxSpeed = 0;
    let maxPlate = '--';
    let maxHighway = '--';
    let sumDelta = 0;
    let severeCount = 0;
    let totalSeconds = 0;
    let longDurationCount = 0;
    let unidentifiedCount = 0;

    let lim80Count = 0;
    let lim60Count = 0;
    let lim40Count = 0;

    let band1 = 0; // 1-10 km/h
    let band2 = 0; // 11-20 km/h
    let band3 = 0; // 21-30 km/h
    let band4 = 0; // >30 km/h

    let dur1 = 0; // < 30s
    let dur2 = 0; // 30s - 120s
    let dur3 = 0; // 121s - 300s
    let dur4 = 0; // > 300s

    for (let i = 0; i < total; i++) {
      const inc = filteredIncidents[i];
      if (inc.recordedSpeed > maxSpeed) {
        maxSpeed = inc.recordedSpeed;
        maxPlate = inc.plate;
        maxHighway = inc.highway;
      }
      sumDelta += inc.deltaSpeed;
      if (inc.deltaSpeed > 30 || inc.severityBand === 4) {
        severeCount++;
      }
      totalSeconds += inc.durationSeconds || 0;
      if ((inc.durationSeconds || 0) >= 600) {
        longDurationCount++;
      }
      if (!inc.hasDriver) {
        unidentifiedCount++;
      }

      if (inc.speedLimit >= 80) lim80Count++;
      else if (inc.speedLimit >= 55) lim60Count++;
      else lim40Count++;

      if (inc.deltaSpeed <= 10) band1++;
      else if (inc.deltaSpeed <= 20) band2++;
      else if (inc.deltaSpeed <= 30) band3++;
      else band4++;

      const sec = inc.durationSeconds || 0;
      if (sec < 30) dur1++;
      else if (sec <= 120) dur2++;
      else if (sec <= 300) dur3++;
      else dur4++;
    }

    const totalHours = Math.floor(totalSeconds / 3600);
    const remMinutes = Math.floor((totalSeconds % 3600) / 60);

    return {
      total,
      shareOfBase: `${((total / Math.max(incidents.length, 1)) * 100).toFixed(1).replace('.', ',')}%`,
      maxSpeed: Math.round(maxSpeed),
      maxPlate,
      maxHighway,
      avgDelta: (sumDelta / total).toFixed(1).replace('.', ','),
      severeCount,
      severePct: `${((severeCount / total) * 100).toFixed(1).replace('.', ',')}%`,
      totalHoursStr: `${totalHours}h ${String(remMinutes).padStart(2, '0')}m`,
      longDurationCount,
      unidentifiedCount,
      unidentifiedPct: `${((unidentifiedCount / total) * 100).toFixed(1).replace('.', ',')}%`,
      lim80Count,
      lim80Pct: Math.round((lim80Count / total) * 100),
      lim60Count,
      lim60Pct: Math.round((lim60Count / total) * 100),
      lim40Count,
      lim40Pct: Math.max(0, 100 - Math.round((lim80Count / total) * 100) - Math.round((lim60Count / total) * 100)),
      band1,
      band2,
      band3,
      band4,
      dur1,
      dur2,
      dur3,
      dur4,
    };
  }, [filteredIncidents, incidents.length]);

  // Dynamic Daily evolution data
  const dailyData = useMemo(() => {
    const dayMap = new Map<
      string,
      { date: string; ts: number; total: number; b1: number; b2: number; b3: number }
    >();
    for (let i = 0; i < filteredIncidents.length; i++) {
      const inc = filteredIncidents[i];
      if (!inc.date) continue;
      let entry = dayMap.get(inc.date);
      if (!entry) {
        entry = {
          date: inc.date,
          ts: parseDateBR(inc.date) ?? 0,
          total: 0,
          b1: 0,
          b2: 0,
          b3: 0,
        };
        dayMap.set(inc.date, entry);
      }
      entry.total += 1;
      if (inc.deltaSpeed > 30) entry.b3 += 1;
      else if (inc.deltaSpeed > 10) entry.b2 += 1;
      else entry.b1 += 1;
    }

    const sorted = Array.from(dayMap.values()).sort((a, b) => a.ts - b.ts);
    const maxTotal = Math.max(...sorted.map((d) => d.total), 1);

    return sorted.map((d) => {
      const tot = Math.max(d.total, 1);
      const f3 = Math.round((d.b3 / tot) * 100);
      const f2 = Math.round((d.b2 / tot) * 100);
      const f1 = Math.max(0, 100 - f3 - f2);
      const heightPct = Math.max(10, Math.round((d.total / maxTotal) * 95));
      return {
        day: d.date.slice(0, 5), // DD/MM
        fullDate: d.date,
        total: d.total,
        f3,
        f2,
        f1,
        height: `${heightPct}%`,
      };
    });
  }, [filteredIncidents]);

  // Dynamic Weekly aggregate data
  const weeklyData = useMemo(() => {
    if (dailyData.length === 0) return [];
    const chunkSize = Math.max(1, Math.ceil(dailyData.length / 4));
    const weeks: { label: string; total: number; f3: number; f2: number; f1: number; height: string }[] = [];
    for (let i = 0; i < dailyData.length; i += chunkSize) {
      const slice = dailyData.slice(i, i + chunkSize);
      const total = slice.reduce((acc, s) => acc + s.total, 0);
      const avgF3 = Math.round(slice.reduce((acc, s) => acc + s.f3, 0) / slice.length);
      const avgF2 = Math.round(slice.reduce((acc, s) => acc + s.f2, 0) / slice.length);
      const avgF1 = Math.max(0, 100 - avgF3 - avgF2);
      weeks.push({
        label: `Sem ${weeks.length + 1} (${slice[0].day} - ${slice[slice.length - 1].day})`,
        total,
        f3: avgF3,
        f2: avgF2,
        f1: avgF1,
        height: '60%',
      });
    }
    const maxWeek = Math.max(...weeks.map((w) => w.total), 1);
    return weeks.map((w) => ({
      ...w,
      height: `${Math.max(15, Math.round((w.total / maxWeek) * 90))}%`,
    }));
  }, [dailyData]);

  // Dynamic 24-hour distribution
  const { sortedHourlyData, peakHourInfo } = useMemo(() => {
    const counts = new Array(24).fill(0);
    for (let i = 0; i < filteredIncidents.length; i++) {
      const inc = filteredIncidents[i];
      const h =
        typeof inc.hour === 'number'
          ? inc.hour
          : parseInt((inc.time || '12:00').split(':')[0] || '12', 10);
      if (h >= 0 && h < 24) {
        counts[h] += 1;
      }
    }
    const maxCount = Math.max(...counts, 1);
    let peakHour = '05';
    let peakCount = 0;

    const baseHours = counts.map((count, hIdx) => {
      const hourStr = String(hIdx).padStart(2, '0');
      if (count > peakCount) {
        peakCount = count;
        peakHour = hourStr;
      }
      const val = Math.round((count / maxCount) * 92);
      return {
        hour: hourStr,
        val,
        h: `${Math.max(count > 0 ? 5 : 1, val)}%`,
        count,
        isPeak: false,
      };
    });

    baseHours.forEach((item) => {
      if (item.hour === peakHour && item.count > 0) {
        item.isPeak = true;
      }
    });

    const sorted =
      hourlySortOrder === 'desc'
        ? [...baseHours].sort((a, b) => b.count - a.count)
        : baseHours;

    return {
      sortedHourlyData: sorted,
      peakHourInfo: { hour: peakHour, count: peakCount },
    };
  }, [filteredIncidents, hourlySortOrder]);

  const handleExport = () => {
    const summaryData = [
      { Metrica: 'Total de Excessos Filtrados', Valor: String(metrics.total), Percentual: metrics.shareOfBase },
      { Metrica: 'Maior Velocidade', Valor: `${metrics.maxSpeed} km/h`, Detalhe: `${metrics.maxPlate} na ${metrics.maxHighway}` },
      { Metrica: 'Média Acima do Limite', Valor: `+${metrics.avgDelta} km/h`, Detalhe: 'Excedente Médio' },
      { Metrica: 'Ocorrências Graves (>30 km/h)', Valor: String(metrics.severeCount), Percentual: metrics.severePct },
      { Metrica: 'Tempo Total em Excesso', Valor: metrics.totalHoursStr, Detalhe: `${metrics.longDurationCount} eventos >10m` },
      { Metrica: 'Sem Identificação / iButton', Valor: String(metrics.unidentifiedCount), Percentual: metrics.unidentifiedPct },
    ];
    const csvContent = convertToCSV(summaryData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `casagrande_resumo_executivo_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const maxBand = Math.max(metrics.band1, metrics.band2, metrics.band3, metrics.band4, 1);
  const maxDur = Math.max(metrics.dur1, metrics.dur2, metrics.dur3, metrics.dur4, 1);

  return (
    <div className="flex flex-col w-full text-on-surface pb-6 animate-fade-in">
      {/* Screen Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-7 bg-[#34b344] rounded-full shadow-[0_0_8px_#34b344]" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-headline-lg text-lg sm:text-xl tracking-tight text-white font-bold">
                Painel de Gestão de Velocidades
              </h1>
            </div>
            <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
              Telemetria de velocidades e monitoramento de frota • Resumo Geral &amp; Horários
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
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#2ca03a] text-white font-semibold text-xs hover:bg-[#34b344] transition shadow-[0_0_12px_rgba(44,160,58,0.35)] cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Exportar Relatório</span>
          </button>
        </div>
      </div>

      {/* Unified 6-Option Operational Filter Bar */}
      <div className="mb-4">
        <OperationalFilterBar
          filterState={filterState}
          totalIncidents={incidents.length}
          title="Filtros Operacionais • Resumo Geral & Horários"
          showSearch={true}
        />
      </div>

      {/* KPI Executive Metrics (Industrial Telemetry Grid - Mobile First) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {/* Total Excessos */}
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#f59e0b]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              TOTAL EXCESSOS
            </span>
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
              <span className="material-symbols-outlined text-[15px]">bolt</span>
            </div>
          </div>
          <div className="my-1">
            <div className="font-tabular-data text-2xl text-white font-bold tracking-tight">
              {metrics.total.toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Base filtrada:</span>
            <span className="font-semibold text-[#f59e0b] text-[11px]">{metrics.shareOfBase} do ciclo</span>
          </div>
        </div>

        {/* Maior Velocidade */}
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#ef4444]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              MAIOR VELOCIDADE
            </span>
            <div className="w-6 h-6 rounded bg-[#ef4444]/20 border border-[#ef4444]/30 flex items-center justify-center text-[#ef4444]">
              <span className="material-symbols-outlined text-[15px]">speed</span>
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1">
            <span className="font-tabular-data text-2xl text-[#ef4444] font-bold">{metrics.maxSpeed}</span>
            <span className="font-tabular-data text-xs text-[#ef4444]/80">km/h</span>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-white font-semibold text-[11px]">{metrics.maxPlate}</span>
            <span className="text-[#94a3b8] truncate text-[11px] max-w-[90px]">{metrics.maxHighway}</span>
          </div>
        </div>

        {/* Média Acima do Limite */}
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#f59e0b]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              MÉDIA ACIMA
            </span>
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
              <span className="material-symbols-outlined text-[15px]">trending_up</span>
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1">
            <span className="font-tabular-data text-2xl font-bold text-[#f59e0b]">+{metrics.avgDelta}</span>
            <span className="font-tabular-data text-xs text-[#94a3b8]">km/h</span>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Em média:</span>
            <span className="text-white font-medium text-[11px]">Acima do limite</span>
          </div>
        </div>

        {/* Ocorrências Graves */}
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#ef4444]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              OCORRÊNCIAS GRAVES
            </span>
            <div className="w-6 h-6 rounded bg-[#ef4444]/20 border border-[#ef4444]/30 flex items-center justify-center text-[#ef4444]">
              <span className="material-symbols-outlined text-[15px]">warning</span>
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="font-tabular-data text-2xl text-[#ef4444] font-bold">
              {metrics.severeCount.toLocaleString('pt-BR')}
            </span>
            <span className="font-tabular-data text-[10px] text-[#ef4444]/80 font-bold">
              ({metrics.severePct})
            </span>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Atenção:</span>
            <span className="font-tabular-data text-[9px] px-1.5 py-0.2 rounded bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30 font-bold">
              &gt; 30 KM/H ACIMA
            </span>
          </div>
        </div>

        {/* Tempo em Excesso */}
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#34b344]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              TEMPO EM EXCESSO
            </span>
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#2ca03a]/20 border border-[#34b344]/30 text-[#34b344]">
              <span className="material-symbols-outlined text-[15px]">timer</span>
            </div>
          </div>
          <div className="my-1">
            <div className="font-tabular-data text-2xl text-white font-bold">{metrics.totalHoursStr}</div>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">&gt; 10 min contínuos:</span>
            <span className="text-[#f59e0b] font-semibold text-[11px]">{metrics.longDurationCount} vezes</span>
          </div>
        </div>

        {/* Sem Motorista ID */}
        <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548] hover:border-[#f59e0b]/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] tracking-wider font-semibold uppercase">
              SEM MOTORISTA
            </span>
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#f59e0b]/20 border border-[#f59e0b]/30 text-[#f59e0b]">
              <span className="material-symbols-outlined text-[15px]">person_off</span>
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="font-tabular-data text-2xl font-bold text-white">
              {metrics.unidentifiedCount.toLocaleString('pt-BR')}
            </span>
            <span className="font-tabular-data text-[10px] text-[#f59e0b] font-bold">
              ({metrics.unidentifiedPct})
            </span>
          </div>
          <div className="flex items-center justify-between font-tabular-data text-xs pt-1 border-t border-[#283548]/40">
            <span className="text-[#94a3b8] text-[11px]">Identificação:</span>
            <span className="font-tabular-data text-[9px] px-1.5 py-0.2 rounded font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
              SEM IBUTTON
            </span>
          </div>
        </div>
      </div>

      {/* Primary Analytics Row: 58% Daily Evolution + 42% Hourly Heat Histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-4">
        {/* Left Card: Quantidade de Excessos de Velocidade por Dia */}
        <div
          className="lg:col-span-7 rounded-xl p-4 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548]"
          style={{ backgroundColor: '#131923', border: '1px solid #283548' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#34b344] text-[18px]">
                  stacked_bar_chart
                </span>
                <span className="font-headline-sm text-sm text-white font-bold tracking-tight">
                  QUANTIDADE DE EXCESSOS DE VELOCIDADE POR DIA
                </span>
              </div>
              <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
                Evolução temporal diária ({dailyData.length} dias no filtro atual)
              </span>
            </div>
            <div className="flex items-center gap-1 bg-[#0c1017] p-0.5 rounded border border-[#283548]">
              <button
                type="button"
                onClick={() => setViewMode('daily')}
                className={`px-2 py-0.5 rounded font-tabular-data text-[10px] font-bold transition-colors cursor-pointer ${
                  viewMode === 'daily'
                    ? 'bg-[#2ca03a] text-white shadow-sm'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                DIÁRIO
              </button>
              <button
                type="button"
                onClick={() => setViewMode('weekly')}
                className={`px-2 py-0.5 rounded font-tabular-data text-[10px] font-bold transition-colors cursor-pointer ${
                  viewMode === 'weekly'
                    ? 'bg-[#2ca03a] text-white shadow-sm'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                SEMANAL
              </button>
            </div>
          </div>

          {/* Chart Canvas Area com scroll horizontal em telas mobile */}
          <div className="relative w-full h-64 mt-2 flex flex-col justify-end bg-[#0c1017] rounded-lg p-3 overflow-hidden border border-[#283548]">
            <span className="sm:hidden text-[9px] text-[#34b344] font-semibold text-center block mb-1">
              ← Deslize para navegar pelos 30 dias →
            </span>
            <div className="w-full overflow-x-auto scrollbar-none touch-scroll-x">
              <div className="relative z-10 min-w-[500px] sm:min-w-0 w-full h-44 sm:h-48 flex items-end justify-between gap-1 px-1">
                {dailyData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[#64748b]">
                    Nenhuma ocorrência para os filtros selecionados.
                  </div>
                ) : viewMode === 'daily' ? (
                  dailyData.map((item) => (
                    <div
                      key={item.fullDate}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative min-w-0"
                      onMouseEnter={() => setHoveredBar(item.fullDate)}
                      onMouseLeave={() => setHoveredBar(null)}
                      onClick={() =>
                        filterState.setSpecificDay(
                          filterState.specificDay === item.fullDate ? 'all' : item.fullDate
                        )
                      }
                    >
                      {hoveredBar === item.fullDate && (
                        <div className="absolute -top-10 bg-[#1c2432] border border-[#283548] text-[9px] font-tabular-data px-2 py-1 rounded shadow-lg text-white whitespace-nowrap z-30">
                          {item.fullDate}: {item.total} alertas
                        </div>
                      )}
                      <div
                        className="w-full rounded-t-sm flex flex-col justify-end overflow-hidden transition-all group-hover:scale-105"
                        style={{ height: item.height }}
                      >
                        <div className="w-full bg-[#ef4444]" style={{ height: `${item.f3}%` }} />
                        <div className="w-full bg-[#f59e0b]" style={{ height: `${item.f2}%` }} />
                        <div className="w-full bg-[#34b344]" style={{ height: `${item.f1}%` }} />
                      </div>
                      <span className="text-[8px] font-tabular-data text-[#94a3b8] mt-1 truncate max-w-full">
                        {item.day.slice(0, 2)}
                      </span>
                    </div>
                  ))
                ) : (
                  weeklyData.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative px-3"
                    >
                      <div className="text-[10px] font-mono text-[#94a3b8] mb-1">
                        {item.total.toLocaleString('pt-BR')}
                      </div>
                      <div
                        className="w-full rounded-t-sm flex flex-col justify-end overflow-hidden transition-all group-hover:scale-105"
                        style={{ height: item.height }}
                      >
                        <div className="w-full bg-[#ef4444]" style={{ height: `${item.f3}%` }} />
                        <div className="w-full bg-[#f59e0b]" style={{ height: `${item.f2}%` }} />
                        <div className="w-full bg-[#34b344]" style={{ height: `${item.f1}%` }} />
                      </div>
                      <span className="text-[10px] font-tabular-data text-white font-semibold mt-1 truncate max-w-full">
                        {item.label}
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
                <span className="text-[#f1f5f9]">Faixa 3 (&gt; 30 km/h)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]" />
                <span className="text-[#f1f5f9]">Faixa 2 (11-30 km/h)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#34b344]" />
                <span className="text-[#f1f5f9]">Faixa 1 (1-10 km/h)</span>
              </div>
            </div>
            <span className="font-tabular-data text-[10px] text-[#34b344] font-semibold">
              CLIQUE EM UM DIA PARA FILTRAR
            </span>
          </div>
        </div>

        {/* Right Card: Horários com Mais Excessos */}
        <div
          className="lg:col-span-5 rounded-xl p-4 flex flex-col justify-between shadow-sm bg-[#131923] border border-[#283548]"
          style={{ backgroundColor: '#131923', border: '1px solid #283548' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#f59e0b] text-[18px]">
                  schedule
                </span>
                <span className="font-headline-sm text-sm text-white font-bold tracking-tight">
                  HORÁRIOS COM MAIS EXCESSOS
                </span>
              </div>
              <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
                {hourlySortOrder === 'desc'
                  ? 'Classificado do maior para o menor volume'
                  : 'Distribuição cronológica (00h às 23h)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-lg bg-[#0c1017] p-0.5 border border-[#283548]">
                <button
                  type="button"
                  onClick={() => setHourlySortOrder('desc')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                    hourlySortOrder === 'desc'
                      ? 'bg-[#34b344] text-white shadow-[0_0_8px_rgba(52,179,68,0.4)]'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  MAIOR P/ MENOR
                </button>
                <button
                  type="button"
                  onClick={() => setHourlySortOrder('cron')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                    hourlySortOrder === 'cron'
                      ? 'bg-[#34b344] text-white shadow-[0_0_8px_rgba(52,179,68,0.4)]'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  00H - 23H
                </button>
              </div>

              <div className="px-2 py-0.5 rounded bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444] font-tabular-data text-[10px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
                <span>
                  PICO {peakHourInfo.hour}H: {peakHourInfo.count.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          {/* Histogram classified descending or chronological */}
          <div className="relative w-full h-64 mt-2 flex flex-col justify-end bg-[#0c1017] rounded-lg p-3 border border-[#283548] overflow-hidden">
            <div className="w-full overflow-x-auto scrollbar-none touch-scroll-x">
              <div className="relative z-10 min-w-[340px] sm:min-w-0 w-full h-48 pl-2 flex items-end justify-between gap-[2px]">
                {sortedHourlyData.map((col, idx) => (
                  <div
                    key={col.hour}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                    title={`${col.hour}h: ${col.count.toLocaleString('pt-BR')} excessos`}
                  >
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-30 px-1.5 py-0.5 rounded bg-[#1e293b] border border-[#475569] text-white text-[9px] font-tabular-data whitespace-nowrap shadow-lg">
                      {col.hour}h: <span className="font-bold text-[#34b344]">{col.count}</span> ({idx + 1}º)
                    </div>
                    <div
                      className={`w-full rounded-t-sm transition-all group-hover:brightness-125 ${
                        col.isPeak ? 'shadow-[0_0_8px_rgba(239,68,68,0.5)]' : ''
                      }`}
                      style={{
                        height: col.h,
                        backgroundColor: col.isPeak
                          ? '#ef4444'
                          : col.val >= 50
                            ? '#f59e0b'
                            : col.val >= 25
                              ? '#34b344'
                              : '#283548',
                      }}
                    />
                    <span
                      className={`text-[8px] font-tabular-data mt-1 ${
                        col.isPeak
                          ? 'text-[#ef4444] font-bold'
                          : col.val >= 50
                            ? 'text-[#f59e0b]'
                            : 'text-[#64748b]'
                      }`}
                    >
                      {col.hour}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Deep Dive Breakdown Cards (Responsive 1/2/3 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {/* Col 1: Limites */}
        <div className="bg-[#131923] border border-[#283548] rounded-xl p-4 flex flex-col justify-between shadow-sm md:col-span-2 xl:col-span-1">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[#f59e0b] text-[18px]">
                speed
              </span>
              <span className="font-headline-sm text-sm text-white font-bold tracking-tight">
                EM QUAIS LIMITES OCORREM OS EXCESSOS?
              </span>
            </div>
            <p className="font-body-sm text-xs text-[#94a3b8] mb-3">
              Distribuição de ocorrências por limite regulamentar da via
            </p>

            <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-center justify-center gap-4 py-2">
              <div className="relative w-36 h-36 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="38"
                    stroke="#1c2432"
                    strokeWidth="12"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="38"
                    stroke="#34b344"
                    strokeDasharray={`${(metrics.lim80Pct * 2.3876).toFixed(1)} 238.76`}
                    strokeDashoffset="0"
                    strokeWidth="12"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="38"
                    stroke="#f59e0b"
                    strokeDasharray={`${(metrics.lim60Pct * 2.3876).toFixed(1)} 238.76`}
                    strokeDashoffset={`-${(metrics.lim80Pct * 2.3876).toFixed(1)}`}
                    strokeWidth="12"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="38"
                    stroke="#ef4444"
                    strokeDasharray={`${(metrics.lim40Pct * 2.3876).toFixed(1)} 238.76`}
                    strokeDashoffset={`-${((metrics.lim80Pct + metrics.lim60Pct) * 2.3876).toFixed(1)}`}
                    strokeWidth="12"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-tabular-data text-lg text-white font-bold leading-none">
                    {metrics.total.toLocaleString('pt-BR')}
                  </span>
                  <span className="font-tabular-data text-[9px] text-[#94a3b8] mt-0.5 uppercase">
                    CASOS
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 font-tabular-data text-xs flex-1">
                <div className="flex items-center justify-between p-1.5 rounded bg-[#0c1017] border border-[#283548]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#34b344]" />
                    <span className="text-[#f1f5f9]">Limite ≥ 80 km/h</span>
                  </div>
                  <span className="font-semibold text-white">
                    {metrics.lim80Pct}% ({metrics.lim80Count.toLocaleString('pt-BR')})
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-[#0c1017] border border-[#283548]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                    <span className="text-[#f1f5f9]">Limite 60 km/h</span>
                  </div>
                  <span className="font-semibold text-white">
                    {metrics.lim60Pct}% ({metrics.lim60Count.toLocaleString('pt-BR')})
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-[#0c1017] border border-[#283548]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                    <span className="text-[#f1f5f9]">Limite ≤ 40 km/h</span>
                  </div>
                  <span className="font-semibold text-white">
                    {metrics.lim40Pct}% ({metrics.lim40Count.toLocaleString('pt-BR')})
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#283548] flex items-center justify-between font-tabular-data text-[10px] text-[#94a3b8]">
            <span>TETO REGULAMENTAR</span>
            <span className="text-[#34b344] font-semibold">RODOVIAS &amp; CERCAS CSG</span>
          </div>
        </div>

        {/* Col 2: Quantos KM/H Acima do Limite? */}
        <div className="bg-[#131923] border border-[#283548] rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[#34b344] text-[18px]">
                troubleshoot
              </span>
              <span className="font-headline-sm text-sm text-white font-bold tracking-tight">
                QUANTOS KM/H ACIMA DO LIMITE?
              </span>
            </div>
            <p className="font-body-sm text-xs text-[#94a3b8] mb-3">
              Classificação por faixa excedente (base filtrada)
            </p>

            <div className="h-44 flex items-end justify-between gap-3 pt-2 px-1">
              <div className="flex-1 flex flex-col items-center h-full justify-end">
                <span className="font-tabular-data text-[10px] text-[#34b344] font-semibold mb-1">
                  {metrics.band1.toLocaleString('pt-BR')}
                </span>
                <div
                  className="w-full bg-[#34b344] rounded-t shadow-[0_0_8px_rgba(52,179,68,0.3)]"
                  style={{ height: `${Math.max(8, Math.round((metrics.band1 / maxBand) * 85))}%` }}
                />
                <span className="font-tabular-data text-xs text-[#f1f5f9] mt-2 text-center leading-tight">
                  1 a 10
                </span>
                <span className="font-tabular-data text-[9px] text-[#94a3b8]">Faixa 1</span>
              </div>

              <div className="flex-1 flex flex-col items-center h-full justify-end">
                <span className="font-tabular-data text-[10px] text-[#eab308] font-semibold mb-1">
                  {metrics.band2.toLocaleString('pt-BR')}
                </span>
                <div
                  className="w-full bg-[#eab308] rounded-t"
                  style={{ height: `${Math.max(8, Math.round((metrics.band2 / maxBand) * 85))}%` }}
                />
                <span className="font-tabular-data text-xs text-[#f1f5f9] mt-2 text-center leading-tight">
                  11 a 20
                </span>
                <span className="font-tabular-data text-[9px] text-[#94a3b8]">Faixa 2</span>
              </div>

              <div className="flex-1 flex flex-col items-center h-full justify-end">
                <span className="font-tabular-data text-[10px] text-[#f59e0b] font-semibold mb-1">
                  {metrics.band3.toLocaleString('pt-BR')}
                </span>
                <div
                  className="w-full bg-[#f59e0b] rounded-t"
                  style={{ height: `${Math.max(8, Math.round((metrics.band3 / maxBand) * 85))}%` }}
                />
                <span className="font-tabular-data text-xs text-[#f1f5f9] mt-2 text-center leading-tight">
                  21 a 30
                </span>
                <span className="font-tabular-data text-[9px] text-[#94a3b8]">Faixa 3</span>
              </div>

              <div className="flex-1 flex flex-col items-center h-full justify-end">
                <span className="font-tabular-data text-[10px] text-[#ef4444] font-semibold mb-1">
                  {metrics.band4.toLocaleString('pt-BR')}
                </span>
                <div
                  className="w-full bg-[#ef4444] rounded-t shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                  style={{ height: `${Math.max(8, Math.round((metrics.band4 / maxBand) * 85))}%` }}
                />
                <span className="font-tabular-data text-xs text-[#ef4444] font-bold mt-2 text-center leading-tight">
                  &gt; 30
                </span>
                <span className="font-tabular-data text-[9px] text-[#ef4444]">Faixa 4</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#283548] flex items-center justify-between font-tabular-data text-[10px] text-[#94a3b8]">
            <span>ESCALA DE VELOCIDADE</span>
            <span className="text-[#ef4444] font-bold">
              {metrics.band4.toLocaleString('pt-BR')} NA FAIXA 4
            </span>
          </div>
        </div>

        {/* Col 3: Duração do Excesso */}
        <div className="bg-[#131923] border border-[#283548] rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[#f59e0b] text-[18px]">
                timelapse
              </span>
              <span className="font-headline-sm text-sm text-white font-bold tracking-tight">
                POR QUANTO TEMPO MANTEVE O EXCESSO?
              </span>
            </div>
            <p className="font-body-sm text-xs text-[#94a3b8] mb-3">
              Tempo de duração do evento registrado
            </p>

            <div className="h-44 flex items-end justify-between gap-3 pt-2 px-1">
              <div className="flex-1 flex flex-col items-center h-full justify-end">
                <span className="font-tabular-data text-[10px] text-[#34b344] font-semibold mb-1">
                  {metrics.dur1.toLocaleString('pt-BR')}
                </span>
                <div
                  className="w-full bg-[#34b344]/80 rounded-t"
                  style={{ height: `${Math.max(8, Math.round((metrics.dur1 / maxDur) * 85))}%` }}
                />
                <span className="font-tabular-data text-xs text-[#94a3b8] mt-2 text-center leading-tight">
                  &lt; 30s
                </span>
                <span className="font-tabular-data text-[9px] text-[#64748b]">Pontual</span>
              </div>

              <div className="flex-1 flex flex-col items-center h-full justify-end">
                <span className="font-tabular-data text-[10px] text-[#f1f5f9] font-semibold mb-1">
                  {metrics.dur2.toLocaleString('pt-BR')}
                </span>
                <div
                  className="w-full bg-[#eab308]/80 rounded-t"
                  style={{ height: `${Math.max(8, Math.round((metrics.dur2 / maxDur) * 85))}%` }}
                />
                <span className="font-tabular-data text-xs text-[#94a3b8] mt-2 text-center leading-tight">
                  30s a 2m
                </span>
                <span className="font-tabular-data text-[9px] text-[#64748b]">Curto</span>
              </div>

              <div className="flex-1 flex flex-col items-center h-full justify-end">
                <span className="font-tabular-data text-[10px] text-[#f59e0b] font-semibold mb-1">
                  {metrics.dur3.toLocaleString('pt-BR')}
                </span>
                <div
                  className="w-full bg-[#f59e0b] rounded-t"
                  style={{ height: `${Math.max(8, Math.round((metrics.dur3 / maxDur) * 85))}%` }}
                />
                <span className="font-tabular-data text-xs text-[#94a3b8] mt-2 text-center leading-tight">
                  2m a 5m
                </span>
                <span className="font-tabular-data text-[9px] text-[#64748b]">Médio</span>
              </div>

              <div className="flex-1 flex flex-col items-center h-full justify-end">
                <span className="font-tabular-data text-[10px] text-[#ef4444] font-semibold mb-1">
                  {metrics.dur4.toLocaleString('pt-BR')}
                </span>
                <div
                  className="w-full bg-[#ef4444] rounded-t shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                  style={{ height: `${Math.max(8, Math.round((metrics.dur4 / maxDur) * 85))}%` }}
                />
                <span className="font-tabular-data text-xs text-[#ef4444] font-bold mt-2 text-center leading-tight">
                  &gt; 5 min
                </span>
                <span className="font-tabular-data text-[9px] text-[#ef4444]">Prolongado</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#283548] flex items-center justify-between font-tabular-data text-[10px] text-[#94a3b8]">
            <span>DURAÇÃO DO EVENTO</span>
            <span className="text-[#f59e0b] font-bold">
              {metrics.total.toLocaleString('pt-BR')} REGISTROS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
