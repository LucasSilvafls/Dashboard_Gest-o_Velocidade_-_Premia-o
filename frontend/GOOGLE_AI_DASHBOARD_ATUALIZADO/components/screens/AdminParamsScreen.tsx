'use client';

import React, { useState } from 'react';
import { RoadParameter, AuditLog } from '@/lib/telemetry-data';

interface AdminParamsScreenProps {
  roadParams: RoadParameter[];
  auditLogs: AuditLog[];
  onOpenRoadModal: (param?: RoadParameter) => void;
  onSaveRules: (minHours: number, baseBonus: string) => void;
}

export default function AdminParamsScreen({
  roadParams,
  auditLogs,
  onOpenRoadModal,
  onSaveRules,
}: AdminParamsScreenProps) {
  const [activeTab, setActiveTab] = useState<'roads' | 'rules' | 'logs'>('roads');
  const [isPropagating, setIsPropagating] = useState(false);
  const [propagatedSuccess, setPropagatedSuccess] = useState(false);
  const [minHours, setMinHours] = useState(120);
  const [baseBonus, setBaseBonus] = useState('1.200,00');

  const handlePropagate = () => {
    setIsPropagating(true);
    setTimeout(() => {
      setIsPropagating(false);
      setPropagatedSuccess(true);
      onSaveRules(minHours, baseBonus);
      setTimeout(() => setPropagatedSuccess(false), 2500);
    }, 1200);
  };

  return (
    <div className="flex flex-col w-full text-on-surface pb-6 animate-fade-in">
      {/* Screen Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 mb-2">
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

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setMinHours(120);
              setBaseBonus('1.200,00');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1c2432] text-[#f1f5f9] border border-[#283548] hover:bg-[#283548] hover:border-[#34b344] transition-colors font-body-sm text-xs cursor-pointer"
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
                ? 'Parâmetros Propagados na Frota (35)!'
                : isPropagating
                ? 'Propagando na frota (35)...'
                : 'Salvar & Atualizar Parâmetros'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Faixa Superior de Status e Saúde do Sistema (5 Cards) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <div className="bg-[#181c22] rounded-xl p-3 border border-[#262b35] hover:border-[#2ca03a]/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9ba3af] font-tabular-data text-[10px] uppercase font-bold">
            <span className="truncate">INTEGRAÇÃO CAN / API</span>
            <div className="w-6 h-6 rounded bg-[#2ca03a]/10 border border-[#2ca03a]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#2ca03a] text-[15px]">hub</span>
            </div>
          </div>
          <div className="my-1">
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

        <div className="bg-[#181c22] rounded-xl p-3 border border-[#262b35] hover:border-[#2ca03a]/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9ba3af] font-tabular-data text-[10px] uppercase font-bold">
            <span className="truncate">TETO GLOBAL REGULAMENTAR</span>
            <div className="w-6 h-6 rounded bg-[#f4cf00]/10 border border-[#f4cf00]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#f4cf00] text-[15px]">speed</span>
            </div>
          </div>
          <div className="my-1">
            <div className="flex items-baseline gap-1">
              <span className="font-tabular-data text-2xl font-bold text-[#dde3ed]">80</span>
              <span className="font-tabular-data text-xs text-[#9ba3af]">km/h</span>
            </div>
          </div>
          <div className="text-[#9ba3af] text-[11px] leading-tight">
            Aplicado a todas as composições pesadas e trechos rurais.
          </div>
        </div>

        <div className="bg-[#181c22] rounded-xl p-3 border border-[#262b35] hover:border-[#2ca03a]/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9ba3af] font-tabular-data text-[10px] uppercase font-bold">
            <span className="truncate">IDENTIFICADORES ATIVOS</span>
            <div className="w-6 h-6 rounded bg-[#2ca03a]/10 border border-[#2ca03a]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#2ca03a] text-[15px]">badge</span>
            </div>
          </div>
          <div className="my-1">
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

        <div className="bg-[#181c22] rounded-xl p-3 border border-[#262b35] hover:border-[#2ca03a]/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9ba3af] font-tabular-data text-[10px] uppercase font-bold">
            <span className="truncate">ALERTA DE CONFIGURAÇÃO</span>
            <div className="w-6 h-6 rounded bg-[#2ca03a]/10 border border-[#2ca03a]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#2ca03a] text-[15px]">check_circle</span>
            </div>
          </div>
          <div className="my-1">
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

        <div className="bg-[#181c22] rounded-xl p-3 border border-[#262b35] hover:border-[#2ca03a]/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9ba3af] font-tabular-data text-[10px] uppercase font-bold">
            <span className="truncate">MARGEM DE TOLERÂNCIA</span>
            <div className="w-6 h-6 rounded bg-[#ef4444]/10 border border-[#ef4444]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#ef4444] text-[15px]">gavel</span>
            </div>
          </div>
          <div className="my-1">
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

      {/* 3. Abas de Configuração Rápida */}
      <section className="bg-[#14171c] rounded-xl p-1 border border-[#262b35] shadow-sm overflow-x-auto scrollbar-none touch-scroll-x">
        <div className="flex items-center gap-1 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab('roads')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 min-h-[38px] ${
              activeTab === 'roads'
                ? 'bg-[#1c2026] text-[#2ca03a] border border-[#2d333b] shadow-sm'
                : 'text-[#9ba3af] hover:text-white hover:bg-[#181c22]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">signpost</span>
            <span>Limites por Rodovia & Trecho</span>
            <span className="font-tabular-data text-[10px] px-1.5 py-0.2 rounded-full bg-[#2ca03a]/20 text-[#2ca03a] border border-[#2ca03a]/40">
              {roadParams.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 min-h-[38px] ${
              activeTab === 'rules'
                ? 'bg-[#1c2026] text-[#2ca03a] border border-[#2d333b] shadow-sm'
                : 'text-[#9ba3af] hover:text-white hover:bg-[#181c22]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">military_tech</span>
            <span>Regras de Premiação & Compliance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 min-h-[38px] ${
              activeTab === 'logs'
                ? 'bg-[#1c2026] text-[#2ca03a] border border-[#2d333b] shadow-sm'
                : 'text-[#9ba3af] hover:text-white hover:bg-[#181c22]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">security</span>
            <span>Logs do Sistema & Auditoria</span>
            <span className="font-tabular-data text-[10px] px-1.5 py-0.2 rounded-full bg-[#2ca03a]/20 text-[#2ca03a] border border-[#2ca03a]/40">
              {auditLogs.length}
            </span>
          </button>
        </div>
      </section>

      {/* 4. Conteúdo da Aba */}
      {activeTab === 'roads' && (
        <section className="bg-[#14171c] rounded-xl p-4 border border-[#262b35] shadow-sm flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#262b35]">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#2ca03a]" />
                <h2 className="font-headline-md text-sm font-bold text-[#dde3ed]">
                  Tabela de Parametrização por Rodovia & Categoria Veicular
                </h2>
              </div>
              <p className="font-body-sm text-xs text-[#94a3b8] mt-0.5">
                Definição do limite máximo aceito e regras de gatilho por trecho.
              </p>
            </div>
            <button
              onClick={() => onOpenRoadModal()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#181c22] hover:bg-[#1c2026] text-[#dde3ed] hover:text-white transition-all text-xs border border-[#262b35] font-semibold cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[#2ca03a] text-[18px]">add</span>
              <span>Adicionar Trecho</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg bg-[#101317] border border-[#262b35] scrollbar-none touch-scroll-x">
            <div className="sm:hidden flex items-center gap-1.5 px-3 py-1 text-[11px] text-[#94a3b8] italic border-b border-[#262b35]/40">
              <span className="material-symbols-outlined text-[14px]">swipe</span>
              <span>Deslize horizontalmente para conferir todos os limites</span>
            </div>
            <table className="w-full text-left font-tabular-data text-xs border-collapse min-w-[760px] whitespace-nowrap">
              <thead>
                <tr className="bg-[#181c22] text-[#94a3b8] text-[10px] uppercase border-b border-[#262b35]">
                  <th className="py-2.5 px-3 text-left">Rodovia / Trecho</th>
                  <th className="py-2.5 px-3 text-left">Perfil da Via</th>
                  <th className="py-2.5 px-2 text-center">Cavalo 6x4</th>
                  <th className="py-2.5 px-2 text-center">Bi-trem</th>
                  <th className="py-2.5 px-2 text-center">Apoio Leve</th>
                  <th className="py-2.5 px-2 text-center">Gatilho 1</th>
                  <th className="py-2.5 px-2 text-center">Gatilho 2</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262b35]">
                {roadParams.map((param) => (
                  <tr key={param.id} className="hover:bg-[#181c22] transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-[#dde3ed] text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#2ca03a]" />
                        <span>{param.road}</span>
                      </div>
                      <span className="text-[#94a3b8] text-[11px] block pl-3">
                        {param.section}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#94a3b8] text-xs text-left">
                      {param.profile}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-[#dde3ed]">
                      {param.cavaloLimit} km/h
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-[#dde3ed]">
                      {param.bitremLimit} km/h
                    </td>
                    <td className="py-2.5 px-2 text-center text-[#94a3b8]">
                      {param.leveLimit} km/h
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-[#f4cf00]/10 border border-[#f4cf00]/30 text-[#f4cf00] font-semibold text-[11px]">
                        {param.trigger1}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] font-semibold text-[11px]">
                        {param.trigger2}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="font-tabular-data text-[10px] px-1.5 py-0.5 rounded bg-[#2ca03a]/10 text-[#2ca03a] border border-[#2ca03a]/30 font-bold">
                        {param.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenRoadModal(param)}
                        className="p-1 hover:bg-[#1c2026] rounded text-[#94a3b8] hover:text-[#dde3ed] transition-colors inline-flex items-center cursor-pointer"
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

      {/* Regras de Parâmetro e Bonificação */}
      {(activeTab === 'roads' || activeTab === 'rules') && (
        <section className="bg-[#14171c] rounded-xl p-4 border border-[#262b35] shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#2ca03a]" />
            <h2 className="font-headline-md text-sm font-bold text-[#dde3ed]">
              Regras de Parâmetro e Bonificação de Condutores
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[#181c22] rounded-lg p-3 flex flex-col justify-between gap-2 border border-[#262b35] shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase font-bold">
                    REGRA DE EXCESSO PONTUAL
                  </span>
                  <p className="text-xs text-[#dde3ed] font-semibold mt-0.5">
                    Excesso Pontual &gt; 80 km/h
                  </p>
                  <p className="text-[11px] text-[#94a3b8] mt-0.5">
                    Registro acima do teto estipulado desclassifica pontuação do ciclo.
                  </p>
                </div>
                <span className="font-tabular-data text-[10px] px-1.5 py-0.5 rounded bg-[#2ca03a]/10 text-[#2ca03a] border border-[#2ca03a]/30 font-bold">
                  ATIVO
                </span>
              </div>
              <div className="font-tabular-data text-[10px] text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/30 px-2 py-1 rounded inline-flex items-center gap-1 font-bold">
                <span className="material-symbols-outlined text-[14px]">shield</span>
                TOLERÂNCIA ZERO CONFIGURADA
              </div>
            </div>

            <div className="bg-[#181c22] rounded-lg p-3 flex flex-col justify-between gap-2 border border-[#262b35] shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase font-bold">
                    HORAS MÍNIMAS DE CONDUÇÃO
                  </span>
                  <p className="text-xs text-[#dde3ed] font-semibold mt-0.5">
                    {minHours} horas / ciclo
                  </p>
                  <p className="text-[11px] text-[#94a3b8] mt-0.5">
                    Carga horária aferida via leitura contínua de CAN bus.
                  </p>
                </div>
                <span className="material-symbols-outlined text-[#2ca03a] text-[20px]">timer</span>
              </div>
              <div className="flex items-center gap-2 font-tabular-data text-xs">
                <span className="text-[#94a3b8]">Parâmetro:</span>
                <input
                  type="number"
                  value={minHours}
                  onChange={(e) => setMinHours(Number(e.target.value))}
                  className="w-20 bg-[#14171c] text-[#dde3ed] rounded px-2 py-0.5 font-bold text-center border border-[#262b35] focus:outline-none focus:border-[#2ca03a]"
                />
                <span className="text-[#94a3b8]">h / ciclo</span>
              </div>
            </div>

            <div className="bg-[#181c22] rounded-lg p-3 flex flex-col justify-between gap-2 border border-[#262b35] shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase font-bold">
                    SEGURANÇA DE IDENTIFICAÇÃO
                  </span>
                  <p className="text-xs text-[#dde3ed] font-semibold mt-0.5">
                    Exclusão Sem Identificação
                  </p>
                  <p className="text-[11px] text-[#94a3b8] mt-0.5">
                    Condução sem chave iButton é glosada do cômputo da bonificação.
                  </p>
                </div>
                <span className="font-tabular-data text-[10px] px-1.5 py-0.5 rounded bg-[#2ca03a]/10 text-[#2ca03a] border border-[#2ca03a]/30 font-bold">
                  ATIVO
                </span>
              </div>
              <div className="font-tabular-data text-[10px] text-[#2ca03a] bg-[#2ca03a]/10 border border-[#2ca03a]/30 px-2 py-1 rounded inline-flex items-center gap-1 font-bold">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                REGRA EM VIGOR
              </div>
            </div>

            <div className="bg-[#181c22] rounded-lg p-3 flex flex-col justify-between gap-2 border border-[#262b35] shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-tabular-data text-[10px] text-[#94a3b8] uppercase font-bold">
                    VALOR BASE DA BONIFICAÇÃO
                  </span>
                  <p className="text-xs text-[#dde3ed] font-semibold mt-0.5">
                    R$ {baseBonus} / condutor
                  </p>
                  <p className="text-[11px] text-[#94a3b8] mt-0.5">
                    Repasse mensal apurado diretamente pelo fechamento executivo CCO.
                  </p>
                </div>
                <span className="material-symbols-outlined text-[#f4cf00] text-[20px]">
                  payments
                </span>
              </div>
              <div className="flex items-center gap-2 font-tabular-data text-xs">
                <span className="text-[#94a3b8]">Valor:</span>
                <input
                  type="text"
                  value={baseBonus}
                  onChange={(e) => setBaseBonus(e.target.value)}
                  className="w-28 bg-[#14171c] text-[#2ca03a] font-bold rounded px-2 py-0.5 text-center border border-[#262b35] focus:outline-none focus:border-[#2ca03a]"
                />
                <span className="text-[#94a3b8]">BRL</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 5. Trilha de Auditoria & Logs de Parametrização */}
      {(activeTab === 'roads' || activeTab === 'logs') && (
        <section className="bg-[#14171c] rounded-xl p-4 border border-[#262b35] shadow-sm flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#262b35]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#2ca03a] text-[20px]">
                security
              </span>
              <h2 className="font-headline-md text-sm font-bold text-[#dde3ed]">
                Trilha de Auditoria & Logs de Parametrização
              </h2>
              <span className="font-tabular-data text-[11px] text-[#94a3b8] hidden sm:inline">
                ({auditLogs.length} {auditLogs.length === 1 ? 'registro' : 'registros'})
              </span>
            </div>
            <span className="font-tabular-data text-[10px] text-[#2ca03a] font-bold px-2 py-0.5 rounded bg-[#2ca03a]/10 border border-[#2ca03a]/30">
              REGISTRO DE AUDITORIA CCO
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg bg-[#101317] border border-[#262b35] scrollbar-none touch-scroll-x">
            <table className="w-full min-w-[650px] text-left font-tabular-data text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[#181c22] text-[#94a3b8] text-[10px] uppercase border-b border-[#262b35]">
                  <th className="py-2.5 px-3">Data / Hora</th>
                  <th className="py-2.5 px-3">Operador / Usuário</th>
                  <th className="py-2.5 px-3">Ação Realizada</th>
                  <th className="py-2.5 px-3 text-center">Origem (IP)</th>
                  <th className="py-2.5 px-3 text-right">Hash</th>
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
                      <td className="py-2.5 px-3 text-[#dde3ed] font-semibold">{log.date}</td>
                      <td className="py-2.5 px-3 text-[#dde3ed]">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[#2ca03a] text-[16px]">
                            admin_panel_settings
                          </span>
                          <span>{log.operator}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#9ba3af]">{log.action}</td>
                      <td className="py-2.5 px-3 text-center text-[#94a3b8]">{log.ip}</td>
                      <td className="py-2.5 px-3 text-right text-[#9ba3af]">
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-2 text-[#94a3b8] text-[11px]">
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
