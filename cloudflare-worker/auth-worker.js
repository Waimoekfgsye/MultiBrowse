/**
 * MultiBrowse Auth Worker
 * Deploy to: api-unrealvfx.unrealvfx.workers.dev
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    if (method !== 'POST' && method !== 'GET') {
      return corsJson({ error: 'Method not allowed' }, 405);
    }

    try {
      await ensureTables(env.DB);

      let body = {};
      if (path === '/paypal-ipn') {
        return await handlePayPalIPN(env, request);
      }

      if (method === 'GET') {
        if (path === '/license/check') return await handleLicenseCheck(env, request);
        return corsJson({ error: 'Not found' }, 404);
      }

      body = await request.json().catch(() => ({}));

      if (path === '/signup') return await handleSignup(env, body);
      if (path === '/verify-email') return await handleVerifyEmail(env, body);
      if (path === '/resend-verification') return await handleResendVerification(env, body);
      if (path === '/login') return await handleLogin(env, body);
      if (path === '/forgot-password') return await handleForgotPassword(env, body);
      if (path === '/reset-password') return await handleResetPassword(env, body);
      if (path === '/activate-license') return await handleActivateLicense(env, body, request);
      if (path === '/redeem-license-key') return await handleRedeemLicenseKey(env, body, request);
      if (path === '/generate-license') return await handleGenerateLicense(env, body, request);

      return corsJson({ error: 'Not found' }, 404);
    } catch (err) {
      return corsJson({ error: err.message || 'Internal error' }, 500);
    }
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsResponse(body, status = 200) {
  return new Response(body, { status, headers: CORS });
}

function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function ensureTables(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS pending_signups (email TEXT PRIMARY KEY, password_hash TEXT NOT NULL, salt TEXT NOT NULL, code TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS verification_codes (email TEXT NOT NULL, code TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'email', expires_at TEXT NOT NULL, PRIMARY KEY (email, type))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS subscriptions (user_id TEXT PRIMARY KEY, plan TEXT NOT NULL DEFAULT 'free_trial', paypal_email TEXT DEFAULT '', paypal_transaction_id TEXT DEFAULT '', upgraded_at TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS licenses (license_key TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')), used_by TEXT DEFAULT '', used_at TEXT DEFAULT '', email_sent_to TEXT DEFAULT '')`),
    db.prepare(`CREATE TABLE IF NOT EXISTS license_keys (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), used INTEGER NOT NULL DEFAULT 0, used_by_user_id TEXT DEFAULT NULL, amount_paid TEXT DEFAULT '', payer_email TEXT DEFAULT '', txn_id TEXT DEFAULT '')`),
    db.prepare(`CREATE TABLE IF NOT EXISTS payment_attempts (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')), txn_id TEXT DEFAULT '', payer_email TEXT DEFAULT '', payment_status TEXT DEFAULT '', amount_paid TEXT DEFAULT '', currency TEXT DEFAULT '', accepted INTEGER NOT NULL DEFAULT 0, reason TEXT DEFAULT '')`),
  ]);
  try { await db.prepare('ALTER TABLE users ADD COLUMN unlocked INTEGER NOT NULL DEFAULT 0').run(); } catch {}
}

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() { const arr = new Uint8Array(16); crypto.getRandomValues(arr); return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(''); }
function generateCode() { return String(Math.floor(1000 + Math.random() * 9000)); }
function generateId() { return crypto.randomUUID(); }

function base64UrlEncode(data) {
  let str;
  if (typeof data === 'string') { str = btoa(data); } else {
    const bytes = new Uint8Array(data); let binary = '';
    for (let i = 0; i < bytes.length; i++) { binary += String.fromCharCode(bytes[i]); }
    str = btoa(binary);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 30 * 24 * 60 * 60 };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return { sent: false, reason: 'Email service not configured' };
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], subject, html }) });
  if (!res.ok) { const txt = await res.text().catch(() => 'Email send failed'); throw new Error(`Resend error: ${txt}`); }
  return { sent: true };
}

function verificationEmailHtml(code, email) {
  return `<div style="font-family:Inter,Arial,sans-serif;background:#0a0a0f;color:#e8e8f0;padding:32px;max-width:520px;margin:0 auto;"><div style="background:#101018;border-radius:16px;padding:28px;"><h1 style="margin:0 0 8px 0;color:#e8d44d;font-size:22px;">MultiBrowse Verification</h1><p style="margin:0 0 20px 0;color:#8888a0;font-size:14px;">Verify your email to continue.</p><p style="margin:0 0 18px 0;color:#e8e8f0;font-size:14px;">Account: <strong>${email}</strong></p><div style="display:inline-block;padding:14px 20px;border-radius:12px;background:#0a0a0f;color:#e8d44d;font-size:28px;letter-spacing:10px;font-weight:700;">${code}</div><p style="margin:20px 0 0 0;color:#555570;font-size:12px;">This code expires in 15 minutes.</p></div></div>`;
}

function resetEmailHtml(code, email) {
  return `<div style="font-family:Inter,Arial,sans-serif;background:#0a0a0f;color:#e8e8f0;padding:32px;max-width:520px;margin:0 auto;"><div style="background:#101018;border-radius:16px;padding:28px;"><h1 style="margin:0 0 8px 0;color:#e8d44d;font-size:22px;">MultiBrowse Reset Code</h1><p style="margin:0 0 20px 0;color:#8888a0;font-size:14px;">Use this code to reset your password.</p><p style="margin:0 0 18px 0;color:#e8e8f0;font-size:14px;">Account: <strong>${email}</strong></p><div style="display:inline-block;padding:14px 20px;border-radius:12px;background:#0a0a0f;color:#e8d44d;font-size:28px;letter-spacing:10px;font-weight:700;">${code}</div><p style="margin:20px 0 0 0;color:#555570;font-size:12px;">This code expires in 15 minutes.</p></div></div>`;
}

function licenseEmailHtml(key, email) {
  return `<div style="font-family:Inter,Arial,sans-serif;background:#0a0a0f;color:#e8e8f0;padding:32px;max-width:520px;margin:0 auto;"><div style="background:#101018;border-radius:16px;padding:28px;"><h1 style="margin:0 0 8px 0;color:#e8d44d;font-size:22px;">MultiBrowse Premium</h1><p style="margin:0 0 20px 0;color:#8888a0;font-size:14px;">Thank you for your purchase!</p><p style="margin:0 0 12px 0;color:#e8e8f0;font-size:14px;">Account: <strong>${email}</strong></p><p style="margin:0 0 8px 0;color:#8888a0;font-size:12px;">Your license key:</p><div style="display:inline-block;padding:14px 24px;border-radius:12px;background:#0a0a0f;color:#e8d44d;font-size:24px;letter-spacing:6px;font-weight:700;font-family:monospace;">${key}</div><p style="margin:20px 0 0 0;color:#8888a0;font-size:12px;">Open MultiBrowse → click ⚡ Upgrade → paste this key → click Activate.</p><p style="margin:12px 0 0 0;color:#555570;font-size:11px;">This key can only be used once.</p></div></div>`;
}

async function handleSignup(env, body) {
  const { email, password } = body;
  if (!email || !password) return corsJson({ error: 'Email and password required' }, 400);
  if (password.length < 6) return corsJson({ error: 'Password must be at least 6 characters' }, 400);
  const normalEmail = email.toLowerCase().trim();
  const existing = await env.DB.prepare('SELECT id, verified FROM users WHERE email = ?').bind(normalEmail).first();
  if (existing && existing.verified) return corsJson({ error: 'Account already exists' }, 409);
  if (existing && !existing.verified) { await env.DB.prepare('DELETE FROM users WHERE email = ?').bind(normalEmail).run(); await env.DB.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(existing.id).run(); }
  const salt = generateSalt(); const hash = await hashPassword(password, salt); const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO pending_signups (email, password_hash, salt, code, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash, salt = excluded.salt, code = excluded.code, expires_at = excluded.expires_at`).bind(normalEmail, hash, salt, code, expiresAt).run();
  await env.DB.prepare(`INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, 'email', ?) ON CONFLICT (email, type) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at`).bind(normalEmail, code, expiresAt).run();
  const emailResult = await sendEmail(env, normalEmail, 'Your MultiBrowse verification code', verificationEmailHtml(code, normalEmail));
  if (!emailResult.sent) return corsJson({ success: true, message: 'Verification code generated. Email service not configured yet, using fallback test code.', verification_code: code });
  return corsJson({ success: true, message: 'Verification code sent to your email.' });
}

async function handleVerifyEmail(env, body) {
  const { email, code } = body;
  if (!email || !code) return corsJson({ error: 'Email and code required' }, 400);
  const normalEmail = email.toLowerCase().trim();
  const pending = await env.DB.prepare('SELECT password_hash, salt, code, expires_at FROM pending_signups WHERE email = ?').bind(normalEmail).first();
  if (!pending) return corsJson({ error: 'No pending verification found. Please sign up again.' }, 404);
  if (pending.code !== code) return corsJson({ error: 'Invalid code' }, 400);
  if (new Date(pending.expires_at) < new Date()) return corsJson({ error: 'Code expired. Request a new one.' }, 400);
  const legacy = await env.DB.prepare('SELECT id, verified FROM users WHERE email = ?').bind(normalEmail).first();
  if (legacy && !legacy.verified) { await env.DB.prepare('DELETE FROM users WHERE email = ?').bind(normalEmail).run(); await env.DB.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(legacy.id).run(); }
  const userId = generateId();
  await env.DB.prepare('INSERT INTO users (id, email, password_hash, salt, verified) VALUES (?, ?, ?, ?, 1)').bind(userId, normalEmail, pending.password_hash, pending.salt).run();
  await env.DB.prepare('INSERT INTO subscriptions (user_id, plan) VALUES (?, ?)').bind(userId, 'free_trial').run();
  await env.DB.prepare('DELETE FROM pending_signups WHERE email = ?').bind(normalEmail).run();
  await env.DB.prepare("DELETE FROM verification_codes WHERE email = ? AND type = 'email'").bind(normalEmail).run();
  return corsJson({ success: true, message: 'Email verified' });
}

async function handleResendVerification(env, body) {
  const { email } = body;
  if (!email) return corsJson({ error: 'Email required' }, 400);
  const normalEmail = email.toLowerCase().trim();
  let pending = await env.DB.prepare('SELECT email FROM pending_signups WHERE email = ?').bind(normalEmail).first();
  if (!pending) {
    const legacy = await env.DB.prepare('SELECT id, password_hash, salt, verified FROM users WHERE email = ?').bind(normalEmail).first();
    if (legacy && !legacy.verified) {
      const legacyCode = generateCode(); const legacyExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await env.DB.prepare(`INSERT INTO pending_signups (email, password_hash, salt, code, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash, salt = excluded.salt, code = excluded.code, expires_at = excluded.expires_at`).bind(normalEmail, legacy.password_hash, legacy.salt, legacyCode, legacyExpires).run();
      await env.DB.prepare('DELETE FROM users WHERE email = ?').bind(normalEmail).run();
      await env.DB.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(legacy.id).run();
      pending = { email: normalEmail };
    }
  }
  if (!pending) return corsJson({ error: 'No pending signup found for this email' }, 404);
  const code = generateCode(); const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await env.DB.prepare(`UPDATE pending_signups SET code = ?, expires_at = ? WHERE email = ?`).bind(code, expiresAt, normalEmail).run();
  await env.DB.prepare(`INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, 'email', ?) ON CONFLICT (email, type) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at`).bind(normalEmail, code, expiresAt).run();
  const emailResult = await sendEmail(env, normalEmail, 'Your MultiBrowse verification code', verificationEmailHtml(code, normalEmail));
  if (!emailResult.sent) return corsJson({ success: true, message: 'Verification code regenerated. Email service not configured yet, using fallback test code.', verification_code: code });
  return corsJson({ success: true, message: 'Verification code resent to your email.' });
}

async function handleLogin(env, body) {
  const { email, password } = body;
  if (!email || !password) return corsJson({ error: 'Email and password required' }, 400);
  const normalEmail = email.toLowerCase().trim();
  const pending = await env.DB.prepare('SELECT email FROM pending_signups WHERE email = ?').bind(normalEmail).first();
  if (pending) return corsJson({ error: 'Please verify your email first' }, 403);
  const user = await env.DB.prepare('SELECT id, email, password_hash, salt, verified FROM users WHERE email = ?').bind(normalEmail).first();
  if (!user) return corsJson({ error: 'Account not found' }, 404);
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.password_hash) return corsJson({ error: 'Invalid password' }, 401);
  if (!user.verified) return corsJson({ error: 'Please verify your email first' }, 403);
  const sub = await env.DB.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').bind(user.id).first();
  const plan = sub?.plan || 'free_trial';
  const token = await signJwt({ sub: user.id, email: user.email, plan: plan }, env.JWT_SECRET);
  return corsJson({ token: token, email: user.email, plan: plan });
}

async function handleForgotPassword(env, body) {
  const { email } = body;
  if (!email) return corsJson({ error: 'Email required' }, 400);
  const normalEmail = email.toLowerCase().trim();
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(normalEmail).first();
  if (!user) return corsJson({ error: 'Account not found' }, 404);
  const code = generateCode(); const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, 'reset', ?) ON CONFLICT (email, type) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at`).bind(normalEmail, code, expiresAt).run();
  const emailResult = await sendEmail(env, normalEmail, 'Your MultiBrowse password reset code', resetEmailHtml(code, normalEmail));
  if (!emailResult.sent) return corsJson({ success: true, message: 'Reset code generated. Email service not configured yet, using fallback test code.', reset_code: code });
  return corsJson({ success: true, message: 'Reset code sent to your email.' });
}

async function handleResetPassword(env, body) {
  const { email, code, password } = body;
  if (!email || !code || !password) return corsJson({ error: 'Email, code, and new password required' }, 400);
  if (password.length < 6) return corsJson({ error: 'Password must be at least 6 characters' }, 400);
  const normalEmail = email.toLowerCase().trim();
  const row = await env.DB.prepare("SELECT code, expires_at FROM verification_codes WHERE email = ? AND type = 'reset'").bind(normalEmail).first();
  if (!row) return corsJson({ error: 'No reset code found' }, 404);
  if (row.code !== code) return corsJson({ error: 'Invalid code' }, 400);
  if (new Date(row.expires_at) < new Date()) return corsJson({ error: 'Code expired' }, 400);
  const salt = generateSalt(); const hash = await hashPassword(password, salt);
  await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE email = ?').bind(hash, salt, normalEmail).run();
  await env.DB.prepare("DELETE FROM verification_codes WHERE email = ? AND type = 'reset'").bind(normalEmail).run();
  return corsJson({ success: true, message: 'Password reset successfully' });
}

function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments = [];
  for (let s = 0; s < 4; s++) { let seg = ''; for (let c = 0; c < 4; c++) { seg += chars[Math.floor(Math.random() * chars.length)]; } segments.push(seg); }
  return segments.join('-');
}

async function handleActivateLicense(env, body, request) {
  const { license_key } = body;
  if (!license_key) return corsJson({ error: 'License key required' }, 400);
  const key = license_key.trim().toUpperCase();

  // Auth — get user ID from JWT
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return corsJson({ error: 'Unauthorized' }, 401);
  const token = authHeader.slice(7).trim();
  let userId;
  try { const parts = token.split('.'); const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/'); const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '='); const payload = JSON.parse(atob(padded)); userId = payload.sub; } catch { return corsJson({ error: 'Invalid token' }, 401); }
  if (!userId) return corsJson({ error: 'Invalid token — no sub' }, 401);

  // Check admin-generated licenses table first
  const adminLicense = await env.DB.prepare('SELECT license_key, used_by FROM licenses WHERE license_key = ?').bind(key).first();
  if (adminLicense) {
    if (adminLicense.used_by) return corsJson({ error: 'This license key has already been used' }, 400);
    await env.DB.prepare("UPDATE licenses SET used_by = ?, used_at = datetime('now') WHERE license_key = ?").bind(userId, key).run();
    await env.DB.prepare(`INSERT INTO subscriptions (user_id, plan, upgraded_at) VALUES (?, 'premium', datetime('now')) ON CONFLICT (user_id) DO UPDATE SET plan = 'premium', upgraded_at = datetime('now')`).bind(userId).run();
    return corsJson({ success: true, plan: 'premium' });
  }

  // Check PayPal IPN-generated license_keys table
  const paypalLicense = await env.DB.prepare('SELECT id, key, used, used_by_user_id FROM license_keys WHERE key = ?').bind(key).first();
  if (paypalLicense) {
    if (paypalLicense.used) return corsJson({ error: 'This license key has already been used' }, 400);
    await env.DB.prepare("UPDATE license_keys SET used = 1, used_by_user_id = ? WHERE key = ?").bind(userId, key).run();
    await env.DB.prepare('UPDATE users SET unlocked = 1 WHERE id = ?').bind(userId).run();
    await env.DB.prepare(`INSERT INTO subscriptions (user_id, plan, upgraded_at) VALUES (?, 'premium', datetime('now')) ON CONFLICT (user_id) DO UPDATE SET plan = 'premium', upgraded_at = datetime('now')`).bind(userId).run();
    return corsJson({ success: true, plan: 'premium' });
  }

  return corsJson({ error: 'Invalid license key' }, 404);
}

async function handleGenerateLicense(env, body, request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${env.ADMIN_SECRET}`) return corsJson({ error: 'Unauthorized — admin only' }, 401);
  const { email } = body;
  if (!email) return corsJson({ error: 'Email required' }, 400);
  const normalEmail = email.toLowerCase().trim();
  const key = generateLicenseKey();
  await env.DB.prepare("INSERT INTO licenses (license_key, email_sent_to) VALUES (?, ?)").bind(key, normalEmail).run();
  const emailResult = await sendEmail(env, normalEmail, 'Your MultiBrowse Premium License Key', licenseEmailHtml(key, normalEmail));
  return corsJson({ success: true, license_key: key, email_sent: emailResult.sent, sent_to: normalEmail });
}

const MIN_PAYMENT_USD = 25;

async function logPaymentAttempt(env, { txnId = '', payerEmail = '', paymentStatus = '', amountPaid = '', currency = '', accepted = 0, reason = '' }) {
  try { await env.DB.prepare(`INSERT INTO payment_attempts (id, txn_id, payer_email, payment_status, amount_paid, currency, accepted, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(generateId(), txnId, payerEmail, paymentStatus, amountPaid, currency, accepted, reason).run(); } catch (err) { console.warn('[IPN] Failed to log payment attempt:', err.message || err); }
}

async function handlePayPalIPN(env, request) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const paymentStatus = params.get('payment_status') || '';
  const mcGross = parseFloat(params.get('mc_gross') || '0');
  const mcCurrency = (params.get('mc_currency') || '').toUpperCase();
  const payerEmail = (params.get('payer_email') || '').toLowerCase().trim();
  const txnId = params.get('txn_id') || '';

  const verifyBody = 'cmd=_notify-validate&' + rawBody;
  const verifyRes = await fetch('https://ipnpb.paypal.com/cgi-bin/webscr', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: verifyBody });
  const verifyText = await verifyRes.text();

  if (verifyText.trim() !== 'VERIFIED') {
    await logPaymentAttempt(env, { txnId, payerEmail, paymentStatus, amountPaid: String(mcGross), currency: mcCurrency, accepted: 0, reason: 'ipn not verified' });
    return new Response('OK', { status: 200 });
  }

  if (paymentStatus !== 'Completed') { await logPaymentAttempt(env, { txnId, payerEmail, paymentStatus, amountPaid: String(mcGross), currency: mcCurrency, accepted: 0, reason: 'payment_status not Completed' }); return new Response('OK', { status: 200 }); }
  if (mcCurrency !== 'USD') { await logPaymentAttempt(env, { txnId, payerEmail, paymentStatus, amountPaid: String(mcGross), currency: mcCurrency, accepted: 0, reason: 'currency not USD' }); return new Response('OK', { status: 200 }); }
  if (mcGross < MIN_PAYMENT_USD) { await logPaymentAttempt(env, { txnId, payerEmail, paymentStatus, amountPaid: String(mcGross), currency: mcCurrency, accepted: 0, reason: `amount below minimum (${MIN_PAYMENT_USD})` }); return new Response('OK', { status: 200 }); }
  if (!payerEmail) { await logPaymentAttempt(env, { txnId, payerEmail, paymentStatus, amountPaid: String(mcGross), currency: mcCurrency, accepted: 0, reason: 'missing payer_email' }); return new Response('OK', { status: 200 }); }

  if (txnId) {
    const existing = await env.DB.prepare('SELECT id FROM license_keys WHERE txn_id = ?').bind(txnId).first();
    if (existing) { await logPaymentAttempt(env, { txnId, payerEmail, paymentStatus, amountPaid: String(mcGross), currency: mcCurrency, accepted: 0, reason: 'duplicate txn_id already processed' }); return new Response('OK', { status: 200 }); }
  }

  const key = generateLicenseKey();
  const keyId = generateId();
  await env.DB.prepare(`INSERT INTO license_keys (id, key, amount_paid, payer_email, txn_id) VALUES (?, ?, ?, ?, ?)`).bind(keyId, key, String(mcGross), payerEmail, txnId).run();
  await logPaymentAttempt(env, { txnId, payerEmail, paymentStatus, amountPaid: String(mcGross), currency: mcCurrency, accepted: 1, reason: 'license issued' });

  try { await sendEmail(env, payerEmail, 'Your MultiBrowse Premium License Key', licenseEmailHtml(key, payerEmail)); } catch (emailErr) { console.warn('[IPN] Email send failed:', emailErr.message); }

  return new Response('OK', { status: 200 });
}

async function handleRedeemLicenseKey(env, body, request) {
  const { key: rawKey } = body;
  if (!rawKey) return corsJson({ error: 'License key required' }, 400);
  const key = rawKey.trim().toUpperCase();
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return corsJson({ error: 'Unauthorized' }, 401);
  const token = authHeader.slice(7).trim();
  let userId;
  try { const parts = token.split('.'); const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/'); const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '='); const payload = JSON.parse(atob(padded)); userId = payload.sub; } catch { return corsJson({ error: 'Invalid token' }, 401); }
  if (!userId) return corsJson({ error: 'Invalid token — no sub' }, 401);
  const license = await env.DB.prepare('SELECT id, key, used, used_by_user_id FROM license_keys WHERE key = ?').bind(key).first();
  if (!license) return corsJson({ error: 'Invalid license key' }, 400);
  if (license.used) return corsJson({ error: 'This license key has already been used' }, 400);
  await env.DB.prepare("UPDATE license_keys SET used = 1, used_by_user_id = ? WHERE key = ?").bind(userId, key).run();
  await env.DB.prepare('UPDATE users SET unlocked = 1 WHERE id = ?').bind(userId).run();
  await env.DB.prepare(`INSERT INTO subscriptions (user_id, plan, upgraded_at) VALUES (?, 'premium', datetime('now')) ON CONFLICT (user_id) DO UPDATE SET plan = 'premium', upgraded_at = datetime('now')`).bind(userId).run();
  return corsJson({ success: true, message: 'License key redeemed successfully', plan: 'premium' });
}

async function handleLicenseCheck(env, request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return corsJson({ error: 'Unauthorized' }, 401);
  const token = authHeader.slice(7).trim();
  let userId;
  try { const parts = token.split('.'); const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/'); const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '='); const payload = JSON.parse(atob(padded)); userId = payload.sub; } catch { return corsJson({ error: 'Invalid token' }, 401); }
  if (!userId) return corsJson({ error: 'Invalid token — no sub' }, 401);
  const user = await env.DB.prepare('SELECT id, email, unlocked FROM users WHERE id = ?').bind(userId).first();
  if (!user) return corsJson({ error: 'User not found' }, 404);
  const sub = await env.DB.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').bind(userId).first();
  return corsJson({ user_id: user.id, email: user.email, unlocked: user.unlocked === 1, plan: sub?.plan || 'free_trial' });
}
