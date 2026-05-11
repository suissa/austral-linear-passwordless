import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHash } from 'node:crypto';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(rootDir, 'public');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';

const sessions = new Map();

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,dpop'
  });
  res.end(payload);
}

function textResponse(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function makeRegistrationOptions(userName = 'agente@aurora.local', origin = 'http://localhost:3000') {
  const sessionId = randomUUID();
  const challenge = base64Url(randomBytes(32));
  const userId = base64Url(randomBytes(16));
  const rpId = new URL(origin).hostname;
  const options = {
    sessionId,
    publicKey: {
      challenge,
      rp: { name: 'Aurora Passwordless', id: rpId },
      user: { id: userId, name: userName, displayName: userName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      timeout: 60000,
      attestation: 'none'
    }
  };
  sessions.set(sessionId, { challenge, userId, userName, createdAt: Date.now() });
  return options;
}

function verifyRegistration(body) {
  const session = sessions.get(body.sessionId);
  if (!session) return { ok: false, reason: 'registration session not found' };
  if (!body.credentialId) return { ok: false, reason: 'credentialId is required' };
  const credential = {
    credentialId: body.credentialId,
    userId: session.userId,
    userName: session.userName,
    registeredAt: new Date().toISOString()
  };
  sessions.delete(body.sessionId);
  return { ok: true, credential };
}

function decodeJwtPart(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

function verifyDpopToken(token) {
  if (!token) return { ok: false, reason: 'DPoP token is required' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'DPoP token must have three parts' };
  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (header.typ !== 'dpop+jwt') return { ok: false, reason: 'typ must be dpop+jwt' };
  if (header.alg !== 'WebAuthn-ES256') return { ok: false, reason: 'alg must be WebAuthn-ES256' };
  if (!payload.cnf || payload.cnf.kid !== header.kid) return { ok: false, reason: 'payload cnf.kid must match header kid' };
  if (payload.passkey_credential_id !== header.kid) return { ok: false, reason: 'passkey credential id must match kid' };
  return {
    ok: true,
    header,
    payload,
    signingInputSha256: base64Url(createHash('sha256').update(`${parts[0]}.${parts[1]}`).digest())
  };
}

async function routeApi(req, res, pathname) {
  if (req.method === 'OPTIONS') return jsonResponse(res, 204, {});

  if (req.method === 'GET' && pathname === '/api/health') {
    return jsonResponse(res, 200, { ok: true, service: 'aurora-passkey-dpop-api', front: '/passkey-dpop.html' });
  }

  if (req.method === 'POST' && pathname === '/api/webauthn/register/options') {
    const body = await readJson(req);
    return jsonResponse(res, 200, makeRegistrationOptions(body.userName, body.origin || `http://${req.headers.host || 'localhost:3000'}`));
  }

  if (req.method === 'POST' && pathname === '/api/webauthn/register/verify') {
    return jsonResponse(res, 200, verifyRegistration(await readJson(req)));
  }

  if (req.method === 'POST' && pathname === '/api/dpop/verify') {
    const body = await readJson(req);
    return jsonResponse(res, 200, verifyDpopToken(body.token));
  }

  return jsonResponse(res, 404, { ok: false, reason: 'API route not found' });
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

async function routeStatic(req, res, pathname) {
  const requestedPath = pathname === '/' ? '/passkey-dpop.html' : pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) return textResponse(res, 403, 'Forbidden');
  try {
    const file = await readFile(filePath);
    return textResponse(res, 200, file, mimeTypes[extname(filePath)] || 'application/octet-stream');
  } catch {
    return textResponse(res, 404, 'Not found');
  }
}

export function createAuroraServer({ apiOnly = false, frontOnly = false } = {}) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (!frontOnly && url.pathname.startsWith('/api/')) return routeApi(req, res, url.pathname);
      if (!apiOnly) return routeStatic(req, res, url.pathname);
      return jsonResponse(res, 404, { ok: false, reason: 'front disabled; use /api/* routes' });
    } catch (error) {
      return jsonResponse(res, 500, { ok: false, reason: error.message });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apiOnly = process.argv.includes('--api-only');
  const frontOnly = process.argv.includes('--front-only');
  createAuroraServer({ apiOnly, frontOnly }).listen(port, host, () => {
    const mode = apiOnly ? 'API' : frontOnly ? 'front' : 'API + front';
    console.log(`Aurora ${mode} running at http://${host}:${port}`);
    if (!apiOnly) console.log(`Front: http://${host}:${port}/passkey-dpop.html`);
    if (!frontOnly) console.log(`API:   http://${host}:${port}/api/health`);
  });
}
