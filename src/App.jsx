import React, { useState, useMemo, useEffect } from "react";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  LayoutGrid,
  BookOpen,
  BarChart3,
  Target,
  Database,
  Search,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
  AlertTriangle,
  CalendarDays,
  Trash2,
} from "lucide-react";

/* ---------------------------------------------------------------
   TOKENS
   bg        #06060a  (void)
   surface   #0d0d13  (panel)
   surface-2 #131320  (raised panel / hover)
   line      rgba(255,255,255,0.07)
   ink       #eceef2
   ink-dim   #6f7280
   violet    #8f7cf7  (signal / accent)
   lime      #baf23c  (profit)
   coral     #ff6a5f  (loss)
   amber     #f5b942  (open / pending)
   Fonts: 'Space Grotesk' (display), 'Inter' (body), 'IBM Plex Mono' (all figures)
------------------------------------------------------------------ */

const FONT_DISPLAY = "'Space Grotesk', 'Inter', sans-serif";
const FONT_BODY = "'Inter', sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Menlo', monospace";

const COLORS = {
  bg: "#06060a",
  surface: "#0d0d13",
  surface2: "#131320",
  line: "rgba(255,255,255,0.07)",
  lineSoft: "rgba(255,255,255,0.045)",
  ink: "#eceef2",
  inkDim: "#8b8d99",
  inkFaint: "#54566a",
  violet: "#8f7cf7",
  violetSoft: "rgba(143,124,247,0.12)",
  lime: "#baf23c",
  limeSoft: "rgba(186,242,60,0.10)",
  coral: "#ff6a5f",
  coralSoft: "rgba(255,106,95,0.10)",
  amber: "#f5b942",
};

/* ---------------------------------------------------------------
   MOCK DATA
------------------------------------------------------------------ */

const ASSET_CLASSES = ["Crypto", "Equity", "Forex", "Index", "Manual"];
const JOURNAL_ASSET_OPTIONS = ["XAU/USD", "BTC/USD", "Other"];
const DEFAULT_START_BALANCE = 0;

/* ---------------------------------------------------------------
   STATS (derived from live trade log + editable starting balance)
------------------------------------------------------------------ */

function computeStats(list, startingBalance) {
  const closedTrades = list.filter((t) => t.status !== "Open");
  const wins = closedTrades.filter((t) => t.status === "Win");
  const losses = closedTrades.filter((t) => t.status === "Loss");
  const netPnL = closedTrades.reduce((s, t) => s + t.pnl, 0);
  const winRate = closedTrades.length ? (wins.length / closedTrades.length) * 100 : 0;
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss ? grossWin / grossLoss : grossWin;
  const currentBalance = startingBalance + netPnL;
  const accountGrowth = startingBalance ? (netPnL / startingBalance) * 100 : 0;

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStr = now.toDateString();

  const weeklyProfit = closedTrades
    .filter((t) => new Date(t.date) >= weekAgo)
    .reduce((s, t) => s + t.pnl, 0);
  const monthlyProfit = closedTrades
    .filter((t) => new Date(t.date) >= monthStart)
    .reduce((s, t) => s + t.pnl, 0);
  const todayPnL = closedTrades
    .filter((t) => new Date(t.date).toDateString() === todayStr)
    .reduce((s, t) => s + t.pnl, 0);

  return {
    closedTrades,
    wins,
    losses,
    netPnL,
    winRate,
    profitFactor,
    currentBalance,
    accountGrowth,
    weeklyProfit,
    monthlyProfit,
    todayPnL,
    totalTrades: list.length,
    openTrades: list.length - closedTrades.length,
  };
}

function buildEquityCurve(list, startingBalance) {
  const sorted = [...list].filter((t) => t.status !== "Open").sort((a, b) => new Date(a.date) - new Date(b.date));
  let bal = startingBalance;
  const points = [{ date: "Start", balance: bal }];
  sorted.forEach((t) => {
    bal += t.pnl;
    points.push({
      date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      balance: Math.round(bal),
    });
  });
  return points;
}

/* ---------------------------------------------------------------
   SMALL HELPERS
------------------------------------------------------------------ */

const money = (n, opts = {}) =>
  (n < 0 ? "-$" : "$") +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, ...opts });

const numFmt = (n, digits = 2) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function StatusPill({ status }) {
  const map = {
    Win: { bg: COLORS.limeSoft, fg: COLORS.lime },
    Loss: { bg: COLORS.coralSoft, fg: COLORS.coral },
    Open: { bg: "rgba(245,185,66,0.10)", fg: COLORS.amber },
    "Break-even": { bg: "rgba(255,255,255,0.08)", fg: COLORS.inkDim },
  };
  const c = map[status] || map["Break-even"];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide"
      style={{ background: c.bg, color: c.fg, fontFamily: FONT_MONO }}
    >
      {status}
    </span>
  );
}

