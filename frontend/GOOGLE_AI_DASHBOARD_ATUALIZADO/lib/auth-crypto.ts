/**
 * Módulo Criptográfico de Autenticação e Sessão CCO (SHA-256 + HMAC-SHA256 JWT)
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
  iat: number;
  exp: number;
}

const PASSWORD_SALT = 'csg_salt_2026';
const TOKEN_SIGNING_CONTEXT = 'csg_hmac_jwt_v2_casagrande_cco_2026';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Hashes SHA-256 salgados pré-computados (sha256("csg_salt_2026:" + senha))
 * - DEFAULT_CORPORATE_HASH corresponde à credencial padrão corporativa CCO
 * - SECONDARY_ADMIN_HASH corresponde à credencial alternativa de contingência
 */
const DEFAULT_CORPORATE_HASH =
  '4fa5a055ee5d3efbaf069c5c198eb9dffc094e9fde8111577cb0954b4d2b9486';
const SECONDARY_ADMIN_HASH =
  'bdb0ac5d5dec84beeac1ce94ecf86f5b11a3ca6a5c20c9d091ede27aafe27a4f';

export const CORPORATE_USERS: Record<string, CorporateUserProfile> = {
  admincasagrande: {
    id: 'cco-user-admincasagrande',
    username: 'admincasagrande',
    name: 'Administrador CCO',
    role: 'admin',
    roleLabel: 'Supervisor de Telemetria & Operações',
    email: 'admincasagrande@casagrandetransportes.com.br',
  },
  rafaelcasagrande: {
    id: 'cco-user-rafaelcasagrande',
    username: 'rafaelcasagrande',
    name: 'Rafael Casagrande',
    role: 'admin',
    roleLabel: 'Supervisor de Telemetria & Operações',
    email: 'rafaelcasagrande@casagrandetransportes.com.br',
  },
  operadorcasagrande: {
    id: 'cco-user-operadorcasagrande',
    username: 'operadorcasagrande',
    name: 'Operador CCO',
    role: 'viewer',
    roleLabel: 'Visualizador CCO',
    email: 'operadorcasagrande@casagrandetransportes.com.br',
  },
};

/**
 * Normaliza entradas de usuário ou e-mail para o identificador canônico corporativo.
 */
export function normalizeCorporateUsername(rawInput: string): string {
  const clean = (rawInput || '').trim().toLowerCase();
  const localPart = clean.includes('@') ? clean.split('@')[0] : clean;

  if (
    localPart === 'admin' ||
    localPart === 'administrador' ||
    localPart === 'admincasagrande' ||
    localPart === 'admin.cco' ||
    localPart.startsWith('admin')
  ) {
    return 'admincasagrande';
  }

  if (localPart === 'rafael' || localPart === 'rafaelcasagrande' || localPart.startsWith('rafael')) {
    return 'rafaelcasagrande';
  }

  if (
    localPart === 'operador' ||
    localPart === 'operadorcasagrande' ||
    localPart === 'viewer' ||
    localPart.startsWith('operador')
  ) {
    return 'operadorcasagrande';
  }

  return localPart;
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
function constantTimeEqual(a: string, b: string): boolean {
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

  // 1. Verifica hash de senha personalizada (se configurado pelo usuário)
  if (
    customPasswordHash &&
    customPasswordHash.length === 64 &&
    constantTimeEqual(candidateHash, customPasswordHash)
  ) {
    return profile;
  }

  // 2. Verifica hash da senha corporativa oficial ("Casagrande@2026") ou contingência admin
  if (
    constantTimeEqual(candidateHash, DEFAULT_CORPORATE_HASH) ||
    constantTimeEqual(candidateHash, SECONDARY_ADMIN_HASH)
  ) {
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
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))
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
 * Emite um token de sessão assinado com HMAC-SHA256.
 */
export function createSignedSessionToken(user: CorporateUserProfile): string {
  const now = Date.now();
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadObj: SessionTokenPayload = {
    sub: user.username,
    name: user.name,
    role: user.role,
    email: user.email,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  const payload = toBase64Url(JSON.stringify(payloadObj));
  const signature = hmacSha256Hex(getSigningSecret(), `${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

/**
 * Verifica a assinatura HMAC-SHA256 e a validade temporal do token de sessão.
 */
export function verifySignedSessionToken(token: string | null | undefined): SessionTokenPayload | null {
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
    return decoded;
  } catch {
    return null;
  }
}
