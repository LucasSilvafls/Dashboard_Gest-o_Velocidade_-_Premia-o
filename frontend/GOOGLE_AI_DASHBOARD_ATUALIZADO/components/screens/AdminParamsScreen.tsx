'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/lib/ThemeContext';
import { RoadParameter, AuditLog } from '@/lib/telemetry-data';
import { BonusRules, DEFAULT_BONUS_RULES } from '@/lib/telemetry-rules';
import {
  fetchFleetVehicles,
  saveFleetVehicle,
  deleteFleetVehicle,
  FleetVehicleRecord,
  cleanPlate,
} from '@/lib/telemetry-service';

interface AdminParamsScreenProps {
  roadParams: RoadParameter[];
  auditLogs: AuditLog[];
  onOpenRoadModal: (param?: RoadParameter) => void;
  onSaveRules: (minHours: number, baseBonus: string) => void;
  bonusRules?: BonusRules;
  onVehiclesUpdated?: () => void;
}

const ALL_CATEGORIES = ['LEVE', 'CAVALO', 'CAÇAMBA', 'PIPA', 'COMBOIO', 'MUNK', 'ÔNIBUS'] as const;

export default function AdminParamsScreen({
  roadParams,
  auditLogs,
  onOpenRoadModal,
  onSaveRules,
  bonusRules,
  onVehiclesUpdated,
}: AdminParamsScreenProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<'roads' | 'rules' | 'logs' | 'vehicles'>('roads');
  const [isPropagating, setIsPropagating] = useState(false);
  const [propagatedSuccess, setPropagatedSuccess] = useState(false);

  // Estados da Frota (Vínculo Placa x Categoria)
  const [vehicles, setVehicles] = useState<FleetVehicleRecord[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleCategoryFilter, setVehicleCategoryFilter] = useState('TODAS');
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicleCategory, setNewVehicleCategory] = useState<string>('LEVE');
  const [newVehiclePrefix, setNewVehiclePrefix] = useState('');
  const [newVehicleUo, setNewVehicleUo] = useState('CASAGRANDE');
  const [vehicleNotification, setVehicleNotification] = useState<{ message: string; isError?: boolean } | null>(null);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);

  const loadVehicles = async () => {
    setIsLoadingVehicles(true);
    try {
      const data = await fetchFleetVehicles();
      setVehicles(data);
    } catch (err) {
      console.warn('Erro ao carregar veículos:', err);
    } finally {
      setIsLoadingVehicles(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const handleQuickCategoryChange = async (plate: string, newCategory: string) => {
    const existing = vehicles.find((v) => v.placa === plate);
    const updated = await saveFleetVehicle({
      placa: plate,
      categoria: newCategory,
      prefixo: existing?.prefixo,
      uo: existing?.uo || 'CASAGRANDE',
    });

    if (updated.success) {
      setVehicles((prev) =>
        prev.map((v) => (v.placa === plate ? { ...v, categoria: newCategory } : v))
      );
      setVehicleNotification({ message: `Placa ${plate} vinculada à categoria ${newCategory}!` });
      setTimeout(() => setVehicleNotification(null), 3000);
      onVehiclesUpdated?.();
    } else {
      setVehicleNotification({ message: `Erro ao salvar: ${updated.error}`, isError: true });
      setTimeout(() => setVehicleNotification(null), 4000);
    }
  };

  const handleSaveNewVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const cp = cleanPlate(newVehiclePlate);
    if (!cp || cp.length < 5) {
      setVehicleNotification({ message: 'Informe uma placa válida (ex: ABC1D23).', isError: true });
      setTimeout(() => setVehicleNotification(null), 3500);
      return;
    }

    setIsSavingVehicle(true);
    try {
      const res = await saveFleetVehicle({
        placa: cp,
        categoria: newVehicleCategory,
        prefixo: newVehiclePrefix.trim() || undefined,
        uo: newVehicleUo.trim() || 'CASAGRANDE',
      });

      if (res.success) {
        setVehicleNotification({ message: `Placa ${cp} vinculada com sucesso à categoria ${newVehicleCategory}!` });
        setTimeout(() => setVehicleNotification(null), 3500);
        setIsAddVehicleModalOpen(false);
        setNewVehiclePlate('');
        setNewVehiclePrefix('');
        await loadVehicles();
        onVehiclesUpdated?.();
      } else {
        setVehicleNotification({ message: `Erro: ${res.error}`, isError: true });
        setTimeout(() => setVehicleNotification(null), 4000);
      }
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const handleDeleteVehicle = async (plate: string) => {
    if (!confirm(`Deseja realmente remover o vínculo da placa ${plate}?`)) return;
    const res = await deleteFleetVehicle(plate);
    if (res.success) {
      setVehicles((prev) => prev.filter((v) => v.placa !== plate));
      setVehicleNotification({ message: `Placa ${plate} removida do cadastro.` });
      setTimeout(() => setVehicleNotification(null), 3000);
      onVehiclesUpdated?.();
    } else {
      setVehicleNotification({ message: `Erro ao remover placa: ${res.error}`, isError: true });
      setTimeout(() => setVehicleNotification(null), 4000);
    }
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const q = vehicleSearch.trim().toUpperCase();
      const matchSearch = !q || v.placa.includes(q) || (v.prefixo && v.prefixo.toUpperCase().includes(q));
      const matchCat = vehicleCategoryFilter === 'TODAS' || v.categoria.toUpperCase() === vehicleCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [vehicles, vehicleSearch, vehicleCategoryFilter]);

  // Contadores por categoria
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { TODAS: vehicles.length };
    for (const cat of ALL_CATEGORIES) {
      counts[cat] = 0;
    }
    for (const v of vehicles) {
      const cat = v.categoria.toUpperCase();
      if (counts[cat] !== undefined) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [vehicles]);

  // Regras de Parâmetro e Bonificação (inicializa com dados persistidos ou defaults)
  const [minHours, setMinHours] = useState<number>(bonusRules?.minHours ?? DEFAULT_BONUS_RULES.minHours);
  const [baseBonus, setBaseBonus] = useState<string>(bonusRules?.baseBonus ?? DEFAULT_BONUS_RULES.baseBonus);

  // Sincroniza estado quando bonusRules for alterado externamente
  useEffect(() => {
    if (bonusRules) {
      setMinHours(bonusRules.minHours);
      setBaseBonus(bonusRules.baseBonus);
    }
  }, [bonusRules]);

  const handlePropagate = () => {
    setIsPropagating(true);

    // Persistência local redundante de segurança
    try {
      localStorage.setItem('csg_bonus_rules_v1', JSON.stringify({ minHours, baseBonus }));
    } catch (e) {
      console.warn('Erro ao salvar localmente regras de bônus:', e);
    }

    setTimeout(() => {
      setIsPropagating(false);
      setPropagatedSuccess(true);
      onSaveRules(minHours, baseBonus);
      setTimeout(() => setPropagatedSuccess(false), 3000);
    }, 800);
  };

  const handleRestoreDefaults = () => {
    setMinHours(DEFAULT_BONUS_RULES.minHours);
    setBaseBonus(DEFAULT_BONUS_RULES.baseBonus);
    try {
      localStorage.setItem('csg_bonus_rules_v1', JSON.stringify(DEFAULT_BONUS_RULES));
    } catch {}
    onSaveRules(DEFAULT_BONUS_RULES.minHours, DEFAULT_BONUS_RULES.baseBonus);
  };

  return (
    <div className="flex flex-col w-full text-on-surface pb-10 animate-fade-in space-y-6">
      {/* 1. Screen Header & Actions */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 py-2 border-b pb-4 ${
          isLight ? 'border-[#e2e8f0]' : 'border-[#283548]/40'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-7 bg-[#34b344] rounded-full shadow-[0_0_8px_#34b344]" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1
                className={`font-headline-lg text-xl tracking-tight font-bold ${
                  isLight ? 'text-[#0f172a]' : 'text-white'
                }`}
              >
                Painel Admin & Parametrizações
              </h1>
            </div>
            <span
              className={`font-body-sm text-xs mt-0.5 ${
                isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
              }`}
            >
              Configuração de limites de velocidade por rodovia e tipo de composição, tolerâncias operacionais e governança
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRestoreDefaults}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors font-body-sm text-xs cursor-pointer shadow-sm ${
              isLight
                ? 'bg-white text-[#0f172a] border-[#cbd5e1] hover:bg-[#f1f5f9] hover:border-[#16a34a]'
                : 'bg-[#1c2432] text-[#f1f5f9] border-[#283548] hover:bg-[#283548] hover:border-[#34b344]'
            }`}
            type="button"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                isLight ? 'text-[#16a34a]' : 'text-[#34b344]'
              }`}
            >
              restart_alt
            </span>
            <span>Restaurar Padrões</span>
          </button>
          <button
            onClick={handlePropagate}
            disabled={isPropagating}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded font-semibold text-xs transition-all shadow-[0_0_12px_rgba(44,160,58,0.35)] cursor-pointer ${
              propagatedSuccess
                ? 'bg-[#238430] text-white'
                : 'bg-[#2ca03a] hover:bg-[#34b344] text-white'
            }`}
            type="button"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                isPropagating ? 'animate-spin' : ''
              }`}
            >
              {propagatedSuccess ? 'done_all' : isPropagating ? 'sync' : 'publish'}
            </span>
            <span>
              {propagatedSuccess
                ? 'Parâmetros Salvos & Propagados na Frota (35)!'
                : isPropagating
                ? 'Propagando na frota (35)...'
                : 'Salvar & Atualizar Parâmetros'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Faixa Superior de Status e Saúde do Sistema (5 Cards Independentes com Espaçamento Amplo) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        <div
          className={`rounded-xl p-3.5 border transition-colors shadow-sm flex flex-col justify-between ${
            isLight
              ? 'bg-white border-[#e2e8f0] hover:border-[#16a34a]/50'
              : 'bg-[#181c22] border-[#262b35] hover:border-[#2ca03a]/40'
          }`}
        >
          <div
            className={`flex items-center justify-between font-tabular-data text-[10px] uppercase font-bold ${
              isLight ? 'text-[#475569]' : 'text-[#9ba3af]'
            }`}
          >
            <span className="truncate">INTEGRAÇÃO CAN / API</span>
            <div
              className={`w-6 h-6 rounded border flex items-center justify-center ${
                isLight
                  ? 'bg-[#dcfce7] border-[#86efac]'
                  : 'bg-[#2ca03a]/10 border-[#2ca03a]/30'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[15px] ${
                  isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                }`}
              >
                hub
              </span>
            </div>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1">
              <span
                className={`font-tabular-data text-2xl font-bold ${
                  isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                }`}
              >
                100%
              </span>
              <span
                className={`font-tabular-data text-[10px] font-semibold ${
                  isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                }`}
              >
                Sincronizado
              </span>
            </div>
          </div>
          <div
            className={`flex flex-col gap-0.5 font-tabular-data text-xs ${
              isLight ? 'text-[#475569]' : 'text-[#9ba3af]'
            }`}
          >
            <div className="flex justify-between">
              <span>Latência Média:</span>
              <span className={`font-semibold ${isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'}`}>
                42 ms
              </span>
            </div>
            <div className="flex justify-between">
              <span>Último Pacote:</span>
              <span className={`font-medium ${isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'}`}>
                há 4s (35 ativos)
              </span>
            </div>
          </div>
        </div>

        <div
          className={`rounded-xl p-3.5 border transition-colors shadow-sm flex flex-col justify-between ${
            isLight
              ? 'bg-white border-[#e2e8f0] hover:border-[#16a34a]/50'
              : 'bg-[#181c22] border-[#262b35] hover:border-[#2ca03a]/40'
          }`}
        >
          <div
            className={`flex items-center justify-between font-tabular-data text-[10px] uppercase font-bold ${
              isLight ? 'text-[#475569]' : 'text-[#9ba3af]'
            }`}
          >
            <span className="truncate">TETO GLOBAL REGULAMENTAR</span>
            <div
              className={`w-6 h-6 rounded border flex items-center justify-center ${
                isLight
                  ? 'bg-[#fef3c7] border-[#fcd34d]'
                  : 'bg-[#f4cf00]/10 border-[#f4cf00]/30'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[15px] ${
                  isLight ? 'text-[#d97706]' : 'text-[#f4cf00]'
                }`}
              >
                speed
              </span>
            </div>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1">
              <span
                className={`font-tabular-data text-2xl font-bold ${
                  isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                }`}
              >
                80
              </span>
              <span
                className={`font-tabular-data text-xs ${
                  isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                }`}
              >
                km/h
              </span>
            </div>
          </div>
          <div className={`text-[11px] leading-tight ${isLight ? 'text-[#475569]' : 'text-[#9ba3af]'}`}>
            Aplicado a todas as composições pesadas e trechos rurais.
          </div>
        </div>

        <div
          className={`rounded-xl p-3.5 border transition-colors shadow-sm flex flex-col justify-between ${
            isLight
              ? 'bg-white border-[#e2e8f0] hover:border-[#16a34a]/50'
              : 'bg-[#181c22] border-[#262b35] hover:border-[#2ca03a]/40'
          }`}
        >
          <div
            className={`flex items-center justify-between font-tabular-data text-[10px] uppercase font-bold ${
              isLight ? 'text-[#475569]' : 'text-[#9ba3af]'
            }`}
          >
            <span className="truncate">IDENTIFICADORES ATIVOS</span>
            <div
              className={`w-6 h-6 rounded border flex items-center justify-center ${
                isLight
                  ? 'bg-[#dcfce7] border-[#86efac]'
                  : 'bg-[#2ca03a]/10 border-[#2ca03a]/30'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[15px] ${
                  isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                }`}
              >
                badge
              </span>
            </div>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1">
              <span
                className={`font-tabular-data text-2xl font-bold ${
                  isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                }`}
              >
                28
              </span>
              <span
                className={`font-tabular-data text-[10px] ${
                  isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                }`}
              >
                Cadastrados
              </span>
            </div>
          </div>
          <div
            className={`flex justify-between font-tabular-data text-xs ${
              isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
            }`}
          >
            <span className={`font-semibold ${isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'}`}>
              12 Vinculados
            </span>
            <span className={isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'}>16 Reserva</span>
          </div>
        </div>

        <div
          className={`rounded-xl p-3.5 border transition-colors shadow-sm flex flex-col justify-between ${
            isLight
              ? 'bg-white border-[#e2e8f0] hover:border-[#16a34a]/50'
              : 'bg-[#181c22] border-[#262b35] hover:border-[#2ca03a]/40'
          }`}
        >
          <div
            className={`flex items-center justify-between font-tabular-data text-[10px] uppercase font-bold ${
              isLight ? 'text-[#475569]' : 'text-[#9ba3af]'
            }`}
          >
            <span className="truncate">ALERTA DE CONFIGURAÇÃO</span>
            <div
              className={`w-6 h-6 rounded border flex items-center justify-center ${
                isLight
                  ? 'bg-[#dcfce7] border-[#86efac]'
                  : 'bg-[#2ca03a]/10 border-[#2ca03a]/30'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[15px] ${
                  isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                }`}
              >
                check_circle
              </span>
            </div>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1">
              <span
                className={`font-tabular-data text-2xl font-bold ${
                  isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                }`}
              >
                0
              </span>
              <span
                className={`font-tabular-data text-[10px] font-semibold ${
                  isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                }`}
              >
                Pendências
              </span>
            </div>
          </div>
          <div className={`text-[11px] leading-tight ${isLight ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>
            Firmware{' '}
            <span className={`font-tabular-data font-semibold ${isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'}`}>
              v4.8.2
            </span>{' '}
            em 35 veículos.
          </div>
        </div>

        <div
          className={`rounded-xl p-3.5 border transition-colors shadow-sm flex flex-col justify-between ${
            isLight
              ? 'bg-white border-[#e2e8f0] hover:border-[#16a34a]/50'
              : 'bg-[#181c22] border-[#262b35] hover:border-[#2ca03a]/40'
          }`}
        >
          <div
            className={`flex items-center justify-between font-tabular-data text-[10px] uppercase font-bold ${
              isLight ? 'text-[#475569]' : 'text-[#9ba3af]'
            }`}
          >
            <span className="truncate">MARGEM DE TOLERÂNCIA</span>
            <div
              className={`w-6 h-6 rounded border flex items-center justify-center ${
                isLight
                  ? 'bg-[#fee2e2] border-[#fca5a5]'
                  : 'bg-[#ef4444]/10 border-[#ef4444]/30'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[15px] ${
                  isLight ? 'text-[#dc2626]' : 'text-[#ef4444]'
                }`}
              >
                gavel
              </span>
            </div>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1">
              <span
                className={`font-tabular-data text-2xl font-bold ${
                  isLight ? 'text-[#dc2626]' : 'text-[#ef4444]'
                }`}
              >
                0
              </span>
              <span
                className={`font-tabular-data text-xs ${
                  isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                }`}
              >
                km/h (Zero)
              </span>
            </div>
          </div>
          <div className={`text-[11px] leading-tight ${isLight ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>
            Excesso contabilizado a partir de{' '}
            <strong className={`font-tabular-data ${isLight ? 'text-[#b45309]' : 'text-[#f4cf00]'}`}>
              81 km/h
            </strong>
            .
          </div>
        </div>
      </section>

      {/* 3. Abas de Navegação das Seções */}
      <section
        className={`rounded-xl p-1.5 border shadow-sm overflow-x-auto scrollbar-none touch-scroll-x ${
          isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#14171c] border-[#262b35]'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab('roads')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
              activeTab === 'roads'
                ? isLight
                  ? 'bg-[#ecfdf5] text-[#15803d] border border-[#86efac] shadow-xs font-bold'
                  : 'bg-[#1c2026] text-[#2ca03a] border border-[#2d333b] shadow-sm font-bold'
                : isLight
                ? 'bg-transparent text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9] border border-transparent'
                : 'text-[#9ba3af] hover:text-white hover:bg-[#181c22]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">signpost</span>
            <span>Limites por Rodovia & Trecho</span>
            <span
              className={`font-tabular-data text-[10px] px-1.5 py-0.2 rounded-full border font-bold ${
                isLight
                  ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac]'
                  : 'bg-[#2ca03a]/20 text-[#2ca03a] border-[#2ca03a]/40'
              }`}
            >
              {roadParams.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
              activeTab === 'rules'
                ? isLight
                  ? 'bg-[#ecfdf5] text-[#15803d] border border-[#86efac] shadow-xs font-bold'
                  : 'bg-[#1c2026] text-[#2ca03a] border border-[#2d333b] shadow-sm font-bold'
                : isLight
                ? 'bg-transparent text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9] border border-transparent'
                : 'text-[#9ba3af] hover:text-white hover:bg-[#181c22]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">military_tech</span>
            <span>Regras de Premiação & Compliance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
              activeTab === 'logs'
                ? isLight
                  ? 'bg-[#ecfdf5] text-[#15803d] border border-[#86efac] shadow-xs font-bold'
                  : 'bg-[#1c2026] text-[#2ca03a] border border-[#2d333b] shadow-sm font-bold'
                : isLight
                ? 'bg-transparent text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9] border border-transparent'
                : 'text-[#9ba3af] hover:text-white hover:bg-[#181c22]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">security</span>
            <span>Logs do Sistema & Auditoria</span>
            <span
              className={`font-tabular-data text-[10px] px-1.5 py-0.2 rounded-full border font-bold ${
                isLight
                  ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac]'
                  : 'bg-[#2ca03a]/20 text-[#2ca03a] border-[#2ca03a]/40'
              }`}
            >
              {auditLogs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vehicles')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
              activeTab === 'vehicles'
                ? isLight
                  ? 'bg-[#ecfdf5] text-[#15803d] border border-[#86efac] shadow-xs font-bold'
                  : 'bg-[#1c2026] text-[#2ca03a] border border-[#2d333b] shadow-sm font-bold'
                : isLight
                ? 'bg-transparent text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9] border border-transparent'
                : 'text-[#9ba3af] hover:text-white hover:bg-[#181c22]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">directions_car</span>
            <span>Vínculo Placa x Categoria</span>
            <span
              className={`font-tabular-data text-[10px] px-1.5 py-0.2 rounded-full border font-bold ${
                isLight
                  ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac]'
                  : 'bg-[#2ca03a]/20 text-[#2ca03a] border-[#2ca03a]/40'
              }`}
            >
              {vehicles.length}
            </span>
          </button>
        </div>
      </section>

      {/* 4. Conteúdo das Seções (Exibição Limpa por Aba Selecionada) */}

      {/* ABA 1: Tabela de Parametrização por Rodovia */}
      {activeTab === 'roads' && (
        <section
          className={`rounded-xl p-4 sm:p-5 border shadow-sm flex flex-col gap-4 ${
            isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#14171c] border-[#262b35]'
          }`}
        >
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ${
              isLight ? 'border-[#e2e8f0]' : 'border-[#262b35]'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#2ca03a]" />
                <h2
                  className={`font-headline-md text-sm sm:text-base font-bold ${
                    isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                  }`}
                >
                  Tabela de Parametrização por Rodovia & Categoria Veicular
                </h2>
              </div>
              <p
                className={`font-body-sm text-xs mt-1 ${
                  isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                }`}
              >
                Definição do limite máximo regulamentar aceito e regras de gatilho por trecho rodoviário.
              </p>
            </div>
            <button
              onClick={() => onOpenRoadModal()}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded transition-all text-xs border font-semibold cursor-pointer shadow-sm self-start sm:self-auto ${
                isLight
                  ? 'bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#0f172a] border-[#cbd5e1]'
                  : 'bg-[#181c22] hover:bg-[#1c2026] text-[#dde3ed] hover:text-white border-[#262b35]'
              }`}
              type="button"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                }`}
              >
                add
              </span>
              <span>Adicionar Trecho</span>
            </button>
          </div>

          <div
            className={`overflow-x-auto rounded-lg border scrollbar-visible touch-scroll-x ${
              isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#101317] border-[#262b35]'
            }`}
          >
            <div
              className={`sm:hidden flex items-center gap-1.5 px-3 py-1.5 text-[11px] italic border-b ${
                isLight
                  ? 'text-[#475569] border-[#e2e8f0]'
                  : 'text-[#94a3b8] border-[#262b35]/40'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">swipe</span>
              <span>Deslize horizontalmente para conferir todos os limites</span>
            </div>
            <table className="w-full text-left font-tabular-data text-xs border-collapse min-w-[850px] whitespace-nowrap">
              <thead>
                <tr
                  className={`text-[10px] uppercase border-b ${
                    isLight
                      ? 'bg-[#f8fafc] text-[#475569] border-[#e2e8f0]'
                      : 'bg-[#181c22] text-[#94a3b8] border-[#262b35]'
                  }`}
                >
                  <th className="py-3 px-3.5 text-left">Rodovia / Trecho</th>
                  <th className="py-3 px-3.5 text-left">Perfil da Via</th>
                  <th className="py-3 px-2 text-center">Cavalo 6x4</th>
                  <th className="py-3 px-2 text-center">Bi-trem</th>
                  <th className="py-3 px-2 text-center">Apoio Leve</th>
                  <th className="py-3 px-2 text-center">Gatilho 1</th>
                  <th className="py-3 px-2 text-center">Gatilho 2</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-[#e2e8f0]' : 'divide-[#262b35]'}`}>
                {roadParams.map((param) => (
                  <tr
                    key={param.id}
                    className={`transition-colors ${
                      isLight ? 'bg-white hover:bg-[#f8fafc]' : 'hover:bg-[#181c22]'
                    }`}
                  >
                    <td
                      className={`py-3 px-3.5 font-semibold text-left ${
                        isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#2ca03a]" />
                        <span>{param.road}</span>
                      </div>
                      <span
                        className={`text-[11px] block pl-3.5 mt-0.5 ${
                          isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                        }`}
                      >
                        {param.section}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-3.5 text-xs text-left ${
                        isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                      }`}
                    >
                      {param.profile}
                    </td>
                    <td
                      className={`py-3 px-2 text-center font-bold ${
                        isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                      }`}
                    >
                      {param.cavaloLimit} km/h
                    </td>
                    <td
                      className={`py-3 px-2 text-center font-bold ${
                        isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                      }`}
                    >
                      {param.bitremLimit} km/h
                    </td>
                    <td
                      className={`py-3 px-2 text-center ${
                        isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                      }`}
                    >
                      {param.leveLimit} km/h
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded border font-semibold text-[11px] ${
                          isLight
                            ? 'bg-[#fef3c7] border-[#fcd34d] text-[#b45309]'
                            : 'bg-[#f4cf00]/10 border-[#f4cf00]/30 text-[#f4cf00]'
                        }`}
                      >
                        {param.trigger1}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded border font-semibold text-[11px] ${
                          isLight
                            ? 'bg-[#fee2e2] border-[#fca5a5] text-[#dc2626]'
                            : 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]'
                        }`}
                      >
                        {param.trigger2}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`font-tabular-data text-[10px] px-2 py-0.5 rounded border font-bold ${
                          isLight
                            ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac]'
                            : 'bg-[#2ca03a]/10 text-[#2ca03a] border-[#2ca03a]/30'
                        }`}
                      >
                        {param.status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenRoadModal(param)}
                        className={`p-1.5 rounded transition-colors inline-flex items-center cursor-pointer ${
                          isLight
                            ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                            : 'text-[#94a3b8] hover:text-[#dde3ed] hover:bg-[#1c2026]'
                        }`}
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ABA 2: Regras de Parâmetro e Bonificação de Condutores */}
      {activeTab === 'rules' && (
        <section
          className={`rounded-xl p-4 sm:p-5 border shadow-sm flex flex-col gap-5 ${
            isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#14171c] border-[#262b35]'
          }`}
        >
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ${
              isLight ? 'border-[#e2e8f0]' : 'border-[#262b35]'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#2ca03a]" />
              <h2
                className={`font-headline-md text-sm sm:text-base font-bold ${
                  isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                }`}
              >
                Regras de Parâmetro e Bonificação de Condutores
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`font-tabular-data text-[10px] font-bold px-2 py-0.5 rounded border ${
                  isLight
                    ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac]'
                    : 'bg-[#2ca03a]/10 text-[#2ca03a] border-[#2ca03a]/30'
                }`}
              >
                REGULAMENTO VIGENTE CCO
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Excesso Pontual */}
            <div
              className={`rounded-xl p-4 flex flex-col justify-between gap-3 border shadow-sm ${
                isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#181c22] border-[#262b35]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className={`font-tabular-data text-[10px] uppercase font-bold tracking-wider ${
                      isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                    }`}
                  >
                    REGRA DE EXCESSO PONTUAL
                  </span>
                  <p
                    className={`text-sm font-semibold mt-1 ${
                      isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                    }`}
                  >
                    Excesso Pontual &gt; 80 km/h
                  </p>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                    }`}
                  >
                    Qualquer registro acima do teto estipulado desclassifica a pontuação e bonificação do condutor no ciclo.
                  </p>
                </div>
                <span
                  className={`font-tabular-data text-[10px] px-2 py-0.5 rounded border font-bold shrink-0 ${
                    isLight
                      ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac]'
                      : 'bg-[#2ca03a]/10 text-[#2ca03a] border-[#2ca03a]/30'
                  }`}
                >
                  ATIVO
                </span>
              </div>
              <div
                className={`font-tabular-data text-[11px] border px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-bold ${
                  isLight
                    ? 'bg-[#fee2e2] text-[#dc2626] border-[#fca5a5]'
                    : 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">shield</span>
                TOLERÂNCIA ZERO CONFIGURADA
              </div>
            </div>

            {/* Card 2: Horas Mínimas de Condução */}
            <div
              className={`rounded-xl p-4 flex flex-col justify-between gap-3 border shadow-sm ${
                isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#181c22] border-[#262b35]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className={`font-tabular-data text-[10px] uppercase font-bold tracking-wider ${
                      isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                    }`}
                  >
                    HORAS MÍNIMAS DE CONDUÇÃO
                  </span>
                  <p
                    className={`text-sm font-semibold mt-1 ${
                      isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                    }`}
                  >
                    {minHours} horas / ciclo
                  </p>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                    }`}
                  >
                    Carga horária mínima aferida via telemetria e leitura contínua de CAN bus para elegibilidade.
                  </p>
                </div>
                <div
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                    isLight
                      ? 'bg-[#dcfce7] border-[#86efac]'
                      : 'bg-[#2ca03a]/10 border-[#2ca03a]/30'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                    }`}
                  >
                    timer
                  </span>
                </div>
              </div>
              <div
                className={`flex items-center gap-2.5 font-tabular-data text-xs p-2 rounded-lg border ${
                  isLight
                    ? 'bg-[#f1f5f9] border-[#e2e8f0]'
                    : 'bg-[#12151a] border-[#262b35]'
                }`}
              >
                <span className={`font-semibold ${isLight ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>
                  Parâmetro:
                </span>
                <input
                  type="number"
                  min={1}
                  max={400}
                  value={minHours}
                  onChange={(e) => setMinHours(Math.max(1, Number(e.target.value) || 0))}
                  className={`w-24 rounded px-2.5 py-1 font-bold text-center border focus:outline-none transition-colors ${
                    isLight
                      ? 'bg-white text-[#0f172a] border-[#cbd5e1] focus:border-[#16a34a]'
                      : 'bg-[#181c22] text-[#dde3ed] border-[#262b35] focus:border-[#2ca03a]'
                  }`}
                />
                <span className={isLight ? 'text-[#475569]' : 'text-[#94a3b8]'}>
                  horas / ciclo
                </span>
              </div>
            </div>

            {/* Card 3: Exclusão Sem Identificação */}
            <div
              className={`rounded-xl p-4 flex flex-col justify-between gap-3 border shadow-sm ${
                isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#181c22] border-[#262b35]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className={`font-tabular-data text-[10px] uppercase font-bold tracking-wider ${
                      isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                    }`}
                  >
                    SEGURANÇA DE IDENTIFICAÇÃO
                  </span>
                  <p
                    className={`text-sm font-semibold mt-1 ${
                      isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                    }`}
                  >
                    Exclusão Sem Identificação
                  </p>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                    }`}
                  >
                    Condução sem chave iButton vinculada é glosada integralmente do cômputo da bonificação.
                  </p>
                </div>
                <span
                  className={`font-tabular-data text-[10px] px-2 py-0.5 rounded border font-bold shrink-0 ${
                    isLight
                      ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac]'
                      : 'bg-[#2ca03a]/10 text-[#2ca03a] border-[#2ca03a]/30'
                  }`}
                >
                  ATIVO
                </span>
              </div>
              <div
                className={`font-tabular-data text-[11px] border px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-bold ${
                  isLight
                    ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac]'
                    : 'bg-[#2ca03a]/10 text-[#2ca03a] border-[#2ca03a]/30'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">lock</span>
                REGRA EM VIGOR
              </div>
            </div>

            {/* Card 4: Valor Base da Bonificação */}
            <div
              className={`rounded-xl p-4 flex flex-col justify-between gap-3 border shadow-sm ${
                isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#181c22] border-[#262b35]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className={`font-tabular-data text-[10px] uppercase font-bold tracking-wider ${
                      isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                    }`}
                  >
                    VALOR BASE DA BONIFICAÇÃO
                  </span>
                  <p
                    className={`text-sm font-semibold mt-1 ${
                      isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                    }`}
                  >
                    R$ {baseBonus} / condutor
                  </p>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                    }`}
                  >
                    Repasse mensal calculado diretamente pelo fechamento executivo CCO para condutores aptos.
                  </p>
                </div>
                <div
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                    isLight
                      ? 'bg-[#fef3c7] border-[#fcd34d]'
                      : 'bg-[#f4cf00]/10 border-[#f4cf00]/30'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isLight ? 'text-[#d97706]' : 'text-[#f4cf00]'
                    }`}
                  >
                    payments
                  </span>
                </div>
              </div>
              <div
                className={`flex items-center gap-2.5 font-tabular-data text-xs p-2 rounded-lg border ${
                  isLight
                    ? 'bg-[#f1f5f9] border-[#e2e8f0]'
                    : 'bg-[#12151a] border-[#262b35]'
                }`}
              >
                <span className={`font-semibold ${isLight ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>
                  Valor Base:
                </span>
                <input
                  type="text"
                  value={baseBonus}
                  onChange={(e) => setBaseBonus(e.target.value)}
                  placeholder="Ex: 1.200,00"
                  className={`w-32 font-bold rounded px-2.5 py-1 text-center border focus:outline-none transition-colors ${
                    isLight
                      ? 'bg-white text-[#15803d] border-[#cbd5e1] focus:border-[#16a34a]'
                      : 'bg-[#181c22] text-[#2ca03a] border-[#262b35] focus:border-[#2ca03a]'
                  }`}
                />
                <span className={isLight ? 'text-[#475569]' : 'text-[#94a3b8]'}>
                  BRL (Reais)
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer dedicado para salvar diretamente as regras */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs mt-2 ${
              isLight
                ? 'bg-[#f8fafc] border-[#e2e8f0]'
                : 'bg-[#0c1017] border-[#262b35]'
            }`}
          >
            <div className={`flex items-center gap-2 ${isLight ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>
              <span
                className={`material-symbols-outlined text-[18px] ${
                  isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                }`}
              >
                info
              </span>
              <span>
                Parâmetros vigentes:{' '}
                <strong className={`font-tabular-data ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                  {minHours}h mínimas
                </strong>{' '}
                e{' '}
                <strong className={`font-tabular-data ${isLight ? 'text-[#15803d]' : 'text-[#34b344]'}`}>
                  R$ {baseBonus}
                </strong>{' '}
                de bonificação base.
              </span>
            </div>

            <button
              onClick={handlePropagate}
              disabled={isPropagating}
              type="button"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-[0_0_12px_rgba(44,160,58,0.35)] cursor-pointer self-stretch sm:self-auto justify-center ${
                propagatedSuccess
                  ? 'bg-[#238430] text-white'
                  : 'bg-[#2ca03a] hover:bg-[#34b344] text-white'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  isPropagating ? 'animate-spin' : ''
                }`}
              >
                {propagatedSuccess ? 'done_all' : isPropagating ? 'sync' : 'save'}
              </span>
              <span>
                {propagatedSuccess
                  ? 'Regras Salvas e Aplicadas!'
                  : isPropagating
                  ? 'Salvando e propagando...'
                  : 'Salvar Regras de Bonificação'}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* ABA 3: Trilha de Auditoria & Logs de Parametrização */}
      {activeTab === 'logs' && (
        <section
          className={`rounded-xl p-4 sm:p-5 border shadow-sm flex flex-col gap-4 ${
            isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#14171c] border-[#262b35]'
          }`}
        >
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ${
              isLight ? 'border-[#e2e8f0]' : 'border-[#262b35]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`material-symbols-outlined text-[20px] ${
                  isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                }`}
              >
                security
              </span>
              <h2
                className={`font-headline-md text-sm sm:text-base font-bold ${
                  isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                }`}
              >
                Trilha de Auditoria & Logs de Parametrização
              </h2>
              <span
                className={`font-tabular-data text-[11px] hidden sm:inline ${
                  isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                }`}
              >
                ({auditLogs.length} {auditLogs.length === 1 ? 'registro' : 'registros'})
              </span>
            </div>
            <span
              className={`font-tabular-data text-[10px] font-bold px-2 py-0.5 rounded border self-start sm:self-auto ${
                isLight
                  ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac]'
                  : 'bg-[#2ca03a]/10 text-[#2ca03a] border-[#2ca03a]/30'
              }`}
            >
              REGISTRO DE AUDITORIA CCO
            </span>
          </div>

          <div
            className={`overflow-x-auto rounded-lg border scrollbar-visible touch-scroll-x ${
              isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#101317] border-[#262b35]'
            }`}
          >
            <table className="w-full min-w-[750px] text-left font-tabular-data text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr
                  className={`text-[10px] uppercase border-b ${
                    isLight
                      ? 'bg-[#f8fafc] text-[#475569] border-[#e2e8f0]'
                      : 'bg-[#181c22] text-[#94a3b8] border-[#262b35]'
                  }`}
                >
                  <th className="py-3 px-3.5">Data / Hora</th>
                  <th className="py-3 px-3.5">Operador / Usuário</th>
                  <th className="py-3 px-3.5">Ação Realizada</th>
                  <th className="py-3 px-3.5 text-center">Origem (IP)</th>
                  <th className="py-3 px-3.5 text-right">Hash SHA-256</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-[#e2e8f0]' : 'divide-[#262b35]'}`}>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className={`py-6 text-center italic ${
                        isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                      }`}
                    >
                      Nenhum registro de auditoria gravado no momento.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className={`transition-colors ${
                        isLight ? 'bg-white hover:bg-[#f8fafc]' : 'hover:bg-[#181c22]'
                      }`}
                    >
                      <td
                        className={`py-3 px-3.5 font-semibold ${
                          isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                        }`}
                      >
                        {log.date}
                      </td>
                      <td className={`py-3 px-3.5 ${isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'}`}>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                            }`}
                          >
                            admin_panel_settings
                          </span>
                          <span>{log.operator}</span>
                        </div>
                      </td>
                      <td className={`py-3 px-3.5 ${isLight ? 'text-[#475569]' : 'text-[#9ba3af]'}`}>
                        {log.action}
                      </td>
                      <td
                        className={`py-3 px-3.5 text-center ${
                          isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                        }`}
                      >
                        {log.ip}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <span
                          className={`border font-tabular-data px-2 py-0.5 rounded text-[10px] ${
                            isLight
                              ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]'
                              : 'bg-[#181c22] border-[#262b35] text-[#2ca03a]'
                          }`}
                        >
                          {log.hash}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-[11px] border-t ${
              isLight
                ? 'text-[#475569] border-[#e2e8f0]'
                : 'text-[#94a3b8] border-[#262b35]/40'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`material-symbols-outlined text-[15px] ${
                  isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                }`}
              >
                verified
              </span>
              <span className="font-tabular-data uppercase tracking-wider text-[10px]">
                AUDITORIA OPERACIONAL CASAGRANDE: PARÂMETROS CRIPTOGRAFADOS E ASSINADOS DIGITALMENTE (SHA-256)
              </span>
            </div>
            <div className="font-tabular-data text-[10px]">
              Versão:{' '}
              <span className={`font-semibold ${isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'}`}>
                2026.10-prod
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ABA 4: Vínculo Placa x Categoria Veicular */}
      {activeTab === 'vehicles' && (
        <section
          className={`rounded-xl p-4 sm:p-5 border shadow-sm flex flex-col gap-4 animate-fade-in ${
            isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#14171c] border-[#262b35]'
          }`}
        >
          {/* Cabeçalho da Aba */}
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ${
              isLight ? 'border-[#e2e8f0]' : 'border-[#262b35]'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#34b344]" />
                <h2
                  className={`font-headline-md text-sm sm:text-base font-bold ${
                    isLight ? 'text-[#0f172a]' : 'text-[#dde3ed]'
                  }`}
                >
                  Vínculo de Placas à Categoria Veicular
                </h2>
                <span
                  className={`font-tabular-data text-[11px] px-2 py-0.5 rounded-full font-bold border ${
                    isLight
                      ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac]'
                      : 'bg-[#2ca03a]/20 text-[#2ca03a] border-[#2ca03a]/40'
                  }`}
                >
                  {vehicles.length} Veículos Cadastrados
                </span>
              </div>
              <p
                className={`font-body-sm text-xs mt-1 ${
                  isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                }`}
              >
                Relacione cada placa à sua categoria e prefixo oficial. Os lançamentos telemétricos importados sem categoria ou com &quot;-&quot; herdarão automaticamente estas definições.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                onClick={loadVehicles}
                disabled={isLoadingVehicles}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded transition-all text-xs border font-semibold cursor-pointer shadow-sm ${
                  isLight
                    ? 'bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#0f172a] border-[#cbd5e1]'
                    : 'bg-[#181c22] hover:bg-[#1c2026] text-[#dde3ed] hover:text-white border-[#262b35]'
                }`}
                type="button"
                title="Recarregar veículos do banco de dados"
              >
                <span
                  className={`material-symbols-outlined text-[17px] ${
                    isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                  } ${isLoadingVehicles ? 'animate-spin' : ''}`}
                >
                  sync
                </span>
                <span>Sincronizar</span>
              </button>

              <button
                onClick={() => {
                  setNewVehiclePlate('');
                  setNewVehicleCategory('LEVE');
                  setNewVehiclePrefix('');
                  setNewVehicleUo('CASAGRANDE');
                  setIsAddVehicleModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#2ca03a] hover:bg-[#34b344] text-white transition-all text-xs font-semibold cursor-pointer shadow-sm"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Cadastrar Nova Placa</span>
              </button>
            </div>
          </div>

          {/* Notificação Temporária de Ação */}
          {vehicleNotification && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between border ${
                vehicleNotification.isError
                  ? isLight
                    ? 'bg-[#fee2e2] border-[#fca5a5] text-[#dc2626]'
                    : 'bg-[#ef4444]/10 border-[#ef4444]/40 text-[#ef4444]'
                  : isLight
                  ? 'bg-[#dcfce7] border-[#86efac] text-[#15803d]'
                  : 'bg-[#2ca03a]/10 border-[#2ca03a]/40 text-[#34b344]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">
                  {vehicleNotification.isError ? 'error' : 'check_circle'}
                </span>
                <span>{vehicleNotification.message}</span>
              </div>
              <button
                onClick={() => setVehicleNotification(null)}
                className={isLight ? 'text-[#475569] hover:text-[#0f172a]' : 'text-[#94a3b8] hover:text-white'}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {/* Cards Rápidos de Distribuição de Categoria */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat] || 0;
              const isSelected = vehicleCategoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setVehicleCategoryFilter(isSelected ? 'TODAS' : cat)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    isSelected
                      ? isLight
                        ? 'bg-[#ecfdf5] border-[#16a34a] shadow-[0_0_10px_rgba(22,163,74,0.15)]'
                        : 'bg-[#1e2735] border-[#34b344] shadow-[0_0_10px_rgba(52,179,68,0.2)]'
                      : isLight
                      ? 'bg-white border-[#e2e8f0] hover:border-[#16a34a]/50 hover:bg-[#f8fafc]'
                      : 'bg-[#181c22] border-[#262b35] hover:border-[#2ca03a]/40'
                  }`}
                >
                  <div
                    className={`text-[10px] uppercase font-bold truncate ${
                      isSelected
                        ? isLight
                          ? 'text-[#15803d]'
                          : 'text-[#34b344]'
                        : isLight
                        ? 'text-[#475569]'
                        : 'text-[#94a3b8]'
                    }`}
                  >
                    {cat}
                  </div>
                  <div
                    className={`font-tabular-data text-lg font-bold mt-0.5 ${
                      isSelected
                        ? isLight
                          ? 'text-[#14532d]'
                          : 'text-white'
                        : isLight
                        ? 'text-[#0f172a]'
                        : 'text-white'
                    }`}
                  >
                    {count}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Barra de Filtros e Busca */}
          <div
            className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 rounded-lg border ${
              isLight ? 'bg-[#f8fafc] border-[#e2e8f0]' : 'bg-[#101317] border-[#262b35]'
            }`}
          >
            <div className="relative flex-1">
              <span
                className={`material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] ${
                  isLight ? 'text-[#64748b]' : 'text-[#94a3b8]'
                }`}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Filtrar por placa ou prefixo..."
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                className={`w-full text-xs pl-8 pr-3 py-1.5 rounded border focus:outline-none placeholder:text-[#64748b] ${
                  isLight
                    ? 'bg-white text-[#0f172a] border-[#cbd5e1] focus:border-[#16a34a]'
                    : 'bg-[#181c22] text-[#dde3ed] border-[#262b35] focus:border-[#2ca03a]'
                }`}
              />
              {vehicleSearch && (
                <button
                  onClick={() => setVehicleSearch('')}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-[#64748b] hover:text-[#0f172a]' : 'text-[#94a3b8] hover:text-white'
                  }`}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setVehicleCategoryFilter('TODAS')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                  vehicleCategoryFilter === 'TODAS'
                    ? 'bg-[#2ca03a] text-white'
                    : isLight
                    ? 'bg-white text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9] border border-[#cbd5e1]'
                    : 'bg-[#181c22] text-[#94a3b8] hover:text-white border border-[#262b35]'
                }`}
              >
                Todas ({vehicles.length})
              </button>
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setVehicleCategoryFilter(cat)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                    vehicleCategoryFilter === cat
                      ? 'bg-[#2ca03a] text-white'
                      : isLight
                      ? 'bg-white text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9] border border-[#cbd5e1]'
                      : 'bg-[#181c22] text-[#94a3b8] hover:text-white border border-[#262b35]'
                  }`}
                >
                  {cat} ({categoryCounts[cat] || 0})
                </button>
              ))}
            </div>
          </div>

          {/* Tabela de Veículos e Vínculo */}
          <div
            className={`overflow-x-auto rounded-lg border scrollbar-visible touch-scroll-x ${
              isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#101317] border-[#262b35]'
            }`}
          >
            <table className="w-full min-w-[700px] text-left font-tabular-data text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr
                  className={`text-[10px] uppercase border-b ${
                    isLight
                      ? 'bg-[#f8fafc] text-[#475569] border-[#e2e8f0]'
                      : 'bg-[#181c22] text-[#94a3b8] border-[#262b35]'
                  }`}
                >
                  <th className="py-3 px-3.5">Placa</th>
                  <th className="py-3 px-3.5">Prefixo</th>
                  <th className="py-3 px-3.5">Categoria Respectiva (Vínculo)</th>
                  <th className="py-3 px-3.5">Enquadramento SESMT</th>
                  <th className="py-3 px-3.5">Unidade (UO)</th>
                  <th className="py-3 px-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-[#e2e8f0]' : 'divide-[#262b35]'}`}>
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className={`py-8 text-center italic ${
                        isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                      }`}
                    >
                      Nenhum veículo encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((v) => {
                    const isLeve = v.categoria.toUpperCase() === 'LEVE';
                    return (
                      <tr
                        key={v.placa}
                        className={`transition-colors ${
                          isLight ? 'bg-white hover:bg-[#f8fafc]' : 'hover:bg-[#181c22]'
                        }`}
                      >
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#34b344]" />
                            <span
                              className={`font-mono font-bold text-sm tracking-wider border px-2 py-0.5 rounded ${
                                isLight
                                  ? 'bg-[#f8fafc] border-[#cbd5e1] text-[#0f172a]'
                                  : 'bg-[#181c22] border-[#283548] text-[#f1f5f9]'
                              }`}
                            >
                              {v.placa}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`py-3 px-3.5 font-mono ${
                            isLight ? 'text-[#475569]' : 'text-[#94a3b8]'
                          }`}
                        >
                          {v.prefixo || <span className="text-[#64748b] italic">Não informado</span>}
                        </td>
                        <td className="py-3 px-3.5">
                          {/* Seletor Rápido de Categoria com feedback imediato */}
                          <div className="flex items-center gap-2">
                            <select
                              value={v.categoria}
                              onChange={(e) => handleQuickCategoryChange(v.placa, e.target.value)}
                              className={`border rounded px-2.5 py-1 text-xs font-semibold focus:outline-none transition-colors cursor-pointer ${
                                isLight
                                  ? 'bg-white text-[#0f172a] border-[#cbd5e1] hover:border-[#16a34a] focus:border-[#16a34a]'
                                  : 'bg-[#1c2432] text-white border-[#283548] hover:border-[#34b344] focus:border-[#34b344]'
                              }`}
                            >
                              {ALL_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                            <span
                              className={`text-[10px] font-bold ${
                                isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                              }`}
                            >
                              VINCULADO
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              isLeve
                                ? isLight
                                  ? 'bg-[#dbeafe] text-[#1d4ed8] border-[#93c5fd]'
                                  : 'bg-[#3b82f6]/10 text-[#60a5fa] border-[#3b82f6]/30'
                                : isLight
                                ? 'bg-[#fef3c7] text-[#b45309] border-[#fcd34d]'
                                : 'bg-[#eab308]/10 text-[#facc15] border-[#eab308]/30'
                            }`}
                          >
                            {isLeve ? 'Veículo Leve' : 'Composição Pesada'}
                          </span>
                        </td>
                        <td className={`py-3 px-3.5 ${isLight ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>
                          {v.uo || 'CASAGRANDE'}
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteVehicle(v.placa)}
                            title="Remover veículo"
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isLight
                                ? 'text-[#64748b] hover:text-[#dc2626] hover:bg-[#fee2e2]'
                                : 'text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#ef4444]/10'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé Informativo */}
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-[11px] border-t ${
              isLight
                ? 'text-[#475569] border-[#e2e8f0]'
                : 'text-[#94a3b8] border-[#262b35]/40'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`material-symbols-outlined text-[15px] ${
                  isLight ? 'text-[#16a34a]' : 'text-[#2ca03a]'
                }`}
              >
                verified
              </span>
              <span>
                Todas as placas listadas são vinculadas em tempo real durante a ingestão e importação de planilhas.
              </span>
            </div>
            <div className="font-tabular-data text-[10px]">
              Total no Cadastro:{' '}
              <strong className={isLight ? 'text-[#0f172a]' : 'text-white'}>{vehicles.length}</strong>
            </div>
          </div>
        </section>
      )}

      {/* Modal de Cadastro de Nova Placa */}
      {isAddVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div
            className={`border rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 ${
              isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#14171c] border-[#283548]'
            }`}
          >
            <div
              className={`flex items-center justify-between pb-3 border-b ${
                isLight ? 'border-[#e2e8f0]' : 'border-[#262b35]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-[22px] ${
                    isLight ? 'text-[#16a34a]' : 'text-[#34b344]'
                  }`}
                >
                  directions_car
                </span>
                <h3
                  className={`font-headline-md text-base font-bold ${
                    isLight ? 'text-[#0f172a]' : 'text-white'
                  }`}
                >
                  Cadastrar Vínculo de Placa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddVehicleModalOpen(false)}
                className={`cursor-pointer ${
                  isLight ? 'text-[#64748b] hover:text-[#0f172a]' : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveNewVehicle} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className={`font-semibold block ${isLight ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>
                  Placa do Veículo <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SLW4D68"
                  value={newVehiclePlate}
                  onChange={(e) => setNewVehiclePlate(e.target.value.toUpperCase())}
                  className={`w-full border rounded px-3 py-2 font-mono uppercase text-sm tracking-wider focus:outline-none ${
                    isLight
                      ? 'bg-[#f8fafc] border-[#cbd5e1] text-[#0f172a] focus:bg-white focus:border-[#16a34a]'
                      : 'bg-[#181c22] border-[#283548] text-white focus:border-[#34b344]'
                  }`}
                />
                <span className="text-[10px] text-[#64748b]">
                  Padrão Mercosul (ex: ABC1D23) ou convencional (ex: ABC1234).
                </span>
              </div>

              <div className="space-y-1">
                <label className={`font-semibold block ${isLight ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>
                  Categoria Respectiva <span className="text-[#ef4444]">*</span>
                </label>
                <select
                  value={newVehicleCategory}
                  onChange={(e) => setNewVehicleCategory(e.target.value)}
                  className={`w-full border rounded px-3 py-2 font-semibold text-xs focus:outline-none cursor-pointer ${
                    isLight
                      ? 'bg-[#f8fafc] border-[#cbd5e1] text-[#0f172a] focus:bg-white focus:border-[#16a34a]'
                      : 'bg-[#181c22] border-[#283548] text-white focus:border-[#34b344]'
                  }`}
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className={`font-semibold block ${isLight ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>
                  Prefixo Operacional (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Z4A4B5A71"
                  value={newVehiclePrefix}
                  onChange={(e) => setNewVehiclePrefix(e.target.value)}
                  className={`w-full border rounded px-3 py-2 font-mono text-xs focus:outline-none ${
                    isLight
                      ? 'bg-[#f8fafc] border-[#cbd5e1] text-[#0f172a] focus:bg-white focus:border-[#16a34a]'
                      : 'bg-[#181c22] border-[#283548] text-white focus:border-[#34b344]'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className={`font-semibold block ${isLight ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>
                  Unidade Operacional (UO)
                </label>
                <input
                  type="text"
                  placeholder="Ex: CASAGRANDE"
                  value={newVehicleUo}
                  onChange={(e) => setNewVehicleUo(e.target.value)}
                  className={`w-full border rounded px-3 py-2 text-xs focus:outline-none ${
                    isLight
                      ? 'bg-[#f8fafc] border-[#cbd5e1] text-[#0f172a] focus:bg-white focus:border-[#16a34a]'
                      : 'bg-[#181c22] border-[#283548] text-white focus:border-[#34b344]'
                  }`}
                />
              </div>

              <div
                className={`pt-2 flex items-center justify-end gap-2 border-t ${
                  isLight ? 'border-[#e2e8f0]' : 'border-[#262b35]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsAddVehicleModalOpen(false)}
                  className={`px-3.5 py-2 rounded border transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] hover:text-[#0f172a] border-[#cbd5e1]'
                      : 'bg-[#181c22] hover:bg-[#1c2026] text-[#94a3b8] hover:text-white border-[#283548]'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingVehicle}
                  className="px-4 py-2 rounded bg-[#2ca03a] hover:bg-[#34b344] text-white font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingVehicle && (
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      sync
                    </span>
                  )}
                  <span>Salvar Vínculo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
