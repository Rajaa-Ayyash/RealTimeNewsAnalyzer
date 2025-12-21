"use client";

import { useEffect, useMemo, useState } from "react";
import type { PagedResponse, TrendingKeyword } from "@/types/api";

function safeNum(x: unknown) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function trendMeta(level?: string) {
  const lv = (level ?? "").toUpperCase();

  // ✨ ألوان مشابهة للستايل الحالي + منطق مستويات الترند
  if (lv === "BREAKING") return { label: "BREAKING", bg: "#bc6565ff", fg: "#FECACA", icon: "🚨", rank: 4 };
  if (lv === "HOT") return { label: "HOT",  bg: "#ff9500", fg: "#0b1220", icon: "🔥", rank: 3 };
  if (lv === "RISING") return { label: "RISING", bg: "#34c759", fg: "#0b1220", icon: "📈", rank: 2 };
  if (lv === "NORMAL") return { label: "NORMAL", bg: "#B1C9EF", fg: "#314A6E", icon: "✅", rank: 1 };

  return { label: lv || "NORMAL", bg: "#B1C9EF", fg: "#314A6E", icon: "✅", rank: 1 };
}

function formatTimeWindow(x: TrendingKeyword) {
  if (x.time_window_text) return x.time_window_text;

  const w: any = x.window ?? {};
  const start =
    w?.start ?? w?.from ?? w?.start_time ?? w?.startAt ?? w?.start_at ?? null;
  const end =
    w?.end ?? w?.to ?? w?.end_time ?? w?.endAt ?? w?.end_at ?? null;

  if (!start || !end) return "";

  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";

  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${hhmm(a)} → ${hhmm(b)}`;
}

export default function TrendsPage() {
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState(""); // BREAKING / HOT / RISING / ...

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [data, setData] = useState<PagedResponse<TrendingKeyword> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryOptions, setCategoryOptions] = useState<string[]>([""]);
  const [levelOptions, setLevelOptions] = useState<string[]>([""]); // dynamic

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (level) p.set("level", level); // backend يطبقها على trend_level
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [category, level, page, pageSize]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/trends?${qs}`, { cache: "no-store" });
        const json: unknown = await res.json().catch(() => null);

        if (!res.ok) {
          const j = json as any;
          const msg =
            j && (j.error || j.details)
              ? `${j.error ?? "Error"}${j.details ? `: ${j.details}` : ""}`
              : `Failed to fetch: ${res.status}`;
          throw new Error(msg);
        }

        const normalized: PagedResponse<TrendingKeyword> = Array.isArray(json)
          ? {
              items: json as TrendingKeyword[],
              total: (json as TrendingKeyword[]).length,
              page,
              pageSize,
            }
          : ((json as PagedResponse<TrendingKeyword>) ?? {
              items: [],
              total: 0,
              page,
              pageSize,
            });

        const safeData: PagedResponse<TrendingKeyword> = {
          items: normalized.items ?? [],
          total: normalized.total ?? 0,
          page: normalized.page ?? page,
          pageSize: normalized.pageSize ?? pageSize,
        };

        setData(safeData);

        // options من الصفحة الحالية
        setCategoryOptions((prev) => {
          const set = new Set(prev);
          for (const x of safeData.items ?? []) if (x?.category) set.add(x.category);
          const arr = Array.from(set).filter(Boolean).sort();
          return ["", ...arr];
        });

        setLevelOptions((prev) => {
          const set = new Set(prev);
          for (const x of safeData.items ?? []) if (x?.trend_level) set.add(String(x.trend_level).toUpperCase());
          const arr = Array.from(set).filter(Boolean).sort();
          return ["", ...arr];
        });
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Unknown error");
        setData({ items: [], total: 0, page: 1, pageSize });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [qs, page, pageSize]);

  // ترتيب:
  // 1) trend_level rank
  // 2) trend_score DESC
  // 3) created_at DESC
  const items = useMemo(() => {
    return (data?.items ?? []).slice().sort((a, b) => {
      const ar = trendMeta(a.trend_level).rank;
      const br = trendMeta(b.trend_level).rank;
      if (br !== ar) return br - ar;

      const s = safeNum(b.trend_score) - safeNum(a.trend_score);
      if (s !== 0) return s;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [data]);

  const totalPages = data ? Math.max(1, Math.ceil((data.total ?? 0) / pageSize)) : 1;

  const clearFilters = () => {
    setCategory("");
    setLevel("");
    setPage(1);
  };

  const mono =
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

  // styles مشتركة للـ selects
  const selectStyle: React.CSSProperties = {
    border: "2px solid #8AAEE0",
    backgroundColor: "#628ECB",
    color: "#FFFFFF",
    outline: "none",
    paddingRight: "2rem",
    minHeight: 42,
    backgroundImage:
      "url('data:image/svg+xml;utf8,<svg fill=\"%23D5DEEF\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.5rem center",
    backgroundSize: "1rem",
  };

  return (
    <div className="space-y-6" style={{ color: "#FFFFFF" }}>
      <h1 className="text-2xl font-bold">Trending Keywords</h1>

      <div className="rounded-xl p-4 shadow space-y-3" style={{ backgroundColor: "#628ECB" }}>
        {/* ✅ Filters: Category + Level + Clear */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-center">
          {/* Category */}
          <select
            className="w-full rounded-lg px-3 py-2 lg:col-span-6"
            style={selectStyle}
            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px #B1C9EF")}
            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            {categoryOptions.map((c) => (
              <option key={c || "__all"} value={c}>
                {c || "All categories"}
              </option>
            ))}
          </select>

          {/* Trend Level */}
          <select
            className="w-full rounded-lg px-3 py-2 lg:col-span-3"
            style={selectStyle}
            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px #B1C9EF")}
            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All trend levels</option>
            {/* dynamic options from data */}
            {levelOptions
              .filter((x) => x)
              .map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
          </select>

          {/* Clear */}
          <button
            className="w-full rounded-lg px-3 py-2 font-bold transition-transform duration-150 lg:col-span-3"
            style={{
              backgroundColor: "#B1C9EF",
              color: "#314A6E",
              border: "none",
              transform: "scale(1)",
              minHeight: 42,
            }}
            onClick={clearFilters}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.95)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
            type="button"
          >
            Clear
          </button>
        </div>

        {loading && <p style={{ color: "#D5DEEF" }}>Loading...</p>}
        {error && <p style={{ color: "#FFDADA" }}>Error: {error}</p>}

        {!loading && !error && items.length === 0 && <p style={{ color: "#D5DEEF" }}>No trending keywords.</p>}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((x) => {
                const pill = trendMeta(x.trend_level);
                const tw = formatTimeWindow(x);

                return (
                  <div
                    key={x._id}
                    className="rounded-xl p-4"
                    style={{
                      border: "2px solid #8AAEE0",
                      backgroundColor: "#314A6E",
                      color: "#FFFFFF",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.03)";
                      e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,0,0,0.35)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span style={{ color: "#B1C9EF" }}>🔥TREND</span>

                      <span
                        className="text-xs rounded-full px-2 py-1"
                        style={{ backgroundColor: pill.bg, color: pill.fg, fontWeight: 800 }}
                      >
                        {pill.icon} {pill.label}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="mt-4 space-y-3" style={{ fontFamily: mono }}>
                      <div style={{ color: "#D5DEEF" }}>
                        <span className="font-semibold">Keyword:</span>{" "}
                        <span style={{ color: "#FFFFFF" }}>{x.keyword}</span>
                      </div>

                      <div style={{ color: "#D5DEEF" }}>
                        <span className="font-semibold">Category:</span>{" "}
                        <span style={{ color: "#FFFFFF" }}>{x.category}</span>
                      </div>

                      <div style={{ color: "#D5DEEF" }}>
                        <span className="font-semibold">Mentions:</span>{" "}
                        <span style={{ color: "#FFFFFF" }}>
                          Now {safeNum(x.current_count)} / Before {safeNum(x.previous_count)}
                        </span>
                      </div>

                      <div style={{ color: "#D5DEEF" }}>
                        <span className="font-semibold">Trend Score:</span>{" "}
                        <span style={{ color: "#B1C9EF" }}>{safeNum(x.trend_score)}</span>
                      </div>

                      <div style={{ color: "#D5DEEF" }}>
                        <span className="font-semibold">Time Window:</span>
                        <div style={{ color: "#B1C9EF", marginTop: 4 }}>
                          {tw || "-"}
                        </div>
                      </div>

                      <div style={{ color: "#D5DEEF" }}>
                        <span className="font-semibold">Detected at:</span>
                        <div style={{ color: "#B1C9EF", marginTop: 4 }}>
                          {new Date(x.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <button
                className="rounded-lg px-3 py-2 disabled:opacity-40 transition-colors"
                style={{
                  border: "2px solid #8AAEE0",
                  color: "#D5DEEF",
                  backgroundColor: "#628ECB",
                }}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#B1C9EF";
                  (e.currentTarget as HTMLButtonElement).style.color = "#314A6E";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#628ECB";
                  (e.currentTarget as HTMLButtonElement).style.color = "#D5DEEF";
                }}
              >
                Prev
              </button>

              <div className="text-sm" style={{ color: "#D5DEEF" }}>
                Page {page} / {totalPages}
              </div>

              <button
                className="rounded-lg px-3 py-2 disabled:opacity-40 transition-colors"
                style={{
                  border: "2px solid #8AAEE0",
                  color: "#D5DEEF",
                  backgroundColor: "#628ECB",
                }}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#B1C9EF";
                  (e.currentTarget as HTMLButtonElement).style.color = "#314A6E";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#628ECB";
                  (e.currentTarget as HTMLButtonElement).style.color = "#D5DEEF";
                }}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}