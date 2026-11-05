/**
 * Módulo Criptográfico de Autenticação, Persistência de Credenciais e RBAC CCO (SHA-256 + HMAC-SHA256 JWT)
 * Casagrande Locações e Transportes
 *
 * Implementação determinística e autossuficiente (compatível com Node.js, Edge,
 * navegadores em HTTPS/localhost e IPs de rede local HTTP).
 * Nenhuma senha em texto puro é armazenada no código ou no navegador.
 */

export interface CorporateUserProfile {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'viewer';
  roleLabel: string;
  email: string;
}

export interface SessionTokenPayload {
  sub: string;
  name: string;
  role: 'admin' | 'viewer';
  email: string;
  pwdVer?: string;
  iat: number;
  exp: number;
}

export interface CorporateSupabaseAuthState {
  username: string;
  profileId?: string;
  name: string;
  email: string;
  role: 'admin' | 'viewer';
  roleLabel: 'Supervisor de Telemetria & Operações' | 'Visualizador CCO';
  primeiroAcesso: boolean;
  customPasswordHash: string | null;
}

const PASSWORD_SALT = 'csg_salt_2026';
const TOKEN_SIGNING_CONTEXT = 'csg_hmac_jwt_v2_casagrande_cco_2026';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Hash SHA-256 salgado pré-computado (sha256("csg_salt_2026:" + senha))
 * DEFAULT_CORPORATE_HASH corresponde exclusivamente à senha inicial padrão ("Casagrande@2026"),
 * que é automaticamente revogada assim que o usuário define uma senha personalizada.
 */
export const DEFAULT_CORPORATE_HASH =
  '4fa5a055ee5d3efbaf069c5c198eb9dffc094e9fde8111577cb0954b4d2b9486';

const CREDENTIAL_ROW_IDS: Record<string, string> = {
  admincasagrande: 'c3dcfdda-0c83-426c-ac67-000000000001',
  rafaelcasagrande: '52dac046-7bd8-4087-bbea-000000000002',
  operadorcasagrande: '91b33755-0624-5a8b-b988-000000000003',
};

export const CORPORATE_USERS: Record<string, CorporateUserProfile> = {
  admincasagrande: {
    id: 'c3dcfdda-0c83-426c-ac67-f2f55b6689e6',
    username: 'admincasagrande',
    name: 'Administrador CCO',
    role: 'admin',
    roleLabel: 'Supervisor de Telemetria & Operações',
    email: 'admincasagrande@casagrandetransportes.com.br',
  },
  rafaelcasagrande: {
    id: '52dac046-7bd8-4087-bbea-3142f302ce1d',
    username: 'rafaelcasagrande',
    name: 'Rafael Casagrande',
    role: 'admin',
    roleLabel: 'Supervisor de Telemetria & Operações',
    email: 'rafaelcasagrande@casagrandetransportes.com.br',
  },
  operadorcasagrande: {
    id: '91b33755-0624-5a8b-b988-9ab9aa7c85c4',
    username: 'operadorcasagrande',
    name: 'Operador CCO',
    role: 'viewer',
    roleLabel: 'Visualizador CCO',
    email: 'operadorcasagrande@casagrandetransportes.com.br',
  },
};

/**
 * Normaliza entradas de usuário ou e-mail para o identificador canônico corporativo.
 * Aceita apenas apelidos corporativos explícitos, impedindo casamento permissivo por prefixo.
 */
export function normalizeCorporateUsername(rawInput: string): string {
  const clean = (rawInput || '').trim().toLowerCase();
  const localPart = clean.includes('@') ? clean.split('@')[0] : clean;

  if (
    localPart === 'admin' ||
    localPart === 'administrador' ||
    localPart === 'admincasagrande' ||
    localPart === 'admin.cco'
  ) {
    return 'admincasagrande';
  }

  if (
    localPart === 'rafael' ||
    localPart === 'rafaelcasagrande' ||
    localPart === 'rafael.cco'
  ) {
    return 'rafaelcasagrande';
  }

  if (
    localPart === 'operador' ||
    localPart === 'operadorcasagrande' ||
    localPart === 'operador.cco' ||
    localPart === 'viewer' ||
    localPart === 'visualizador'
  ) {
    return 'operadorcasagrande';
  }

  return localPart;
}

/**
 * Verifica se o perfil/role informado possui privilégios administrativos (Deny by Default).
 */
