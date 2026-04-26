"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";

const TICKER_TO_COMPANY: Record<string, string> = {
  INFY: "Infosys",
  HDFCBANK: "HDFC Bank",
  RELIANCE: "Reliance Industries",
  TCS: "Tata Consultancy Services",
  ICICIBANK: "ICICI Bank",
  WIPRO: "Wipro",
  AXISBANK: "Axis Bank",
  SBIN: "State Bank of India",
  BAJFINANCE: "Bajaj Finance",
  HINDUNILVR: "Hindustan Unilever",
  TATAMOTORS: "Tata Motors",
  MARUTI: "Maruti Suzuki",
  SUNPHARMA: "Sun Pharmaceutical",
  DRREDDY: "Dr Reddy's Laboratories",
  NESTLEIND: "Nestle India",
  TITAN: "Titan Company",
  ADANIENT: "Adani Enterprises",
  COALINDIA: "Coal India",
  ONGC: "ONGC",
  ITC: "ITC",
};

interface Fundamentals {
  pe_ratio?: number | string | null;
  pb_ratio?: number | string | null;
  roe?: number | string | null;
  eps?: number | string | null;
  market_cap?: number | string | null;
  price?: number | string | null;
  high_52w?: number | string | null;
  low_52w?: number | string | null;
  debt_to_equity?: number | string | null;
  revenue?: number | string | null;
  name?: string | null;
}

interface BrieferResponseItem {
  fundamentals: string | Fundamentals;
  brief: string;
}

const CRORE = 1_00_00_000;           // 10^7
const LAKH_CRORE = 1_00_000_00_00_000; // 10^12

function formatMarketCap(raw: number | string | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "N/A";
  const num = typeof raw === "string" ? parseFloat(raw) : raw;
  if (!num || isNaN(num)) return "N/A";
  if (num >= LAKH_CRORE) {
    return `₹${(num / LAKH_CRORE).toFixed(2)} L Cr`;
  }
  if (num >= 1000 * CRORE) {
    return `₹${Math.round(num / CRORE).toLocaleString("en-IN")} Cr`;
  }
  return `₹${(num / CRORE).toFixed(2)} Cr`;
}

const METRIC_CONFIG: {
  key: keyof Omit<Fundamentals, "revenue" | "name">;
  label: string;
  prefix?: string;
  suffix?: string;
  formatter?: (v: number | string | null | undefined) => string;
}[] = [
  { key: "price", label: "Price", prefix: "₹" },
  { key: "market_cap", label: "Market Cap", formatter: formatMarketCap },
  { key: "pe_ratio", label: "P/E Ratio" },
  { key: "pb_ratio", label: "P/B Ratio" },
  { key: "eps", label: "EPS", prefix: "₹" },
  { key: "roe", label: "ROE", suffix: "%" },
  { key: "high_52w", label: "52W High", prefix: "₹" },
  { key: "low_52w", label: "52W Low", prefix: "₹" },
  { key: "debt_to_equity", label: "Debt / Equity" },
];

function formatValue(raw: number | string | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const num = typeof raw === "string" ? parseFloat(raw) : raw;
  if (isNaN(num)) return String(raw);
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function MetricCard({
  label,
  value,
  prefix,
  suffix,
  formatter,
}: {
  label: string;
  value: number | string | null | undefined;
  prefix?: string;
  suffix?: string;
  formatter?: (v: number | string | null | undefined) => string;
}) {
  const display = formatter ? formatter(value) : formatValue(value);
  const isEmpty = display === "—" || display === "N/A";

  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ backgroundColor: "#d1ccdc" }}>
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#886f68" }}>
        {label}
      </span>
      <span
        className="text-lg font-bold leading-tight"
        style={{ color: isEmpty ? "#886f68" : "#3d2c2e" }}
      >
        {formatter ? display : isEmpty ? "—" : `${prefix ?? ""}${display}${suffix ?? ""}`}
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2 animate-pulse"
      style={{ backgroundColor: "#d1ccdc" }}
    >
      <div className="h-3 w-16 rounded" style={{ backgroundColor: "#886f6840" }} />
      <div className="h-5 w-24 rounded" style={{ backgroundColor: "#886f6840" }} />
    </div>
  );
}

