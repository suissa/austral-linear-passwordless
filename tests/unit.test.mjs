import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDemoApi } from './helpers.mjs';

test('unit: embedded DPoP helpers pass', async () => {
  const api = await loadDemoApi();
  const results = await api.runUnitTests();
  assert.equal(results.length, 1);
  assert.equal(results[0].pass, true);
});

test('unit: DPoP signing input binds passkey credential id', async () => {
  const api = await loadDemoApi();
  const proof = api.helpers.dpopSigningInput({
    method: 'post',
    url: 'https://api.aurora.local/identity/mount',
    credentialId: 'passkey-id',
    issuedAt: 1,
    jwtId: 'jti'
  });
  assert.equal(proof.header.kid, 'passkey-id');
  assert.equal(proof.payload.cnf.kid, 'passkey-id');
  assert.equal(proof.payload.passkey_credential_id, 'passkey-id');
  assert.equal(proof.payload.htm, 'POST');
});