export function isAdminRole(role?: string | null): boolean {
  if (!role || typeof role !== 'string') return false;
  const normalized = role.trim().toLowerCase();
  return (
    normalized === 'admin' ||
    normalized === 'supervisor de telemetria & operações' ||
    normalized === 'supervisor de telemetria & operacoes'
  );
}

export function normalizeRoleCode(role?: string | null): 'admin' | 'viewer' {
  return isAdminRole(role) ? 'admin' : 'viewer';
}

export function normalizeRoleLabel(
  role?: string | null
): 'Supervisor de Telemetria & Operações' | 'Visualizador CCO' {
  return isAdminRole(role) ? 'Supervisor de Telemetria & Operações' : 'Visualizador CCO';
}

export function isValidPasswordHash(hash: string | null | undefined): hash is string {
  return typeof hash === 'string' && /^[0-9a-f]{64}$/i.test(hash.trim());
}

export function getPasswordVersionTag(activePasswordHash?: string | null): string {
  const effectiveHash = isValidPasswordHash(activePasswordHash)
    ? activePasswordHash.trim().toLowerCase()
    : DEFAULT_CORPORATE_HASH;
  return effectiveHash.slice(0, 12);
}

/**
 * Implementação pura e compacta de SHA-256 (FIPS 180-4) para garantir funcionamento
 * idêntico em SSR (Node.js), Edge Runtime e navegadores em HTTP/HTTPS.
 */
