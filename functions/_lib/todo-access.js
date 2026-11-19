const encoder = new TextEncoder();
export const cookieName = '__Host-cdv-todo';
const sessionSeconds = 90 * 24 * 60 * 60;

export function accessConfigured(env) {
  return typeof env.TODO_ACCESS_KEY === 'string' && env.TODO_ACCESS_KEY.length >= 32;
}

async function signingKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  return Uint8Array.from(hex.match(/../g) || [], pair => parseInt(pair, 16));
}

export async function validAccessKey(candidate, env) {
  if (typeof candidate !== 'string' || candidate.length < 32 || candidate.length > 512) return false;
  const expectedKey = await signingKey(env.TODO_ACCESS_KEY);
  const candidateKey = await signingKey(candidate);
  const challenge = encoder.encode('CDV todo private access');
  const signature = await crypto.subtle.sign('HMAC', expectedKey, challenge);
  return crypto.subtle.verify('HMAC', candidateKey, signature, challenge);
}

export async function sessionCookie(request, env) {
  const expires = Math.floor(Date.now() / 1000) + sessionSeconds;
  const value = `olivier.${expires}.${crypto.randomUUID()}`;
  const message = encoder.encode(new URL(request.url).origin + '|' + value);
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env.TODO_ACCESS_KEY), message);
  return `${cookieName}=${value}.${toHex(signature)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${sessionSeconds}`;
}

export async function authenticated(request, env) {
  if (!accessConfigured(env)) return false;
  const value = (request.headers.get('Cookie') || '').split(';')
    .map(part => part.trim()).find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  const match = value?.match(/^olivier\.(\d{10})\.([a-f0-9-]{36})\.([a-f0-9]{64})$/);
  if (!match) return false;
  const expires = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  if (expires <= now || expires > now + sessionSeconds) return false;
  const signedValue = `olivier.${match[1]}.${match[2]}`;
  return crypto.subtle.verify('HMAC', await signingKey(env.TODO_ACCESS_KEY), fromHex(match[3]),
    encoder.encode(new URL(request.url).origin + '|' + signedValue));
}

export function sameOrigin(request) {
  return request.headers.get('Origin') === new URL(request.url).origin;
}
