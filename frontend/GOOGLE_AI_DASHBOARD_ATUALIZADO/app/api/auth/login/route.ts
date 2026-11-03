import { NextRequest, NextResponse } from 'next/server';
import {
  verifyCorporateCredentials,
  createSignedSessionToken,
} from '@/lib/auth-crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const customHash = typeof body.customHash === 'string' ? body.customHash : null;

    if (!username || !password) {
      return NextResponse.json(
        { detail: 'Informe usuário e senha para autenticar.' },
        { status: 400 }
      );
    }

    const verifiedProfile = verifyCorporateCredentials(username, password, customHash);
    if (!verifiedProfile) {
      return NextResponse.json(
        { detail: 'Credenciais incorretas: Usuário ou senha inválidos.' },
        { status: 401 }
      );
    }

    const accessToken = createSignedSessionToken(verifiedProfile);

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: 'bearer',
        username: verifiedProfile.username,
        role: verifiedProfile.role,
        nome_completo: verifiedProfile.name,
        email: verifiedProfile.email,
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