/* ---------------------------------------------------------------
   NAVIGATION
------------------------------------------------------------------ */

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutGrid },
  { label: "Journal", icon: BookOpen },
  { label: "Analytics", icon: BarChart3 },
  { label: "Goals", icon: Target },
  { label: "Data", icon: Database },
];

function MobileNav({ active, setActive }) {
  return (
    <div
      className="flex md:hidden items-center gap-1 px-3 py-2.5 overflow-x-auto sticky top-0 z-30"
      style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.line}` }}
    >
      {NAV_ITEMS.map((it) => {
        const isActive = active === it.label;
        return (
          <button
            key={it.label}
            onClick={() => setActive(it.label)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
            style={{
              background: isActive ? COLORS.surface2 : "transparent",
              color: isActive ? COLORS.ink : COLORS.inkDim,
              fontFamily: FONT_BODY,
            }}
          >
            <it.icon size={14} color={isActive ? COLORS.violet : COLORS.inkFaint} strokeWidth={2} />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function Sidebar({ active, setActive }) {
  return (
    <aside
      className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 px-5 py-7"
      style={{ background: COLORS.bg, borderRight: `1px solid ${COLORS.line}` }}
    >
      <div className="flex items-center gap-3 mb-10 px-1">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: COLORS.violetSoft }}>
          <TrendingUp size={18} color={COLORS.violet} strokeWidth={2.4} />
        </div>
        <div>
          <div className="text-white font-bold leading-tight" style={{ fontFamily: FONT_DISPLAY, fontSize: "15px" }}>
            Somendra's
          </div>
          <div className="text-[10px] tracking-[0.2em]" style={{ color: COLORS.inkFaint }}>
            JOURNAL
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((it) => {
          const isActive = active === it.label;
          return (
            <button
              key={it.label}
              onClick={() => setActive(it.label)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                background: isActive ? COLORS.surface2 : "transparent",
                color: isActive ? COLORS.ink : COLORS.inkDim,
                fontFamily: FONT_BODY,
              }}
            >
              <it.icon size={17} color={isActive ? COLORS.violet : COLORS.inkFaint} strokeWidth={2} />
              {it.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-6" style={{ borderTop: `1px solid ${COLORS.line}` }}>
        <div className="flex items-center gap-2 px-1 pt-4 text-xs" style={{ color: COLORS.inkFaint }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.lime }} />
          Sync: Cloud
        </div>
      </div>
    </aside>
  );
}

/* ---------------------------------------------------------------
   METRIC CARDS
------------------------------------------------------------------ */

function MetricCard({ label, icon: Icon, value, sub, tone = "neutral", big = false }) {
  const toneColor = tone === "positive" ? COLORS.lime : tone === "negative" ? COLORS.coral : COLORS.ink;
  return (
    <div className="rounded-2xl p-5 flex flex-col justify-between h-full" style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium tracking-wide uppercase" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
          {label}
        </span>
        {Icon && <Icon size={15} color={COLORS.inkFaint} strokeWidth={2} />}
      </div>
      <div>
        <div className={big ? "text-3xl" : "text-2xl"} style={{ fontFamily: FONT_MONO, fontWeight: 600, color: toneColor, letterSpacing: "-0.02em" }}>
          {value}
        </div>
        {sub && (
          <div className="text-xs mt-1.5" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function EditableStartingBalanceCard({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(String(value));

  const save = () => {
    const parsed = parseFloat(temp);
    if (!isNaN(parsed) && parsed >= 0) onChange(parsed);
    else setTemp(String(value));
    setEditing(false);
  };

  return (
    <div className="rounded-2xl p-5 flex flex-col justify-between h-full" style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium tracking-wide uppercase" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
          Starting Balance
        </span>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <span className="text-2xl" style={{ fontFamily: FONT_MONO, color: COLORS.inkFaint }}>
            $
          </span>
          <input
            autoFocus
            type="number"
            step="any"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="text-3xl font-semibold bg-transparent outline-none w-full border-b"
            style={{ fontFamily: FONT_MONO, color: COLORS.ink, borderColor: COLORS.violet, letterSpacing: "-0.02em" }}
          />
          <button onClick={save} className="p-1.5 rounded-lg shrink-0" style={{ background: COLORS.limeSoft }}>
            <Check size={16} color={COLORS.lime} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <div className="text-3xl" style={{ fontFamily: FONT_MONO, fontWeight: 600, color: COLORS.ink, letterSpacing: "-0.02em" }}>
            {money(value)}
          </div>
          <button
            onClick={() => {
              setTemp(String(value));
              setEditing(true);
            }}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <Pencil size={15} color={COLORS.inkFaint} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   EQUITY CURVE
------------------------------------------------------------------ */

function EquityCurveCard({ curve, accountGrowth }) {
  return (
    <div className="rounded-2xl p-6 flex-1 min-w-0" style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-white" style={{ fontFamily: FONT_DISPLAY }}>
          Equity Curve
        </h3>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-semibold"
          style={{ background: accountGrowth >= 0 ? COLORS.limeSoft : COLORS.coralSoft, color: accountGrowth >= 0 ? COLORS.lime : COLORS.coral, fontFamily: FONT_MONO }}
        >
          {accountGrowth >= 0 ? "+" : ""}
          {accountGrowth.toFixed(1)}%
        </span>
      </div>
      <p className="text-xs mb-5" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
        Account balance growth over time
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={curve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.violet} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COLORS.violet} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={COLORS.lineSoft} />
          <XAxis dataKey="date" tick={{ fill: COLORS.inkFaint, fontSize: 11, fontFamily: FONT_MONO }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={2} />
          <YAxis
            tick={{ fill: COLORS.inkFaint, fontSize: 11, fontFamily: FONT_MONO }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            width={52}
          />
          <Tooltip
            contentStyle={{ background: COLORS.surface2, border: `1px solid ${COLORS.line}`, borderRadius: 10, fontFamily: FONT_MONO, fontSize: 12 }}
            labelStyle={{ color: COLORS.inkDim }}
            formatter={(v) => [money(v), "Balance"]}
          />
          <Area type="monotone" dataKey="balance" stroke={COLORS.violet} strokeWidth={2.4} fill="url(#equityFill)" dot={false} activeDot={{ r: 4, fill: COLORS.violet, stroke: COLORS.bg, strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------------
   TRADE LOG TABLE
------------------------------------------------------------------ */

function TradeLog({ data, limit }) {
  const [query, setQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = useMemo(() => {
    const result = data
      .filter((t) => (assetFilter === "All" ? true : t.cls === assetFilter))
      .filter((t) => (statusFilter === "All" ? true : t.status === statusFilter))
      .filter((t) => {
        const q = query.toLowerCase();
        if (!q) return true;
        return (
          t.ticker.toLowerCase().includes(q) ||
          (t.notes || "").toLowerCase().includes(q) ||
          (t.setup || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const isFiltering = query.trim() !== "" || assetFilter !== "All" || statusFilter !== "All";
    if (limit && !isFiltering) return result.slice(0, limit);
    return result;
  }, [data, query, assetFilter, statusFilter, limit]);

  return (
    <div className="rounded-2xl p-6" style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="text-base font-bold text-white" style={{ fontFamily: FONT_DISPLAY }}>
            Trade Log
          </h3>
          <p className="text-xs mt-1" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
            {limit ? `Showing ${filtered.length} most recent · search to find any trade` : `${filtered.length} of ${data.length} trades`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: COLORS.surface2, border: `1px solid ${COLORS.line}` }}>
            <Search size={14} color={COLORS.inkFaint} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ticker, setup, notes…"
              className="bg-transparent outline-none text-sm w-48"
              style={{ color: COLORS.ink, fontFamily: FONT_BODY }}
            />
          </div>

          <SelectPill value={assetFilter} onChange={setAssetFilter} options={["All", ...ASSET_CLASSES]} />
          <SelectPill value={statusFilter} onChange={setStatusFilter} options={["All", "Win", "Loss", "Open"]} />
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full min-w-[920px] border-collapse">
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
              {["Date", "Asset", "Dir", "Entry", "Exit", "Size", "R:R", "Net ROI", "Status", "Notes"].map((h) => (
                <th key={h} className="text-left px-2 py-3 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="transition-colors duration-150 hover:bg-white/[0.02]" style={{ borderBottom: `1px solid ${COLORS.lineSoft}` }}>
                <td className="px-2 py-3.5 text-xs whitespace-nowrap" style={{ color: COLORS.inkDim, fontFamily: FONT_MONO }}>
                  {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  <span className="ml-1.5" style={{ color: COLORS.inkFaint }}>
                    {new Date(t.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </td>
                <td className="px-2 py-3.5 text-sm font-semibold whitespace-nowrap" style={{ color: COLORS.ink, fontFamily: FONT_BODY }}>
                  {t.ticker}
                  {t.cls && (
                    <div className="text-[10px] font-normal" style={{ color: COLORS.inkFaint }}>
                      {t.cls}
                    </div>
                  )}
                </td>
                <td className="px-2 py-3.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: t.dir === "Long" ? COLORS.lime : COLORS.coral, fontFamily: FONT_MONO }}>
                    {t.dir === "Long" ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {t.dir}
                  </span>
                </td>
                <td className="px-2 py-3.5 text-xs whitespace-nowrap" style={{ color: COLORS.inkDim, fontFamily: FONT_MONO }}>
                  {t.entry != null ? numFmt(t.entry, t.cls === "Forex" ? 4 : 2) : "—"}
                </td>
                <td className="px-2 py-3.5 text-xs whitespace-nowrap" style={{ color: COLORS.inkDim, fontFamily: FONT_MONO }}>
                  {t.exit != null ? numFmt(t.exit, t.cls === "Forex" ? 4 : 2) : "—"}
                </td>
                <td className="px-2 py-3.5 text-xs whitespace-nowrap" style={{ color: COLORS.inkDim, fontFamily: FONT_MONO }}>
                  {t.size ?? "—"}
                </td>
                <td className="px-2 py-3.5 text-xs whitespace-nowrap" style={{ color: COLORS.inkDim, fontFamily: FONT_MONO }}>
                  {t.rr != null ? `1:${t.rr.toFixed(1)}` : "—"}
                </td>
                <td
                  className="px-2 py-3.5 text-xs font-semibold whitespace-nowrap"
                  style={{ color: t.roi == null ? COLORS.inkFaint : t.roi >= 0 ? COLORS.lime : COLORS.coral, fontFamily: FONT_MONO }}
                >
                  {t.roi == null ? "—" : `${t.roi >= 0 ? "+" : ""}${t.roi.toFixed(2)}%`}
                </td>
                <td className="px-2 py-3.5 whitespace-nowrap">
                  <StatusPill status={t.status} />
                </td>
                <td className="px-2 py-3.5 text-xs max-w-[220px] truncate" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
                  {t.notes}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-10 text-sm" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
                  No trades match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SelectPill({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 rounded-xl text-sm outline-none cursor-pointer"
        style={{ background: COLORS.surface2, border: `1px solid ${COLORS.line}`, color: COLORS.ink, fontFamily: FONT_BODY }}
      >
        {options.map((o) => (
          <option key={o} value={o} style={{ background: COLORS.surface2 }}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown size={13} color={COLORS.inkFaint} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

/* ---------------------------------------------------------------
   JOURNAL — TRADE ENTRY ONLY
------------------------------------------------------------------ */

const journalInputStyle = {
  background: COLORS.surface2,
  border: `1px solid ${COLORS.line}`,
  color: COLORS.ink,
  fontFamily: FONT_MONO,
};

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium" style={{ color: COLORS.inkDim, fontFamily: FONT_BODY }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function JournalView({ onSave }) {
  const [form, setForm] = useState({ asset: "XAU/USD", customAsset: "", direction: "Long", pnl: "", lotSize: "", notes: "" });
  const [justSaved, setJustSaved] = useState(false);
  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const assetValue = form.asset === "Other" ? form.customAsset.trim() : form.asset;
    if (!assetValue || form.pnl === "") return;
    onSave({ ...form, asset: assetValue });
    setForm({ asset: "XAU/USD", customAsset: "", direction: "Long", pnl: "", lotSize: "", notes: "" });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2200);
  };

  return (
    <div className="max-w-xl">
      <div className="rounded-2xl p-6" style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
        <h3 className="text-base font-bold text-white mb-1" style={{ fontFamily: FONT_DISPLAY }}>
          Log a Trade
        </h3>
        <p className="text-xs mb-6" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
          Quick entry — asset, direction, result, size, and notes
        </p>

        <form onSubmit={submit} className="flex flex-col gap-5">
          <Field label="Asset">
            <select value={form.asset} onChange={update("asset")} className="px-3.5 py-2.5 rounded-xl text-sm outline-none appearance-none" style={journalInputStyle}>
              {JOURNAL_ASSET_OPTIONS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>

          {form.asset === "Other" && (
            <Field label="Custom Asset">
              <input
                value={form.customAsset}
                onChange={update("customAsset")}
                placeholder="e.g. ETH/USD"
                className="px-3.5 py-2.5 rounded-xl text-sm outline-none"
                style={journalInputStyle}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Direction">
              <select value={form.direction} onChange={update("direction")} className="px-3.5 py-2.5 rounded-xl text-sm outline-none appearance-none" style={journalInputStyle}>
                <option>Long</option>
                <option>Short</option>
              </select>
            </Field>
            <Field label="Lot Size">
              <input
                type="number"
                step="any"
                value={form.lotSize}
                onChange={update("lotSize")}
                placeholder="0.00"
                className="px-3.5 py-2.5 rounded-xl text-sm outline-none"
                style={journalInputStyle}
              />
            </Field>
          </div>

          <Field label="Profit or Loss ($)">
            <input
              type="number"
              step="any"
              value={form.pnl}
              onChange={update("pnl")}
              placeholder="e.g. 250 or -120"
              className="px-3.5 py-2.5 rounded-xl text-sm outline-none"
              style={journalInputStyle}
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={update("notes")}
              placeholder="What was your read on this trade?"
              rows={5}
              className="px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ ...journalInputStyle, fontFamily: FONT_BODY }}
            />
          </Field>

          <button
            type="submit"
            className="mt-1 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: COLORS.violet, color: "#0a0a12", fontFamily: FONT_BODY }}
          >
            Save Trade
          </button>

          {justSaved && (
            <div className="text-xs text-center py-2 rounded-lg" style={{ background: COLORS.limeSoft, color: COLORS.lime, fontFamily: FONT_BODY }}>
              Trade saved to your journal.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   ANALYTICS — MONTHLY CALENDAR
------------------------------------------------------------------ */

function TradeCalendar({ data }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();

  const monthLabel = base.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const pnlByDay = useMemo(() => {
    const map = {};
    data
      .filter((t) => t.status !== "Open")
      .forEach((t) => {
        const d = new Date(t.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          map[day] = (map[day] || 0) + t.pnl;
        }
      });
    return map;
  }, [data, year, month]);

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayMatches = (d) => {
    const now = new Date();
    return d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  };

  return (
    <div className="rounded-2xl p-6" style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CalendarDays size={17} color={COLORS.violet} />
          <h3 className="text-base font-bold text-white" style={{ fontFamily: FONT_DISPLAY }}>
            {monthLabel}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMonthOffset((m) => m - 1)} className="p-1.5 rounded-lg hover:bg-white/5" style={{ border: `1px solid ${COLORS.line}` }}>
            <ChevronLeft size={15} color={COLORS.inkDim} />
          </button>
          <button onClick={() => setMonthOffset(0)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white/5" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkDim, fontFamily: FONT_BODY }}>
            Today
          </button>
          <button onClick={() => setMonthOffset((m) => m + 1)} className="p-1.5 rounded-lg hover:bg-white/5" style={{ border: `1px solid ${COLORS.line}` }}>
            <ChevronRight size={15} color={COLORS.inkDim} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wide" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((d, i) => {
          if (d === null) return <div key={`empty-${i}`} />;
          const pnl = pnlByDay[d];
          const hasTrade = pnl !== undefined;
          const positive = hasTrade && pnl >= 0;
          return (
            <div key={d} className="group relative aspect-square">
              <div
                className="w-full h-full rounded-xl flex flex-col items-center justify-center transition-transform duration-150 group-hover:scale-[1.06] cursor-default"
                style={{
                  background: hasTrade ? (positive ? COLORS.limeSoft : COLORS.coralSoft) : COLORS.surface2,
                  border: todayMatches(d) ? `1.5px solid ${COLORS.violet}` : `1px solid ${COLORS.line}`,
                }}
              >
                <span className="text-xs font-semibold" style={{ color: hasTrade ? (positive ? COLORS.lime : COLORS.coral) : COLORS.inkDim, fontFamily: FONT_MONO }}>
                  {d}
                </span>
                {hasTrade && (
                  <span className="w-1 h-1 rounded-full mt-1" style={{ background: positive ? COLORS.lime : COLORS.coral }} />
                )}
              </div>

              {hasTrade && (
                <div
                  className="pointer-events-none absolute left-1/2 bottom-full mb-2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10"
                  style={{ background: COLORS.surface2, border: `1px solid ${COLORS.line}`, color: positive ? COLORS.lime : COLORS.coral, fontFamily: FONT_MONO }}
                >
                  {positive ? "+" : ""}
                  {money(pnl)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-5 pt-4" style={{ borderTop: `1px solid ${COLORS.line}` }}>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
          <span className="w-2 h-2 rounded-full" style={{ background: COLORS.lime }} />
          Profitable day
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
          <span className="w-2 h-2 rounded-full" style={{ background: COLORS.coral }} />
          Losing day
        </div>
        <div className="text-xs" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
          Hover a day to see total P&L
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   GOALS — DAILY DRAWDOWN ONLY
------------------------------------------------------------------ */

function computeDayExtremes(data) {
  const byDay = {};
  data
    .filter((t) => t.status !== "Open")
    .forEach((t) => {
      const key = new Date(t.date).toDateString();
      byDay[key] = (byDay[key] || 0) + t.pnl;
    });

  const entries = Object.entries(byDay);
  if (entries.length === 0) return { best: null, worst: null };

  let best = entries[0];
  let worst = entries[0];
  entries.forEach((e) => {
    if (e[1] > best[1]) best = e;
    if (e[1] < worst[1]) worst = e;
  });

  return {
    best: { date: best[0], pnl: best[1] },
    worst: { date: worst[0], pnl: worst[1] },
  };
}

function DayExtremeCard({ title, icon: Icon, entry, tone }) {
  const color = tone === "positive" ? COLORS.lime : COLORS.coral;
  const bg = tone === "positive" ? COLORS.limeSoft : COLORS.coralSoft;
  return (
    <div className="rounded-2xl p-6" style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Icon size={14} color={color} />
        </div>
        <h3 className="text-sm font-semibold" style={{ color: COLORS.ink, fontFamily: FONT_BODY }}>
          {title}
        </h3>
      </div>
      {entry ? (
        <>
          <div className="text-2xl font-semibold mb-1" style={{ color, fontFamily: FONT_MONO, letterSpacing: "-0.02em" }}>
            {entry.pnl >= 0 ? "+" : ""}
            {money(entry.pnl)}
          </div>
          <div className="text-xs" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
            {new Date(entry.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </div>
        </>
      ) : (
        <div className="text-sm" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
          No closed trades yet
        </div>
      )}
    </div>
  );
}

function GoalsView({ todayPnL, startingBalance, data }) {
  const maxDrawdownPct = 5;
  const currentDrawdownPct = todayPnL < 0 ? Math.abs(todayPnL / startingBalance) * 100 : 0;
  const pct = Math.min(100, (currentDrawdownPct / maxDrawdownPct) * 100);
  const breached = currentDrawdownPct >= maxDrawdownPct;
  const { best, worst } = computeDayExtremes(data);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <DayExtremeCard title="Best Profit Day" icon={TrendingUp} entry={best} tone="positive" />
        <DayExtremeCard title="Worst Loss Day" icon={TrendingDown} entry={worst} tone="negative" />
      </div>

      <div className="max-w-md">
        <div className="rounded-2xl p-6" style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} color={breached ? COLORS.coral : COLORS.violet} />
              <h3 className="text-sm font-semibold" style={{ color: COLORS.ink, fontFamily: FONT_BODY }}>
                Daily Drawdown
              </h3>
            </div>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: breached ? COLORS.coralSoft : COLORS.limeSoft, color: breached ? COLORS.coral : COLORS.lime, fontFamily: FONT_MONO }}
            >
              {breached ? "Limit hit" : "Within limit"}
            </span>
          </div>

          <div className="flex items-baseline gap-1.5 mb-3" style={{ fontFamily: FONT_MONO }}>
            <span className="text-3xl font-semibold" style={{ color: breached ? COLORS.coral : COLORS.ink }}>
              {currentDrawdownPct.toFixed(2)}%
            </span>
            <span className="text-sm" style={{ color: COLORS.inkFaint }}>
              / {maxDrawdownPct.toFixed(1)}% max
            </span>
          </div>

          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: COLORS.surface2 }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: breached ? COLORS.coral : COLORS.violet }} />
          </div>

          <p className="text-xs" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
            {todayPnL < 0
              ? `Today's net loss is ${money(Math.abs(todayPnL))}, ${currentDrawdownPct.toFixed(2)}% of your starting balance.`
              : "No losses recorded today — drawdown is at zero."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   DATA VIEW
------------------------------------------------------------------ */

function ClearDataButton({ onClear }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            onClear();
            setConfirming(false);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: COLORS.coral, color: "#1a0a08" }}
        >
          <Trash2 size={15} strokeWidth={2.2} />
          Confirm clear
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-white/5"
          style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkDim, fontFamily: FONT_BODY }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
      style={{ background: COLORS.coralSoft, color: COLORS.coral, fontFamily: FONT_BODY }}
    >
      <Trash2 size={15} strokeWidth={2.2} />
      Clear all data
    </button>
  );
}

