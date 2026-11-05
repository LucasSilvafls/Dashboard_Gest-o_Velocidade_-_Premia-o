import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCorporateUsername,
  verifyCorporateCredentials,
  createSignedSessionToken,
  verifySignedSessionToken,
  hashCorporatePassword,
  isAdminRole,
  normalizeRoleCode,
  normalizeRoleLabel,
} from './auth-crypto.ts';

test('normaliza apelidos corporativos conhecidos e rejeita casamento permissivo por prefixo', () => {
  assert.equal(normalizeCorporateUsername('admin'), 'admincasagrande');
  assert.equal(normalizeCorporateUsername('administrador'), 'admincasagrande');
  assert.equal(normalizeCorporateUsername('admincasagrande'), 'admincasagrande');
  assert.equal(normalizeCorporateUsername('rafael'), 'rafaelcasagrande');
  assert.equal(normalizeCorporateUsername('rafaelcasagrande'), 'rafaelcasagrande');
  assert.equal(normalizeCorporateUsername('operador'), 'operadorcasagrande');
  assert.equal(normalizeCorporateUsername('operadorcasagrande'), 'operadorcasagrande');

  // Não deve converter usuários arbitrários com mesmo prefixo em contas privilegiadas
  assert.equal(normalizeCorporateUsername('admin_invasor'), 'admin_invasor');
  assert.equal(verifyCorporateCredentials('admin_invasor', 'Casagrande@2026'), null);
});

test('autentica contas em estado inicial com a senha padrão Casagrande@2026', () => {
  const adminProfile = verifyCorporateCredentials('admincasagrande', 'Casagrande@2026');
  assert.ok(adminProfile);
  assert.equal(adminProfile.username, 'admincasagrande');
  assert.equal(adminProfile.role, 'admin');

  const rafaelProfile = verifyCorporateCredentials('rafael', 'Casagrande@2026');
  assert.ok(rafaelProfile);
  assert.equal(rafaelProfile.username, 'rafaelcasagrande');
  assert.equal(rafaelProfile.name, 'Rafael Casagrande');
  assert.equal(rafaelProfile.role, 'admin');

  const operadorProfile = verifyCorporateCredentials('operadorcasagrande', 'Casagrande@2026');
  assert.ok(operadorProfile);
  assert.equal(operadorProfile.username, 'operadorcasagrande');
  assert.equal(operadorProfile.role, 'viewer');
});

test('rejeita senhas incorretas ou usuários inexistentes', () => {
  assert.equal(verifyCorporateCredentials('admincasagrande', 'senha_errada'), null);
  assert.equal(verifyCorporateCredentials('rafael', '123456'), null);
  assert.equal(verifyCorporateCredentials('usuario_inexistente', 'Casagrande@2026'), null);
});

test('REGRA CRÍTICA: revoga permanentemente a senha padrão Casagrande@2026 após alteração de senha', () => {
  const customHash = hashCorporatePassword('NovaSenhaForte#2026');

  // 1. A nova senha personalizada deve autenticar com sucesso
  const validProfile = verifyCorporateCredentials(
    'admincasagrande',
    'NovaSenhaForte#2026',
    customHash
  );
  assert.ok(validProfile);
  assert.equal(validProfile.username, 'admincasagrande');

  // 2. A senha padrão antiga ("Casagrande@2026") DEVE ser rejeitada quando customHash está ativo
  const rejectedDefault = verifyCorporateCredentials(
    'admincasagrande',
    'Casagrande@2026',
    customHash
  );
  assert.equal(rejectedDefault, null);

  // 3. Senhas de contingência antigas também devem ser rejeitadas
  assert.equal(
    verifyCorporateCredentials('admincasagrande', 'Admin@Casagrande2026', customHash),
    null
  );
});

test('emite token HMAC-SHA256 vinculado à versão da senha e invalida tokens antigos após troca de senha', () => {
  const profile = verifyCorporateCredentials('admincasagrande', 'Casagrande@2026');
  assert.ok(profile);

  // Token emitido antes da troca de senha (usando senha padrão)
  const initialToken = createSignedSessionToken(profile, null);
  const payload = verifySignedSessionToken(initialToken);
  assert.ok(payload);
  assert.equal(payload.sub, 'admincasagrande');
  assert.equal(payload.role, 'admin');

  // Token adulterado deve ser rejeitado
  assert.equal(verifySignedSessionToken(`${initialToken}x`), null);

  // Após o usuário alterar sua senha, o token antigo deve ser invalidado ao validar contra o novo hash
  const newCustomHash = hashCorporatePassword('SenhaAlterada@2026');
  assert.equal(verifySignedSessionToken(initialToken, newCustomHash), null);

  // O novo token emitido com o novo hash deve ser aceito
  const newToken = createSignedSessionToken(profile, newCustomHash);
  const newPayload = verifySignedSessionToken(newToken, newCustomHash);
  assert.ok(newPayload);
  assert.equal(newPayload.sub, 'admincasagrande');
});

test('aplica RBAC estrito (Deny by Default) para perfis de operador e administrador', () => {
  assert.equal(isAdminRole('admin'), true);
  assert.equal(isAdminRole('Supervisor de Telemetria & Operações'), true);

  assert.equal(isAdminRole('viewer'), false);
  assert.equal(isAdminRole('visualizador'), false);
  assert.equal(isAdminRole('Visualizador CCO'), false);
  assert.equal(isAdminRole(null), false);
  assert.equal(isAdminRole(undefined), false);
  assert.equal(isAdminRole(''), false);

  assert.equal(normalizeRoleCode('admin'), 'admin');
  assert.equal(normalizeRoleCode('visualizador'), 'viewer');
  assert.equal(normalizeRoleLabel('admin'), 'Supervisor de Telemetria & Operações');
  assert.equal(normalizeRoleLabel('visualizador'), 'Visualizador CCO');
});
