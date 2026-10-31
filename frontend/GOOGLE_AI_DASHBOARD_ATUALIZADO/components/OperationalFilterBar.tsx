'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Filter, RotateCcw, Search, Calendar } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { Incident } from '@/lib/telemetry-data';
import {
  filterIncidents,
  getDatasetDateBounds,
  isDateInPeriod,
  isDateInCompetence,
  getAvailableCompetences,
  getCompetenceInfoFromKey,
  AvailableCompetenceItem,
  CompetenceInfo,
  parseDateBR,
} from '@/lib/telemetry-rules';

export interface OperationalFilterState {
  competence: string;
  setCompetence: (val: string) => void;
  period: string;
  setPeriod: (val: string) => void;
  specificDay: string;
  setSpecificDay: (val: string) => void;
  vehicleCategory: string;
  setVehicleCategory: (val: string) => void;
  excessType: string;
  setExcessType: (val: string) => void;
  plate: string;
  setPlate: (val: string) => void;
  driverIdStatus: string;
  setDriverIdStatus: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  availableCompetences: AvailableCompetenceItem[];
  selectedCompetenceInfo: CompetenceInfo | null;
  availableDays: Array<{ date: string; count: number }>;
  availableCategories: Array<{ category: string; count: number }>;
  availablePlates: Array<{ plate: string; category: string; count: number }>;
  filteredIncidents: Incident[];
  activeFilterCount: number;
  resetFilters: () => void;
}

export interface UseOperationalFiltersOptions {
  defaultDriverIdStatus?: string;
  defaultPeriod?: string;
  defaultCompetence?: string;
}

const DEFAULT_CATEGORIES = ['LEVE', 'CAVALO', 'ÔNIBUS', 'MUNK', 'CAÇAMBA', 'COMBOIO', 'PIPA'];

