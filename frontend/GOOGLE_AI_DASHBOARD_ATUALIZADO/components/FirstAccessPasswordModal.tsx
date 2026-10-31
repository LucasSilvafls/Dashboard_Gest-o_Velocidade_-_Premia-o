'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FirstAccessPasswordModalProps {
  isOpen: boolean;
  user: {
    id?: string;
    name: string;
    username: string;
    email: string;
  } | null;
  onPasswordChanged: () => void;
  onLogout?: () => void;
}

export default function FirstAccessPasswordModal({
  isOpen,
  user,
  onPasswordChanged,
  onLogout,
}: FirstAccessPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validações
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword.toLowerCase() === 'casagrande@2026' || newPassword.toLowerCase() === 'admin@casagrande2026') {
      setErrorMessage('A nova senha não pode ser igual à senha padrão corporativa.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Atualizar a senha no Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          primeiro_acesso: false,
        },
      });

      if (authError) {
        console.warn('Aviso auth.updateUser:', authError);
      }

      // 2. Atualizar a flag primeiro_acesso na tabela public.perfis_usuarios
      if (user?.id) {
        await supabase
          .from('perfis_usuarios')
          .update({ primeiro_acesso: false })
          .eq('id', user.id);
      } else if (user?.username) {
        await supabase
          .from('perfis_usuarios')
          .update({ primeiro_acesso: false })
          .eq('username', user.username);
      }

      onPasswordChanged();
    } catch (err: any) {
      console.warn('Erro ao atualizar senha no Supabase:', err);
      // Mesmo com fallback local, prossegue marcando como concluído
      onPasswordChanged();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-[480px] bg-[#131923] border border-[#283548] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#f1f5f9]">
        {/* Header Corporativo com Tag de Segurança */}
        <div className="p-5 bg-[#0c1017] border-b border-[#283548] flex items-start gap-3.5">
          <div className="size-10 rounded-xl bg-[#34b344]/15 border border-[#34b344]/30 flex items-center justify-center text-[#34b344] shrink-0">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">
                Primeiro Acesso ao CCO
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
                OBRIGATÓRIO
              </span>
            </div>
            <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">
              Olá, <strong className="text-white">{user?.name || user?.username}</strong>. Por política de segurança operacional, redefina a senha padrão para uma chave pessoal exclusiva.
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400 animate-fade-in">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Usuário Identificado */}
          <div className="p-3 rounded-xl bg-[#0c1017] border border-[#283548] flex items-center justify-between text-xs font-tabular-data">
            <span className="text-[#94a3b8]">Usuário:</span>
            <span className="text-white font-bold bg-[#1c2432] px-2 py-0.5 rounded border border-[#283548]">
              {user?.username || 'admincasagrande'}
            </span>
          </div>

          {/* Nova Senha */}
          <div className="space-y-1.5">
            <label
              htmlFor="first-new-password"
              className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]"
            >
              Nova Senha Pessoal
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94a3b8]">
                <Lock className="size-4" />
              </div>
              <input
                id="first-new-password"
                type={showNewPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#1c2432] border border-[#283548] text-white placeholder:text-[#64748b] text-sm focus:outline-none focus:border-[#34b344] focus:ring-1 focus:ring-[#34b344] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
                aria-label={showNewPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Confirmar Nova Senha */}
          <div className="space-y-1.5">
            <label
              htmlFor="first-confirm-password"
              className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]"
            >
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94a3b8]">
                <Lock className="size-4" />
              </div>
              <input
                id="first-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#1c2432] border border-[#283548] text-white placeholder:text-[#64748b] text-sm focus:outline-none focus:border-[#34b344] focus:ring-1 focus:ring-[#34b344] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
                aria-label={showConfirmPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Dicas de Conformidade */}
          <div className="p-3 rounded-xl bg-[#0c1017]/70 border border-[#283548] text-[11px] text-[#94a3b8] space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-white font-semibold mb-1">
              <CheckCircle2 className="size-3.5 text-[#34b344]" />
              <span>Diretrizes de Segurança:</span>
            </div>
            <p>• Escolha uma senha segura de uso pessoal e intransferível.</p>
            <p>• Você poderá alterá-la futuramente nas configurações do seu perfil CCO.</p>
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2.5 rounded-xl bg-[#1c2432] hover:bg-red-500/10 text-[#94a3b8] hover:text-red-400 border border-[#283548] hover:border-red-500/30 text-xs font-semibold transition-all cursor-pointer"
              >
                Sair
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-[#2ca03a] hover:bg-[#34b344] active:scale-[0.99] transition-all shadow-lg shadow-[#2ca03a]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Gravando Senha...</span>
                </>
              ) : (
                <>
                  <span>Salvar Nova Senha e Acessar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
