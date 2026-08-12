// Very small "session token" for the admin demo. It is NOT a full auth
// system — see README security limitations. The token is an HMAC of the
// admin PIN plus a timestamp, signed with a server-only secret, so the
// browser can hold it without ever knowing the PIN itself.

const crypto = require('crypto');

const TOKEN_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

function getSecret() {
  // Falls back to a fixed string if not set, which is fine for a demo —
  // documented in README as a limitation.
  return process.env.ADMIN_TOKEN_SECRET || 'madina-united-demo-secret';
}

function createAdminToken() {
  const issuedAt = Date.now();
  const payload = `${issuedAt}`;
  const signature = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  let decoded;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return false;
  }

  const [payload, signature] = decoded.split('.');
  if (!payload || !signature) return false;

  const expectedSignature = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  const validSignature =
    signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  if (!validSignature) return false;

  const issuedAt = Number(payload);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > TOKEN_TTL_MS) return false;

  return true;
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

function requireAdmin(req, res) {
  const token = getBearerToken(req);
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Unauthorized. Please log in again.' });
    return false;
  }
  return true;
}

module.exports = { createAdminToken, verifyAdminToken, requireAdmin };
