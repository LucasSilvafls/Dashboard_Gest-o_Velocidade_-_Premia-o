'use client';

import React from 'react';
import { DriverScore } from '@/lib/telemetry-data';

interface DriverDetailModalProps {
  driver: DriverScore | null;
  onClose: () => void;
  bonusAmount?: string;
}

export default function DriverDetailModal({ driver, onClose, bonusAmount = '1.200,00' }: DriverDetailModalProps) {
  if (!driver) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl bg-[#131923] border border-[#283548] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#f1f5f9]"
      >
        {/* Header */}
        <div className="p-4 bg-[#0c1017] border-b border-[#283548] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                driver.status === 'APTO'
                  ? 'bg-[#2ca03a]/20 border border-[#34b344]/40 text-[#34b344]'
                  : 'bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444]'
              }`}
            >
              {driver.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-base truncate max-w-sm">
                  {driver.name}
                </h3>
                <span
                  className={`font-tabular-data text-[10px] font-bold px-2 py-0.5 rounded border ${
                    driver.status === 'APTO'
                      ? 'bg-[#2ca03a]/20 text-[#34b344] border-[#34b344]/40'
                      : 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40'
                  }`}
                >
                  {driver.status === 'APTO' ? 'APTO À BONIFICAÇÃO' : 'INAPTO (> 80 KM/H)'}
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] font-tabular-data mt-0.5">
                iButton: {driver.ibutton} • Placa Principal: {driver.plate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-9 min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-[#1c2432] transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body Metrics */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[85dvh] overflow-y-auto font-body-md text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8] font-tabular-data text-[10px] uppercase">
                Velocidade Máxima
              </span>
              <div
                className={`text-2xl font-bold font-tabular-data mt-1 ${
                  driver.status === 'APTO' ? 'text-[#34b344]' : 'text-[#ef4444]'
                }`}
              >
                {driver.maxSpeed}{' '}
                <span className="text-xs text-[#94a3b8] font-normal">km/h</span>
              </div>
              <span className="text-[10px] text-[#94a3b8]">
                Teto: {driver.limitSpeed} km/h
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8] font-tabular-data text-[10px] uppercase">
                Total de Alertas
              </span>
              <div className="text-2xl font-bold font-tabular-data text-white mt-1">
                {driver.totalAlerts}
              </div>
              <span className="text-[10px] text-[#94a3b8]">
                Infrações no ciclo
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8] font-tabular-data text-[10px] uppercase">
                Violações &gt; 80
              </span>
              <div
                className={`text-2xl font-bold font-tabular-data mt-1 ${
                  driver.violationsAbove80 === 0 ? 'text-[#34b344]' : 'text-[#ef4444]'
                }`}
              >
                {driver.violationsAbove80}
              </div>
              <span className="text-[10px] text-[#94a3b8]">
                Desclassificatórias
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8] font-tabular-data text-[10px] uppercase">
                Horas Conduzidas
              </span>
              <div className="text-2xl font-bold font-tabular-data text-white mt-1">
                {driver.hoursWorked}h
              </div>
              <span className="text-[10px] text-[#34b344]">
                Mínimo 120h cumprido
              </span>
            </div>
          </div>

          {/* Operational Review */}
          <div className="p-3.5 rounded-lg bg-[#0c1017] border border-[#283548] space-y-2">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#34b344] text-[16px]">
                gavel
              </span>
              Parecer Operacional de Compliance CCO
            </h4>
            <p className="text-[#94a3b8] text-xs">
              {driver.status === 'APTO'
                ? `O condutor cumpriu integralmente o teto de 80 km/h estipulado para a frota pesada, registrando velocidade de pico de ${driver.maxSpeed} km/h (margem de ${Math.abs(driver.deltaSpeed)} km/h abaixo do limite máximo). Elegível à bonificação de R$ ${bonusAmount}.`
                : `O condutor ultrapassou o teto regulamentar de 80 km/h, atingindo velocidade máxima de ${driver.maxSpeed} km/h (+${driver.deltaSpeed} km/h excedentes) em ${driver.worstEventLocation}. Desclassificado para premiação no ciclo.`}
            </p>
          </div>

          {/* Critical Point */}
          <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548] flex items-center justify-between font-tabular-data">
            <div>
              <span className="text-[#94a3b8] text-[10px] uppercase block">
                Pior Registro no Ciclo
              </span>
              <span className="text-white font-medium text-xs">
                {driver.worstEventLocation}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                driver.status === 'APTO'
                  ? 'bg-[#2ca03a]/20 text-[#34b344]'
                  : 'bg-[#ef4444]/20 text-[#ef4444]'
              }`}
            >
              Ranking #{driver.rank}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0c1017] border-t border-[#283548] flex items-center justify-between">
          <span className="text-xs text-[#94a3b8] font-tabular-data">
            Ciclo Vigente: 26/09/2026 - 25/10/2026
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#2ca03a] hover:bg-[#34b344] text-white text-xs font-bold transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
