'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Incident } from '@/lib/telemetry-data';
import { convertToCSV } from '@/lib/telemetry-rules';
import { OperationalFilterBar, useOperationalFilters } from '@/components/OperationalFilterBar';

interface AuditUnidentifiedScreenProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  onLinkDriver: (incidentId: string) => void;
}

export default function AuditUnidentifiedScreen({
  incidents,
  onSelectIncident,
  onLinkDriver,
}: AuditUnidentifiedScreenProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'graves' | 'rodovias' | 'preconciliados'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const pageSize = 20;

  // Defaults to 'sem_identificacao' for the Unidentified Audit page, while allowing all 3 options in Filter 6
  const filterState = useOperationalFilters(incidents, {
    defaultDriverIdStatus: 'sem_identificacao',
  });

  const { filteredIncidents: baseFiltered, searchQuery, setSearchQuery } = filterState;

  // Apply quick tab filter on top of the 6 operational filters
  const filteredIncidents = useMemo(() => {
    let list = baseFiltered;
    if (activeTab === 'graves') {
      list = list.filter((i) => i.severityBand === 4 || i.deltaSpeed > 30);
    } else if (activeTab === 'rodovias') {
      list = list.filter(
        (i) =>
          (i.highway || '').toUpperCase().includes('MS-') ||
          (i.highway || '').toUpperCase().includes('BR-')
      );
    } else if (activeTab === 'preconciliados') {
      list = list.filter((i) => i.suggestedDriver != null || i.conciliationStatus === 'CONCILIADO');
    }
    return list;
  }, [baseFiltered, activeTab]);

  // Reset pagination during render when any filter changes (sem cascading renders de useEffect)
  const [prevFilterKey, setPrevFilterKey] = useState('');
  const currentFilterKey = `${filterState.competence}|${filterState.period}|${filterState.specificDay}|${filterState.vehicleCategory}|${filterState.excessType}|${filterState.plate}|${filterState.driverIdStatus}|${filterState.searchQuery}|${activeTab}`;

  if (currentFilterKey !== prevFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setCurrentPage(1);
  }

  const handleClearFilters = () => {
    filterState.resetFilters();
    setActiveTab('all');
    setCurrentPage(1);
  };

  // Dynamic KPIs
  const topPlateStats = useMemo(() => {
    if (filteredIncidents.length === 0) {
      return { plate: 'NENHUM', count: 0, model: 'N/A', percent: '0,0%' };
    }
    const counts: Record<string, { count: number; model: string }> = {};
    for (const inc of filteredIncidents) {
      if (!counts[inc.plate]) {
        counts[inc.plate] = { count: 0, model: inc.vehicleCategory || 'Veículo' };
      }
      counts[inc.plate].count++;
    }
    let top = { plate: '--', count: 0, model: '--' };
    for (const [p, data] of Object.entries(counts)) {
      if (data.count > top.count) {
        top = { plate: p, count: data.count, model: data.model };
      }
    }
    const percent =
      ((top.count / filteredIncidents.length) * 100).toFixed(1).replace('.', ',') + '%';
    return { ...top, percent };
  }, [filteredIncidents]);

  const maxSpeedStats = useMemo(() => {
    if (filteredIncidents.length === 0) return { speed: 0, highway: 'N/A', plate: 'N/A' };
    let max = filteredIncidents[0];
    for (const inc of filteredIncidents) {
      if (inc.recordedSpeed > max.recordedSpeed) {
        max = inc;
      }
    }
    return {
      speed: Math.round(max.recordedSpeed),
      highway: max.highway || 'Rodovia',
      plate: max.plate,
    };
  }, [filteredIncidents]);

  const totalExcessTimeStr = useMemo(() => {
    const totalSec = filteredIncidents.reduce((sum, inc) => sum + (inc.durationSeconds || 120), 0);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    return `${hours}h ${mins}m`;
  }, [filteredIncidents]);

  const shiftDistribution = useMemo(() => {
    let madrugada = 0;
    let diurno = 0;
    let noturno = 0;
    for (const inc of filteredIncidents) {
      const hour =
        typeof inc.hour === 'number'
          ? inc.hour
          : parseInt((inc.time || '12').split(':')[0], 10);
      if (!isNaN(hour) && hour >= 0 && hour < 6) madrugada++;
      else if (!isNaN(hour) && hour >= 6 && hour < 18) diurno++;
      else noturno++;
    }
    const total = filteredIncidents.length || 1;
    return {
      madrugada: {
        count: madrugada,
        percent: ((madrugada / total) * 100).toFixed(1).replace('.', ','),
        width: `${Math.round((madrugada / total) * 100)}%`,
      },
      diurno: {
        count: diurno,
        percent: ((diurno / total) * 100).toFixed(1).replace('.', ','),
        width: `${Math.round((diurno / total) * 100)}%`,
      },
      noturno: {
        count: noturno,
        percent: ((noturno / total) * 100).toFixed(1).replace('.', ','),
        width: `${Math.round((noturno / total) * 100)}%`,
      },
    };
  }, [filteredIncidents]);

  const top5Vehicles = useMemo(() => {
    const counts: Record<string, { count: number; model: string }> = {};
    for (const inc of filteredIncidents) {
      if (!counts[inc.plate]) {
        counts[inc.plate] = { count: 0, model: inc.vehicleCategory || 'CAVALO' };
      }
      counts[inc.plate].count++;
    }
    const sorted = Object.entries(counts)
      .map(([plate, data]) => ({ plate, model: data.model, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const maxCount = sorted.length > 0 ? sorted[0].count : 1;
    return sorted.map((v, idx) => ({
      rank: `#${idx + 1}`,
      plate: v.plate,
      model: v.model,
      count: `${v.count} ocorrência${v.count > 1 ? 's' : ''}`,
      w: `${Math.round((v.count / maxCount) * 100)}%`,
      c: idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-amber-500' : 'bg-[#2ca03a]',
    }));
  }, [filteredIncidents]);

  const pendingCount = useMemo(() => {
    return filteredIncidents.filter((i) => !i.hasDriver && i.conciliationStatus !== 'CONCILIADO')
      .length;
  }, [filteredIncidents]);

  const pendingRate = useMemo(() => {
    if (filteredIncidents.length === 0) return '0,0%';
    return ((pendingCount / filteredIncidents.length) * 100).toFixed(1).replace('.', ',') + '%';
  }, [filteredIncidents, pendingCount]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / pageSize));
  const paginatedIncidents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredIncidents.slice(start, start + pageSize);
  }, [filteredIncidents, currentPage, pageSize]);

  const handleLink = (id: string) => {
    onLinkDriver(id);
  };

  const handleExportCSV = () => {
    const data = filteredIncidents.map((i) => ({
      IDEvento: i.code,
      DataHora: i.timestamp,
      Placa: i.plate,
      Categoria: i.vehicleCategory,
      TipoExcesso: i.excessType || 'EXCESSO_VELOCIDADE',
      Motorista: i.driver,
      Velocidade: `${i.recordedSpeed} km/h`,
      Limite: `${i.speedLimit} km/h`,
      Excesso: `+${i.deltaSpeed} km/h`,
      Rodovia: i.highway,
      Localizacao: i.locationDetails,
      Duracao: i.duration,
      Status: i.hasDriver ? 'IDENTIFICADO' : i.conciliationStatus || 'PENDENTE',
    }));
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_identificacao_casagrande_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1000);
  };

  return (
    <div className="flex flex-col w-full text-slate-200 pb-6 animate-fade-in">
      {/* Screen Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-space-md py-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-7 bg-[#34b344] rounded-full shadow-[0_0_8px_#34b344]" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-headline-lg text-xl tracking-tight text-white font-bold">
                Auditoria de Condução sem Identificação
              </h1>
            </div>
            <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
              Apuração e conciliação de viagens e excessos registrados por status de identificação (iButton)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
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
            <span>Exportar Relatório (CSV)</span>
          </button>
        </div>
      </div>

      {/* Unified 6-Option Operational Filter Bar */}
      <div className="my-4">
        <OperationalFilterBar
          filterState={filterState}
          totalIncidents={incidents.length}
          title="Filtros Operacionais • Auditoria de Identificação Condutor"
          onResetExtra={() => setActiveTab('all')}
        />
      </div>

      {/* 3. Faixa de 6 KPIs Técnicos */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <div className="rounded-lg bg-[#121820] border border-[#283548] p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] uppercase text-[#94a3b8] font-bold">
              Registros no Filtro
            </span>
            <span className="material-symbols-outlined text-[18px] text-amber-400">no_accounts</span>
          </div>
          <div className="my-1">
            <span className="font-tabular-data text-2xl font-bold text-white tracking-tight">
              {filteredIncidents.length.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8]">
              {incidents.length > 0
                ? `${((filteredIncidents.length / incidents.length) * 100).toFixed(1).replace('.', ',')}% do ciclo`
                : '100%'}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-tabular-data text-[9px] font-bold">
              {pendingCount > 0 ? 'PENDENTE' : 'CONCLUÍDO'}
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-[#121820] border border-[#283548] p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] uppercase text-[#94a3b8] font-bold">
              Maior Incidência
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#34b344]">
              local_shipping
            </span>
          </div>
          <div className="my-1">
            <span className="font-tabular-data text-2xl font-bold text-white tracking-tight">
              {topPlateStats.plate}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8]">
              {topPlateStats.count} eventos ({topPlateStats.percent})
            </span>
            <span className="px-1.5 py-0.2 rounded bg-[#1b232c] text-[#94a3b8] border border-[#283548] font-tabular-data text-[9px] font-bold truncate max-w-[80px]">
              {topPlateStats.model}
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-[#121820] border border-[#283548] p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] uppercase text-[#94a3b8] font-bold">
              Tempo Total em Excesso
            </span>
            <span className="material-symbols-outlined text-[18px] text-red-400">timer_off</span>
          </div>
          <div className="my-1">
            <span className="font-tabular-data text-2xl font-bold text-white tracking-tight">
              {totalExcessTimeStr}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8]">No recorte atual</span>
            <span className="px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-tabular-data text-[9px] font-bold">
              CRÍTICO
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-[#121820] border border-[#283548] p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] uppercase text-[#94a3b8] font-bold">
              Maior Velocidade
            </span>
            <span className="material-symbols-outlined text-[18px] text-red-400">speed</span>
          </div>
          <div className="my-1 flex items-baseline gap-1">
            <span className="font-tabular-data text-2xl font-bold text-red-400 tracking-tight">
              {maxSpeedStats.speed}
            </span>
            <span className="font-tabular-data text-xs text-[#94a3b8]">km/h</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8] truncate">
              {maxSpeedStats.highway} • {maxSpeedStats.plate}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-tabular-data text-[9px] font-bold">
              PICO
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-[#121820] border border-[#283548] p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] uppercase text-[#94a3b8] font-bold">
              Sem Identificação
            </span>
            <span className="material-symbols-outlined text-[18px] text-amber-400">
              pending_actions
            </span>
          </div>
          <div className="my-1">
            <span className="font-tabular-data text-2xl font-bold text-amber-400 tracking-tight">
              {pendingRate}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8]">
              {pendingCount.toLocaleString('pt-BR')} sem atribuição
            </span>
            <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-tabular-data text-[9px] font-bold">
              AUDITORIA
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-[#121820] border border-[#283548] p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] uppercase text-[#94a3b8] font-bold">
              Impacto Financeiro
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#34b344]">gavel</span>
          </div>
          <div className="my-1">
            <span className="font-tabular-data text-2xl font-bold text-slate-200 tracking-tight">
              R$ 0,00
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-tabular-data text-[10px] text-[#94a3b8]">Glosado até conciliação</span>
            <span className="px-1.5 py-0.2 rounded bg-[#2ca03a]/15 text-[#34b344] border border-[#2ca03a]/30 font-tabular-data text-[9px] font-bold">
              RETIDO
            </span>
          </div>
        </div>
      </section>

      {/* 4. Painel Central: Concentração por Turno & Top Veículos (Largura Total) */}
      <section className="bg-[#121820] border border-[#283548] rounded-xl p-4 flex flex-col gap-4 shadow-sm mb-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#283548]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#34b344] text-[20px]">
              donut_large
            </span>
            <h2 className="text-sm font-bold text-white">
              Concentração por Turno &amp; Top Veículos sem Identificação
            </h2>
          </div>
          <span className="font-tabular-data text-[10px] px-2 py-0.5 rounded bg-[#1b232c] text-[#34b344] border border-[#2ca03a]/30 font-bold self-start sm:self-auto">
            TELEMETRIA CSG • DISTRIBUIÇÃO OPERACIONAL
          </span>
        </div>

        {/* Grid interno de 2 colunas amplas: Turnos à esquerda, Top Veículos à direita */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Coluna 1: Distribuição Cronológica por Turno */}
          <div className="flex flex-col justify-between gap-3 p-3.5 rounded-lg bg-[#0b0f14] border border-[#283548]">
            <div className="flex items-center justify-between pb-2 border-b border-[#283548]/60">
              <span className="font-tabular-data text-[10px] uppercase text-[#94a3b8] font-bold tracking-wider">
                DISTRIBUIÇÃO CRONOLÓGICA DAS INFRAÇÕES
              </span>
              <span className="font-tabular-data text-[10px] text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25">
                MADRUGADA = {shiftDistribution.madrugada.percent}%
              </span>
            </div>

            <div className="space-y-3 py-1">
              {/* Madrugada */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-tabular-data text-xs">
                  <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    Madrugada (00h às 06h)
                  </span>
                  <span className="text-white font-bold">
                    {shiftDistribution.madrugada.count} eventos ({shiftDistribution.madrugada.percent}%)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded bg-[#1b232c] overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded transition-all duration-300"
                    style={{ width: shiftDistribution.madrugada.width }}
                  />
                </div>
              </div>

              {/* Noturno */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-tabular-data text-xs">
                  <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    Noturno (18h às 00h)
                  </span>
                  <span className="text-[#94a3b8]">
                    {shiftDistribution.noturno.count} eventos ({shiftDistribution.noturno.percent}%)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded bg-[#1b232c] overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded transition-all duration-300"
                    style={{ width: shiftDistribution.noturno.width }}
                  />
                </div>
              </div>

              {/* Diurno */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-tabular-data text-xs">
                  <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#34b344]" />
                    Diurno (06h às 18h)
                  </span>
                  <span className="text-[#94a3b8]">
                    {shiftDistribution.diurno.count} eventos ({shiftDistribution.diurno.percent}%)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded bg-[#1b232c] overflow-hidden">
                  <div
                    className="h-full bg-[#2ca03a] rounded transition-all duration-300"
                    style={{ width: shiftDistribution.diurno.width }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#283548]/60 flex items-center justify-between text-[11px] text-[#94a3b8]">
              <span>Maior concentração de viagens anônimas:</span>
              <strong className="text-amber-400 font-semibold">Horário Noturno / Madrugada</strong>
            </div>
          </div>

          {/* Coluna 2: Top Veículos no Filtro */}
          <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-[#0b0f14] border border-[#283548]">
            <div className="flex items-center justify-between pb-2 border-b border-[#283548]/60">
              <span className="font-tabular-data text-[10px] uppercase text-[#94a3b8] font-bold tracking-wider">
                TOP VEÍCULOS NO FILTRO ATUAL (CLIQUE PARA FILTRAR)
              </span>
              <span className="text-[10px] text-[#94a3b8]">
                {top5Vehicles.length} veículos listados
              </span>
            </div>

            <div className="space-y-2 font-tabular-data text-xs">
              {top5Vehicles.length === 0 ? (
                <div className="p-4 text-center text-[#94a3b8] bg-[#121820] rounded border border-[#283548]">
                  Nenhum veículo encontrado no filtro selecionado.
                </div>
              ) : (
                top5Vehicles.map((v) => (
                  <div
                    key={v.plate}
                    onClick={() =>
                      filterState.setPlate(filterState.plate === v.plate ? 'all' : v.plate)
                    }
                    className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors ${
                      filterState.plate === v.plate
                        ? 'bg-[#1c2432] border-[#34b344] shadow-sm'
                        : 'bg-[#121820] border-[#283548] hover:border-[#34b344]/50 hover:bg-[#161f2a]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[#34b344] font-bold text-xs">{v.rank}</span>
                      <span className="text-white font-bold text-xs">{v.plate}</span>
                      <span className="text-[#94a3b8] text-[10px] px-2 py-0.5 rounded bg-[#1b232c] border border-[#283548]/50">
                        {v.model}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-28 sm:w-36 h-2 rounded bg-[#1b232c] overflow-hidden hidden sm:block">
                        <div className={`h-full rounded ${v.c}`} style={{ width: v.w }} />
                      </div>
                      <span className="text-white font-bold text-xs">{v.count}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Tabela / Data Grid de Alta Densidade */}
      <section className="bg-[#121820] border border-[#283548] rounded-lg p-4 flex flex-col gap-3.5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-[#283548]">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#34b344] text-[20px]">dataset</span>
              <h2 className="text-sm font-bold text-white">
                Matriz de Registros de Auditoria de Identificação
              </h2>
            </div>
            <span className="font-tabular-data text-xs text-[#94a3b8]">
              Exibindo {paginatedIncidents.length} de {filteredIncidents.length.toLocaleString('pt-BR')} eventos filtrados
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <div className="flex items-center gap-1 p-1 rounded bg-[#0b0f14] border border-[#283548] overflow-x-auto scrollbar-none touch-scroll-x max-w-full">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1.5 rounded font-tabular-data text-[11px] font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === 'all'
                    ? 'bg-[#2ca03a] text-white shadow-sm'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                Todos ({baseFiltered.length.toLocaleString('pt-BR')})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('graves')}
                className={`px-2.5 py-1.5 rounded font-tabular-data text-[11px] cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === 'graves'
                    ? 'bg-[#ef4444] text-white font-bold'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                Graves &gt;30 km/h
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rodovias')}
                className={`px-2.5 py-1.5 rounded font-tabular-data text-[11px] cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === 'rodovias'
                    ? 'bg-[#2ca03a] text-white font-bold'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                Trechos Rodoviários
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preconciliados')}
                className={`px-2.5 py-1.5 rounded font-tabular-data text-[11px] cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === 'preconciliados'
                    ? 'bg-[#2ca03a] text-white font-bold'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                Pré-Conciliados
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#161f2a] hover:bg-[#1b232c] border border-[#283548] text-xs font-tabular-data text-slate-200 transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px] text-[#34b344]">download</span>
              Baixar Lista em Excel (CSV)
            </button>
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-[16px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar placa, motorista, rodovia ou data..."
              className="w-full bg-[#0b0f14] border border-[#283548] text-slate-200 pl-8 pr-3 py-1.5 rounded text-xs font-tabular-data focus:outline-none focus:border-[#2ca03a] placeholder-[#94a3b8]/60"
            />
          </div>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto scrollbar-none touch-scroll-x">
          <div className="sm:hidden flex items-center gap-1.5 px-3 py-1 text-[11px] text-[#94a3b8] italic border-b border-[#283548]/40">
            <span className="material-symbols-outlined text-[14px]">swipe</span>
            <span>Deslize horizontalmente para navegar na matriz</span>
          </div>
          <table className="w-full min-w-[850px] text-left font-tabular-data text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr className="text-[#94a3b8] border-b border-[#283548] bg-[#0b0f14] text-[10px] uppercase">
                <th className="py-2.5 px-3">ID EVENTO</th>
                <th className="py-2.5 px-3">DATA &amp; HORA</th>
                <th className="py-2.5 px-3">VEÍCULO / CATEGORIA</th>
                <th className="py-2.5 px-3">CONDUTOR</th>
                <th className="py-2.5 px-3 text-right">VELOCIDADE / LIMITE</th>
                <th className="py-2.5 px-3">RODOVIA &amp; TRECHO</th>
                <th className="py-2.5 px-3">DURAÇÃO</th>
                <th className="py-2.5 px-3 text-center">STATUS</th>
                <th className="py-2.5 px-3 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#283548] text-slate-200">
              {paginatedIncidents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-[#94a3b8] font-tabular-data">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[36px] text-amber-400">
                        filter_alt_off
                      </span>
                      <p className="text-sm font-semibold text-white">
                        Nenhum evento telemétrico encontrado para os filtros selecionados.
                      </p>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="mt-2 px-3.5 py-1.5 text-xs rounded font-bold bg-[#2ca03a] text-white hover:bg-[#34b344] transition-all shadow-sm cursor-pointer"
                      >
                        Limpar Todos os Filtros
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-[#161f2a]/70 transition-colors">
                    <td className="py-2.5 px-3 text-[#34b344] font-bold">{inc.code}</td>
                    <td className="py-2.5 px-3">{inc.timestamp}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-white">{inc.plate}</span>
                      <span className="ml-1.5 px-1 py-0.5 rounded bg-[#1b232c] text-[#94a3b8] text-[9px]">
                        {inc.vehicleCategory}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {inc.hasDriver ? (
                        <span className="text-[#34b344] font-semibold">{inc.driver}</span>
                      ) : (
                        <span className="text-amber-400 font-semibold">Sem identificação</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`font-bold ${
                          inc.deltaSpeed > 30 ? 'text-red-400' : 'text-amber-400'
                        }`}
                      >
                        {inc.recordedSpeed} km/h
                      </span>
                      <span className="text-[#94a3b8] text-[10px] ml-1">/ {inc.speedLimit}</span>
                      <span
                        className={`ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold ${
                          inc.deltaSpeed > 30
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        +{inc.deltaSpeed}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 truncate max-w-[220px]">
                      {inc.highway} • {inc.locationDetails}
                    </td>
                    <td className="py-2.5 px-3 text-[#94a3b8]">{inc.duration}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          inc.hasDriver || inc.conciliationStatus === 'CONCILIADO'
                            ? 'bg-[#2ca03a]/20 text-[#34b344] border-[#34b344]/40'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {inc.hasDriver
                          ? 'IDENTIFICADO'
                          : inc.conciliationStatus || 'SEM IDENTIFICAÇÃO'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {inc.suggestedDriver && !inc.hasDriver && (
                        <button
                          type="button"
                          onClick={() => handleLink(inc.id)}
                          className="px-2.5 py-1 rounded bg-[#2ca03a] hover:bg-[#34b344] text-white font-tabular-data text-[11px] font-bold transition-all shadow-sm cursor-pointer"
                        >
                          Vincular
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectIncident(inc)}
                        className="ml-1 p-1 rounded bg-[#1b232c] border border-[#283548] text-[#94a3b8] hover:text-white transition-colors align-middle cursor-pointer"
                        title="Ver Telemetria"
                      >
                        <span className="material-symbols-outlined text-[15px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Controles de Paginação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#283548] text-xs font-tabular-data text-[#94a3b8]">
          <div>
            Mostrando{' '}
            <span className="text-white font-bold">
              {filteredIncidents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>{' '}
            a{' '}
            <span className="text-white font-bold">
              {Math.min(currentPage * pageSize, filteredIncidents.length)}
            </span>{' '}
            de{' '}
            <span className="text-[#34b344] font-bold">
              {filteredIncidents.length.toLocaleString('pt-BR')}
            </span>{' '}
            ocorrências filtradas
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded bg-[#161f2a] border border-[#283548] text-slate-200 hover:bg-[#1f2937] hover:border-[#34b344] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">chevron_left</span>
              Anterior
            </button>
            <span className="px-3 py-1 rounded bg-[#0b0f14] border border-[#283548] text-white font-bold">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded bg-[#161f2a] border border-[#283548] text-slate-200 hover:bg-[#1f2937] hover:border-[#34b344] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
            >
              Próxima
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
