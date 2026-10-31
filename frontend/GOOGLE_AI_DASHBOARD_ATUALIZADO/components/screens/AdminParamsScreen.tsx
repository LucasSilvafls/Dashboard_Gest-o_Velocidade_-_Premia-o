'use client';

import React, { useState, useEffect } from 'react';
import { RoadParameter, AuditLog } from '@/lib/telemetry-data';
import { BonusRules, DEFAULT_BONUS_RULES } from '@/lib/telemetry-rules';

interface AdminParamsScreenProps {
  roadParams: RoadParameter[];
  auditLogs: AuditLog[];
  onOpenRoadModal: (param?: RoadParameter) => void;
  onSaveRules: (minHours: number, baseBonus: string) => void;
  bonusRules?: BonusRules;
}

export default function AdminParamsScreen({
  roadParams,
  auditLogs,
  onOpenRoadModal,
  onSaveRules,
  bonusRules,
}: AdminParamsScreenProps) {
  const [activeTab, setActiveTab] = useState<'roads' | 'rules' | 'logs'>('roads');
  const [isPropagating, setIsPropagating] = useState(false);
  const [propagatedSuccess, setPropagatedSuccess] = useState(false);

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
      <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-[#283548]/40 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-7 bg-[#34b344] rounded-full shadow-[0_0_8px_#34b344]" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-headline-lg text-xl tracking-tight text-white font-bold">
                Painel Admin & Parametrizações
              </h1>
            </div>
            <span className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
              Configuração de limites de velocidade por rodovia e tipo de composição, tolerâncias operacionais e governança
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRestoreDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1c2432] text-[#f1f5f9] border border-[#283548] hover:bg-[#283548] hover:border-[#34b344] transition-colors font-body-sm text-xs cursor-pointer shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-[#34b344]">restart_alt</span>
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
        <div className="bg-[#181c22] rounded-xl p-3.5 border border-[#262b35] hover:border-[#2ca03a]/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9ba3af] font-tabular-data text-[10px] uppercase font-bold">
            <span className="truncate">INTEGRAÇÃO CAN / API</span>
            <div className="w-6 h-6 rounded bg-[#2ca03a]/10 border border-[#2ca03a]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#2ca03a] text-[15px]">hub</span>
            </div>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1">
              <span className="font-tabular-data text-2xl font-bold text-[#2ca03a]">100%</span>
              <span className="font-tabular-data text-[10px] text-[#2ca03a] font-semibold">
                Sincronizado
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 font-tabular-data text-xs text-[#9ba3af]">
            <div className="flex justify-between">
              <span>Latência Média:</span>
              <span className="text-[#dde3ed] font-semibold">42 ms</span>
            </div>
            <div className="flex justify-between">
              <span>Último Pacote:</span>
              <span className="text-[#2ca03a] font-medium">há 4s (35 ativos)</span>
            </div>
          </div>
        </div>

        <div className="bg-[#181c22] rounded-xl p-3.5 border border-[#262b35] hover:border-[#2ca03a]/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9ba3af] font-tabular-data text-[10px] uppercase font-bold">
            <span className="truncate">TETO GLOBAL REGULAMENTAR</span>
            <div className="w-6 h-6 rounded bg-[#f4cf00]/10 border border-[#f4cf00]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#f4cf00] text-[15px]">speed</span>
            </div>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1">
              <span className="font-tabular-data text-2xl font-bold text-[#dde3ed]">80</span>
              <span className="font-tabular-data text-xs text-[#94a3b8]">km/h</span>
            </div>
          </div>
          <div className="text-[#9ba3af] text-[11px] leading-tight">
            Aplicado a todas as composições pesadas e trechos rurais.
          </div>
        </div>

        <div className="bg-[#181c22] rounded-xl p-3.5 border border-[#262b35] hover:border-[#2ca03a]/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9ba3af] font-tabular-data text-[10px] uppercase font-bold">
            <span className="truncate">IDENTIFICADORES ATIVOS</span>
            <div className="w-6 h-6 rounded bg-[#2ca03a]/10 border border-[#2ca03a]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#2ca03a] text-[15px]">badge</span>
            </div>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1">
              <span className="font-tabular-data text-2xl font-bold text-[#dde3ed]">28</span>
              <span className="font-tabular-data text-[10px] text-[#94a3b8]">Cadastrados</span>
            </div>
          </div>
          <div className="flex justify-between font-tabular-data text-xs text-[#94a3b8]">
            <span className="text-[#2ca03a] font-semibold">12 Vinculados</span>
            <span className="text-[#dde3ed]">16 Reserva</span>
          </div>
        </div>

        <div className="bg-[#181c22] rounded-xl p-3.5 border border-[#262b35] hover:border-[#2ca03a]/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9ba3af] font-tabular-data text-[10px] uppercase font-bold">
            <span className="truncate">ALERTA DE CONFIGURAÇÃO</span>
            <div className="w-6 h-6 rounded bg-[#2ca03a]/10 border border-[#2ca03a]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#2ca03a] text-[15px]">check_circle</span>
            </div>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1">
              <span className="font-tabular-data text-2xl font-bold text-[#2ca03a]">0</span>
              <span className="font-tabular-data text-[10px] text-[#2ca03a] font-semibold">
                Pendências
              </span>
            </div>
          </div>
          <div className="text-[#94a3b8] text-[11px] leading-tight">
            Firmware <span className="font-tabular-data text-[#dde3ed] font-semibold">v4.8.2</span> em 35 veículos.
          </div>
        </div>

        <div className="bg-[#181c22] rounded-xl p-3.5 border border-[#262b35] hover:border-[#2ca03a]/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9ba3af] font-tabular-data text-[10px] uppercase font-bold">
            <span className="truncate">MARGEM DE TOLERÂNCIA</span>
            <div className="w-6 h-6 rounded bg-[#ef4444]/10 border border-[#ef4444]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#ef4444] text-[15px]">gavel</span>
            </div>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1">
              <span className="font-tabular-data text-2xl font-bold text-[#ef4444]">0</span>
              <span className="font-tabular-data text-xs text-[#94a3b8]">km/h (Zero)</span>
            </div>
          </div>
          <div className="text-[#94a3b8] text-[11px] leading-tight">
            Excesso contabilizado a partir de <strong className="text-[#f4cf00] font-tabular-data">81 km/h</strong>.
          </div>
        </div>
      </section>

      {/* 3. Abas de Navegação das Seções */}
      <section className="bg-[#14171c] rounded-xl p-1.5 border border-[#262b35] shadow-sm overflow-x-auto scrollbar-none touch-scroll-x">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab('roads')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
              activeTab === 'roads'
                ? 'bg-[#1c2026] text-[#2ca03a] border border-[#2d333b] shadow-sm font-bold'
                : 'text-[#9ba3af] hover:text-white hover:bg-[#181c22]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">signpost</span>
            <span>Limites por Rodovia & Trecho</span>
            <span className="font-tabular-data text-[10px] px-1.5 py-0.2 rounded-full bg-[#2ca03a]/20 text-[#2ca03a] border border-[#2ca03a]/40 font-bold">
              {roadParams.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
              activeTab === 'rules'
                ? 'bg-[#1c2026] text-[#2ca03a] border border-[#2d333b] shadow-sm font-bold'
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
                ? 'bg-[#1c2026] text-[#2ca03a] border border-[#2d333b] shadow-sm font-bold'
                : 'text-[#9ba3af] hover:text-white hover:bg-[#181c22]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">security</span>
            <span>Logs do Sistema & Auditoria</span>
            <span className="font-tabular-data text-[10px] px-1.5 py-0.2 rounded-full bg-[#2ca03a]/20 text-[#2ca03a] border border-[#2ca03a]/40 font-bold">
              {auditLogs.length}
            </span>
          </button>
        </div>
      </section>

      {/* 4. Conteúdo das Seções (Exibição Limpa por Aba Selecionada) */}

      {/* ABA 1: Tabela de Parametrização por Rodovia */}
      {activeTab === 'roads' && (
        <section className="bg-[#14171c] rounded-xl p-4 sm:p-5 border border-[#262b35] shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262b35]">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#2ca03a]" />
                <h2 className="font-headline-md text-sm sm:text-base font-bold text-[#dde3ed]">
                  Tabela de Parametrização por Rodovia & Categoria Veicular
                </h2>
              </div>
              <p className="font-body-sm text-xs text-[#94a3b8] mt-1">
                Definição do limite máximo regulamentar aceito e regras de gatilho por trecho rodoviário.
              </p>
            </div>
            <button
              onClick={() => onOpenRoadModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#181c22] hover:bg-[#1c2026] text-[#dde3ed] hover:text-white transition-all text-xs border border-[#262b35] font-semibold cursor-pointer shadow-sm self-start sm:self-auto"
              type="button"
            >
              <span className="material-symbols-outlined text-[#2ca03a] text-[18px]">add</span>
              <span>Adicionar Trecho</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg bg-[#101317] border border-[#262b35] scrollbar-visible touch-scroll-x">
            <div className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#94a3b8] italic border-b border-[#262b35]/40">
              <span className="material-symbols-outlined text-[14px]">swipe</span>
              <span>Deslize horizontalmente para conferir todos os limites</span>
            </div>
            <table className="w-full text-left font-tabular-data text-xs border-collapse min-w-[850px] whitespace-nowrap">
              <thead>
                <tr className="bg-[#181c22] text-[#94a3b8] text-[10px] uppercase border-b border-[#262b35]">
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
              <tbody className="divide-y divide-[#262b35]">
                {roadParams.map((param) => (
                  <tr key={param.id} className="hover:bg-[#181c22] transition-colors">
                    <td className="py-3 px-3.5 font-semibold text-[#dde3ed] text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#2ca03a]" />
                        <span>{param.road}</span>
                      </div>
                      <span className="text-[#94a3b8] text-[11px] block pl-3.5 mt-0.5">
                        {param.section}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-[#94a3b8] text-xs text-left">
                      {param.profile}
                    </td>
                    <td className="py-3 px-2 text-center font-bold text-[#dde3ed]">
                      {param.cavaloLimit} km/h
                    </td>
                    <td className="py-3 px-2 text-center font-bold text-[#dde3ed]">
                      {param.bitremLimit} km/h
                    </td>
                    <td className="py-3 px-2 text-center text-[#94a3b8]">
                      {param.leveLimit} km/h
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 rounded bg-[#f4cf00]/10 border border-[#f4cf00]/30 text-[#f4cf00] font-semibold text-[11px]">
                        {param.trigger1}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 rounded bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] font-semibold text-[11px]">
                        {param.trigger2}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="font-tabular-data text-[10px] px-2 py-0.5 rounded bg-[#2ca03a]/10 text-[#2ca03a] border border-[#2ca03a]/30 font-bold">
                        {param.status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenRoadModal(param)}
                        className="p-1.5 hover:bg-[#1c2026] rounded text-[#94a3b8] hover:text-[#dde3ed] transition-colors inline-flex items-center cursor-pointer"
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
        <section className="bg-[#14171c] rounded-xl p-4 sm:p-5 border border-[#262b35] shadow-sm flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262b35]">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#2ca03a]" />
              <h2 className="font-headline-md text-sm sm:text-base font-bold text-[#dde3ed]">
                Regras de Parâmetro e Bonificação de Condutores
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-tabular-data text-[10px] text-[#2ca03a] font-bold px-2 py-0.5 rounded bg-[#2ca03a]/10 border border-[#2ca03a]/30">
                REGULAMENTO VIGENTE CCO
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Excesso Pontual */}
            <div className="bg-[#181c22] rounded-xl p-4 flex flex-col justify-between gap-3 border border-[#262b35] shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase font-bold tracking-wider">
                    REGRA DE EXCESSO PONTUAL
                  </span>
                  <p className="text-sm text-[#dde3ed] font-semibold mt-1">
                    Excesso Pontual &gt; 80 km/h
                  </p>
                  <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">
                    Qualquer registro acima do teto estipulado desclassifica a pontuação e bonificação do condutor no ciclo.
                  </p>
                </div>
                <span className="font-tabular-data text-[10px] px-2 py-0.5 rounded bg-[#2ca03a]/10 text-[#2ca03a] border border-[#2ca03a]/30 font-bold shrink-0">
                  ATIVO
                </span>
              </div>
              <div className="font-tabular-data text-[11px] text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/30 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-bold">
                <span className="material-symbols-outlined text-[16px]">shield</span>
                TOLERÂNCIA ZERO CONFIGURADA
              </div>
            </div>

            {/* Card 2: Horas Mínimas de Condução */}
            <div className="bg-[#181c22] rounded-xl p-4 flex flex-col justify-between gap-3 border border-[#262b35] shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase font-bold tracking-wider">
                    HORAS MÍNIMAS DE CONDUÇÃO
                  </span>
                  <p className="text-sm text-[#dde3ed] font-semibold mt-1">
                    {minHours} horas / ciclo
                  </p>
                  <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">
                    Carga horária mínima aferida via telemetria e leitura contínua de CAN bus para elegibilidade.
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#2ca03a]/10 border border-[#2ca03a]/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#2ca03a] text-[20px]">timer</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 font-tabular-data text-xs bg-[#12151a] p-2 rounded-lg border border-[#262b35]">
                <span className="text-[#94a3b8] font-semibold">Parâmetro:</span>
                <input
                  type="number"
                  min={1}
                  max={400}
                  value={minHours}
                  onChange={(e) => setMinHours(Math.max(1, Number(e.target.value) || 0))}
                  className="w-24 bg-[#181c22] text-[#dde3ed] rounded px-2.5 py-1 font-bold text-center border border-[#262b35] focus:outline-none focus:border-[#2ca03a] transition-colors"
                />
                <span className="text-[#94a3b8]">horas / ciclo</span>
              </div>
            </div>

            {/* Card 3: Exclusão Sem Identificação */}
            <div className="bg-[#181c22] rounded-xl p-4 flex flex-col justify-between gap-3 border border-[#262b35] shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase font-bold tracking-wider">
                    SEGURANÇA DE IDENTIFICAÇÃO
                  </span>
                  <p className="text-sm text-[#dde3ed] font-semibold mt-1">
                    Exclusão Sem Identificação
                  </p>
                  <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">
                    Condução sem chave iButton vinculada é glosada integralmente do cômputo da bonificação.
                  </p>
                </div>
                <span className="font-tabular-data text-[10px] px-2 py-0.5 rounded bg-[#2ca03a]/10 text-[#2ca03a] border border-[#2ca03a]/30 font-bold shrink-0">
                  ATIVO
                </span>
              </div>
              <div className="font-tabular-data text-[11px] text-[#2ca03a] bg-[#2ca03a]/10 border border-[#2ca03a]/30 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-bold">
                <span className="material-symbols-outlined text-[16px]">lock</span>
                REGRA EM VIGOR
              </div>
            </div>

            {/* Card 4: Valor Base da Bonificação */}
            <div className="bg-[#181c22] rounded-xl p-4 flex flex-col justify-between gap-3 border border-[#262b35] shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase font-bold tracking-wider">
                    VALOR BASE DA BONIFICAÇÃO
                  </span>
                  <p className="text-sm text-[#dde3ed] font-semibold mt-1">
                    R$ {baseBonus} / condutor
                  </p>
                  <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">
                    Repasse mensal calculado diretamente pelo fechamento executivo CCO para condutores aptos.
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#f4cf00]/10 border border-[#f4cf00]/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#f4cf00] text-[20px]">
                    payments
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 font-tabular-data text-xs bg-[#12151a] p-2 rounded-lg border border-[#262b35]">
                <span className="text-[#94a3b8] font-semibold">Valor Base:</span>
                <input
                  type="text"
                  value={baseBonus}
                  onChange={(e) => setBaseBonus(e.target.value)}
                  placeholder="Ex: 1.200,00"
                  className="w-32 bg-[#181c22] text-[#2ca03a] font-bold rounded px-2.5 py-1 text-center border border-[#262b35] focus:outline-none focus:border-[#2ca03a] transition-colors"
                />
                <span className="text-[#94a3b8]">BRL (Reais)</span>
              </div>
            </div>
          </div>

          {/* Action Footer dedicado para salvar diretamente as regras */}
          <div className="p-3.5 bg-[#0c1017] rounded-xl border border-[#262b35] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs mt-2">
            <div className="flex items-center gap-2 text-[#94a3b8]">
              <span className="material-symbols-outlined text-[#2ca03a] text-[18px]">info</span>
              <span>
                Parâmetros vigentes:{' '}
                <strong className="text-white font-tabular-data">{minHours}h mínimas</strong> e{' '}
                <strong className="text-[#34b344] font-tabular-data">R$ {baseBonus}</strong> de bonificação base.
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
        <section className="bg-[#14171c] rounded-xl p-4 sm:p-5 border border-[#262b35] shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262b35]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#2ca03a] text-[20px]">
                security
              </span>
              <h2 className="font-headline-md text-sm sm:text-base font-bold text-[#dde3ed]">
                Trilha de Auditoria & Logs de Parametrização
              </h2>
              <span className="font-tabular-data text-[11px] text-[#94a3b8] hidden sm:inline">
                ({auditLogs.length} {auditLogs.length === 1 ? 'registro' : 'registros'})
              </span>
            </div>
            <span className="font-tabular-data text-[10px] text-[#2ca03a] font-bold px-2 py-0.5 rounded bg-[#2ca03a]/10 border border-[#2ca03a]/30 self-start sm:self-auto">
              REGISTRO DE AUDITORIA CCO
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg bg-[#101317] border border-[#262b35] scrollbar-visible touch-scroll-x">
            <table className="w-full min-w-[750px] text-left font-tabular-data text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[#181c22] text-[#94a3b8] text-[10px] uppercase border-b border-[#262b35]">
                  <th className="py-3 px-3.5">Data / Hora</th>
                  <th className="py-3 px-3.5">Operador / Usuário</th>
                  <th className="py-3 px-3.5">Ação Realizada</th>
                  <th className="py-3 px-3.5 text-center">Origem (IP)</th>
                  <th className="py-3 px-3.5 text-right">Hash SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262b35]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[#94a3b8] italic">
                      Nenhum registro de auditoria gravado no momento.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#181c22] transition-colors">
                      <td className="py-3 px-3.5 text-[#dde3ed] font-semibold">{log.date}</td>
                      <td className="py-3 px-3.5 text-[#dde3ed]">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[#2ca03a] text-[16px]">
                            admin_panel_settings
                          </span>
                          <span>{log.operator}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-[#9ba3af]">{log.action}</td>
                      <td className="py-3 px-3.5 text-center text-[#94a3b8]">{log.ip}</td>
                      <td className="py-3 px-3.5 text-right text-[#9ba3af]">
                        <span className="bg-[#181c22] border border-[#262b35] text-[#2ca03a] font-tabular-data px-2 py-0.5 rounded text-[10px]">
                          {log.hash}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-[#94a3b8] text-[11px] border-t border-[#262b35]/40">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#2ca03a] text-[15px]">verified</span>
              <span className="font-tabular-data uppercase tracking-wider text-[10px]">
                AUDITORIA OPERACIONAL CASAGRANDE: PARÂMETROS CRIPTOGRAFADOS E ASSINADOS DIGITALMENTE (SHA-256)
              </span>
            </div>
            <div className="font-tabular-data text-[10px]">
              Versão: <span className="text-[#2ca03a] font-semibold">2026.10-prod</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