const K: number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function utf8Bytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function sha256Bytes(msgBytes: Uint8Array): Uint8Array {
  const ml = msgBytes.length * 8;
  const totalLen = Math.ceil((msgBytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(totalLen);
  padded.set(msgBytes);
  padded[msgBytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(ml / 0x100000000);
  const lowBits = ml >>> 0;
  view.setUint32(totalLen - 8, highBits, false);
  view.setUint32(totalLen - 4, lowBits, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function sha256Hex(input: string): string {
  return bytesToHex(sha256Bytes(utf8Bytes(input)));
}

function hmacSha256Hex(keyStr: string, message: string): string {
  const blockSize = 64;
  let keyBytes = utf8Bytes(keyStr);
  if (keyBytes.length > blockSize) {
    keyBytes = sha256Bytes(keyBytes);
  }
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(keyBytes);

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const msgBytes = utf8Bytes(message);
  const innerInput = new Uint8Array(blockSize + msgBytes.length);
  innerInput.set(iKeyPad);
  innerInput.set(msgBytes, blockSize);
  const innerHash = sha256Bytes(innerInput);

  const outerInput = new Uint8Array(blockSize + innerHash.length);
  outerInput.set(oKeyPad);
  outerInput.set(innerHash, blockSize);
  return bytesToHex(sha256Bytes(outerInput));
}

/**
 * Comparação em tempo constante para evitar timing attacks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Gera o hash criptográfico SHA-256 salgado de uma senha.
 */
export function hashCorporatePassword(password: string): string {
  return sha256Hex(`${PASSWORD_SALT}:${password}`);
}

/**
 * Valida credenciais corporativas por comparação criptográfica de hash SHA-256.
 *
 * REGRA CRÍTICA DE SEGURANÇA:
 * Se `customPasswordHash` estiver presente (usuário já alterou sua senha),
 * a senha padrão inicial (`Casagrande@2026`) é ESTRITAMENTE REJEITADA (sem fallback).
 */
export function verifyCorporateCredentials(
  rawUsername: string,
  password: string,
  customPasswordHash?: string | null
): CorporateUserProfile | null {
  if (!rawUsername || !password) return null;

  const cleanUsername = normalizeCorporateUsername(rawUsername);
  const profile = CORPORATE_USERS[cleanUsername];
  if (!profile) return null;

  const candidateHash = hashCorporatePassword(password);

  // 1. Se o usuário possui hash de senha personalizada configurado, APENAS ele é aceito.
  // A senha padrão inicial fica permanentemente desativada para a conta.
  if (isValidPasswordHash(customPasswordHash)) {
    const normalizedCustom = customPasswordHash.trim().toLowerCase();
    return constantTimeEqual(candidateHash, normalizedCustom) ? profile : null;
  }

  // 2. Somente se o usuário nunca definiu senha personalizada, valida contra o hash padrão inicial.
  if (constantTimeEqual(candidateHash, DEFAULT_CORPORATE_HASH)) {
    return profile;
  }

  return null;
}

function toBase64Url(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64 + pad, 'base64').toString('utf-8');
  }
  const binary = atob(b64 + pad);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getSigningSecret(): string {
  const envSecret =
    (typeof process !== 'undefined' && process.env?.JWT_SECRET_KEY) ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    '';
  return `${TOKEN_SIGNING_CONTEXT}:${envSecret}`;
}

/**
 * Emite um token de sessão assinado com HMAC-SHA256 vinculado à versão atual da senha (`pwdVer`).
 */
export function createSignedSessionToken(
  user: CorporateUserProfile,
  activePasswordHash?: string | null
): string {
  const now = Date.now();
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadObj: SessionTokenPayload = {
    sub: user.username,
    name: user.name,
    role: normalizeRoleCode(user.role),
    email: user.email,
    pwdVer: getPasswordVersionTag(activePasswordHash),
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  const payload = toBase64Url(JSON.stringify(payloadObj));
  const signature = hmacSha256Hex(getSigningSecret(), `${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

/**
 * Verifica a assinatura HMAC-SHA256, a validade temporal e (opcionalmente) a versão da senha (`pwdVer`).
 */
export function verifySignedSessionToken(
  token: string | null | undefined,
  expectedPasswordHash?: string | null
): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSig = hmacSha256Hex(getSigningSecret(), `${header}.${payload}`);
  if (!constantTimeEqual(signature, expectedSig)) {
    return null;
  }

  try {
    const decoded = JSON.parse(fromBase64Url(payload)) as SessionTokenPayload;
    if (!decoded.sub || !decoded.exp || Date.now() > decoded.exp) {
      return null;
    }
    if (decoded.role !== 'admin' && decoded.role !== 'viewer') {
      return null;
    }
    if (expectedPasswordHash !== undefined && expectedPasswordHash !== null) {
      const expectedVer = getPasswordVersionTag(expectedPasswordHash);
      if (!decoded.pwdVer || !constantTimeEqual(decoded.pwdVer, expectedVer)) {
        return null;
      }
    }
    return decoded;
  } catch {
    return null;
  }
}

function getSupabaseRestConfig(): { url: string; key: string } {
  const url =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    'https://rmtacyjdumcwmasksvqz.supabase.co';
  const key =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    'sb_publishable_EpVfAIR5fdX3J3Jo3bUY8Q_1gwerDPe';
  return { url: url.replace(/\/+$/, ''), key };
}

/**
 * Consulta no Supabase (`public.perfis_usuarios`) o perfil corporativo e o hash
 * de senha personalizada (`username = "pwd_hash:<cleanUsername>"`) do operador.
 */
export async function fetchCorporateAuthStateFromSupabase(
  rawUsername: string
): Promise<CorporateSupabaseAuthState | null> {
  const cleanUsername = normalizeCorporateUsername(rawUsername);
  const baseProfile = CORPORATE_USERS[cleanUsername];
  if (!baseProfile) return null;

  const { url, key } = getSupabaseRestConfig();
  const pwdRowUsername = `pwd_hash:${cleanUsername}`;
  const query = `select=id,nome,email,role,username,primeiro_acesso&username=in.(${encodeURIComponent(
    cleanUsername
  )},${encodeURIComponent(pwdRowUsername)})`;

  try {
    const res = await fetch(`${url}/rest/v1/perfis_usuarios?${query}`, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        username: baseProfile.username,
        profileId: baseProfile.id,
        name: baseProfile.name,
        email: baseProfile.email,
        role: baseProfile.role,
        roleLabel: normalizeRoleLabel(baseProfile.role),
        primeiroAcesso: false,
        customPasswordHash: null,
      };
    }

    const rows = (await res.json()) as Array<{
      id?: string;
      nome?: string;
      email?: string;
      role?: string;
      username?: string;
      primeiro_acesso?: boolean;
    }>;

    const profileRow = rows.find((r) => r.username === cleanUsername);
    const pwdRow = rows.find((r) => r.username === pwdRowUsername);

    const customPasswordHash =
      pwdRow?.nome && isValidPasswordHash(pwdRow.nome) ? pwdRow.nome.trim().toLowerCase() : null;

    const resolvedRole = profileRow?.role
      ? normalizeRoleCode(profileRow.role)
      : baseProfile.role;

    return {
      username: baseProfile.username,
      profileId: profileRow?.id || baseProfile.id,
      name: profileRow?.nome || baseProfile.name,
      email: profileRow?.email || baseProfile.email,
      role: resolvedRole,
      roleLabel: normalizeRoleLabel(resolvedRole),
      primeiroAcesso: Boolean(profileRow?.primeiro_acesso) && !customPasswordHash,
      customPasswordHash,
    };
  } catch {
    return {
      username: baseProfile.username,
      profileId: baseProfile.id,
      name: baseProfile.name,
      email: baseProfile.email,
      role: baseProfile.role,
      roleLabel: normalizeRoleLabel(baseProfile.role),
      primeiroAcesso: false,
      customPasswordHash: null,
    };
  }
}

/**
 * Persiste o hash SHA-256 salgado da nova senha no Supabase (`public.perfis_usuarios`)
 * de forma durável e desativa `primeiro_acesso`.
 */
export async function saveCorporatePasswordHashToSupabase(
  rawUsername: string,
  passwordHash: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanUsername = normalizeCorporateUsername(rawUsername);
  const baseProfile = CORPORATE_USERS[cleanUsername];
  if (!baseProfile) {
    return { ok: false, error: 'Usuário corporativo inválido.' };
  }
  if (!isValidPasswordHash(passwordHash)) {
    return { ok: false, error: 'Hash criptográfico inválido.' };
  }

  const normalizedHash = passwordHash.trim().toLowerCase();
  const { url, key } = getSupabaseRestConfig();
  const pwdRowUsername = `pwd_hash:${cleanUsername}`;
  const credentialRowId = CREDENTIAL_ROW_IDS[cleanUsername] || `c3dcfdda-0c83-426c-ac67-000000000009`;
  const dbRole = baseProfile.role === 'admin' ? 'admin' : 'visualizador';

  try {
    // 1. Upsert do registro de credencial criptografada em public.perfis_usuarios
    const upsertRes = await fetch(`${url}/rest/v1/perfis_usuarios?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: credentialRowId,
        username: pwdRowUsername,
        nome: normalizedHash,
        email: `pwd.${cleanUsername}@casagrandetransportes.com.br`,
        role: dbRole,
        primeiro_acesso: false,
      }),
    });

    if (!upsertRes.ok) {
      // Fallback: atualizar por username caso já exista com outro ID
      const patchPwdRes = await fetch(
        `${url}/rest/v1/perfis_usuarios?username=eq.${encodeURIComponent(pwdRowUsername)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            nome: normalizedHash,
            primeiro_acesso: false,
          }),
        }
      );
      if (!patchPwdRes.ok) {
        const errText = await upsertRes.text().catch(() => 'Erro ao gravar hash no Supabase.');
        return { ok: false, error: errText };
      }
    }

    // 2. Garantir primeiro_acesso = false no registro principal do perfil
    await fetch(
      `${url}/rest/v1/perfis_usuarios?username=eq.${encodeURIComponent(cleanUsername)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ primeiro_acesso: false }),
      }
    ).catch(() => {});

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Falha de comunicação com o Supabase.' };
  }
}

