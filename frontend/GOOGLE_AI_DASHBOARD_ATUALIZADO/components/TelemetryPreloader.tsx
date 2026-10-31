'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  CASAGRANDE_LOGO_DARK_URL,
} from '@/components/Sidebar';
import {
  fetchTelemetrySummaryStats,
  TelemetrySummaryStats,
} from '@/lib/telemetry-service';

interface TelemetryPreloaderProps {
  statusText?: string;
  subText?: string;
  stats?: TelemetrySummaryStats | null;
}

export default function TelemetryPreloader({
  statusText = 'Sincronizando Telemetria da Frota...',
  subText,
  stats,
}: TelemetryPreloaderProps) {
  const [liveStats, setLiveStats] = useState<TelemetrySummaryStats | null>(stats || null);

  useEffect(() => {
    if (stats) {
      setLiveStats(stats);
      return;
    }
    let active = true;
    fetchTelemetrySummaryStats()
      .then((data) => {
        if (active && data) {
          setLiveStats(data);
        }
      })
      .catch((err) => {
        console.warn('Erro ao carregar estatísticas no preloader:', err);
      });

    return () => {
      active = false;
    };
  }, [stats]);

  const totalVelText = liveStats
    ? liveStats.totalVelocidade.toLocaleString('pt-BR')
    : null;
  const totalRegText = liveStats
    ? `${liveStats.totalAlertas.toLocaleString('pt-BR')} registros`
    : null;
  const veiculosCount = liveStats?.totalVeiculos ?? 37;

  const dynamicSubText = liveStats
    ? `Consolidando ${totalVelText} excessos de velocidade (${totalRegText}), apuração SESMT e conformidade dos ${veiculosCount} veículos`
    : 'Conectando ao Supabase e sincronizando registros de telemetria da frota em tempo real...';

  const finalSubText = subText ?? dynamicSubText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090d14] text-[#f1f5f9] select-none overflow-hidden">
      {/* Background Ambient Glow */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[160px] opacity-20 bg-[#34b344]"
        aria-hidden="true"
      />

      {/* Decorative Grid Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1c2432_1px,transparent_1px),linear-gradient(to_bottom,#1c2432_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Card Central */}
      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center text-center p-8 rounded-3xl bg-[#131923]/90 border border-[#283548] shadow-2xl backdrop-blur-xl animate-fade-in">
        {/* Logo Casagrande */}
        <div className="mb-6 flex items-center justify-center">
          <Image
            src={CASAGRANDE_LOGO_DARK_URL}
            alt="Casagrande Locações & Transportes"
            width={240}
            height={44}
            priority
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Pulse Radar Indicator */}
        <div className="relative my-3 flex items-center justify-center">
          <div className="size-16 rounded-full bg-[#34b344]/10 border border-[#34b344]/30 flex items-center justify-center relative">
            <span className="material-symbols-outlined text-[#34b344] text-[28px] animate-pulse">
              speed
            </span>
            <span className="absolute -inset-1 rounded-full border border-[#34b344]/40 animate-ping opacity-40" />
          </div>
        </div>

        {/* Status Text */}
        <h3 className="text-base font-bold text-white tracking-tight mt-4">
          {statusText}
        </h3>
        <p className="text-xs text-[#94a3b8] mt-2 max-w-[340px] leading-relaxed">
          {finalSubText}
        </p>

        {/* High-tech Progress Bar */}
        <div className="w-full mt-6 space-y-2 font-tabular-data">
          <div className="w-full h-1.5 bg-[#1c2432] rounded-full overflow-hidden border border-[#283548] relative">
            <div className="h-full bg-gradient-to-r from-[#2ca03a] via-[#34b344] to-[#4ade80] rounded-full animate-indeterminate-bar" />
          </div>
          <div className="flex justify-between items-center text-[10px] text-[#94a3b8] font-bold tracking-wider uppercase pt-1">
            <span>CCO OPERAÇÕES</span>
            <span className="text-[#34b344] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34b344] animate-pulse" />
              ONLINE
            </span>
          </div>
        </div>

        {/* Badges de Verificação */}
        <div className="mt-6 pt-5 border-t border-[#283548] w-full flex items-center justify-center gap-4 text-[11px] text-[#94a3b8]">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#34b344] text-[16px]">verified</span>
            {liveStats ? `${liveStats.totalVeiculos} Veículos` : `${veiculosCount} Veículos`}
          </span>
          <span className="h-3 w-px bg-[#283548]" />
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#34b344] text-[16px]">database</span>
            Supabase SP
          </span>
        </div>
      </div>
    </div>
  );
}
