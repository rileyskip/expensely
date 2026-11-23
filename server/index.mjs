import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { migrate, query, withTransaction } from './db.mjs';
import { hashPassword, hashToken, newToken, verifyPassword } from './passwords.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 3000;
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const COOKIE = 'expensely_session';
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;
let paddingHash;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

function sessionCookie(token, maxAgeMs) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

function clearSessionCookie() {
  const parts = [`${COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

function publicUser(row) {
  return { id: row.id, username: row.username, role: row.role };
}

function sendError(res, status, error) {
  res.status(status).json({ error });
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function validateCredentials(username, password) {
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username must be 3–32 characters and use only letters, numbers, and underscores.';
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
    return 'Password must be 8–200 characters.';
  }
  return null;
}

async function needsSetup() {
  const result = await query('SELECT EXISTS (SELECT 1 FROM users) AS has_users');
  return !result.rows[0].has_users;
}

async function currentUser(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const result = await query(
    `SELECT u.id, u.username, u.role, u.access_enabled
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)]
  );
  const user = result.rows[0];
  if (!user || !user.access_enabled) return null;
  return user;
}

async function startSession(res, userId) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
    [hashToken(token), userId, expiresAt.toISOString()]
  );
  res.setHeader('Set-Cookie', sessionCookie(token, SESSION_MS));
}

async function requireAdmin(req, res) {
  const user = await currentUser(req);
  if (!user) {
    sendError(res, 401, 'Sign in required.');
    return null;
  }
  if (user.role !== 'admin') {
    sendError(res, 403, 'Only an admin can do that.');
    return null;
  }
  return user;
}

