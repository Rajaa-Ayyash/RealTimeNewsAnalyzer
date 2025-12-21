"use client";

import { useEffect, useMemo, useState } from "react";
import type { PagedResponse, SentimentDoc } from "@/types/api";

/** Helpers */
function intensity(score?: number) {
  const s = Math.abs(score ?? 0);
  if (s >= 6) return { label: "High", bg: "#FFCBD1", text: "#6E1F1F" };
  if (s >= 3) return { label: "Med", bg: "#FFE9B3", text: "#5A3D00" };
  return { label: "Low", bg: "#CFF2D6", text: "#1F5E2D" };
}

function sentimentPill(sent?: string) {
  const v = (sent ?? "").toLowerCase();
  if (v.includes("neg")) return { bg: "#FFDADA", text: "#6E1F1F", label: sent ?? "Negative" };
  if (v.includes("pos")) return { bg: "#DFF5E1", text: "#1F5E2D", label: sent ?? "Positive" };
  return { bg: "#E6EEFF", text: "#314A6E", label: sent ?? "Neutral" };
}

export default function SentimentPage() {
  // ✅ فلتر واحد فقط
  const [sentiment, setSentiment] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [data, setData] = useState<PagedResponse<SentimentDoc> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ خيارات الدروب داون (عدّلي القيم لتطابق Mongo إذا لازم)
  const SENTIMENT_OPTIONS = [
    { value: "", label: "All Sentiments" },
    { value: "Positive", label: "Positive" },
    { value: "Negative", label: "Negative" },
    { value: "Neutral", label: "Neutral" },
  ];

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (sentiment) p.set("sentiment", sentiment);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [sentiment, page, pageSize]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/sentiment?${qs}`, { cache: "no-store" });
        const json: any = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            json && (json.error || json.details)
              ? `${json.error ?? "Error"}${json.details ? `: ${json.details}` : ""}`
              : `Failed to fetch: ${res.status}`;
          throw new Error(msg);
        }

        const normalized: PagedResponse<SentimentDoc> = Array.isArray(json)
          ? { items: json as SentimentDoc[], total: (json as SentimentDoc[]).length, page, pageSize }
          : (json ?? { items: [], total: 0, page, pageSize });

        setData({
          items: normalized.items ?? [],
          total: normalized.total ?? 0,
          page: normalized.page ?? page,
          pageSize: normalized.pageSize ?? pageSize,
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

  const items = data?.items ?? [];
  const totalPages = data
    ? Math.max(1, Math.ceil((data.total ?? 0) / (data.pageSize ?? pageSize)))
    : 1;

  const clearFilters = () => {
    setSentiment("");
    setPage(1);
  };

  return (
    <div className="space-y-6" style={{ color: "#FFFFFF" }}>
      <h1 className="text-2xl font-bold" style={{ color: "#FFFFFF" }}>
        Sentiment News
      </h1>

      <div className="rounded-xl p-4 shadow space-y-3" style={{ backgroundColor: "#628ECB" }}>
        {/* Filters */}
        <div className="grid gap-3 md:grid-cols-2">
          {/* Sentiment dropdown */}
          <div className="relative w-full">
<select
  className="w-full rounded-lg px-3 py-2"
  style={{
    border: "2px solid #8AAEE0",
    backgroundColor: "#628ECB",
    color: "#FFFFFF",
    outline: "none",
    paddingRight: "3rem", // مساحة مريحة للسهم
    appearance: "none",     // مهم لإخفاء سهم المتصفح الافتراضي
    backgroundImage:
      "url('data:image/svg+xml;utf8,<svg fill=\"%23D5DEEF\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.75rem center",
    backgroundSize: "0.75rem",
  }}
  onFocus={(e) => {
    e.currentTarget.style.boxShadow = "0 0 0 2px #B1C9EF";
  }}
  onBlur={(e) => {
    e.currentTarget.style.boxShadow = "none";
  }}
  value={sentiment}
  onChange={(e) => {
    setSentiment(e.target.value);
    setPage(1);
  }}
>
  {SENTIMENT_OPTIONS.map((s) => (
    <option key={s.value || "__all"} value={s.value}>
      {s.label}
    </option>
  ))}
</select>

</div>

          <button
            className="w-full rounded-lg px-3 py-2 font-bold transition-transform duration-150"
            style={{
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

        {/* Status messages */}
        {loading && <p className="text-sm" style={{ color: "#D5DEEF" }}>Loading...</p>}
        {error && <p className="text-sm" style={{ color: "#FFDADA" }}>Error: {error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="text-sm" style={{ color: "#D5DEEF" }}>No sentiment docs.</p>
        )}

        {/* Cards */}
        {!loading && !error && items.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((x) => {
                const sPill = sentimentPill(x.sentiment);
                const iPill = intensity(x.sentiment_score);

                return (
                  <a
                    key={x._id}
                    href={x.link}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl p-4 transition-transform duration-150"
                    style={{
                      backgroundColor: "#314A6E",
                      border: "2px solid #8AAEE0",
                      color: "#FFFFFF",
                      transform: "scale(1)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.02)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)";
                    }}
                  >
                    {/* Source (عرض فقط) */}
                    <div className="text-xs font-semibold tracking-wide" style={{ color: "#D5DEEF" }}>
                      {x.source_normalized}
                    </div>

                    {/* Title */}
                    <h3 className="mt-3 text-lg font-bold leading-snug line-clamp-2">
                      {x.title}
                    </h3>

                    {/* Sentiment + Intensity */}
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className="text-xs rounded-full px-2 py-1 font-semibold"
                        style={{ backgroundColor: sPill.bg, color: sPill.text }}
                      >
                        {sPill.label}
                      </span>

                      <span
                        className="text-xs rounded-full px-2 py-1 font-semibold"
                        style={{ backgroundColor: iPill.bg, color: iPill.text }}
                        title={`Intensity based on sentiment_score: ${x.sentiment_score ?? 0}`}
                      >
                        {iPill.label}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <button
                className="rounded-lg px-3 py-2 disabled:opacity-40 transition-colors"
                style={{ border: "2px solid #8AAEE0", color: "#D5DEEF", backgroundColor: "#628ECB" }}
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
                style={{ border: "2px solid #8AAEE0", color: "#D5DEEF", backgroundColor: "#628ECB" }}
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