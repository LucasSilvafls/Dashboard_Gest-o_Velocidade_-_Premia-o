import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeCorporateUsername,
  verifyCorporateCredentials,
  hashCorporatePassword,
  createSignedSessionToken,
  fetchCorporateAuthStateFromSupabase,
  saveCorporatePasswordHashToSupabase,
  DEFAULT_CORPORATE_HASH,
  constantTimeEqual,
} from '@/lib/auth-crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawUsername = typeof body.username === 'string' ? body.username.trim() : '';
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!rawUsername || !currentPassword || !newPassword) {
      return NextResponse.json(
        { detail: 'Informe o usuário, a senha atual e a nova senha.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { detail: 'A nova senha deve ter no mínimo 6 caracteres.' },
        { status: 400 }
      );
    }

    const newPasswordHash = hashCorporatePassword(newPassword);
    if (
      newPassword.toLowerCase() === 'casagrande@2026' ||
      newPassword.toLowerCase() === 'admin@casagrande2026' ||
      constantTimeEqual(newPasswordHash, DEFAULT_CORPORATE_HASH)
    ) {
      return NextResponse.json(
        { detail: 'A nova senha não pode ser igual à senha padrão corporativa.' },
        { status: 400 }
      );
    }

    const cleanUsername = normalizeCorporateUsername(rawUsername);
    const authState = await fetchCorporateAuthStateFromSupabase(cleanUsername);
    if (!authState) {
      return NextResponse.json(
        { detail: 'Usuário corporativo não encontrado.' },
        { status: 404 }
      );
    }

    // Reautenticação obrigatória: valida a senha atual contra o hash ativo no Supabase
    const verifiedCurrent = verifyCorporateCredentials(
      cleanUsername,
      currentPassword,
      authState.customPasswordHash
    );

    if (!verifiedCurrent) {
      return NextResponse.json(
        { detail: 'A senha atual informada está incorreta.' },
        { status: 401 }
      );
    }

    const currentPasswordHash = hashCorporatePassword(currentPassword);
    if (constantTimeEqual(newPasswordHash, currentPasswordHash)) {
      return NextResponse.json(
        { detail: 'A nova senha deve ser diferente da senha atual.' },
        { status: 400 }
      );
    }

    // Persiste o novo hash SHA-256 no Supabase (public.perfis_usuarios) e desativa primeiro_acesso
    const saveResult = await saveCorporatePasswordHashToSupabase(
      cleanUsername,
      newPasswordHash
    );

    if (!saveResult.ok) {
      return NextResponse.json(
        {
          detail:
            saveResult.error || 'Não foi possível persistir a nova senha no banco de dados.',
        },
        { status: 500 }
      );
    }

    const effectiveProfile = {
      ...verifiedCurrent,
      id: authState.profileId || verifiedCurrent.id,
      name: authState.name || verifiedCurrent.name,
      email: authState.email || verifiedCurrent.email,
      role: authState.role,
      roleLabel: authState.roleLabel,
    };

    // Emite novo token JWT assinado vinculado à nova versão de senha (invalidando tokens anteriores)
    const accessToken = createSignedSessionToken(effectiveProfile, newPasswordHash);

    return NextResponse.json(
      {
        ok: true,
        access_token: accessToken,
        password_hash: newPasswordHash,
        username: cleanUsername,
        role: effectiveProfile.role,
        role_label: effectiveProfile.roleLabel,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { detail: 'Erro interno ao processar alteração de senha.' },
      { status: 500 }
    );
  }
}