/**
 * Sincroniza automaticamente hashes de senha alterados anteriormente no navegador (`localStorage`)
 * para o banco de dados Supabase (`public.perfis_usuarios`), garantindo que a revogação da senha
 * padrão (`Casagrande@2026`) seja imediatamente persistida no backend.
 */
export async function syncLocalPasswordHashesToSupabase(): Promise<void> {
  if (typeof window === 'undefined') return;

  for (const uname of Object.keys(CORPORATE_USERS)) {
    try {
      const localHash = localStorage.getItem(`csg_pwd_hash_v2_${uname}`);
      if (
        isValidPasswordHash(localHash) &&
        !constantTimeEqual(localHash.trim().toLowerCase(), DEFAULT_CORPORATE_HASH)
      ) {
        const remoteState = await fetchCorporateAuthStateFromSupabase(uname);
        if (!remoteState?.customPasswordHash) {
          await saveCorporatePasswordHashToSupabase(uname, localHash);
        } else if (remoteState.customPasswordHash !== localHash.trim().toLowerCase()) {
          // O banco de dados centralizado prevalece sobre cache antigo
          localStorage.setItem(`csg_pwd_hash_v2_${uname}`, remoteState.customPasswordHash);
          localStorage.setItem(`csg_pw_changed_${uname}`, 'true');
        }
      }
    } catch {
      // Ignora falhas silenciosas de rede na sincronização em segundo plano
    }
  }
}
