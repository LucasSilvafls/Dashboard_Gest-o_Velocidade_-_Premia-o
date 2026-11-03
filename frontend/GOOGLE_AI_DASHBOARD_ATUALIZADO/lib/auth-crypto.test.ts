import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCorporateUsername,
  verifyCorporateCredentials,
  createSignedSessionToken,
  verifySignedSessionToken,
  hashCorporatePassword,
} from './auth-crypto';

test('normaliza apelidos corporativos para identificadores canônicos', () => {
  assert.equal(normalizeCorporateUsername('admin'), 'admincasagrande');
  assert.equal(normalizeCorporateUsername('admincasagrande'), 'admincasagrande');
  assert.equal(normalizeCorporateUsername('rafael'), 'rafaelcasagrande');
  assert.equal(normalizeCorporateUsername('rafaelcasagrande'), 'rafaelcasagrande');
  assert.equal(normalizeCorporateUsername('operador'), 'operadorcasagrande');
});

test('autentica admincasagrande e rafael com a senha padrão Casagrande@2026', () => {
  const adminProfile = verifyCorporateCredentials('admincasagrande', 'Casagrande@2026');
  assert.ok(adminProfile);
  assert.equal(adminProfile.username, 'admincasagrande');
  assert.equal(adminProfile.role, 'admin');

  const rafaelProfile = verifyCorporateCredentials('rafael', 'Casagrande@2026');
  assert.ok(rafaelProfile);
  assert.equal(rafaelProfile.username, 'rafaelcasagrande');
  assert.equal(rafaelProfile.name, 'Rafael Casagrande');
  assert.equal(rafaelProfile.role, 'admin');
});

test('rejeita senhas incorretas ou usuários inexistentes', () => {
  assert.equal(verifyCorporateCredentials('admincasagrande', 'senha_errada'), null);
  assert.equal(verifyCorporateCredentials('rafael', '123456'), null);
  assert.equal(verifyCorporateCredentials('usuario_inexistente', 'Casagrande@2026'), null);
});

test('emite e valida token de sessão assinado com HMAC-SHA256', () => {
  const profile = verifyCorporateCredentials('rafael', 'Casagrande@2026');
  assert.ok(profile);

  const token = createSignedSessionToken(profile);
  const payload = verifySignedSessionToken(token);
  assert.ok(payload);
  assert.equal(payload.sub, 'rafaelcasagrande');
  assert.equal(payload.role, 'admin');

  // Token adulterado deve ser rejeitado
  assert.equal(verifySignedSessionToken(`${token}x`), null);
});

test('aceita hash SHA-256 de senha personalizada quando configurado', () => {
  const customHash = hashCorporatePassword('MinhaNovaSenha@2026');
  const profile = verifyCorporateCredentials('admincasagrande', 'MinhaNovaSenha@2026', customHash);
  assert.ok(profile);
  assert.equal(profile.username, 'admincasagrande');
});
