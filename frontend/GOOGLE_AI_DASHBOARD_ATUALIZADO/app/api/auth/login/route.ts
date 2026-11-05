import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeCorporateUsername,
  verifyCorporateCredentials,
  createSignedSessionToken,
  fetchCorporateAuthStateFromSupabase,
  hashCorporatePassword,
  DEFAULT_CORPORATE_HASH,
} from '@/lib/auth-crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawUsername = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const passwordChangedLocally = Boolean(body.passwordChangedLocally);

    if (!rawUsername || !password) {
      return NextResponse.json(
        { detail: 'Informe usuário e senha para autenticar.' },
        { status: 400 }
      );
    }

    const cleanUsername = normalizeCorporateUsername(rawUsername);

    // Consulta o estado de autenticação e o hash personalizado persistido no Supabase
    const authState = await fetchCorporateAuthStateFromSupabase(cleanUsername);
    if (!authState) {
      return NextResponse.json(
        { detail: 'Credenciais incorretas: Usuário ou senha inválidos.' },
        { status: 401 }
      );
    }

    // Se o cliente sinalizou que a senha padrão já foi alterada ou se o perfil não está mais
    // em primeiro acesso e existe bloqueio de senha padrão, rejeita a senha padrão.
    const candidateHash = hashCorporatePassword(password);
    if (
      (authState.customPasswordHash || passwordChangedLocally) &&
      candidateHash === DEFAULT_CORPORATE_HASH
    ) {
      return NextResponse.json(
        {
          detail:
            'A senha padrão inicial foi revogada após a redefinição de credenciais. Utilize sua senha pessoal atual.',
        },
        { status: 401 }
      );
    }

    // IMPORTANTE: Nunca confia em customHash enviado pelo cliente (prevenção de CWE-602).
    // Utiliza exclusivamente o customPasswordHash autoritativo do Supabase.
    const verifiedProfile = verifyCorporateCredentials(
      cleanUsername,
      password,
      authState.customPasswordHash
    );

    if (!verifiedProfile) {
      return NextResponse.json(
        { detail: 'Credenciais incorretas: Usuário ou senha inválidos.' },
        { status: 401 }
      );
    }

    const effectiveProfile = {
      ...verifiedProfile,
      id: authState.profileId || verifiedProfile.id,
      name: authState.name || verifiedProfile.name,
      email: authState.email || verifiedProfile.email,
      role: authState.role,
      roleLabel: authState.roleLabel,
    };

    const accessToken = createSignedSessionToken(
      effectiveProfile,
      authState.customPasswordHash
    );

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: 'bearer',
        id: effectiveProfile.id,
        username: effectiveProfile.username,
        role: effectiveProfile.role,
        role_label: effectiveProfile.roleLabel,
        nome_completo: effectiveProfile.name,
        email: effectiveProfile.email,
        primeiro_acesso: authState.primeiroAcesso,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { detail: 'Erro interno ao processar autenticação.' },
      { status: 500 }
    );
  }
}
