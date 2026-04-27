"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: "#3d2c2e" }}>{children}</strong>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
};

interface StockRow {
  ticker: string;
  name: string;
  pe_ratio?: number | null;
  pb_ratio?: number | null;
  roe?: number | null;
  eps?: number | null;
  market_cap?: number | null;
  price?: number | null;
}

type MetricKey = "pe_ratio" | "pb_ratio" | "roe" | "eps";
type SortKey = keyof StockRow;

const METRIC_TABS: { key: MetricKey; label: string }[] = [
  { key: "pe_ratio", label: "P/E Ratio" },
  { key: "pb_ratio", label: "P/B Ratio" },
  { key: "roe", label: "ROE" },
  { key: "eps", label: "EPS" },
];

const CRORE = 1_00_00_000;
const LAKH_CRORE = 1_00_000_00_00_000;

function formatMarketCap(raw: number | null | undefined): string {
  if (!raw) return "—";
  if (raw >= LAKH_CRORE) return `₹${(raw / LAKH_CRORE).toFixed(2)} L Cr`;
  return `₹${Math.round(raw / CRORE).toLocaleString("en-IN")} Cr`;
}

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("en-IN", { maximumFractionDigits: decimals });
}

function parseSignal(content: string): "Bullish" | "Neutral" | "Bearish" | null {
  const signalIdx = content.toLowerCase().lastIndexOf("sector signal");
  if (signalIdx === -1) return null;
  const afterSignal = content.slice(signalIdx);
  if (/bullish/i.test(afterSignal)) return "Bullish";
  if (/bearish/i.test(afterSignal)) return "Bearish";
  if (/neutral/i.test(afterSignal)) return "Neutral";
  return null;
}

