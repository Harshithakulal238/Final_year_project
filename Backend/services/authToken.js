import crypto from 'node:crypto';

export function verifyBearerToken(authorization, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return null;

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || typeof payload.userId !== 'string' || !payload.userId) return null;
    if (payload.exp !== undefined && (!Number.isFinite(payload.exp) || nowSeconds >= payload.exp)) return null;
    if (payload.nbf !== undefined && (!Number.isFinite(payload.nbf) || nowSeconds < payload.nbf)) return null;

    const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    const actual = Buffer.from(parts[2], 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    return payload;
  } catch {
    return null;
  }
}
