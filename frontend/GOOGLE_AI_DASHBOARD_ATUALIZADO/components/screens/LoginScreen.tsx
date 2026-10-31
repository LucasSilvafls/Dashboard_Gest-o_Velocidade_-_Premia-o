'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabaseClient';
import {
  CASAGRANDE_LOGO_DARK_URL,
  CASAGRANDE_LOGO_LIGHT_URL,
} from '@/components/Sidebar';
import { Eye, EyeOff, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';

export interface AuthenticatedUser {
  id?: string;
  name: string;
  username: string;
  role: string;
  email: string;
  primeiroAcesso?: boolean;
}

interface LoginScreenProps {
  onLoginSuccess: (user: AuthenticatedUser) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Iniciar campos vazios por padrão (sem deixar admin pré-preenchido)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMsg('Por favor, informe seu usuário (ex: operadorcasagrande).');
      return;
    }

    if (!password || password.length < 4) {
      setErrorMsg('A senha precisa ter pelo menos 4 caracteres.');
      return;
    }

    // Sintetiza o email corporativo para autenticação no Supabase Auth
    const effectiveEmail = cleanUsername.includes('@')
      ? cleanUsername
      : `${cleanUsername}@casagrandetransportes.com.br`;

    setIsLoading(true);

    try {
      // 1. Consultar dados do perfil na tabela perfis_usuarios para checar primeiro_acesso
      let profileData: any = null;
      try {
        const { data: prof } = await supabase
          .from('perfis_usuarios')
          .select('*')
          .or(`username.eq.${cleanUsername},email.eq.${effectiveEmail}`)
          .maybeSingle();
        profileData = prof;
      } catch (eProf) {
        console.warn('Aviso: falha ao consultar perfis_usuarios:', eProf);
      }

      // 2. Verificar se o usuário já alterou a senha anteriormente
      const hasChangedLocally =
        typeof window !== 'undefined' &&
        localStorage.getItem(`csg_pw_changed_${cleanUsername}`) === 'true';
      const customSavedPass =
        typeof window !== 'undefined'
          ? localStorage.getItem(`csg_custom_pass_${cleanUsername}`)
          : null;
      const alreadyChangedInProfile = profileData && profileData.primeiro_acesso === false;
      const isAlreadyChanged = Boolean(hasChangedLocally || alreadyChangedInProfile);

      // Se a senha já foi alterada anteriormente, a senha padrão Casagrande@2026 é BLOQUEADA
      if (password === 'Casagrande@2026' && isAlreadyChanged) {
        setErrorMsg('A senha padrão inicial já foi alterada anteriormente. Por favor, utilize sua nova senha pessoal.');
        setIsLoading(false);
        return;
      }

      // 3. Tentar login no Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: effectiveEmail,
        password,
      });

      if (!error && data?.user) {
        const meta = data.user.user_metadata || {};
        const isDefaultPass = password === 'Casagrande@2026';
        const needsFirstAccess = !isAlreadyChanged && (profileData?.primeiro_acesso ?? isDefaultPass);

        onLoginSuccess({
          id: data.user.id || profileData?.id,
          name:
            profileData?.nome ||
            meta.nome ||
            (cleanUsername.includes('rafael') ? 'Rafael Casagrande' : 'Operador CCO'),
          username: profileData?.username || cleanUsername,
          role:
            profileData?.role === 'admin' || meta.role === 'admin'
              ? 'Supervisor de Telemetria & Operações'
              : 'Visualizador CCO',
          email: data.user.email || effectiveEmail,
          primeiroAcesso: Boolean(needsFirstAccess),
        });
        return;
      }

      // 4. Fallbacks controlados:
      // Se a senha digitada bate com a nova senha customizada gravada
      if (customSavedPass && customSavedPass === password) {
        onLoginSuccess({
          id: profileData?.id,
          name: profileData?.nome || (cleanUsername.includes('rafael') ? 'Rafael Casagrande' : 'Administrador CCO'),
          username: profileData?.username || cleanUsername,
          role: profileData?.role || 'Supervisor de Telemetria & Operações',
          email: effectiveEmail,
          primeiroAcesso: false,
        });
        return;
      }

      // Se é o legítimo primeiro acesso e a senha informada é a padrão
      if (!isAlreadyChanged && password === 'Casagrande@2026') {
        const isRafael = cleanUsername.includes('rafael');
        onLoginSuccess({
          id: profileData?.id,
          name: isRafael ? 'Rafael Casagrande' : 'Administrador CCO',
          username: cleanUsername,
          role: 'Supervisor de Telemetria & Operações',
          email: effectiveEmail,
          primeiroAcesso: true,
        });
        return;
      }

      setErrorMsg('Usuário ou senha incorretos no CCO.');
    } catch {
      setErrorMsg('Erro ao conectar com o serviço de autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  const isLight = mounted && theme === 'light';

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-[#090d14] dark:bg-[#090d14] light:bg-[#f1f5f9] text-[#f1f5f9] relative overflow-hidden transition-colors duration-200">
      {/* Background Ambient Glow (matching Casagrande Green) */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] rounded-full blur-[140px] opacity-20 dark:opacity-20 light:opacity-10 bg-[#34b344]"
        aria-hidden="true"
      />

      {/* Floating Theme Toggle (Light / Dark) */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="size-9 rounded-xl border border-[#283548] dark:border-[#283548] light:border-slate-300 bg-[#131923] dark:bg-[#131923] light:bg-white text-[#94a3b8] dark:text-[#94a3b8] light:text-slate-700 hover:text-white dark:hover:text-white light:hover:text-slate-900 transition-colors flex items-center justify-center cursor-pointer shadow-md"
          title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          aria-label="Alternar tema de cores"
        >
          <span className="material-symbols-outlined text-[19px]">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
      </div>

      {/* Centered Login Card */}
      <main className="w-full max-w-[460px] z-10 animate-fade-in my-auto">
        <div className="rounded-3xl bg-[#131923]/95 dark:bg-[#131923]/95 light:bg-white/95 backdrop-blur-xl border border-[#283548] dark:border-[#283548] light:border-slate-200/90 shadow-2xl p-6 sm:p-8 flex flex-col transition-all">
          
          {/* Logo & Platform Title */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="mb-4 flex items-center justify-center min-h-[44px]">
              {/* Renderiza apenas uma única imagem de logotipo conforme o tema ativo */}
              <Image
                src={isLight ? CASAGRANDE_LOGO_LIGHT_URL : CASAGRANDE_LOGO_DARK_URL}
                alt="Casagrande Locações & Transportes"
                width={220}
                height={40}
                priority
                className="h-10 w-auto object-contain max-w-[220px]"
              />
            </div>

            <h1 className="text-[17px] sm:text-xl md:text-[22px] font-bold tracking-tight text-white dark:text-white light:text-slate-900">
              Gestão de Velocidades e Premiação
            </h1>
            <p className="text-xs text-[#94a3b8] dark:text-[#94a3b8] light:text-slate-500 mt-1.5">
              Telemetria e controle operacional de frotas
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400 dark:text-red-400 light:text-red-600 animate-fade-in">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Username Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-username"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] dark:text-[#94a3b8] light:text-slate-600"
              >
                Usuário do Sistema (ex: operadorcasagrande)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94a3b8]">
                  <User className="size-4" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: operadorcasagrande"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1c2432] dark:bg-[#1c2432] light:bg-slate-50 border border-[#283548] dark:border-[#283548] light:border-slate-300 text-white dark:text-white light:text-slate-900 placeholder:text-[#64748b] text-sm focus:outline-none focus:border-[#34b344] focus:ring-1 focus:ring-[#34b344] transition-all font-body-md"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] dark:text-[#94a3b8] light:text-slate-600"
                >
                  Senha de Acesso
                </label>
                <button
                  type="button"
                  onClick={() => alert('Para redefinição de chave ou suporte CCO, contate o Administrador CCO.')}
                  className="text-[11px] font-semibold text-[#34b344] hover:underline cursor-pointer"
                >
                  Esqueceu?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94a3b8]">
                  <Lock className="size-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-[#1c2432] dark:bg-[#1c2432] light:bg-slate-50 border border-[#283548] dark:border-[#283548] light:border-slate-300 text-white dark:text-white light:text-slate-900 placeholder:text-[#64748b] text-sm focus:outline-none focus:border-[#34b344] focus:ring-1 focus:ring-[#34b344] transition-all font-body-md"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94a3b8] hover:text-white dark:hover:text-white light:hover:text-slate-900 transition-colors cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember access checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 rounded bg-[#1c2432] border-[#283548] text-[#34b344] focus:ring-[#34b344] accent-[#34b344] cursor-pointer"
              />
              <label
                htmlFor="remember-me"
                className="text-xs text-[#94a3b8] dark:text-[#94a3b8] light:text-slate-600 select-none cursor-pointer"
              >
                Lembrar credencial neste navegador
              </label>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-[#2ca03a] hover:bg-[#34b344] active:scale-[0.99] transition-all shadow-lg shadow-[#2ca03a]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Autenticando CCO...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
