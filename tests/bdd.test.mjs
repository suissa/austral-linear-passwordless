import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDemoApi } from './helpers.mjs';

test('bdd: dado um agente, quando gera passkey, então cria DPoP vinculado', async () => {
  const api = await loadDemoApi();
  const results = await api.runBddTests();
  assert.deepEqual(results, [{ name: 'BDD: agente gera passkey e recebe DPoP vinculado', pass: true }]);
});
