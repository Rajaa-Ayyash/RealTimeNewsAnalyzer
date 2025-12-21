"use client";

import { useEffect, useMemo, useState } from "react";
import type { BreakingEvent, PagedResponse } from "@/types/api";

// debounce hook
function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debouncedValue;
}

function safeNum(x: unknown) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function minutesBetween(startISO: string, endISO: string) {
  const a = new Date(startISO).getTime();
  const b = new Date(endISO).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.max(1, Math.round((b - a) / 60000));
}

export default function BreakingPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [minApprox, setMinApprox] = useState<number>(0);

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [data, setData] = useState<PagedResponse<BreakingEvent> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryOptions, setCategoryOptions] = useState<string[]>([""]);

  const debouncedQ = useDebounce(q, 400);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ) p.set("q", debouncedQ);
    if (category) p.set("category", category);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [debouncedQ, category, page, pageSize]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/breaking?${qs}`, { cache: "no-store" });
        const json: unknown = await res.json().catch(() => null);

        if (!res.ok) {
          const j = json as any;
          const msg =
            j && (j.error || j.details)
              ? `${j.error ?? "Error"}${j.details ? `: ${j.details}` : ""}`
              : `Failed to fetch: ${res.status}`;
          throw new Error(msg);
        }

        const normalized: PagedResponse<BreakingEvent> = Array.isArray(json)
          ? {
              items: json as BreakingEvent[],
              total: (json as BreakingEvent[]).length,
              page,
              pageSize,
            }
          : ((json as PagedResponse<BreakingEvent>) ?? {
              items: [],
              total: 0,
              page,
              pageSize,
            });

        const safeData: PagedResponse<BreakingEvent> = {
          items: normalized.items ?? [],
          total: normalized.total ?? 0,
          page: normalized.page ?? page,
          pageSize: normalized.pageSize ?? pageSize,
        };

        setData(safeData);

        // options من الصفحة الحالية (مناسب للداتا الكبيرة)
        setCategoryOptions((prev) => {
          const set = new Set(prev);
          for (const x of safeData.items ?? []) if (x?.category) set.add(x.category);

          const arr = Array.from(set).filter(Boolean);
          const hasOther = arr.includes("other");

          const sorted = arr.filter((c) => c !== "other").sort();
          return ["", ...sorted, ...(hasOther ? ["other"] : [])];
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

  // ✅ ترتيب حسب الصورة:
  // 1) approx_count DESC
  // 2) window_end DESC
  const items = useMemo(() => {
    return (data?.items ?? [])
      .filter((x) => safeNum(x.approx_count) >= minApprox)
      .sort((a, b) => {
        const ap = safeNum(b.approx_count) - safeNum(a.approx_count);
        if (ap !== 0) return ap;
        return new Date(b.window_end).getTime() - new Date(a.window_end).getTime();
      });
  }, [data, minApprox]);

  const totalPages = data ? Math.max(1, Math.ceil((data.total ?? 0) / pageSize)) : 1;

  const clearFilters = () => {
    setQ("");
    setCategory("");
    setMinApprox(0);
    setPage(1);
  };

  return (
    <div className="space-y-6" style={{ color: "#FFFFFF" }}>
      <h1 className="text-2xl font-bold">Breaking News</h1>

      <div className="rounded-xl p-4 shadow space-y-3" style={{ backgroundColor: "#628ECB" }}>
        {/* Filters */}
       {/* Filters */}
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
  {/* ✅ على اليسار: البحث فقط */}
  <input
    className="w-full rounded-lg px-3 py-2"
    style={{
      border: "2px solid #8AAEE0",
      backgroundColor: "#628ECB",
      color: "#FFFFFF",
      outline: "none",
      minHeight: 42,
    }}
    onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px #B1C9EF")}
    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
    placeholder="Search keyword..."
    value={q}
    onChange={(e) => {
      setQ(e.target.value);
      setPage(1);
    }}
  />

  {/* ✅ الفلتر يسار والـ Clear يمين مع فراغ بينهم (زي الصورة) */}
  <div className="flex w-full items-center justify-between gap-3 sm:col-span-1 lg:col-span-3">
    <select
      className="w-full rounded-lg px-3 py-2"
      style={{
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
      }}
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

    <button
      className="rounded-lg px-3 py-2 font-bold transition-transform duration-150"
      style={{
        width: "300px", // ✅ نفس عرضك بالزبط
        backgroundColor: "#B1C9EF",
        color: "#314A6E",
        border: "none",
        transform: "scale(1)",
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
</div>

        {loading && <p style={{ color: "#D5DEEF" }}>Loading...</p>}
        {error && <p style={{ color: "#FFDADA" }}>Error: {error}</p>}

        {!loading && !error && items.length === 0 && (
          <p style={{ color: "#D5DEEF" }}>No breaking events.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((x) => {
                const mins = minutesBetween(x.window_start, x.window_end);
                const mentions = safeNum(x.approx_count);

                // ✅ خبر واحد فقط + رابط واحد فقط
                const headline = (x as any)?.sample_titles?.[0] as string | undefined;
                const headlineLink = (x as any)?.sample_links?.[0] as string | undefined;

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
                      <span style={{ color: "#B1C9EF" }}>🔥 BREAKING NEWS</span>
                      {/* ✅ حذفنا status */}
                    </div>

                    {/* Event */}
                    <div className="mt-3">
                      <div className="text-sm font-semibold" style={{ color: "#D5DEEF" }}>
                        Event:
                      </div>
                      <div className="mt-1 text-base font-bold">
                        {x.keyword} {x.category ? `(${x.category})` : ""}
                      </div>
                    </div>

                    {/* Why Breaking */}
                    <div className="mt-4">
                      <div className="text-sm font-semibold" style={{ color: "#D5DEEF" }}>
                        Why Breaking?
                      </div>
                      <div className="mt-1 text-sm" style={{ color: "#D5DEEF" }}>
                        Mentioned <span className="font-bold">{mentions}</span> times in{" "}
                        <span className="font-bold">{mins}</span> minutes
                      </div>
                    </div>

                    {/* ✅ Top Headlines: خبر واحد فقط + رابط */}
                    <div className="mt-4">
                      <div className="text-sm font-semibold" style={{ color: "#D5DEEF" }}>
                        Top Headlines:
                      </div>

                      {headline ? (
                        headlineLink ? (
                          <a
                            href={headlineLink}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block text-sm underline underline-offset-2 hover:opacity-90"
                            style={{ color: "#FFFFFF" }}
                          >
                            • {headline}
                          </a>
                        ) : (
                          <div className="mt-1 text-sm" style={{ color: "#D5DEEF" }}>
                            • {headline}
                          </div>
                        )
                      ) : (
                        <div className="mt-1 text-sm" style={{ color: "#D5DEEF" }}>
                          • No sample headline
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

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