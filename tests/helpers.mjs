import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createAuroraServer } from '../server.mjs';

export async function loadDemoApi() {
  const html = await readFile(new URL('../public/passkey-dpop.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  delete globalThis.AuroraPasskeyDPoP;
  (0, eval)(script);
  return globalThis.AuroraPasskeyDPoP;
}

export async function withServer(testFn) {
  const server = createAuroraServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    return await testFn(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
