import SearchBar from "@/components/SearchBar";

const POPULAR_TICKERS = [
  "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK",
  "WIPRO", "SBIN", "BAJFINANCE", "HINDUNILVR", "ADANIENT",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">
            MarketLens
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/sector/Information%20Technology"
            className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
          >
            Sectors
          </a>
          <span className="text-xs text-gray-400 font-medium">NSE India</span>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-medium text-blue-600">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          NSE Live Research
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4 max-w-2xl">
          Smarter insights for{" "}
          <span className="text-blue-600">Indian stocks</span>
        </h1>

        <p className="text-gray-500 text-lg mb-10 max-w-md">
          Search any NSE ticker to get financials, charts, and AI-powered
          analysis — all in one place.
        </p>

        <SearchBar />

        {/* Popular tickers */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">
            Popular
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {POPULAR_TICKERS.map((t) => (
              <a
                key={t}
                href={`/stock/${t}`}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"
              >
                {t}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-5 text-center text-xs text-gray-400 border-t border-gray-100">
        © {new Date().getFullYear()} MarketLens · Data from NSE India · Not
        investment advice
      </footer>
    </main>
  );
}
