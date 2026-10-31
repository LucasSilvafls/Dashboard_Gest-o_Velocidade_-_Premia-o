'use client';

import React from 'react';
import { useTheme } from '@/lib/ThemeContext';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAlert?: (code: string) => void;
}

export default function NotificationsModal({
  isOpen,
  onClose,
  onSelectAlert,
}: NotificationsModalProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  if (!isOpen) return null;

  const alerts = [
    {
      id: 'al-1',
      title: 'Pico de Velocidade Crítico (164 km/h)',
      desc: 'Veículo SMH0F42 registrou 164 km/h na descida da serra (MS-223 Km 88). Condução anônima (sem iButton).',
      time: 'Há 14 minutos',
      severity: 'grave',
      code: '#00012',
    },
    {
      id: 'al-2',
      title: 'Conciliação Sugerida pelo Sistema',
      desc: 'Motor de conciliação encontrou 94% de compatibilidade para escala de Senivaldo Costa Rodrigues no veículo SMH0F42.',
      time: 'Há 28 minutos',
      severity: 'info',
      code: '#00012',
    },
    {
      id: 'al-3',
      title: 'Excesso Prolongado Contínuo (> 5 min)',
      desc: 'Veículo UGY5G31 manteve velocidade excedente por 05m 08s na MS-377 Km 38.',
      time: 'Há 45 minutos',
      severity: 'alerta',
      code: '#00019',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col border transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-[#131923] border-[#283548] text-[#f1f5f9]'
        }`}
      >
        <div
          className={`p-4 border-b flex items-center justify-between ${
            isLight ? 'bg-[#f8fafc] border-slate-200' : 'bg-[#0c1017] border-[#283548]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#f59e0b] text-[20px]">
              notifications
            </span>
            <h3 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Notificações &amp; Alertas Operacionais CCO
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`size-9 min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isLight
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#1c2432]'
            }`}
            aria-label="Fechar modal"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-4 space-y-2.5 max-h-[80dvh] overflow-y-auto">
          {alerts.map((al) => (
            <div
              key={al.id}
              onClick={() => {
                if (al.code && onSelectAlert) {
                  onSelectAlert(al.code);
                  onClose();
                }
              }}
              className={`p-3 rounded-lg border transition-all flex flex-col gap-1 cursor-pointer ${
                isLight
                  ? 'bg-[#f8fafc] border-slate-200 hover:border-[#34b344] hover:bg-slate-100/80 shadow-xs'
                  : 'bg-[#0c1017] border-[#283548] hover:border-[#34b344]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-semibold text-xs flex items-center gap-1.5 ${
                    al.severity === 'grave'
                      ? 'text-[#ef4444]'
                      : al.severity === 'alerta'
                      ? isLight ? 'text-amber-600' : 'text-[#f59e0b]'
                      : isLight ? 'text-emerald-700' : 'text-[#34b344]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      al.severity === 'grave'
                        ? 'bg-[#ef4444]'
                        : al.severity === 'alerta'
                        ? 'bg-[#f59e0b]'
                        : isLight ? 'bg-emerald-600' : 'bg-[#34b344]'
                    }`}
                  />
                  {al.title}
                </span>
                <span className={`text-[10px] font-tabular-data ${isLight ? 'text-slate-500' : 'text-[#94a3b8]'}`}>
                  {al.time}
                </span>
              </div>
              <p className={`text-[11px] leading-snug ${isLight ? 'text-slate-600' : 'text-[#94a3b8]'}`}>
                {al.desc}
              </p>
            </div>
          ))}
        </div>

        <div
          className={`p-3 border-t flex items-center justify-between ${
            isLight ? 'bg-[#f8fafc] border-slate-200' : 'bg-[#0c1017] border-[#283548]'
          }`}
        >
          <span className={`text-[10px] font-tabular-data ${isLight ? 'text-slate-500' : 'text-[#94a3b8]'}`}>
            Casagrande CCO Telemetria em Tempo Real
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1 rounded bg-[#2ca03a] hover:bg-[#34b344] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