app.get('/api/health', async (_req, res, next) => {
  try {
    await query('SELECT 1 AS ok');
    const setup = await needsSetup();
    res.json({ ok: true, database: 'postgres', needsSetup: setup });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/session', async (req, res, next) => {
  try {
    const setup = await needsSetup();
    const user = setup ? null : await currentUser(req);
    res.json({ needsSetup: setup, user: user ? publicUser(user) : null });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/setup', async (req, res, next) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  const problem = validateCredentials(username, password);
  if (problem) {
    sendError(res, 400, problem);
    return;
  }
  try {
    const user = await withTransaction(async (client) => {
      await client.query('LOCK TABLE users IN EXCLUSIVE MODE');
      const existing = await client.query('SELECT COUNT(*)::int AS count FROM users');
      if (existing.rows[0].count > 0) {
        const error = new Error('An admin account already exists.');
        error.status = 409;
        throw error;
      }
      const passwordHash = await hashPassword(password);
      const inserted = await client.query(
        `INSERT INTO users (username, password_hash, role, access_enabled)
         VALUES ($1, $2, 'admin', true)
         RETURNING id, username, role`,
        [username, passwordHash]
      );
      return inserted.rows[0];
    });
    await startSession(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error && error.status) {
      sendError(res, error.status, error.message);
      return;
    }
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  try {
    const result = await query(
      `SELECT id, username, role, password_hash, access_enabled
       FROM users WHERE username = $1`,
      [username]
    );
    const user = result.rows[0];
    if (!paddingHash) paddingHash = await hashPassword('unused-timing-padding');
    const passwordOk = await verifyPassword(password, user ? user.password_hash : paddingHash);
    if (!user || !passwordOk) {
      sendError(res, 401, 'Invalid username or password.');
      return;
    }
    if (!user.access_enabled) {
      sendError(res, 403, 'This account does not have access.');
      return;
    }
    await startSession(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const token = readCookie(req, COOKIE);
    if (token) {
      await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
    }
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

function jsonArray(value, limit) {
  if (!Array.isArray(value) || value.length > limit) return null;
  return value;
}

app.get('/api/ledger', async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) {
      sendError(res, 401, 'Sign in required.');
      return;
    }
    const result = await query(
      `SELECT expenses, paycheck_settings, balance_snapshots, transfers, description_choices, removed_choices
       FROM user_ledgers
       WHERE user_id = $1`,
      [user.id]
    );
    const row = result.rows[0];
    if (!row) {
      res.json({
        stored: false,
        expenses: [],
        paycheckSettings: null,
        balanceSnapshots: [],
        transfers: [],
        descriptionChoices: [],
        removedChoices: [],
      });
      return;
    }
    res.json({
      stored: true,
      expenses: row.expenses,
      paycheckSettings: row.paycheck_settings,
      balanceSnapshots: row.balance_snapshots,
      transfers: row.transfers,
      descriptionChoices: row.description_choices,
      removedChoices: row.removed_choices,
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/ledger', async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) {
      sendError(res, 401, 'Sign in required.');
      return;
    }
    const expenses = jsonArray(req.body?.expenses, 20000);
    const balanceSnapshots = jsonArray(req.body?.balanceSnapshots, 5000);
    const transfers = jsonArray(req.body?.transfers, 20000);
    const descriptionChoices = jsonArray(req.body?.descriptionChoices, 500);
    const removedChoices = jsonArray(req.body?.removedChoices, 500);
    const paycheckSettings = req.body?.paycheckSettings ?? null;
    if (!expenses || !balanceSnapshots || !transfers || !descriptionChoices || !removedChoices) {
      sendError(res, 400, 'Expenses could not be saved.');
      return;
    }
    if (paycheckSettings !== null && (typeof paycheckSettings !== 'object' || Array.isArray(paycheckSettings))) {
      sendError(res, 400, 'Expenses could not be saved.');
      return;
    }
    await query(
      `INSERT INTO user_ledgers (
         user_id, expenses, paycheck_settings, balance_snapshots, transfers, description_choices, removed_choices, updated_at
       )
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET
         expenses = EXCLUDED.expenses,
         paycheck_settings = EXCLUDED.paycheck_settings,
         balance_snapshots = EXCLUDED.balance_snapshots,
         transfers = EXCLUDED.transfers,
         description_choices = EXCLUDED.description_choices,
         removed_choices = EXCLUDED.removed_choices,
         updated_at = now()`,
      [
        user.id,
        JSON.stringify(expenses),
        paycheckSettings === null ? null : JSON.stringify(paycheckSettings),
        JSON.stringify(balanceSnapshots),
        JSON.stringify(transfers),
        JSON.stringify(descriptionChoices),
        JSON.stringify(removedChoices),
      ]
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/users', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await query(
      `SELECT id, username, role, access_enabled, created_at
       FROM users
       ORDER BY created_at ASC`
    );
    res.json({
      users: result.rows.map((row) => ({
        id: row.id,
        username: row.username,
        role: row.role,
        accessEnabled: row.access_enabled,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/users', async (req, res, next) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  const problem = validateCredentials(username, password);
  if (problem) {
    sendError(res, 400, problem);
    return;
  }
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const passwordHash = await hashPassword(password);
    const inserted = await query(
      `INSERT INTO users (username, password_hash, role, access_enabled)
       VALUES ($1, $2, 'user', true)
       RETURNING id, username, role, access_enabled, created_at`,
      [username, passwordHash]
    );
    const row = inserted.rows[0];
    res.status(201).json({
      user: {
        id: row.id,
        username: row.username,
        role: row.role,
        accessEnabled: row.access_enabled,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    if (error && error.code === '23505') {
      sendError(res, 409, 'That username is already taken.');
      return;
    }
    next(error);
  }
});

app.patch('/api/admin/users/:id', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = req.params.id;
    const found = await query(
      `SELECT id, username, role, access_enabled FROM users WHERE id = $1`,
      [id]
    );
    const user = found.rows[0];
    if (!user) {
      sendError(res, 404, 'User not found.');
      return;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'accessEnabled')) {
      const accessEnabled = req.body.accessEnabled;
      if (typeof accessEnabled !== 'boolean') {
        sendError(res, 400, 'accessEnabled must be true or false.');
        return;
      }
      if (user.id === admin.id && !accessEnabled) {
        sendError(res, 400, 'You cannot remove your own access.');
        return;
      }
      await query('UPDATE users SET access_enabled = $1 WHERE id = $2', [accessEnabled, id]);
      if (!accessEnabled) {
        await query('DELETE FROM sessions WHERE user_id = $1', [id]);
      }
    }
    if (typeof req.body?.password === 'string') {
      const problem = validateCredentials(user.username, req.body.password);
      if (problem) {
        sendError(res, 400, problem);
        return;
      }
      const passwordHash = await hashPassword(req.body.password);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
      if (user.id !== admin.id) {
        await query('DELETE FROM sessions WHERE user_id = $1', [id]);
      }
    }
    const updated = await query(
      `SELECT id, username, role, access_enabled, created_at FROM users WHERE id = $1`,
      [id]
    );
    const row = updated.rows[0];
    res.json({
      user: {
        id: row.id,
        username: row.username,
        role: row.role,
        accessEnabled: row.access_enabled,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/users/:id', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (req.params.id === admin.id) {
      sendError(res, 400, 'You cannot remove your own admin account.');
      return;
    }
    const deleted = await query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (deleted.rowCount === 0) {
      sendError(res, 404, 'User not found.');
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use('/api', (_req, res) => {
  sendError(res, 404, 'Not found.');
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (!res.headersSent) {
    sendError(res, 500, 'Something went wrong.');
  }
});

if (isProd) {
  const dist = path.join(root, 'dist');
  app.use(express.static(dist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

await migrate();
app.listen(port, () => {
  console.log(`Expensely listening on http://localhost:${port}`);
});
