import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDemoApi, withServer } from './helpers.mjs';

test('e2e: server serves front and verifies passkey-based DPoP token', async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    assert.equal(health.front, '/passkey-dpop.html');

    const front = await fetch(`${baseUrl}/passkey-dpop.html`).then((response) => response.text());
    assert.match(front, /Aurora Passkey DPoP/);
    assert.match(front, /runE2eTests/);

    const api = await loadDemoApi();
    const adapter = api.adapters.virtualPasskeyAdapter();
    await api.registerPasskey({ userName: 'e2e@aurora.local', adapter });
    const envelope = await api.createDpopToken({ method: 'POST', url: `${baseUrl}/api/protected`, adapter });

    const verification = await fetch(`${baseUrl}/api/dpop/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: envelope.token })
    }).then((response) => response.json());

    assert.equal(verification.ok, true);
    assert.equal(verification.header.kid, api.state.credentialId);
    assert.equal(verification.payload.passkey_credential_id, api.state.credentialId);
  });
});