export function useOperationalFilters(
  incidents: Incident[],
  options?: UseOperationalFiltersOptions
): OperationalFilterState {
  const initialDriverStatus = options?.defaultDriverIdStatus ?? 'all';
  const initialPeriod = options?.defaultPeriod ?? 'all';
  const initialCompetence = options?.defaultCompetence ?? 'all';

  const [competence, setCompetence] = useState<string>(initialCompetence);
  const [period, setPeriod] = useState<string>(initialPeriod);
  const [specificDay, setSpecificDay] = useState<string>('all');
  const [vehicleCategory, setVehicleCategory] = useState<string>('all');
  const [excessType, setExcessType] = useState<string>('all');
  const [plate, setPlate] = useState<string>('all');
  const [driverIdStatus, setDriverIdStatus] = useState<string>(initialDriverStatus);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Available competences in dataset (sorted newest first)
  const availableCompetences = useMemo(() => getAvailableCompetences(incidents), [incidents]);

  // Information about currently selected competence
  const selectedCompetenceInfo = useMemo(() => getCompetenceInfoFromKey(competence), [competence]);

  // Date bounds for periods (consider selected competence bounds if active)
  const { minTs, maxTs } = useMemo(() => {
    if (selectedCompetenceInfo) {
      return { minTs: selectedCompetenceInfo.startTs, maxTs: selectedCompetenceInfo.endTs };
    }
    return getDatasetDateBounds(incidents);
  }, [incidents, selectedCompetenceInfo]);

  // Available dates within the selected Competence & Period (Filter 1 -> Filter 2 -> Filter 3 cascade)
  const availableDays = useMemo(() => {
    const counts = new Map<string, number>();
    for (let i = 0; i < incidents.length; i++) {
      const inc = incidents[i];
      if (!inc.date) continue;
      if (competence !== 'all' && !isDateInCompetence(inc.date, competence)) {
        continue;
      }
      if (isDateInPeriod(inc.date, period, minTs, maxTs)) {
        counts.set(inc.date, (counts.get(inc.date) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => {
        const tsA = parseDateBR(a[0]) ?? 0;
        const tsB = parseDateBR(b[0]) ?? 0;
        return tsB - tsA; // Most recent first
      })
      .map(([date, count]) => ({ date, count }));
  }, [incidents, competence, period, minTs, maxTs]);

  // Available vehicle categories from dataset
  const availableCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (let i = 0; i < incidents.length; i++) {
      const inc = incidents[i];
      if (competence !== 'all' && !isDateInCompetence(inc.date, competence)) {
        continue;
      }
      const cat = (inc.vehicleCategory || 'CAVALO').toUpperCase();
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    if (counts.size === 0) {
      return DEFAULT_CATEGORIES.map((c) => ({ category: c, count: 0 }));
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));
  }, [incidents, competence]);

  // Available plates filtered by selected Vehicle Category and Competence
  const availablePlates = useMemo(() => {
    const plateMap = new Map<string, { category: string; count: number }>();
    for (let i = 0; i < incidents.length; i++) {
      const inc = incidents[i];
      if (!inc.plate) continue;
      if (competence !== 'all' && !isDateInCompetence(inc.date, competence)) {
        continue;
      }
      if (vehicleCategory !== 'all') {
        const catUpper = (inc.vehicleCategory || '').toUpperCase();
        const selUpper = vehicleCategory.toUpperCase();
        if (catUpper !== selUpper && !catUpper.includes(selUpper)) continue;
      }
      const prev = plateMap.get(inc.plate);
      if (prev) {
        prev.count += 1;
      } else {
        plateMap.set(inc.plate, { category: inc.vehicleCategory, count: 1 });
      }
    }
    return Array.from(plateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([plateName, info]) => ({
        plate: plateName,
        category: info.category,
        count: info.count,
      }));
  }, [incidents, competence, vehicleCategory]);

  // Derivação pura durante a renderização sem efeitos colaterais:
  // Se o valor selecionado não existir no subconjunto válido atual, reverte para 'all'
  const isSpecificDayValid = specificDay === 'all' || availableDays.some((d) => d.date === specificDay);
  const effectiveSpecificDay = isSpecificDayValid ? specificDay : 'all';

  const isPlateValid = plate === 'all' || availablePlates.some((p) => p.plate === plate);
  const effectivePlate = isPlateValid ? plate : 'all';

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    return filterIncidents(incidents, {
      competence,
      period,
      specificDay: effectiveSpecificDay,
      vehicleCategory,
      excessType,
      plate: effectivePlate,
      driverIdStatus,
      searchQuery,
    });
  }, [
    incidents,
    competence,
    period,
    effectiveSpecificDay,
    vehicleCategory,
    excessType,
    effectivePlate,
    driverIdStatus,
    searchQuery,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (competence !== 'all') count++;
    if (period !== 'all') count++;
    if (effectiveSpecificDay !== 'all') count++;
    if (vehicleCategory !== 'all') count++;
    if (excessType !== 'all') count++;
    if (effectivePlate !== 'all') count++;
    if (driverIdStatus !== 'all') count++;
    if (searchQuery.trim().length > 0) count++;
    return count;
  }, [competence, period, effectiveSpecificDay, vehicleCategory, excessType, effectivePlate, driverIdStatus, searchQuery]);

  const resetFilters = () => {
    setCompetence(initialCompetence);
    setPeriod('all');
    setSpecificDay('all');
    setVehicleCategory('all');
    setExcessType('all');
    setPlate('all');
    setDriverIdStatus('all');
    setSearchQuery('');
  };

  return {
    competence,
    setCompetence,
    period,
    setPeriod,
    specificDay: effectiveSpecificDay,
    setSpecificDay,
    vehicleCategory,
    setVehicleCategory,
    excessType,
    setExcessType,
    plate: effectivePlate,
    setPlate,
    driverIdStatus,
    setDriverIdStatus,
    searchQuery,
    setSearchQuery,
    availableCompetences,
    selectedCompetenceInfo,
    availableDays,
    availableCategories,
    availablePlates,
    filteredIncidents,
    activeFilterCount,
    resetFilters,
  };
}

interface OperationalFilterBarProps {
  filterState: OperationalFilterState;
  totalIncidents: number;
  title?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  onResetExtra?: () => void;
}

