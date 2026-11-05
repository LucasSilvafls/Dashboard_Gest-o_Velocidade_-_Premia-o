import { NextRequest, NextResponse } from 'next/server';
import {
  verifySignedSessionToken,
  fetchCorporateAuthStateFromSupabase,
  DEFAULT_CORPORATE_HASH,
} from '@/lib/auth-crypto';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  const initialPayload = verifySignedSessionToken(token);
  if (!initialPayload) {
    return NextResponse.json(
      { detail: 'Token de sessão inválido ou expirado.' },
      { status: 401 }
    );
  }

  const authState = await fetchCorporateAuthStateFromSupabase(initialPayload.sub);
  if (!authState) {
    return NextResponse.json(
      { detail: 'Perfil de operador não encontrado.' },
      { status: 401 }
    );
  }

  // Revalida o token contra o hash de senha ativo no Supabase (invalida sessões antigas após troca de senha)
  const verifiedPayload = verifySignedSessionToken(
    token,
    authState.customPasswordHash || DEFAULT_CORPORATE_HASH
  );
  if (!verifiedPayload) {
    return NextResponse.json(
      { detail: 'Sessão expirada devido à alteração de credenciais. Faça login novamente.' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      id: authState.profileId || `cco-user-${verifiedPayload.sub}`,
      username: authState.username,
      email: authState.email,
      role: authState.role,
      role_label: authState.roleLabel,
      nome_completo: authState.name,
      primeiro_acesso: authState.primeiroAcesso,
      ativo: true,
    },
    { status: 200 }
  );
}
