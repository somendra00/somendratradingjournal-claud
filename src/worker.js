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

async function handleApi(request, env, url) {
  const { pathname } = url;
  const method = request.method;
  const singleTradeMatch = pathname.match(/^\/api\/trades\/(\d+)$/);

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
};