export default function StockPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase().replace(/\.(NS|BO)$/, "");
  const nseTicker = `${ticker}.NS`;
  const company = TICKER_TO_COMPANY[ticker] ?? ticker;

  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"live" | "cached" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    function sixHoursAgo(): string {
      return new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    }

    async function saveToSupabase(f: Fundamentals, briefText: string | null) {
      const now = new Date().toISOString();

      const stockPayload = {
        ticker: nseTicker,
        name: f.name ?? company,
        pe_ratio: f.pe_ratio,
        pb_ratio: f.pb_ratio,
        roe: f.roe,
        eps: f.eps,
        market_cap: f.market_cap,
        debt_to_equity: f.debt_to_equity,
        revenue: f.revenue,
        price: f.price,
        high_52w: f.high_52w,
        low_52w: f.low_52w,
        updated_at: now,
      };
      console.log("[supabase] stocks upsert payload:", stockPayload);

      const { data: stockData, error: stockError } = await supabase
        .from("stocks")
        .upsert(stockPayload, { onConflict: "ticker" })
        .select();
      if (stockError) {
        console.error("[supabase] stocks upsert error:", {
          message: stockError.message,
          code: stockError.code,
          details: stockError.details,
          hint: stockError.hint,
        });
      } else {
        console.log("[supabase] stocks upsert success:", stockData);
      }

      if (briefText) {
        const summaryPayload = {
          ticker: nseTicker,
          summary_type: "company",
          content: briefText,
          generated_at: now,
          model_version: "llama-3.1-8b-instant",
        };
        console.log("[supabase] ai_summaries insert payload:", summaryPayload);

        const { data: summaryData, error: summaryError } = await supabase
          .from("ai_summaries")
          .insert(summaryPayload)
          .select();
        if (summaryError) {
          console.error("[supabase] ai_summaries insert error:", {
            message: summaryError.message,
            code: summaryError.code,
            details: summaryError.details,
            hint: summaryError.hint,
          });
        } else {
          console.log("[supabase] ai_summaries insert success:", summaryData);
        }
      }
    }

    async function load() {
      try {
        const cutoff = sixHoursAgo();

        // Query Supabase for fresh rows — staleness filtered server-side
        const [stocksRes, summaryRes] = await Promise.all([
          supabase
            .from("stocks")
            .select("*")
            .eq("ticker", nseTicker)
            .gt("updated_at", cutoff)
            .maybeSingle(),
          supabase
            .from("ai_summaries")
            .select("content, generated_at")
            .eq("ticker", nseTicker)
            .eq("summary_type", "company")
            .gt("generated_at", cutoff)
            .order("generated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const cachedStock = stocksRes.data;
        const cachedSummary = summaryRes.data;

        if (cachedStock && cachedSummary) {
          // Full cache hit — skip webhook entirely
          if (!cancelled) {
            setFundamentals(cachedStock as Fundamentals);
            setBrief(cachedSummary.content);
            setSource("cached");
          }
          return;
        }

        // Cache miss or stale — call n8n webhook
        const res = await fetch(
          "https://n8n-production-fa88.up.railway.app/webhook/briefer",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company, ticker: nseTicker }),
          }
        );
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const json: BrieferResponseItem[] = await res.json();
        const item = json[0];
        const parsedFundamentals: Fundamentals =
          typeof item.fundamentals === "string"
            ? JSON.parse(item.fundamentals.trim())
            : item.fundamentals;
        const briefText = item.brief ?? null;

        if (!cancelled) {
          setFundamentals(parsedFundamentals);
          setBrief(briefText);
          setSource("live");
        }

        saveToSupabase(parsedFundamentals, briefText);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [company, nseTicker]);

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

        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-1 rounded-md"
            style={{ backgroundColor: "#d1ccdc", color: "#424c55" }}
          >
            NSE
          </span>
          <span className="text-sm font-bold" style={{ color: "#3d2c2e" }}>
            {nseTicker}
          </span>
          {source && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md"
              style={{
                backgroundColor: source === "live" ? "#fff3e0" : "#f0f0f0",
                color: source === "live" ? "#e65100" : "#757575",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: source === "live" ? "#e65100" : "#9e9e9e" }}
              />
              {source === "live" ? "Live" : "Cached"}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stock title */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm mb-3 hover:opacity-70 transition-opacity"
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
          <h1 className="text-3xl sm:text-4xl font-extrabold" style={{ color: "#3d2c2e" }}>
            {company}
          </h1>
          <p className="mt-1 text-sm font-medium" style={{ color: "#886f68" }}>
            {nseTicker} · National Stock Exchange of India
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div
            className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center max-w-md mx-auto mt-16"
            style={{ backgroundColor: "#d1ccdc" }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#886f6830" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="#886f68"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <p className="font-semibold" style={{ color: "#3d2c2e" }}>
              Failed to load data
            </p>
            <p className="text-sm" style={{ color: "#886f68" }}>
              {error}
            </p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                setFundamentals(null);
                setBrief(null);
              }}
              className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#3d2c2e", color: "#f5edf0" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Two-column layout */}
        {!error && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6">
            {/* Left: Fundamentals */}
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#886f68" }}>
                Fundamentals
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {loading
                  ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
                  : METRIC_CONFIG.map((m) => (
                      <MetricCard
                        key={m.key}
                        label={m.label}
                        value={fundamentals?.[m.key]}
                        prefix={m.prefix}
                        suffix={m.suffix}
                        formatter={m.formatter}
                      />
                    ))}
              </div>
            </div>

            {/* Right: Brief */}
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#886f68" }}>
                Research Brief
              </h2>

              {loading ? (
                <div
                  className="rounded-2xl p-6 flex flex-col gap-3 animate-pulse"
                  style={{ backgroundColor: "white", border: "1px solid #d1ccdc" }}
                >
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-3 rounded"
                      style={{
                        backgroundColor: "#d1ccdc",
                        width: i % 3 === 2 ? "60%" : "100%",
                      }}
                    />
                  ))}
                </div>
              ) : brief ? (
                <div
                  className="rounded-2xl p-6 text-sm leading-relaxed prose prose-sm max-w-none"
                  style={{
                    backgroundColor: "white",
                    border: "1px solid #d1ccdc",
                    color: "#424c55",
                  }}
                >
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="text-base font-bold mb-2" style={{ color: "#3d2c2e" }}>{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-bold mb-2" style={{ color: "#3d2c2e" }}>{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-bold mb-1" style={{ color: "#3d2c2e" }}>{children}</h3>,
                      strong: ({ children }) => <strong className="font-semibold" style={{ color: "#3d2c2e" }}>{children}</strong>,
                      p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                    }}
                  >
                    {brief}
                  </ReactMarkdown>
                </div>
              ) : (
                <div
                  className="rounded-2xl p-6 text-sm italic"
                  style={{
                    backgroundColor: "white",
                    border: "1px solid #d1ccdc",
                    color: "#886f68",
                  }}
                >
                  No research brief available for this ticker.
                </div>
              )}
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
