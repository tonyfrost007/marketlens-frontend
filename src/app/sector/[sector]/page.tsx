"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SECTORS = [
  "Information Technology",
  "Banking",
  "FMCG",
  "Pharma",
  "Auto",
];

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

export default function SectorPage({ params }: { params: { sector: string } }) {
  const sector = decodeURIComponent(params.sector);
  const [content, setContent] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    setLoading(true);
    setContent(null);
    setGeneratedAt(null);

    supabase
      .from("sector_summaries")
      .select("content, generated_at")
      .eq("sector", sector)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          if (data) {
            setContent(data.content);
            setGeneratedAt(data.generated_at);
          }
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sector]);

  const sections = content ? parseSections(content) : [];
  const signal = content ? parseSignal(content) : null;

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
        <div className="flex flex-wrap gap-2 mb-8">
          {SECTORS.map((s) => (
            <Link
              key={s}
              href={`/sector/${encodeURIComponent(s)}`}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor: s === sector ? "#3d2c2e" : "#d1ccdc",
                color: s === sector ? "#f5edf0" : "#424c55",
              }}
            >
              {s}
            </Link>
          ))}
        </div>

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

        {/* Empty state */}
        {!loading && !content && (
          <p className="text-base italic" style={{ color: "#886f68" }}>
            No analysis available for this sector yet.
          </p>
        )}

        {/* Parsed sections */}
        {!loading && sections.length > 0 && (
          <div className="flex flex-col">
            {sections.map((section, idx) => (
              <div
                key={idx}
                className="py-6"
                style={{
                  borderTop: idx === 0 ? "none" : `1px solid #d1ccdc`,
                }}
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
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: "#424c55" }}
                >
                  {section.body}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fallback: show raw content if sections couldn't be parsed */}
        {!loading && content && sections.length === 0 && (
          <div
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "#424c55" }}
          >
            {content}
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