function parseSections(content: string): { heading: string; body: string }[] {
  const regex = /(?:^|\n)\*{0,2}(\d+\.\s+[A-Z][A-Z ]+)\*{0,2}\n([\s\S]*?)(?=\n\*{0,2}\d+\.\s+[A-Z]|$)/g;
  const sections: { heading: string; body: string }[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const heading = match[1].trim();
    const body = match[2].trim();
    if (heading && body) sections.push({ heading, body });
  }
  return sections;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

function SignalBadge({ signal }: { signal: "Bullish" | "Neutral" | "Bearish" }) {
  const config = {
    Bullish: { bg: "#dcfce7", color: "#166534", dot: "#16a34a" },
    Neutral: { bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" },
    Bearish: { bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
  }[signal];

  return (
    <span
      className="inline-flex items-center gap-2 text-lg font-bold px-5 py-2 rounded-xl"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: config.dot }} />
      {signal}
    </span>
  );
}

function CompanyChart({ stocks, metric }: { stocks: StockRow[]; metric: MetricKey }) {
  const data = stocks
    .filter((s) => s[metric] !== null && s[metric] !== undefined)
    .map((s) => ({
      name: s.name?.split(" ")[0] ?? s.ticker,
      value: metric === "roe" ? (s[metric]! * 100) : s[metric]!,
    }));

  if (data.length === 0) return (
    <p className="text-sm italic" style={{ color: "#886f68" }}>No data available.</p>
  );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#886f68" }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fontSize: 11, fill: "#886f68" }} width={48} />
        <Tooltip
          contentStyle={{ backgroundColor: "#f5edf0", border: "1px solid #d1ccdc", borderRadius: 8, fontSize: 12 }}
          cursor={{ fill: "#d1ccdc40" }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="#424c55" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function SectorPage({ params }: { params: { sector: string } }) {
  const sector = decodeURIComponent(params.sector);

  const [content, setContent] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(false);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [sectors, setSectors] = useState<{ sector: string; display_name: string }[]>([]);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("pe_ratio");
  const [sortKey, setSortKey] = useState<SortKey>("pe_ratio");
  const [sortAsc, setSortAsc] = useState(true);

  // Load sector list from Supabase
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("sectors")
      .select("sector, display_name")
      .order("display_name")
      .then(({ data }) => {
        if (data && data.length > 0) setSectors(data);
      });
  }, []);

  // Load sector summary + stocks
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    setLoading(true);
    setContent(null);
    setGeneratedAt(null);
    setStocks([]);

    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    supabase
      .from("sector_summaries")
      .select("content, generated_at")
      .eq("sector", sector)
      .gt("generated_at", cutoff)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return;

        if (data) {
          setContent(data.content);
          setGeneratedAt(data.generated_at);
          setLoading(false);

          // Fetch stocks for this sector from Supabase
          const { data: sectorRow } = await supabase
            .from("sectors")
            .select("tickers")
            .eq("sector", sector)
            .maybeSingle();

          if (sectorRow?.tickers?.length && !cancelled) {
            const { data: stockRows } = await supabase
              .from("stocks")
              .select("ticker, name, pe_ratio, pb_ratio, roe, eps, market_cap, price")
              .in("ticker", sectorRow.tickers);
            if (stockRows && !cancelled) setStocks(stockRows as StockRow[]);
          }
          return;
        }

        // No fresh cache — call webhook
        setLoading(false);
        setLiveLoading(true);
        try {
          const res = await fetch(
            "https://n8n-production-fa88.up.railway.app/webhook/sector-analysis",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sector }),
            }
          );
          if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
          const raw = await res.json();
          const item = Array.isArray(raw) ? raw[0] : raw;

          if (!cancelled) {
            setContent(item.content ?? null);
            setGeneratedAt(new Date().toISOString());

            if (item.stocks) {
              try {
                const parsed: StockRow[] =
                  typeof item.stocks === "string"
                    ? JSON.parse(item.stocks)
                    : item.stocks;
                setStocks(parsed);
              } catch {
                console.error("[sector] failed to parse stocks JSON");
              }
            }
          }

          // Save to Supabase
          if (item.content) {
            supabase.from("sector_summaries").insert({
              sector,
              content: item.content,
              signal: item.signal ?? null,
              generated_at: new Date().toISOString(),
              model_version: "llama-3.1-8b-instant",
            });
          }
        } catch (e) {
          console.error("[sector] webhook error:", e);
        } finally {
          if (!cancelled) setLiveLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [sector]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((a) => !a);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sortedStocks = [...stocks].sort((a, b) => {
    const av = a[sortKey] as number | null | undefined;
    const bv = b[sortKey] as number | null | undefined;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return sortAsc ? av - bv : bv - av;
  });

  const sections = content ? parseSections(content) : [];
  const signal = content ? parseSignal(content) : null;

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>
    ) : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f5edf0" }}>
      {/* Header */}
      <header
        className="w-full px-6 py-4 flex items-center justify-between border-b"
        style={{ borderColor: "#d1ccdc", backgroundColor: "#f5edf0" }}
      >
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#3d2c2e" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="white"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <span
            className="text-lg font-bold tracking-tight group-hover:opacity-80 transition-opacity"
            style={{ color: "#3d2c2e" }}
          >
            MarketLens
          </span>
        </Link>
        <span className="text-xs font-medium" style={{ color: "#886f68" }}>
          Sector Analysis
        </span>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm mb-6 hover:opacity-70 transition-opacity"
          style={{ color: "#886f68" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to search
        </Link>

        {/* Sector switcher */}
        {sectors.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {sectors.map((s) => (
              <Link
                key={s.sector}
                href={`/sector/${encodeURIComponent(s.sector)}`}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  backgroundColor: s.sector === sector ? "#3d2c2e" : "#d1ccdc",
                  color: s.sector === sector ? "#f5edf0" : "#424c55",
                }}
              >
                {s.display_name}
              </Link>
            ))}
          </div>
        )}

        {/* Title + signal badge */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold" style={{ color: "#3d2c2e" }}>
              {sector}
            </h1>
            {generatedAt && (
              <p className="mt-1 text-sm" style={{ color: "#886f68" }}>
                Last updated: {formatDate(generatedAt)}
              </p>
            )}
          </div>
          {signal && <SignalBadge signal={signal} />}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-8 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-36 rounded" style={{ backgroundColor: "#d1ccdc" }} />
                  <div className="flex-1 h-px" style={{ backgroundColor: "#d1ccdc" }} />
                </div>
                {Array.from({ length: 3 }).map((_, j) => (
                  <div
                    key={j}
                    className="h-3 rounded"
                    style={{ backgroundColor: "#d1ccdc", width: j === 2 ? "65%" : "100%" }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Live generation loading */}
        {liveLoading && (
          <div
            className="rounded-2xl p-6 flex items-center gap-4"
            style={{ backgroundColor: "#d1ccdc" }}
          >
            <svg
              className="animate-spin h-5 w-5 flex-shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              style={{ color: "#886f68" }}
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm font-medium" style={{ color: "#3d2c2e" }}>
              Generating sector analysis… this may take 30 seconds.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !liveLoading && !content && (
          <p className="text-base italic" style={{ color: "#886f68" }}>
            No analysis available for this sector yet.
          </p>
        )}

        {/* Parsed sections */}
        {!loading && !liveLoading && sections.length > 0 && (
          <div className="flex flex-col">
            {sections.map((section, idx) => (
              <div
                key={idx}
                className="py-6"
                style={{ borderTop: idx === 0 ? "none" : "1px solid #d1ccdc" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <h2
                    className="text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: "#886f68" }}
                  >
                    {section.heading}
                  </h2>
                  <div className="flex-1 h-px" style={{ backgroundColor: "#d1ccdc" }} />
                </div>
                <div className="text-sm leading-relaxed" style={{ color: "#424c55" }}>
                  <ReactMarkdown components={mdComponents}>{section.body}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fallback: raw content */}
        {!loading && !liveLoading && content && sections.length === 0 && (
          <div className="text-sm leading-relaxed" style={{ color: "#424c55" }}>
            <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
          </div>
        )}

        {/* Company comparison */}
        {!loading && !liveLoading && stocks.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-6">
              <h2
                className="text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                style={{ color: "#886f68" }}
              >
                Company Comparison
              </h2>
              <div className="flex-1 h-px" style={{ backgroundColor: "#d1ccdc" }} />
            </div>

            {/* Metric tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {METRIC_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveMetric(tab.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: activeMetric === tab.key ? "#3d2c2e" : "#d1ccdc",
                    color: activeMetric === tab.key ? "#f5edf0" : "#424c55",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Bar chart */}
            <div
              className="rounded-2xl p-4 mb-6"
              style={{ backgroundColor: "white", border: "1px solid #d1ccdc" }}
            >
              <CompanyChart stocks={stocks} metric={activeMetric} />
            </div>

            {/* Comparison table */}
            <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid #d1ccdc" }}>
              <table className="w-full text-sm" style={{ backgroundColor: "white" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #d1ccdc", backgroundColor: "#f5edf0" }}>
                    {(
                      [
                        { key: "name" as SortKey, label: "Company" },
                        { key: "price" as SortKey, label: "Price" },
                        { key: "pe_ratio" as SortKey, label: "P/E" },
                        { key: "pb_ratio" as SortKey, label: "P/B" },
                        { key: "roe" as SortKey, label: "ROE" },
                        { key: "eps" as SortKey, label: "EPS" },
                        { key: "market_cap" as SortKey, label: "Market Cap" },
                      ] as { key: SortKey; label: string }[]
                    ).map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:opacity-70"
                        style={{ color: "#886f68" }}
                      >
                        {label}
                        <SortIcon k={key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedStocks.map((s, i) => (
                    <tr
                      key={s.ticker}
                      style={{
                        borderTop: i === 0 ? "none" : "1px solid #d1ccdc",
                      }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: "#3d2c2e" }}>
                        <Link
                          href={`/stock/${encodeURIComponent(s.ticker.replace(/\.NS$/, ""))}`}
                          className="hover:underline"
                        >
                          {s.name ?? s.ticker}
                        </Link>
                      </td>
                      <td className="px-4 py-3" style={{ color: "#424c55" }}>
                        {s.price ? `₹${fmt(s.price)}` : "—"}
                      </td>
                      <td className="px-4 py-3" style={{ color: "#424c55" }}>{fmt(s.pe_ratio)}</td>
                      <td className="px-4 py-3" style={{ color: "#424c55" }}>{fmt(s.pb_ratio)}</td>
                      <td className="px-4 py-3" style={{ color: "#424c55" }}>
                        {s.roe !== null && s.roe !== undefined ? `${fmt(s.roe * 100)}%` : "—"}
                      </td>
                      <td className="px-4 py-3" style={{ color: "#424c55" }}>{fmt(s.eps)}</td>
                      <td className="px-4 py-3" style={{ color: "#424c55" }}>{formatMarketCap(s.market_cap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer
        className="py-5 text-center text-xs border-t"
        style={{ borderColor: "#d1ccdc", color: "#886f68" }}
      >
        © {new Date().getFullYear()} MarketLens · Data from NSE India · Not investment advice
      </footer>
    </div>
  );
}
