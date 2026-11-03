import { NextRequest, NextResponse } from 'next/server';
import { verifySignedSessionToken } from '@/lib/auth-crypto';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  const payload = verifySignedSessionToken(token);
  if (!payload) {
    return NextResponse.json(
      { detail: 'Token de sessão inválido ou expirado.' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      id: `cco-user-${payload.sub}`,
      username: payload.sub,
      email: payload.email,
      role: payload.role,
      nome_completo: payload.name,
      ativo: true,
    },
    { status: 200 }
  );
}
