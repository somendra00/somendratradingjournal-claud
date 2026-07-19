function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

function rowToTrade(row) {
  return {
    id: row.id,
    ticker: row.ticker,
    cls: row.cls,
    dir: row.dir,
    entry: row.entry,
    exit: row.exit,
    size: row.size,
    rr: row.rr,
    date: row.date,
    setup: row.setup,
    notes: row.notes,
    pnl: row.pnl,
    status: row.status,
    roi: row.roi,
  };
}

function rowToConnection(row) {
  return {
    id: row.id,
    platform: row.platform,
    broker: row.broker,
    login: row.login,
    server: row.server,
    metaapiAccountId: row.metaapi_account_id,
    region: row.region,
    status: row.status,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

/* -----------------------------------------------------------------
   MetaApi.cloud integration
   Docs referenced: https://metaapi.cloud/docs/provisioning/ and
   https://metaapi.cloud/docs/client/restApi/
   NOTE: account creation and read-deals-by-time-range are confirmed
   against MetaApi's published docs. Region auto-detection and the
   exact investor-password handling are inferred from general MetaApi
   behavior and may need adjusting once tested against a live token.
------------------------------------------------------------------ */

const METAAPI_PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

function metaapiClientBase(region) {
  const r = region || "new-york";
  return `https://mt-client-api-v1.${r}.agiliumtrade.ai`;
}

async function metaapiCreateAccount(env, { platform, login, password, server }) {
  const res = await fetch(`${METAAPI_PROVISIONING_BASE}/users/current/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "auth-token": env.METAAPI_TOKEN },
    body: JSON.stringify({
      login: String(login),
      password,
      name: `journal-${login}`,
      server,
      platform,
      magic: 0,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `MetaApi account creation failed (${res.status})`);
  }
  return body; // { id, state, region? }
}

async function metaapiGetAccount(env, accountId) {
  const res = await fetch(`${METAAPI_PROVISIONING_BASE}/users/current/accounts/${accountId}`, {
    headers: { "auth-token": env.METAAPI_TOKEN },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Failed to fetch MetaApi account (${res.status})`);
  return body;
}

async function metaapiGetDeals(env, accountId, region, fromISO, toISO) {
  const url = `${metaapiClientBase(region)}/users/current/accounts/${accountId}/history-deals/time/${encodeURIComponent(fromISO)}/${encodeURIComponent(toISO)}`;
  const res = await fetch(url, { headers: { "auth-token": env.METAAPI_TOKEN } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Failed to fetch deal history (${res.status})`);
  return Array.isArray(body) ? body : [];
}

function dealToTrade(deal) {
  // Only closing deals ("OUT") represent a realized win/loss.
  const entryType = deal.entryType || deal.entry;
  if (entryType && entryType !== "DEAL_ENTRY_OUT" && entryType !== "DEAL_ENTRY_OUT_BY") return null;
  if (!deal.symbol) return null;

  const pnl = Number(deal.profit || 0) + Number(deal.commission || 0) + Number(deal.swap || 0);
  // Closing a Long position executes as a SELL deal, and vice versa.
  const dir = deal.type === "DEAL_TYPE_SELL" ? "Long" : "Short";

  return {
    ticker: deal.symbol,
    cls: "Manual",
    dir,
    entry: null,
    exit: deal.price ?? null,
    size: deal.volume ?? null,
    rr: null,
    date: deal.time ? new Date(deal.time).toISOString() : new Date().toISOString(),
    setup: null,
    notes: "Synced from broker",
    pnl,
    status: pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Break-even",
    roi: null,
    brokerDealId: String(deal.id),
  };
}

async function syncConnection(env, conn) {
  if (!conn.metaapi_account_id) return { synced: 0 };

  const from = conn.last_synced_at || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date().toISOString();

  const deals = await metaapiGetDeals(env, conn.metaapi_account_id, conn.region, from, to);
  const trades = deals.map(dealToTrade).filter(Boolean);

  let synced = 0;
  for (const t of trades) {
    const result = await env.DB.prepare(
      `INSERT OR IGNORE INTO trades (ticker, cls, dir, entry, exit, size, rr, date, setup, notes, pnl, status, roi, broker_deal_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(t.ticker, t.cls, t.dir, t.entry, t.exit, t.size, t.rr, t.date, t.setup, t.notes, t.pnl, t.status, t.roi, t.brokerDealId)
      .run();
    if (result.meta.changes > 0) synced += 1;
  }

  await env.DB.prepare("UPDATE broker_connections SET last_synced_at = ?, status = 'connected', last_error = NULL WHERE id = ?")
    .bind(to, conn.id)
    .run();

  return { synced };
}

async function syncAllConnections(env) {
  const { results } = await env.DB.prepare("SELECT * FROM broker_connections WHERE status != 'disconnected'").all();
  const summary = [];
  for (const conn of results) {
    try {
      const { synced } = await syncConnection(env, conn);
      summary.push({ id: conn.id, ok: true, synced });
    } catch (err) {
      await env.DB.prepare("UPDATE broker_connections SET status = 'error', last_error = ? WHERE id = ?")
        .bind(err.message, conn.id)
        .run();
      summary.push({ id: conn.id, ok: false, error: err.message });
    }
  }
  return summary;
}

async function handleBrokerApi(request, env, url) {
  const { pathname } = url;
  const method = request.method;
  const singleConnMatch = pathname.match(/^\/api\/broker\/connections\/(\d+)$/);

  if (pathname === "/api/broker/connections" && method === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM broker_connections ORDER BY created_at DESC").all();
    return json(results.map(rowToConnection));
  }

  if (pathname === "/api/broker/connect" && method === "POST") {
    if (!env.METAAPI_TOKEN) {
      return json({ error: "Broker sync isn't configured yet. Add a METAAPI_TOKEN secret in Cloudflare first." }, { status: 400 });
    }
    const body = await request.json();
    const { platform, broker, login, password, server } = body;
    if (!platform || !login || !password || !server) {
      return json({ error: "Missing platform, login, password, or server" }, { status: 400 });
    }

    const now = new Date().toISOString();
    let metaapiAccountId = null;
    let region = null;
    let status = "pending";
    let lastError = null;

    try {
      const account = await metaapiCreateAccount(env, { platform, login, password, server });
      metaapiAccountId = account.id;
      region = account.region || "new-york";
      status = account.state === "DEPLOYED" ? "connected" : "pending";
    } catch (err) {
      status = "error";
      lastError = err.message;
    }

    const result = await env.DB.prepare(
      `INSERT INTO broker_connections (platform, broker, login, server, metaapi_account_id, region, status, last_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(platform, broker || "Other", String(login), server, metaapiAccountId, region, status, lastError, now)
      .run();

    const row = await env.DB.prepare("SELECT * FROM broker_connections WHERE id = ?").bind(result.meta.last_row_id).first();
    return json(rowToConnection(row), { status: 201 });
  }

  if (pathname === "/api/broker/sync" && method === "POST") {
    if (!env.METAAPI_TOKEN) {
      return json({ error: "Broker sync isn't configured yet. Add a METAAPI_TOKEN secret in Cloudflare first." }, { status: 400 });
    }
    const summary = await syncAllConnections(env);
    return json({ results: summary });
  }

  if (singleConnMatch && method === "DELETE") {
    const id = Number(singleConnMatch[1]);
    await env.DB.prepare("UPDATE broker_connections SET status = 'disconnected' WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return json({ error: "Not found" }, { status: 404 });
}

async function handleApi(request, env, url) {
  const { pathname } = url;
  const method = request.method;
  const singleTradeMatch = pathname.match(/^\/api\/trades\/(\d+)$/);
  const singleWithdrawalMatch = pathname.match(/^\/api\/withdrawals\/(\d+)$/);

  if (pathname.startsWith("/api/broker/")) {
    try {
      return await handleBrokerApi(request, env, url);
    } catch (err) {
      return json({ error: err.message }, { status: 500 });
    }
  }

  try {
    if (pathname === "/api/trades" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM trades ORDER BY date DESC, id DESC"
      ).all();
      return json(results.map(rowToTrade));
    }

    if (pathname === "/api/trades" && method === "POST") {
      const t = await request.json();
      if (!t.ticker || !t.dir || !t.date || !t.status) {
        return json({ error: "Missing required trade fields" }, { status: 400 });
      }
      const result = await env.DB.prepare(
        `INSERT INTO trades (ticker, cls, dir, entry, exit, size, rr, date, setup, notes, pnl, status, roi)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          t.ticker,
          t.cls ?? null,
          t.dir,
          t.entry ?? null,
          t.exit ?? null,
          t.size ?? null,
          t.rr ?? null,
          t.date,
          t.setup ?? null,
          t.notes ?? null,
          t.pnl ?? null,
          t.status,
          t.roi ?? null
        )
        .run();

      const newId = result.meta.last_row_id;
      const row = await env.DB.prepare("SELECT * FROM trades WHERE id = ?").bind(newId).first();
      return json(rowToTrade(row), { status: 201 });
    }

    if (pathname === "/api/trades" && method === "DELETE") {
      await env.DB.prepare("DELETE FROM trades").run();
      await env.DB.prepare("DELETE FROM withdrawals").run();
      await env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES ('starting_balance', '0') ON CONFLICT(key) DO UPDATE SET value = '0'"
      ).run();
      return json({ ok: true });
    }

    if (singleTradeMatch && method === "PUT") {
      const id = Number(singleTradeMatch[1]);
      const t = await request.json();
      if (!t.ticker || !t.dir || !t.date || !t.status) {
        return json({ error: "Missing required trade fields" }, { status: 400 });
      }
      await env.DB.prepare(
        `UPDATE trades SET ticker = ?, cls = ?, dir = ?, entry = ?, exit = ?, size = ?, rr = ?, date = ?, setup = ?, notes = ?, pnl = ?, status = ?, roi = ?
         WHERE id = ?`
      )
        .bind(
          t.ticker,
          t.cls ?? null,
          t.dir,
          t.entry ?? null,
          t.exit ?? null,
          t.size ?? null,
          t.rr ?? null,
          t.date,
          t.setup ?? null,
          t.notes ?? null,
          t.pnl ?? null,
          t.status,
          t.roi ?? null,
          id
        )
        .run();

      const row = await env.DB.prepare("SELECT * FROM trades WHERE id = ?").bind(id).first();
      if (!row) return json({ error: "Trade not found" }, { status: 404 });
      return json(rowToTrade(row));
    }

    if (singleTradeMatch && method === "DELETE") {
      const id = Number(singleTradeMatch[1]);
      await env.DB.prepare("DELETE FROM trades WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    if (pathname === "/api/withdrawals" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM withdrawals ORDER BY date DESC, id DESC").all();
      return json(results);
    }

    if (pathname === "/api/withdrawals" && method === "POST") {
      const w = await request.json();
      const amount = Number(w.amount);
      if (isNaN(amount) || amount <= 0) {
        return json({ error: "Withdrawal amount must be a positive number" }, { status: 400 });
      }
      const date = w.date || new Date().toISOString();
      const result = await env.DB.prepare("INSERT INTO withdrawals (amount, date, notes) VALUES (?, ?, ?)")
        .bind(amount, date, w.notes ?? null)
        .run();
      const row = await env.DB.prepare("SELECT * FROM withdrawals WHERE id = ?").bind(result.meta.last_row_id).first();
      return json(row, { status: 201 });
    }

    if (singleWithdrawalMatch && method === "DELETE") {
      const id = Number(singleWithdrawalMatch[1]);
      await env.DB.prepare("DELETE FROM withdrawals WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    if (pathname === "/api/settings" && method === "GET") {
      const row = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = 'starting_balance'"
      ).first();
      return json({ startingBalance: row ? parseFloat(row.value) : 0 });
    }

    if (pathname === "/api/settings" && method === "PUT") {
      const body = await request.json();
      const value = Number(body.startingBalance);
      if (isNaN(value) || value < 0) {
        return json({ error: "Invalid startingBalance" }, { status: 400 });
      }
      await env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES ('starting_balance', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
        .bind(String(value))
        .run();
      return json({ ok: true });
    }

    return json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    if (!env.METAAPI_TOKEN) return;
    ctx.waitUntil(syncAllConnections(env));
  },
};
