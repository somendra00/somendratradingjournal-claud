import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
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
  ImagePlus,
  Loader2,
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
  const containerRef = useRef(null);
  const btnRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const measure = () => {
      const btn = btnRefs.current[active];
      const container = containerRef.current;
      if (!btn || !container) return;
      const btnRect = btn.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicator({ left: btnRect.left - containerRect.left, width: btnRect.width, ready: true });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  return (
    <>
      <style>{`
        @keyframes glassSheen {
          0%, 100% { transform: translateX(-30%) rotate(8deg); opacity: 0.5; }
          50% { transform: translateX(30%) rotate(8deg); opacity: 0.85; }
        }
        .liquid-glass-nav {
          position: relative;
          overflow: hidden;
          background: rgba(18,18,26,0.55);
          -webkit-backdrop-filter: blur(28px) saturate(190%);
          backdrop-filter: blur(28px) saturate(190%);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 20px;
          box-shadow:
            0 12px 40px rgba(0,0,0,0.5),
            0 2px 8px rgba(0,0,0,0.35),
            inset 0 1px 0 rgba(255,255,255,0.16),
            inset 0 -1px 0 rgba(0,0,0,0.25);
        }
        .liquid-glass-nav::before {
          content: "";
          position: absolute;
          inset: -40% -10%;
          background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.16) 48%, rgba(255,255,255,0.03) 58%, transparent 70%);
          pointer-events: none;
          animation: glassSheen 9s ease-in-out infinite;
        }
        .tab-indicator {
          position: absolute;
          top: 6px;
          bottom: 6px;
          left: 0;
          border-radius: 14px;
          background-color: rgba(143,124,247,0.28);
          border: 1px solid rgba(143,124,247,0.45);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.35),
            inset 0 -1px 2px rgba(0,0,0,0.25),
            0 2px 10px rgba(143,124,247,0.35);
          transition:
            transform 620ms cubic-bezier(0.34,1.56,0.64,1),
            width 620ms cubic-bezier(0.34,1.56,0.64,1);
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .tab-indicator::after {
          content: "";
          position: absolute;
          top: -60%;
          left: 10%;
          width: 80%;
          height: 60%;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(255,255,255,0.4), transparent 70%);
          pointer-events: none;
        }
        .tab-btn {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          min-width: 58px;
          padding: 8px 14px;
          border-radius: 14px;
          background: transparent;
          border: none;
          transform: scale(1);
          transition: transform 620ms cubic-bezier(0.34,1.56,0.64,1);
        }
        .tab-btn.is-active {
          transform: scale(1.045);
        }
        .tab-icon {
          transition: color 560ms cubic-bezier(0.22,1,0.36,1);
          display: flex;
        }
        .tab-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: -0.01em;
          transition: color 560ms cubic-bezier(0.22,1,0.36,1);
        }
      `}</style>
      <nav
        className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 justify-center px-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)", paddingTop: "8px" }}
      >
        <div ref={containerRef} className="liquid-glass-nav flex items-center gap-0.5 px-1.5 py-1.5">
          <div
            className="tab-indicator"
            style={{
              transform: `translateX(${indicator.left}px)`,
              width: indicator.width,
              opacity: indicator.ready ? 1 : 0,
            }}
          />
          {NAV_ITEMS.map((it) => {
            const isActive = active === it.label;
            return (
              <button
                key={it.label}
                ref={(el) => (btnRefs.current[it.label] = el)}
                onClick={() => setActive(it.label)}
                className={`tab-btn ${isActive ? "is-active" : ""}`}
              >
                <span className="tab-icon" style={{ color: isActive ? "#ffffff" : COLORS.inkFaint }}>
                  <it.icon size={18} color="currentColor" strokeWidth={isActive ? 2.3 : 2} />
                </span>
                <span className="tab-label" style={{ color: isActive ? "#ffffff" : COLORS.inkFaint, fontFamily: FONT_BODY }}>
                  {it.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
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
    <div className="rounded-2xl p-5 flex flex-col justify-between h-full" style={{ background: "var(--glass-card-bg)", border: "1px solid var(--glass-card-border)", backdropFilter: "var(--glass-card-blur)", WebkitBackdropFilter: "var(--glass-card-blur)" }}>
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
    <div className="rounded-2xl p-5 flex flex-col justify-between h-full" style={{ background: "var(--glass-card-bg)", border: "1px solid var(--glass-card-border)", backdropFilter: "var(--glass-card-blur)", WebkitBackdropFilter: "var(--glass-card-blur)" }}>
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
    <div className="rounded-2xl p-6 flex-1 min-w-0" style={{ background: "var(--glass-card-bg)", border: "1px solid var(--glass-card-border)", backdropFilter: "var(--glass-card-blur)", WebkitBackdropFilter: "var(--glass-card-blur)" }}>
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

function TradeLog({ data, limit, onEdit, onDelete }) {
  const [query, setQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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
    <div className="rounded-2xl p-6" style={{ background: "var(--glass-card-bg)", border: "1px solid var(--glass-card-border)", backdropFilter: "var(--glass-card-blur)", WebkitBackdropFilter: "var(--glass-card-blur)" }}>
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
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
              {["Date", "Asset", "Dir", "Size", "P&L", "Status", ""].map((h) => (
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
                  {t.size ?? "—"}
                </td>
                <td
                  className="px-2 py-3.5 text-xs font-semibold whitespace-nowrap"
                  style={{ color: t.pnl == null ? COLORS.inkFaint : t.pnl >= 0 ? COLORS.lime : COLORS.coral, fontFamily: FONT_MONO }}
                >
                  {t.pnl == null ? "—" : `${t.pnl >= 0 ? "+" : ""}${money(t.pnl)}`}
                </td>
                <td className="px-2 py-3.5 whitespace-nowrap">
                  <StatusPill status={t.status} />
                </td>
                <td className="px-2 py-3.5 whitespace-nowrap">
                  {confirmDeleteId === t.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          onDelete(t.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold"
                        style={{ background: COLORS.coralSoft, color: COLORS.coral, fontFamily: FONT_BODY }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold"
                        style={{ background: COLORS.surface2, color: COLORS.inkDim, fontFamily: FONT_BODY }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button onClick={() => onEdit(t)} className="p-1.5 rounded-lg hover:bg-white/5" title="Edit trade">
                        <Pencil size={14} color={COLORS.inkFaint} />
                      </button>
                      <button onClick={() => setConfirmDeleteId(t.id)} className="p-1.5 rounded-lg hover:bg-white/5" title="Delete trade">
                        <Trash2 size={14} color={COLORS.inkFaint} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-sm" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
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

function JournalView({ onSave, currentBalance }) {
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
    <div className="max-w-xl flex flex-col gap-4">
      <div
        className="rounded-2xl p-5 flex items-center justify-between"
        style={{ background: "var(--glass-card-bg)", border: "1px solid var(--glass-card-border)", backdropFilter: "var(--glass-card-blur)", WebkitBackdropFilter: "var(--glass-card-blur)" }}
      >
        <span className="text-xs font-medium tracking-wide uppercase" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
          Current Balance
        </span>
        <span className="text-xl font-semibold" style={{ color: COLORS.lime, fontFamily: FONT_MONO, letterSpacing: "-0.02em" }}>
          {money(currentBalance)}
        </span>
      </div>

      <div className="rounded-2xl p-6" style={{ background: "var(--glass-card-bg)", border: "1px solid var(--glass-card-border)", backdropFilter: "var(--glass-card-blur)", WebkitBackdropFilter: "var(--glass-card-blur)" }}>
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
    <div className="rounded-2xl p-6" style={{ background: "var(--glass-card-bg)", border: "1px solid var(--glass-card-border)", backdropFilter: "var(--glass-card-blur)", WebkitBackdropFilter: "var(--glass-card-blur)" }}>
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
  const profitDays = entries.filter(([, pnl]) => pnl > 0);
  const lossDays = entries.filter(([, pnl]) => pnl < 0);

  const best = profitDays.length ? profitDays.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
  const worst = lossDays.length ? lossDays.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;

  return {
    best: best ? { date: best[0], pnl: best[1] } : null,
    worst: worst ? { date: worst[0], pnl: worst[1] } : { date: null, pnl: 0 },
  };
}

function computeTradeExtremes(data) {
  const closed = data.filter((t) => t.status !== "Open" && t.pnl != null);
  if (!closed.length) return { bestTrade: null, worstTrade: null };

  let bestTrade = closed[0];
  let worstTrade = closed[0];
  closed.forEach((t) => {
    if (t.pnl > bestTrade.pnl || (t.pnl === bestTrade.pnl && new Date(t.date) > new Date(bestTrade.date))) {
      bestTrade = t;
    }
    if (t.pnl < worstTrade.pnl || (t.pnl === worstTrade.pnl && new Date(t.date) > new Date(worstTrade.date))) {
      worstTrade = t;
    }
  });

  return { bestTrade, worstTrade };
}

function DayExtremeCard({ title, icon: Icon, entry, tone }) {
  const color = tone === "positive" ? COLORS.lime : COLORS.coral;
  const bg = tone === "positive" ? COLORS.limeSoft : COLORS.coralSoft;
  const hasDate = entry && entry.date;
  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--glass-card-bg)", border: "1px solid var(--glass-card-border)", backdropFilter: "var(--glass-card-blur)", WebkitBackdropFilter: "var(--glass-card-blur)" }}>
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
          <div className="text-2xl font-semibold mb-1" style={{ color: hasDate ? color : COLORS.inkDim, fontFamily: FONT_MONO, letterSpacing: "-0.02em" }}>
            {entry.pnl > 0 ? "+" : ""}
            {money(entry.pnl)}
          </div>
          <div className="text-xs" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
            {hasDate
              ? new Date(entry.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
              : "No losing days yet"}
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

function TradeExtremeCard({ title, icon: Icon, trade, tone }) {
  const color = tone === "positive" ? COLORS.lime : COLORS.coral;
  const bg = tone === "positive" ? COLORS.limeSoft : COLORS.coralSoft;
  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--glass-card-bg)", border: "1px solid var(--glass-card-border)", backdropFilter: "var(--glass-card-blur)", WebkitBackdropFilter: "var(--glass-card-blur)" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Icon size={14} color={color} />
        </div>
        <h3 className="text-sm font-semibold" style={{ color: COLORS.ink, fontFamily: FONT_BODY }}>
          {title}
        </h3>
      </div>
      {trade ? (
        <>
          <div className="text-2xl font-semibold mb-1" style={{ color, fontFamily: FONT_MONO, letterSpacing: "-0.02em" }}>
            {trade.pnl >= 0 ? "+" : ""}
            {money(trade.pnl)}
          </div>
          <div className="text-xs" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
            {trade.ticker} · {new Date(trade.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
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
  const { bestTrade, worstTrade } = computeTradeExtremes(data);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <DayExtremeCard title="Best Profit Day" icon={TrendingUp} entry={best} tone="positive" />
        <DayExtremeCard title="Worst Loss Day" icon={TrendingDown} entry={worst} tone="negative" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <TradeExtremeCard title="Best Trade" icon={TrendingUp} trade={bestTrade} tone="positive" />
        <TradeExtremeCard title="Worst Trade" icon={TrendingDown} trade={worstTrade} tone="negative" />
      </div>

      <div className="max-w-md">
        <div className="rounded-2xl p-6" style={{ background: "var(--glass-card-bg)", border: "1px solid var(--glass-card-border)", backdropFilter: "var(--glass-card-blur)", WebkitBackdropFilter: "var(--glass-card-blur)" }}>
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

/* ---------------------------------------------------------------
   MT5 SCREENSHOT IMPORT — OCR + layout parsing
   MT5 history rows render as two lines per trade:
     line 1: SYMBOL  buy/sell  LOT  ....................  PROFIT
     line 2: entry → exit  ....................  yyyy.mm.dd hh:mm:ss
   Profit/loss sign is printed explicitly by MT5 ("-12.34" vs "12.34"),
   so we can parse from OCR text directly without needing pixel colors.
------------------------------------------------------------------ */

async function runMT5Ocr(file, onProgress) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data;
  } finally {
    await worker.terminate();
  }
}

function groupWordsIntoLines(words) {
  const valid = words.filter((w) => w.text && w.text.trim() && w.bbox);
  const sorted = [...valid].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const avgHeight = sorted.length ? sorted.reduce((s, w) => s + (w.bbox.y1 - w.bbox.y0), 0) / sorted.length : 20;
  const threshold = Math.max(10, avgHeight * 0.6);

  const lines = [];
  sorted.forEach((w) => {
    const cy = (w.bbox.y0 + w.bbox.y1) / 2;
    let line = lines.find((l) => Math.abs(l.cy - cy) < threshold);
    if (!line) {
      line = { cy, words: [] };
      lines.push(line);
    }
    line.words.push(w);
    line.cy = (line.cy * (line.words.length - 1) + cy) / line.words.length;
  });
  lines.forEach((l) => l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0));
  lines.sort((a, b) => a.cy - b.cy);
  return lines;
}

function parseMT5Trades(ocrData) {
  const words = (ocrData && ocrData.words) || [];
  const lines = groupWordsIntoLines(words);

  const dirRe = /^(buy|sell)$/i;
  const numRe = /^-?\d+(\.\d+)?$/;
  const dateRe = /^\d{4}[.\-]\d{2}[.\-]\d{2}$/;
  const timeRe = /^\d{2}:\d{2}:\d{2}$/;

  const trades = [];
  let pending = null;

  for (const line of lines) {
    const texts = line.words.map((w) => w.text.trim()).filter(Boolean);
    const dirIdx = texts.findIndex((t) => dirRe.test(t));

    if (dirIdx > 0) {
      const symbol = texts[dirIdx - 1].replace(/[^A-Za-z0-9.#/]/g, "");
      const dirWord = texts[dirIdx].toLowerCase();
      const lotToken = texts[dirIdx + 1];
      const lot = lotToken && numRe.test(lotToken) ? parseFloat(lotToken) : null;

      const numericTokens = texts.filter((t) => numRe.test(t) && !dateRe.test(t));
      let profit = null;
      if (numericTokens.length) {
        const last = numericTokens[numericTokens.length - 1];
        profit = last === lotToken && numericTokens.length > 1 ? parseFloat(numericTokens[numericTokens.length - 2]) : parseFloat(last);
      }

      pending = { symbol, dir: dirWord === "buy" ? "Long" : "Short", lot, profit };
      continue;
    }

    const dateToken = texts.find((t) => dateRe.test(t));
    const timeToken = texts.find((t) => timeRe.test(t));
    if (dateToken && pending) {
      const isoParts = dateToken.replace(/-/g, ".").split(".");
      let isoDate = new Date().toISOString();
      if (isoParts.length === 3) {
        const [y, m, d] = isoParts;
        const t = timeToken || "00:00:00";
        const parsed = new Date(`${y}-${m}-${d}T${t}`);
        if (!isNaN(parsed)) isoDate = parsed.toISOString();
      }
      trades.push({
        ticker: pending.symbol.toUpperCase(),
        dir: pending.dir,
        size: pending.lot,
        pnl: pending.profit,
        date: isoDate,
      });
      pending = null;
    }
  }

  return trades.filter((t) => t.ticker && t.ticker.length >= 2 && t.pnl !== null && !isNaN(t.pnl));
}

function ImportScreenshotModal({ open, onClose, onImport }) {
  const fileInputRef = useRef(null);
  const [stage, setStage] = useState("idle"); // idle | processing | review | error
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setStage("idle");
    setProgress(0);
    setRows([]);
    setErrorMsg("");
    setImporting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setStage("processing");
    setProgress(0);
    try {
      const ocrData = await runMT5Ocr(file, setProgress);
      const parsed = parseMT5Trades(ocrData);
      if (!parsed.length) {
        setErrorMsg("Couldn't find any trade rows in that screenshot. Try a clearer, uncropped capture of the History tab.");
        setStage("error");
        return;
      }
      setRows(parsed.map((t, i) => ({ ...t, id: i, include: true })));
      setStage("review");
    } catch (err) {
      setErrorMsg(err.message || "Something went wrong reading that image.");
      setStage("error");
    }
  };

  const updateRow = (id, patch) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  const confirmImport = async () => {
    const selected = rows.filter((r) => r.include && r.ticker && r.pnl !== "" && r.pnl !== null && !isNaN(r.pnl));
    if (!selected.length) return;
    setImporting(true);
    const payload = selected.map((r) => ({
      ticker: r.ticker.toUpperCase(),
      cls: "Manual",
      dir: r.dir,
      entry: null,
      exit: null,
      size: r.size !== "" && r.size !== null ? parseFloat(r.size) : null,
      rr: null,
      date: r.date,
      setup: null,
      notes: "Imported from MT5 screenshot",
      pnl: parseFloat(r.pnl),
      status: parseFloat(r.pnl) > 0 ? "Win" : parseFloat(r.pnl) < 0 ? "Loss" : "Break-even",
      roi: null,
    }));
    try {
      await onImport(payload);
      handleClose();
    } catch (err) {
      setErrorMsg("Import failed. Please try again.");
      setStage("error");
      setImporting(false);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        onClick={handleClose}
      />
      <div
        className="fixed top-0 right-0 h-screen w-full max-w-xl z-50 flex flex-col transition-transform duration-300 ease-out"
        style={{
          background: "rgba(16,16,24,0.85)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          borderLeft: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "inset 1px 0 0 rgba(255,255,255,0.06), -12px 0 40px rgba(0,0,0,0.4)",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: FONT_DISPLAY }}>
            Import MT5 Screenshot
          </h3>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/5">
            <X size={18} color={COLORS.inkDim} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {stage === "idle" && (
            <div className="flex flex-col items-center justify-center text-center gap-4 py-16">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: COLORS.violetSoft }}>
                <ImagePlus size={26} color={COLORS.violet} />
              </div>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: COLORS.ink, fontFamily: FONT_BODY }}>
                  Upload a screenshot of your MT5 History tab
                </p>
                <p className="text-xs max-w-xs mx-auto" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
                  We'll read the symbol, direction, lot size, and P&L from each row automatically — you'll get a chance to review before anything is saved.
                </p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: COLORS.violet, color: "#0a0a12", fontFamily: FONT_BODY }}
              >
                Choose Screenshot
              </button>
            </div>
          )}

          {stage === "processing" && (
            <div className="flex flex-col items-center justify-center text-center gap-4 py-20">
              <Loader2 size={28} color={COLORS.violet} className="animate-spin" />
              <p className="text-sm" style={{ color: COLORS.inkDim, fontFamily: FONT_BODY }}>
                Reading trades from your screenshot… {progress}%
              </p>
            </div>
          )}

          {stage === "error" && (
            <div className="flex flex-col items-center justify-center text-center gap-4 py-16">
              <p className="text-sm" style={{ color: COLORS.coral, fontFamily: FONT_BODY }}>
                {errorMsg}
              </p>
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: COLORS.surface2, color: COLORS.ink, border: `1px solid ${COLORS.line}`, fontFamily: FONT_BODY }}
              >
                Try Again
              </button>
            </div>
          )}

          {stage === "review" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs mb-1" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
                Found {rows.length} trade{rows.length === 1 ? "" : "s"}. Review and fix anything OCR got wrong, then import.
              </p>
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: COLORS.surface2, border: `1px solid ${COLORS.line}` }}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={r.include} onChange={(e) => updateRow(r.id, { include: e.target.checked })} className="shrink-0" />
                    <input
                      value={r.ticker}
                      onChange={(e) => updateRow(r.id, { ticker: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                      style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, color: COLORS.ink, fontFamily: FONT_MONO }}
                      placeholder="Symbol"
                    />
                    <select
                      value={r.dir}
                      onChange={(e) => updateRow(r.id, { dir: e.target.value })}
                      className="px-2 py-1.5 rounded-lg text-xs outline-none appearance-none"
                      style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, color: COLORS.ink, fontFamily: FONT_MONO }}
                    >
                      <option value="Long">Long</option>
                      <option value="Short">Short</option>
                    </select>
                    <button onClick={() => removeRow(r.id)} className="p-1.5 rounded-lg hover:bg-white/5 shrink-0">
                      <Trash2 size={13} color={COLORS.inkFaint} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <input
                      type="number"
                      step="any"
                      value={r.size ?? ""}
                      onChange={(e) => updateRow(r.id, { size: e.target.value })}
                      className="w-24 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                      style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, color: COLORS.ink, fontFamily: FONT_MONO }}
                      placeholder="Lot size"
                    />
                    <input
                      type="number"
                      step="any"
                      value={r.pnl ?? ""}
                      onChange={(e) => updateRow(r.id, { pnl: e.target.value })}
                      className="w-28 px-2.5 py-1.5 rounded-lg text-xs outline-none font-semibold"
                      style={{
                        background: COLORS.bg,
                        border: `1px solid ${COLORS.line}`,
                        color: parseFloat(r.pnl) >= 0 ? COLORS.lime : COLORS.coral,
                        fontFamily: FONT_MONO,
                      }}
                      placeholder="P&L"
                    />
                    <span className="text-[11px]" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
                      {new Date(r.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {stage === "review" && (
          <div className="px-6 py-5" style={{ borderTop: `1px solid ${COLORS.line}` }}>
            <button
              onClick={confirmImport}
              disabled={importing}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: COLORS.violet, color: "#0a0a12", fontFamily: FONT_BODY }}
            >
              {importing && <Loader2 size={15} className="animate-spin" />}
              {importing ? "Importing…" : `Import ${rows.filter((r) => r.include).length} Trade${rows.filter((r) => r.include).length === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function toCSV(data) {
  const headers = ["date", "ticker", "direction", "lotSize", "pnl", "status", "notes"];
  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = data.map((t) => [t.date, t.ticker, t.dir, t.size ?? "", t.pnl ?? "", t.status, t.notes ?? ""]);
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (c === "," && !inQuotes) {
        values.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    values.push(cur);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = values[i] !== undefined ? values[i].trim() : ""));
    return obj;
  });
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DataView({ data, onClearAll, onImport }) {
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState(null);
  const [screenshotOpen, setScreenshotOpen] = useState(false);

  const handleExportCSV = () => {
    downloadFile(`trading-journal-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(data), "text/csv");
  };

  const handleExportJSON = () => {
    downloadFile(`trading-journal-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const trades = rows
        .map((r) => {
          const pnl = parseFloat(r.pnl);
          return {
            ticker: (r.ticker || r.asset || "").toUpperCase(),
            cls: "Manual",
            dir: r.direction || r.dir || "Long",
            entry: null,
            exit: null,
            size: r.lotsize ? parseFloat(r.lotsize) : r.size ? parseFloat(r.size) : null,
            rr: null,
            date: r.date && !isNaN(new Date(r.date)) ? new Date(r.date).toISOString() : new Date().toISOString(),
            setup: null,
            notes: r.notes || "—",
            pnl: isNaN(pnl) ? 0 : pnl,
            status: pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Break-even",
            roi: null,
          };
        })
        .filter((t) => t.ticker);

      if (!trades.length) {
        setImportStatus({ ok: false, message: "No valid rows found. Expected columns: date, ticker, direction, lotSize, pnl, notes." });
      } else {
        await onImport(trades);
        setImportStatus({ ok: true, message: `Imported ${trades.length} trade${trades.length === 1 ? "" : "s"}.` });
      }
    } catch (err) {
      setImportStatus({ ok: false, message: "Couldn't read that file. Make sure it's a CSV." });
    } finally {
      e.target.value = "";
      setTimeout(() => setImportStatus(null), 4000);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Trades Stored" value={String(data.length)} sub="Across all asset classes" />
        <MetricCard label="Storage Used" value="1.2 MB" sub="Well under any plan limit" />
        <MetricCard label="Last Sync" value="Just now" sub="Cloud sync active" tone="positive" />
      </div>
      <div className="rounded-2xl p-6" style={{ background: "var(--glass-card-bg)", border: "1px solid var(--glass-card-border)", backdropFilter: "var(--glass-card-blur)", WebkitBackdropFilter: "var(--glass-card-blur)" }}>
        <h3 className="text-base font-bold text-white mb-1" style={{ fontFamily: FONT_DISPLAY }}>
          Import & Export
        </h3>
        <p className="text-xs mb-5" style={{ color: COLORS.inkFaint }}>
          Move your data in and out of the journal
        </p>

        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleExportCSV}
            className="text-left p-4 rounded-xl transition-colors hover:bg-white/[0.03]"
            style={{ background: COLORS.surface2, border: `1px solid ${COLORS.line}` }}
          >
            <div className="text-sm font-semibold mb-1" style={{ color: COLORS.ink, fontFamily: FONT_BODY }}>
              Export as CSV
            </div>
            <div className="text-xs" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
              Download your full trade history for spreadsheets or tax prep.
            </div>
          </button>

          <button
            onClick={handleExportJSON}
            className="text-left p-4 rounded-xl transition-colors hover:bg-white/[0.03]"
            style={{ background: COLORS.surface2, border: `1px solid ${COLORS.line}` }}
          >
            <div className="text-sm font-semibold mb-1" style={{ color: COLORS.ink, fontFamily: FONT_BODY }}>
              Export as JSON
            </div>
            <div className="text-xs" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
              Raw structured export for custom tooling or backups.
            </div>
          </button>

          <button
            onClick={handleImportClick}
            className="text-left p-4 rounded-xl transition-colors hover:bg-white/[0.03]"
            style={{ background: COLORS.surface2, border: `1px solid ${COLORS.line}` }}
          >
            <div className="text-sm font-semibold mb-1" style={{ color: COLORS.ink, fontFamily: FONT_BODY }}>
              Import CSV
            </div>
            <div className="text-xs" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
              Columns: date, ticker, direction, lotSize, pnl, notes.
            </div>
          </button>

          <button
            onClick={() => setScreenshotOpen(true)}
            className="text-left p-4 rounded-xl transition-colors hover:bg-white/[0.03]"
            style={{ background: COLORS.violetSoft, border: `1px solid rgba(143,124,247,0.35)` }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <ImagePlus size={14} color={COLORS.violet} />
              <span className="text-sm font-semibold" style={{ color: COLORS.ink, fontFamily: FONT_BODY }}>
                Import MT5 Screenshot
              </span>
            </div>
            <div className="text-xs" style={{ color: COLORS.inkFaint, fontFamily: FONT_BODY }}>
              Upload a History tab screenshot — trades are read automatically.
            </div>
          </button>
        </div>

        {importStatus && (
          <div
            className="mt-3 px-3 py-2 rounded-lg text-xs"
            style={{
              background: importStatus.ok ? COLORS.limeSoft : COLORS.coralSoft,
              color: importStatus.ok ? COLORS.lime : COLORS.coral,
              fontFamily: FONT_BODY,
            }}
          >
            {importStatus.message}
          </div>
        )}
      </div>
      <div className="rounded-2xl p-6" style={{ background: "var(--glass-card-bg)", border: `1px solid ${COLORS.coralSoft}`, backdropFilter: "var(--glass-card-blur)", WebkitBackdropFilter: "var(--glass-card-blur)" }}>
        <h3 className="text-base font-bold text-white mb-1" style={{ fontFamily: FONT_DISPLAY }}>
          Danger Zone
        </h3>
        <p className="text-xs mb-5" style={{ color: COLORS.inkFaint }}>
          Permanently remove every trade from this journal. This can't be undone.
        </p>
        <ClearDataButton onClear={onClearAll} />
      </div>

      <ImportScreenshotModal open={screenshotOpen} onClose={() => setScreenshotOpen(false)} onImport={onImport} />
    </div>
  );
}

/* ---------------------------------------------------------------
   ADD TRADE PANEL (full modal — used outside Journal tab)
------------------------------------------------------------------ */

const inputStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: COLORS.ink,
  fontFamily: FONT_MONO,
};

function AddTradePanel({ open, onClose, onSave, editingTrade }) {
  const isEdit = !!editingTrade;
  const [form, setForm] = useState({ asset: "XAU/USD", customAsset: "", direction: "Long", lotSize: "", pnl: "" });

  useEffect(() => {
    if (!open) return;
    if (editingTrade) {
      const knownAsset = JOURNAL_ASSET_OPTIONS.includes(editingTrade.ticker) ? editingTrade.ticker : "Other";
      setForm({
        asset: knownAsset,
        customAsset: knownAsset === "Other" ? editingTrade.ticker : "",
        direction: editingTrade.dir,
        lotSize: editingTrade.size != null ? String(editingTrade.size) : "",
        pnl: editingTrade.pnl != null ? String(editingTrade.pnl) : "",
      });
    } else {
      setForm({ asset: "XAU/USD", customAsset: "", direction: "Long", lotSize: "", pnl: "" });
    }
  }, [editingTrade, open]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const assetValue = form.asset === "Other" ? form.customAsset.trim() : form.asset;
    if (!assetValue || form.pnl === "") return;
    onSave({ ...form, asset: assetValue });
    onClose();
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 h-screen w-full max-w-md z-50 flex flex-col transition-transform duration-300 ease-out"
        style={{
          background: "rgba(16,16,24,0.72)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          borderLeft: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "inset 1px 0 0 rgba(255,255,255,0.06), -12px 0 40px rgba(0,0,0,0.4)",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: FONT_DISPLAY }}>
            {isEdit ? "Edit Trade" : "Log New Trade"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5">
            <X size={18} color={COLORS.inkDim} />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          <Field label="Asset">
            <select value={form.asset} onChange={update("asset")} className="px-3.5 py-2.5 rounded-xl text-sm outline-none appearance-none" style={inputStyle}>
              {JOURNAL_ASSET_OPTIONS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>

          {form.asset === "Other" && (
            <Field label="Custom Asset">
              <input value={form.customAsset} onChange={update("customAsset")} placeholder="e.g. ETH/USD" className="px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Direction">
              <select value={form.direction} onChange={update("direction")} className="px-3.5 py-2.5 rounded-xl text-sm outline-none appearance-none" style={inputStyle}>
                <option>Long</option>
                <option>Short</option>
              </select>
            </Field>
            <Field label="Lot Size">
              <input type="number" step="any" value={form.lotSize} onChange={update("lotSize")} placeholder="0.00" className="px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <Field label="Net Profit or Loss ($)">
            <input type="number" step="any" value={form.pnl} onChange={update("pnl")} placeholder="e.g. 250 or -120" className="px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
          </Field>

          <button type="submit" className="mt-2 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90" style={{ background: COLORS.violet, color: "#0a0a12", fontFamily: FONT_BODY }}>
            {isEdit ? "Update Trade" : "Save Trade"}
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
  async updateTrade(id, trade) {
    const res = await fetch(`/api/trades/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trade),
    });
    if (!res.ok) throw new Error("Failed to update trade");
    return res.json();
  },
  async deleteTrade(id) {
    const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete trade");
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
  const [editingTrade, setEditingTrade] = useState(null);
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

  const openAddTrade = () => {
    setEditingTrade(null);
    setPanelOpen(true);
  };

  const openEditTrade = (trade) => {
    setEditingTrade(trade);
    setPanelOpen(true);
  };

  const closeTradePanel = () => {
    setPanelOpen(false);
    setEditingTrade(null);
  };

  const handleSaveTrade = async (form) => {
    const pnl = parseFloat(form.pnl);
    const payload = {
      ticker: form.asset.toUpperCase(),
      cls: "Manual",
      dir: form.direction,
      entry: null,
      exit: null,
      size: form.lotSize ? parseFloat(form.lotSize) : null,
      rr: null,
      date: editingTrade ? editingTrade.date : new Date().toISOString(),
      setup: null,
      notes: editingTrade ? editingTrade.notes : "—",
      pnl,
      status: pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Break-even",
      roi: null,
    };
    try {
      if (editingTrade) {
        const saved = await api.updateTrade(editingTrade.id, payload);
        setLog((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      } else {
        const saved = await api.addTrade(payload);
        setLog((prev) => [saved, ...prev]);
      }
    } catch (err) {
      setLoadError(err.message);
    }
  };

  const handleDeleteTrade = async (id) => {
    try {
      await api.deleteTrade(id);
      setLog((prev) => prev.filter((t) => t.id !== id));
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

  const handleImportTrades = async (trades) => {
    try {
      const saved = [];
      for (const trade of trades) {
        const result = await api.addTrade(trade);
        saved.push(result);
      }
      setLog((prev) => [...saved, ...prev]);
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
      <style>{`
        :root {
          --glass-card-bg: ${COLORS.surface};
          --glass-card-border: ${COLORS.line};
          --glass-card-blur: none;
        }
        @media (max-width: 767px) {
          :root {
            --glass-card-bg: rgba(19,19,29,0.6);
            --glass-card-border: rgba(255,255,255,0.13);
            --glass-card-blur: blur(22px) saturate(180%);
          }
          .rounded-2xl {
            position: relative;
            overflow: hidden;
          }
          .rounded-2xl::before {
            content: "";
            position: absolute;
            inset: -60% -20%;
            background: linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%);
            pointer-events: none;
          }
        }
      `}</style>
      <Sidebar active={active} setActive={setActive} />
      <MobileNav active={active} setActive={setActive} />

      <main className="flex-1 min-w-0 px-5 md:px-8 pt-7 pb-32 md:pb-7">
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
              onClick={openAddTrade}
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

            <TradeLog data={log} limit={5} onEdit={openEditTrade} onDelete={handleDeleteTrade} />
          </div>
        )}

        {active === "Journal" && <JournalView onSave={handleSaveJournal} currentBalance={stats.currentBalance} />}

        {active === "Analytics" && <TradeCalendar data={log} />}

        {active === "Goals" && <GoalsView todayPnL={stats.todayPnL} startingBalance={startingBalance} data={log} />}

        {active === "Data" && <DataView data={log} onClearAll={handleClearAll} onImport={handleImportTrades} />}
      </main>

      <AddTradePanel open={panelOpen} onClose={closeTradePanel} onSave={handleSaveTrade} editingTrade={editingTrade} />
    </div>
  );
}
