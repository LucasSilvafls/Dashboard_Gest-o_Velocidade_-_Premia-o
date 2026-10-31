'use client';

import React from 'react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

export default function UserProfileModal({ isOpen, onClose, onLogout }: UserProfileModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-[#131923] border border-[#283548] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#f1f5f9]"
      >
        <div className="p-4 bg-[#0c1017] border-b border-[#283548] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#34b344] text-[20px]">
              badge
            </span>
            <h3 className="font-bold text-white text-sm">
              Perfil do Administrador CCO
            </h3>
          </div>
          <button
            onClick={onClose}
            className="size-9 min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-[#1c2432] transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 text-xs font-body-md max-h-[85dvh] overflow-y-auto">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0c1017] border border-[#283548]">
            <div className="w-12 h-12 rounded-full bg-[#2ca03a] flex items-center justify-center text-white text-lg font-bold shadow-md">
              <span className="material-symbols-outlined text-[24px]">person</span>
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Administrador CCO</h4>
              <p className="text-xs text-[#34b344] font-semibold">
                Centro de Controle Operacional
              </p>
              <p className="text-[11px] text-[#94a3b8] font-tabular-data">
                admin.cco@casagrandetransportes.com.br
              </p>
            </div>
          </div>

          <div className="space-y-2 font-tabular-data">
            <div className="flex justify-between p-2 rounded bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8]">Unidade:</span>
              <span className="text-white font-semibold">Casagrande Locações & Transportes</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8]">Frota sob Gestão:</span>
              <span className="text-white font-semibold">35 Veículos Florestais</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8]">Nível de Acesso:</span>
              <span className="text-[#34b344] font-bold">SUPERVISÃO TOTAL / AUDITORIA</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8]">Sessão:</span>
              <span className="text-[#34b344] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34b344] animate-pulse" />
                AUTENTICADA (2FA)
              </span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-[#0c1017] border-t border-[#283548] flex items-center justify-between">
          {onLogout ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Encerrar Sessão</span>
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#2ca03a] hover:bg-[#34b344] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
