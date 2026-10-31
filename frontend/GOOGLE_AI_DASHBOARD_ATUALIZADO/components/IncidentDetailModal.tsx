'use client';

import React from 'react';
import { Incident } from '@/lib/telemetry-data';

interface IncidentDetailModalProps {
  incident: Incident | null;
  onClose: () => void;
  onLinkDriver?: (incidentId: string) => void;
}

export default function IncidentDetailModal({
  incident,
  onClose,
  onLinkDriver,
}: IncidentDetailModalProps) {
  if (!incident) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-[#131923] border border-[#283548] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#f1f5f9]"
      >
        {/* Header */}
        <div className="p-4 bg-[#0c1017] border-b border-[#283548] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                incident.severityBand === 4
                  ? 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40'
                  : incident.severityBand >= 2
                  ? 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40'
                  : 'bg-[#34b344]/20 text-[#34b344] border border-[#34b344]/40'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {incident.severityBand === 4 ? 'crisis_alert' : 'speed'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-base">
                  Dossiê de Telemetria {incident.code}
                </h3>
                <span
                  className={`font-tabular-data text-[10px] font-bold px-2 py-0.5 rounded border ${
                    incident.severityBand === 4
                      ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40'
                      : incident.severityBand >= 2
                      ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/40'
                      : 'bg-[#34b344]/20 text-[#34b344] border-[#34b344]/40'
                  }`}
                >
                  {incident.severity}
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Registro telemétrico transmitido via CAN Bus / Módulo GPS CCO
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-9 min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-[#1c2432] transition-colors cursor-pointer"
            title="Fechar Dossiê"
            aria-label="Fechar modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[85dvh] overflow-y-auto font-body-md text-xs">
          {/* Top Alert Banner if > 30 km/h */}
          {incident.severityBand === 4 && (
            <div className="p-3 rounded-lg bg-[#ef4444]/15 border border-[#ef4444]/40 flex items-start gap-2.5 text-[#ef4444]">
              <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">
                warning
              </span>
              <div>
                <strong className="font-bold">Infração Gravíssima ({incident.recordedSpeed} km/h em limite de {incident.speedLimit} km/h):</strong>
                <p className="text-[#f1f5f9] text-[11px] mt-0.5">
                  Excedeu em +{incident.deltaSpeed} km/h o limite homologado pelo CONTRAN. Risco de capotamento e perda de estabilidade de carga.
                </p>
              </div>
            </div>
          )}

          {/* Telemetry Gauge Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8] font-tabular-data text-[10px] uppercase">
                Velocidade Registrada
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-2xl font-bold font-tabular-data ${
                    incident.severityBand === 4
                      ? 'text-[#ef4444]'
                      : incident.severityBand >= 2
                      ? 'text-[#f59e0b]'
                      : 'text-[#34b344]'
                  }`}
                >
                  {incident.recordedSpeed}
                </span>
                <span className="text-xs text-[#94a3b8]">km/h</span>
              </div>
              <span className="text-[10px] text-[#94a3b8]">
                Teto: {incident.speedLimit} km/h
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8] font-tabular-data text-[10px] uppercase">
                Delta Acima do Teto
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-2xl font-bold font-tabular-data ${
                    incident.deltaSpeed > 0 ? 'text-[#ef4444]' : 'text-[#34b344]'
                  }`}
                >
                  {incident.deltaSpeed > 0 ? `+${incident.deltaSpeed}` : incident.deltaSpeed}
                </span>
                <span className="text-xs text-[#94a3b8]">km/h</span>
              </div>
              <span className="text-[10px] text-[#94a3b8]">
                Excedente regulatório
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8] font-tabular-data text-[10px] uppercase">
                Duração do Excesso
              </span>
              <div className="text-xl font-bold font-tabular-data text-white mt-1">
                {incident.duration}
              </div>
              <span className="text-[10px] text-[#94a3b8]">
                {incident.durationSeconds > 300 ? 'Prolongado (> 5 min)' : 'Pontual'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8] font-tabular-data text-[10px] uppercase">
                Horário & Turno
              </span>
              <div className="text-base font-bold font-tabular-data text-white mt-1">
                {incident.time}
              </div>
              <span className="text-[10px] text-[#34b344] font-semibold">
                {incident.shift} • {incident.date}
              </span>
            </div>
          </div>

          {/* Vehicle and Driver details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Vehicle Box */}
            <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548] space-y-2">
              <div className="flex items-center justify-between border-b border-[#283548] pb-1.5">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#34b344]">
                    local_shipping
                  </span>
                  Veículo & Equipamento
                </span>
                <span className="font-tabular-data text-xs font-bold text-white px-2 py-0.5 rounded bg-[#1c2432] border border-[#283548]">
                  {incident.plate}
                </span>
              </div>
              <div className="space-y-1 font-tabular-data text-xs">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Modelo:</span>
                  <span className="text-white font-medium">{incident.vehicleModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Categoria:</span>
                  <span className="text-[#34b344] font-semibold">{incident.vehicleCategory}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Frota:</span>
                  <span className="text-white">Casagrande Florestal</span>
                </div>
              </div>
            </div>

            {/* Driver Box */}
            <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548] space-y-2">
              <div className="flex items-center justify-between border-b border-[#283548] pb-1.5">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#34b344]">
                    badge
                  </span>
                  Condutor Auditado
                </span>
                <span
                  className={`font-tabular-data text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    incident.hasDriver
                      ? 'bg-[#2ca03a]/20 text-[#34b344] border-[#34b344]/40'
                      : 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40'
                  }`}
                >
                  {incident.hasDriver ? 'IDENTIFICADO' : 'PENDENTE'}
                </span>
              </div>
              <div className="space-y-1 font-tabular-data text-xs">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Nome:</span>
                  <span
                    className={`font-semibold ${
                      incident.hasDriver ? 'text-white' : 'text-[#ef4444]'
                    }`}
                  >
                    {incident.driver}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">iButton ID:</span>
                  <span className="text-white">{incident.ibutton}</span>
                </div>
                {!incident.hasDriver && incident.suggestedDriver && (
                  <div className="mt-1 pt-1 border-t border-[#283548] flex items-center justify-between">
                    <span className="text-[#f59e0b] text-[10px]">
                      Sugestão: {incident.suggestedDriver.name} ({incident.suggestedDriver.confidence}%)
                    </span>
                    {onLinkDriver && (
                      <button
                        onClick={() => onLinkDriver(incident.id)}
                        className="px-2 py-0.5 rounded bg-[#2ca03a] hover:bg-[#34b344] text-white text-[10px] font-bold"
                      >
                        Vincular
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Location & Road details */}
          <div className="p-3 rounded-lg bg-[#0c1017] border border-[#283548] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#f59e0b]">
                  add_road
                </span>
                Localização & Georreferenciamento
              </span>
              <span className="text-[#94a3b8] font-tabular-data text-[11px]">
                Lat: {incident.lat} | Lng: {incident.lng}
              </span>
            </div>
            <p className="text-white font-medium">{incident.highway} - {incident.locationDetails}</p>
            <p className="text-[#94a3b8] text-[11px]">
              Trecho com pavimento asfáltico e trânsito intenso de composições florestais pesadas (tritrens).
            </p>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 bg-[#0c1017] border-t border-[#283548] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-[#94a3b8] text-xs font-tabular-data">
            Protocolo: CASAGRANDE-CCO-{incident.code.replace('#', '')}
          </span>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => {
                alert(`Relatório em PDF do incidente ${incident.code} gerado com sucesso para impressão/encaminhamento.`);
              }}
              className="px-3 py-1.5 rounded bg-[#1c2432] hover:bg-[#283548] text-[#f1f5f9] border border-[#283548] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
            >
              <span className="material-symbols-outlined text-[15px]">print</span>
              Imprimir Dossiê
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-[#2ca03a] hover:bg-[#34b344] text-white text-xs font-bold transition-all shadow-md cursor-pointer min-h-[36px]"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
