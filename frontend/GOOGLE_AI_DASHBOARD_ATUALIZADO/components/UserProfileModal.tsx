'use client';

import React from 'react';
import { KeyRound, Shield, LogOut, CheckCircle } from 'lucide-react';

export interface UserProfileData {
  id?: string;
  name: string;
  username: string;
  email: string;
  role: string;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
  user?: UserProfileData | null;
  onChangePassword?: () => void;
}

export default function UserProfileModal({
  isOpen,
  onClose,
  onLogout,
  user,
  onChangePassword,
}: UserProfileModalProps) {
  if (!isOpen) return null;

  const displayName = user?.name || 'Administrador CCO';
  const displayUsername = user?.username || 'admincasagrande';
  const displayEmail = user?.email || `${displayUsername}@casagrandetransportes.com.br`;
  const displayRole = user?.role === 'admin' || user?.role?.includes('Supervisor')
    ? 'Supervisor de Telemetria & Operações'
    : 'Visualizador CCO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#131923] border border-[#283548] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#f1f5f9]">
        {/* Header */}
        <div className="p-4 bg-[#0c1017] border-b border-[#283548] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#34b344] text-[20px]">
              badge
            </span>
            <h3 className="font-bold text-white text-sm">
              Perfil do Operador CCO
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

        {/* Informações do Usuário */}
        <div className="p-4 sm:p-5 space-y-4 text-xs font-body-md max-h-[85dvh] overflow-y-auto">
          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#0c1017] border border-[#283548]">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2ca03a] to-[#34b344] flex items-center justify-center text-white text-lg font-bold shadow-md shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-white text-sm truncate">
                {displayName}
              </h4>
              <p className="text-xs text-[#34b344] font-semibold mt-0.5">
                {displayRole}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-[#94a3b8] font-tabular-data">
                <span className="bg-[#1c2432] px-1.5 py-0.5 rounded text-white font-medium border border-[#283548]">
                  @{displayUsername}
                </span>
                <span className="truncate">{displayEmail}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 font-tabular-data">
            <div className="flex justify-between p-2.5 rounded-lg bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8]">Unidade:</span>
              <span className="text-white font-semibold">Casagrande Locações & Transportes</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8]">Frota sob Gestão:</span>
              <span className="text-white font-semibold">35 Veículos Florestais</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8]">Nível de Acesso:</span>
              <span className="text-[#34b344] font-bold">SUPERVISÃO TOTAL / SESMT</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-[#0c1017] border border-[#283548]">
              <span className="text-[#94a3b8]">Sessão CCO:</span>
              <span className="text-[#34b344] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#34b344] animate-pulse" />
                AUTENTICADA
              </span>
            </div>
          </div>

          {/* Opção de Redefinir Senha */}
          {onChangePassword && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onChangePassword();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-[#1c2432] hover:bg-[#283548] border border-[#283548] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <KeyRound className="size-4 text-[#34b344]" />
                <span>Alterar Minha Senha de Acesso</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0c1017] border-t border-[#283548] flex items-center justify-between">
          {onLogout ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="size-4" />
              <span>Encerrar Sessão</span>
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#2ca03a] hover:bg-[#34b344] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