export function OperationalFilterBar({
  filterState,
  totalIncidents,
  title = 'Filtros Operacionais Unificados • Telemetria CSG',
  showSearch = false,
  searchPlaceholder = 'Buscar placa, motorista, rodovia ou velocidade...',
  onResetExtra,
}: OperationalFilterBarProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const {
    competence,
    setCompetence,
    period,
    setPeriod,
    specificDay,
    setSpecificDay,
    vehicleCategory,
    setVehicleCategory,
    excessType,
    setExcessType,
    plate,
    setPlate,
    driverIdStatus,
    setDriverIdStatus,
    searchQuery,
    setSearchQuery,
    availableCompetences,
    availableDays,
    availableCategories,
    availablePlates,
    filteredIncidents,
    activeFilterCount,
    resetFilters,
  } = filterState;

  const handleReset = () => {
    resetFilters();
    if (onResetExtra) onResetExtra();
  };

  const getSelectClass = (isActive: boolean) => {
    if (isLight) {
      return isActive
        ? 'w-full rounded-lg px-2.5 py-2 text-xs min-h-[38px] transition-all outline-none cursor-pointer border bg-emerald-50/80 border-emerald-500 text-emerald-950 font-semibold shadow-xs'
        : 'w-full rounded-lg px-2.5 py-2 text-xs min-h-[38px] transition-all outline-none cursor-pointer border bg-[#f8fafc] border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-[#34b344] focus:ring-1 focus:ring-[#34b344]/20';
    }
    return isActive
      ? 'w-full rounded-lg px-2.5 py-2 text-xs min-h-[38px] transition-all outline-none cursor-pointer border bg-[#34b344]/15 border-[#34b344] text-white font-semibold'
      : 'w-full rounded-lg px-2.5 py-2 text-xs min-h-[38px] transition-all outline-none cursor-pointer border bg-[#0c1017] border-[#283548] text-[#f1f5f9] hover:border-[#34b344]/50 focus:border-[#34b344]';
  };

  const getLabelClass = (isActive: boolean) => {
    if (isLight) {
      return `block text-[10px] font-mono uppercase font-bold tracking-wider mb-1 truncate ${
        isActive ? 'text-emerald-700' : 'text-slate-600'
      }`;
    }
    return `block text-[10px] font-mono uppercase font-bold tracking-wider mb-1 truncate ${
      isActive ? 'text-[#34b344]' : 'text-[#94a3b8]'
    }`;
  };

  const optClass = isLight ? 'bg-white text-slate-900' : 'bg-[#0c1017] text-[#f1f5f9]';

  return (
    <div
      data-slot="filter-bar"
      className={`rounded-xl p-3 sm:p-4 transition-all duration-200 border ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#131923] border-[#283548] shadow-md'
      }`}
    >
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2.5 border-b ${
          isLight ? 'border-slate-100' : 'border-[#283548]'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className={`w-3.5 h-3.5 ${isLight ? 'text-[#16a34a]' : 'text-[#34b344]'}`} />
          <span
            className={`text-[11px] font-bold uppercase tracking-wider ${
              isLight ? 'text-slate-800' : 'text-[#f1f5f9]'
            }`}
          >
            {title}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              isLight
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-[#34b344]/10 border-[#34b344]/30 text-[#34b344]'
            }`}
          >
            {filteredIncidents.length.toLocaleString('pt-BR')} / {totalIncidents.toLocaleString('pt-BR')} registros
          </span>
          {activeFilterCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                isLight
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-[#f59e0b]/15 border-[#f59e0b]/30 text-[#f59e0b]'
              }`}
            >
              {activeFilterCount} {activeFilterCount === 1 ? 'filtro ativo' : 'filtros ativos'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {showSearch && (
            <div className="relative flex-1 sm:w-64 md:w-72 sm:flex-none">
              <Search
                className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
                  isLight ? 'text-slate-400' : 'text-[#94a3b8]'
                }`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className={`w-full rounded-lg pl-8 pr-3 py-1.5 text-xs transition-colors outline-none border ${
                  isLight
                    ? 'bg-[#f8fafc] border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#34b344] focus:ring-1 focus:ring-[#34b344]/20'
                    : 'bg-[#0c1017] border-[#283548] text-[#f1f5f9] placeholder:text-[#64748b] focus:border-[#34b344]'
                }`}
              />
            </div>
          )}
          <button
            type="button"
            onClick={handleReset}
            className={`text-[11px] font-medium flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
              isLight
                ? 'bg-[#f1f5f9] border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-slate-200/70 hover:border-emerald-300'
                : 'bg-[#0c1017] border-[#283548] text-[#94a3b8] hover:text-[#34b344] hover:border-[#34b344]/40'
            }`}
          >
            <RotateCcw className="w-3 h-3" /> Limpar Filtros
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 sm:gap-3">
        {/* 1: Competência / Mês */}
        <div className="min-w-0">
          <label className={getLabelClass(competence !== 'all')} title="Ciclo mensal Casagrande: dia 26 do mês anterior ao dia 25 do mês atual">
            1. Competência / Mês
          </label>
          <select
            value={competence}
            onChange={(e) => {
              setCompetence(e.target.value);
              setSpecificDay('all');
            }}
            className={getSelectClass(competence !== 'all')}
            title="Ciclo mensal: do dia 26 do mês anterior ao dia 25 do mês atual"
          >
            <option value="all" className={optClass}>
              Todas as competências ({availableCompetences.length})
            </option>
            {availableCompetences.map((c) => (
              <option key={c.key} value={c.key} className={optClass}>
                {c.label} ({c.shortRangeLabel}) • {c.count.toLocaleString('pt-BR')}
              </option>
            ))}
          </select>
        </div>

        {/* 2: Período / Recorte */}
        <div className="min-w-0">
          <label className={getLabelClass(period !== 'all')}>
            2. Período / Recorte
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={getSelectClass(period !== 'all')}
          >
            <option value="all" className={optClass}>Todos os dias</option>
            <option value="ultimos-7" className={optClass}>Últimos 7 dias</option>
            <option value="ultimos-15" className={optClass}>Últimos 15 dias</option>
            <option value="primeiros-15" className={optClass}>Primeiros 15 dias</option>
          </select>
        </div>

        {/* 3: Dia específico */}
        <div className="min-w-0">
          <label className={getLabelClass(specificDay !== 'all')}>
            3. Dia Específico
          </label>
          <select
            value={specificDay}
            onChange={(e) => setSpecificDay(e.target.value)}
            className={getSelectClass(specificDay !== 'all')}
          >
            <option value="all" className={optClass}>Todos os dias ({availableDays.length} dias)</option>
            {availableDays.map((d) => (
              <option key={d.date} value={d.date} className={optClass}>
                {d.date} ({d.count} ocorr.)
              </option>
            ))}
          </select>
        </div>

        {/* 4: Categoria Veículo */}
        <div className="min-w-0">
          <label className={getLabelClass(vehicleCategory !== 'all')}>
            4. Categoria Veículo
          </label>
          <select
            value={vehicleCategory}
            onChange={(e) => {
              setVehicleCategory(e.target.value);
              setPlate('all');
            }}
            className={getSelectClass(vehicleCategory !== 'all')}
          >
            <option value="all" className={optClass}>Todas as categorias</option>
            {availableCategories.map((c) => (
              <option key={c.category} value={c.category} className={optClass}>
                {c.category} ({c.count.toLocaleString('pt-BR')})
              </option>
            ))}
          </select>
        </div>

        {/* 5: Tipo de Excesso Veloc. */}
        <div className="min-w-0">
          <label className={getLabelClass(excessType !== 'all')}>
            5. Tipo de Excesso
          </label>
          <select
            value={excessType}
            onChange={(e) => setExcessType(e.target.value)}
            className={getSelectClass(excessType !== 'all')}
          >
            <option value="all" className={optClass}>Todos os tipos de excesso</option>
            <option value="EXCESSO_VELOCIDADE" className={optClass}>Excesso de Velocidade (Limite Frota)</option>
            <option value="EXCESSO_VELOCIDADE_POR_VIA" className={optClass}>Excesso Veloc. por Via / Cerca</option>
            <option value="gravissima" className={optClass}>Faixa Gravíssima (&gt; 30 km/h acima)</option>
            <option value="grave" className={optClass}>Faixa Média / Grave (11 a 30 km/h)</option>
            <option value="leve" className={optClass}>Faixa Leve (Até 10 km/h acima)</option>
          </select>
        </div>

        {/* 6: Placa do Veículo */}
        <div className="min-w-0">
          <label className={getLabelClass(plate !== 'all')}>
            6. Placa do Veículo
          </label>
          <select
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            className={getSelectClass(plate !== 'all')}
          >
            <option value="all" className={optClass}>Todas as placas ({availablePlates.length})</option>
            {availablePlates.map((p) => (
              <option key={p.plate} value={p.plate} className={optClass}>
                {p.plate} • {p.category} ({p.count})
              </option>
            ))}
          </select>
        </div>

        {/* 7: Identificação Condutor */}
        <div className="min-w-0">
          <label className={getLabelClass(driverIdStatus !== 'all')}>
            7. Identificação Condutor
          </label>
          <select
            value={driverIdStatus}
            onChange={(e) => setDriverIdStatus(e.target.value)}
            className={getSelectClass(driverIdStatus !== 'all')}
          >
            <option value="all" className={optClass}>Todos (Com e sem identificação)</option>
            <option value="identificado" className={optClass}>Condutor Identificado</option>
            <option value="sem_identificacao" className={optClass}>Sem identificação</option>
          </select>
        </div>
      </div>
    </div>
  );
}
