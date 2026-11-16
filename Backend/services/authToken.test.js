import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { verifyBearerToken } from './authToken.js';

const secret = 'test-secret-with-more-than-thirty-two-bytes';

function sign(payload, algorithm = 'HS256') {
  const header = Buffer.from(JSON.stringify({ alg: algorithm, typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `Bearer ${header}.${body}.${signature}`;
}

test('accepts a valid HS256 token for an identified user', () => {
  const payload = { userId: '0123456789abcdef01234567', exp: 2000 };
  assert.deepEqual(verifyBearerToken(sign(payload), secret, 1000), payload);
});

test('rejects missing, malformed, tampered, and expired tokens', () => {
  const valid = sign({ userId: 'user-1', exp: 2000 });
  assert.equal(verifyBearerToken(undefined, secret, 1000), null);
  assert.equal(verifyBearerToken('Bearer invalid', secret, 1000), null);
  assert.equal(verifyBearerToken(`${valid}x`, secret, 1000), null);
  assert.equal(verifyBearerToken(valid, secret, 2000), null);
});

test('rejects tokens with an unsupported algorithm or not-before time', () => {
  assert.equal(verifyBearerToken(sign({ userId: 'user-1', exp: 2000 }, 'none'), secret, 1000), null);
  assert.equal(verifyBearerToken(sign({ userId: 'user-1', nbf: 1500 }, 'none'), secret, 1000), null);
});