function DataView({ data, onClearAll }) {
  const actions = [
    { title: "Export as CSV", desc: "Download your full trade history for spreadsheets or tax prep." },
    { title: "Export as JSON", desc: "Raw structured export for custom tooling or backups." },
    { title: "Import Broker Statement", desc: "Bulk-import fills from a CSV export of your broker." },
    { title: "Connect Broker API", desc: "Auto-sync fills as they happen (read-only)." },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Trades Stored" value={String(data.length)} sub="Across all asset classes" />
        <MetricCard label="Storage Used" value="1.2 MB" sub="Well under any plan limit" />
        <MetricCard label="Last Sync" value="Just now" sub="Cloud sync active" tone="positive" />
      </div>
      <div className="rounded-2xl p-6" style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
        <h3 className="text-base font-bold text-white mb-1" style={{ fontFamily: FONT_DISPLAY }}>
          Import & Export
        </h3>
        <p className="text-xs mb-5" style={{ color: COLORS.inkFaint }}>
          Move your data in and out of the journal
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {actions.map((a) => (
            <button key={a.title} className="text-left p-4 rounded-xl transition-colors hover:bg-white/[0.03]" style={{ background: COLORS.surface2, border: `1px solid ${COLORS.line}` }}>
              <div className="text-sm font-semibold mb-1" style={{ color: COLORS.ink, fontFamily: FONT_BODY }}>
                {a.title}
              </div>
              <div className="text-xs" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
                {a.desc}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl p-6" style={{ background: COLORS.surface, border: `1px solid ${COLORS.coralSoft}` }}>
        <h3 className="text-base font-bold text-white mb-1" style={{ fontFamily: FONT_DISPLAY }}>
          Danger Zone
        </h3>
        <p className="text-xs mb-5" style={{ color: COLORS.inkFaint }}>
          Permanently remove every trade from this journal. This can't be undone.
        </p>
        <ClearDataButton onClear={onClearAll} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   ADD TRADE PANEL (full modal — used outside Journal tab)
------------------------------------------------------------------ */

const inputStyle = journalInputStyle;

function AddTradePanel({ open, onClose, onSave }) {
  const [form, setForm] = useState({
    asset: "",
    setup: "Breakout",
    direction: "Long",
    entry: "",
    exit: "",
    stopLoss: "",
    takeProfit: "",
    notes: "",
  });

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.asset || !form.entry) return;
    onSave(form);
    setForm({ asset: "", setup: "Breakout", direction: "Long", entry: "", exit: "", stopLoss: "", takeProfit: "", notes: "" });
    onClose();
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 h-screen w-full max-w-md z-50 flex flex-col transition-transform duration-300 ease-out"
        style={{ background: COLORS.surface, borderLeft: `1px solid ${COLORS.line}`, transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: FONT_DISPLAY }}>
            Log New Trade
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5">
            <X size={18} color={COLORS.inkDim} />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          <Field label="Asset">
            <input value={form.asset} onChange={update("asset")} placeholder="e.g. BTC/USD" className="px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Setup Type">
              <select value={form.setup} onChange={update("setup")} className="px-3.5 py-2.5 rounded-xl text-sm outline-none appearance-none" style={inputStyle}>
                {["Breakout", "Mean Reversion", "Trend Continuation", "Reversal"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Direction">
              <select value={form.direction} onChange={update("direction")} className="px-3.5 py-2.5 rounded-xl text-sm outline-none appearance-none" style={inputStyle}>
                <option>Long</option>
                <option>Short</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Entry Price">
              <input type="number" step="any" value={form.entry} onChange={update("entry")} placeholder="0.00" className="px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="Exit Price">
              <input type="number" step="any" value={form.exit} onChange={update("exit")} placeholder="0.00" className="px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Stop Loss">
              <input type="number" step="any" value={form.stopLoss} onChange={update("stopLoss")} placeholder="0.00" className="px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="Take Profit">
              <input type="number" step="any" value={form.takeProfit} onChange={update("takeProfit")} placeholder="0.00" className="px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <Field label="Mindset / Notes">
            <textarea
              value={form.notes}
              onChange={update("notes")}
              placeholder="What was your read on the market? How did you feel entering and managing this trade?"
              rows={5}
              className="px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ ...inputStyle, fontFamily: FONT_BODY }}
            />
          </Field>

          <button type="submit" className="mt-2 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90" style={{ background: COLORS.violet, color: "#0a0a12", fontFamily: FONT_BODY }}>
            Save Trade
          </button>
        </form>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------
   API — talks to the Cloudflare Worker + D1 backend so mobile and
   desktop read/write the same data
------------------------------------------------------------------ */

const api = {
  async getTrades() {
    const res = await fetch("/api/trades");
    if (!res.ok) throw new Error("Failed to load trades");
    return res.json();
  },
  async addTrade(trade) {
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trade),
    });
    if (!res.ok) throw new Error("Failed to save trade");
    return res.json();
  },
  async clearAll() {
    const res = await fetch("/api/trades", { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to clear data");
    return res.json();
  },
  async getSettings() {
    const res = await fetch("/api/settings");
    if (!res.ok) throw new Error("Failed to load settings");
    return res.json();
  },
  async updateSettings(settings) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error("Failed to update settings");
    return res.json();
  },
};

/* ---------------------------------------------------------------
   APP
------------------------------------------------------------------ */

export default function App() {
  const [active, setActive] = useState("Dashboard");
  const [panelOpen, setPanelOpen] = useState(false);
  const [log, setLog] = useState([]);
  const [startingBalance, setStartingBalanceState] = useState(DEFAULT_START_BALANCE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [trades, settings] = await Promise.all([api.getTrades(), api.getSettings()]);
        if (cancelled) return;
        setLog(trades);
        setStartingBalanceState(settings.startingBalance);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => computeStats(log, startingBalance), [log, startingBalance]);
  const curve = useMemo(() => buildEquityCurve(log, startingBalance), [log, startingBalance]);

  const setStartingBalance = async (value) => {
    setStartingBalanceState(value);
    try {
      await api.updateSettings({ startingBalance: value });
    } catch (err) {
      setLoadError(err.message);
    }
  };

  const handleSaveFull = async (form) => {
    const entry = parseFloat(form.entry);
    const exit = form.exit ? parseFloat(form.exit) : null;
    const pnl = exit ? Number(((exit - entry) * (form.direction === "Long" ? 1 : -1) * 10).toFixed(2)) : null;
    const newTrade = {
      ticker: form.asset.toUpperCase(),
      cls: "Equity",
      dir: form.direction,
      entry,
      exit,
      size: 10,
      rr: 2.0,
      date: new Date().toISOString(),
      setup: form.setup,
      notes: form.notes || "—",
      pnl,
      status: pnl === null ? "Open" : pnl >= 0 ? "Win" : "Loss",
      roi: pnl !== null ? (pnl / (entry * 10)) * 100 : null,
    };
    try {
      const saved = await api.addTrade(newTrade);
      setLog((prev) => [saved, ...prev]);
    } catch (err) {
      setLoadError(err.message);
    }
  };

  const handleClearAll = async () => {
    try {
      await api.clearAll();
      setLog([]);
      setStartingBalanceState(0);
    } catch (err) {
      setLoadError(err.message);
    }
  };

  const handleSaveJournal = async (form) => {
    const pnl = parseFloat(form.pnl);
    const newTrade = {
      ticker: form.asset.toUpperCase(),
      cls: "Manual",
      dir: form.direction,
      entry: null,
      exit: null,
      size: form.lotSize ? parseFloat(form.lotSize) : null,
      rr: null,
      date: new Date().toISOString(),
      setup: null,
      notes: form.notes || "—",
      pnl,
      status: pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Break-even",
      roi: null,
    };
    try {
      const saved = await api.addTrade(newTrade);
      setLog((prev) => [saved, ...prev]);
    } catch (err) {
      setLoadError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full" style={{ background: COLORS.bg }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" />
        <p className="text-sm" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
          Loading your journal…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full" style={{ background: COLORS.bg, fontFamily: FONT_BODY }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" />
      <Sidebar active={active} setActive={setActive} />
      <MobileNav active={active} setActive={setActive} />

      <main className="flex-1 min-w-0 px-5 md:px-8 py-7">
        {loadError && (
          <div className="mb-5 px-4 py-3 rounded-xl text-sm" style={{ background: COLORS.coralSoft, color: COLORS.coral, fontFamily: FONT_BODY }}>
            {loadError} — changes may not be saved. Try refreshing.
          </div>
        )}

        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: FONT_DISPLAY }}>
              {active}
            </h1>
            <p className="text-sm mt-1" style={{ color: COLORS.inkFaint }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          {active !== "Journal" && (
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-transform hover:scale-[1.02]"
              style={{ background: COLORS.violet, color: "#0a0a12" }}
            >
              <Plus size={16} strokeWidth={2.5} />
              Add Trade
            </button>
          )}
        </div>

        {active === "Dashboard" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <EditableStartingBalanceCard value={startingBalance} onChange={setStartingBalance} />
              <MetricCard label="Current Balance" value={money(stats.currentBalance)} tone="positive" big />
              <MetricCard
                label="Weekly Profit"
                icon={stats.weeklyProfit >= 0 ? TrendingUp : TrendingDown}
                value={`${stats.weeklyProfit >= 0 ? "+" : ""}${money(stats.weeklyProfit)}`}
                sub="Net P&L, last 7 days"
                tone={stats.weeklyProfit >= 0 ? "positive" : "negative"}
              />
              <MetricCard
                label="Monthly Profit"
                icon={stats.monthlyProfit >= 0 ? TrendingUp : TrendingDown}
                value={`${stats.monthlyProfit >= 0 ? "+" : ""}${money(stats.monthlyProfit)}`}
                sub="Net P&L, this calendar month"
                tone={stats.monthlyProfit >= 0 ? "positive" : "negative"}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricCard
                label="Net P&L"
                icon={stats.netPnL >= 0 ? TrendingUp : TrendingDown}
                value={`${stats.netPnL >= 0 ? "+" : ""}${money(stats.netPnL)}`}
                sub={`${stats.accountGrowth >= 0 ? "+" : ""}${stats.accountGrowth.toFixed(2)}% account growth`}
                tone={stats.netPnL >= 0 ? "positive" : "negative"}
              />
              <MetricCard label="Win Rate" icon={Percent} value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.wins.length} of ${stats.closedTrades.length} trades won`} />
              <MetricCard label="Profit Factor" icon={Activity} value={stats.profitFactor > 99 ? "99.99" : stats.profitFactor.toFixed(2)} sub="Gross win / gross loss" />
            </div>

            <EquityCurveCard curve={curve} accountGrowth={stats.accountGrowth} />

            <TradeLog data={log} limit={5} />
          </div>
        )}

        {active === "Journal" && <JournalView onSave={handleSaveJournal} />}

        {active === "Analytics" && <TradeCalendar data={log} />}

        {active === "Goals" && <GoalsView todayPnL={stats.todayPnL} startingBalance={startingBalance} data={log} />}

        {active === "Data" && <DataView data={log} onClearAll={handleClearAll} />}
      </main>

      <AddTradePanel open={panelOpen} onClose={() => setPanelOpen(false)} onSave={handleSaveFull} />
    </div>
  );
}
