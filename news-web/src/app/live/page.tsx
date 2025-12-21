"use client";

import { useEffect, useMemo, useState } from "react";
import type { Article, PagedResponse } from "@/types/api";

function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debouncedValue;
}

export default function LivePage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState(""); 
  const [source, setSource] = useState(""); 

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [data, setData] = useState<PagedResponse<Article> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [categoryOptions, setCategoryOptions] = useState<string[]>([""]);
  const [sourceOptions, setSourceOptions] = useState<string[]>([""]);

  const debouncedQ = useDebounce(q, 400);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ) p.set("q", debouncedQ);
    if (category) p.set("category", category);
    if (source) p.set("source", source);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [debouncedQ, category, source, page, pageSize]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErr("");

      try {
        const res = await fetch(`/api/articles?${qs}`, { cache: "no-store" });
        const json: any = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            json && (json.error || json.details)
              ? `${json.error ?? "Error"}${json.details ? `: ${json.details}` : ""}`
              : `Failed to fetch: ${res.status}`;
          throw new Error(msg);
        }

        const normalized: PagedResponse<Article> = Array.isArray(json)
          ? { items: json as Article[], total: (json as Article[]).length, page, pageSize }
          : (json ?? { items: [], total: 0, page, pageSize });

        const safeData: PagedResponse<Article> = {
          items: normalized.items ?? [],
          total: normalized.total ?? 0,
          page: normalized.page ?? page,
          pageSize: normalized.pageSize ?? pageSize,
        };

        setData(safeData);

        setCategoryOptions((prev) => {
          const set = new Set(prev);
          for (const a of safeData.items) if (a?.category) set.add(a.category);
          return Array.from(set).sort((a, b) => a.localeCompare(b));
        });

        setSourceOptions((prev) => {
          const set = new Set(prev);
          for (const a of safeData.items) if (a?.source_normalized) set.add(a.source_normalized);
          return Array.from(set).sort((a, b) => a.localeCompare(b));
        });
      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? "Failed to fetch data");
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
    setQ("");
    setCategory("");
    setSource("");
    setPage(1);
  };

  return (
  <div className="space-y-6" style={{ color: "#FFFFFF" }}>
    <h1 className="text-2xl font-bold" style={{ color: "#FFFFFF" }}>
      Live News
    </h1>

    <div className="rounded-xl p-4 shadow space-y-3" style={{ backgroundColor: "#628ECB" }}>
      <div className="grid gap-3 md:grid-cols-4">
       <input
        className="w-full rounded-lg px-3 py-2"
          style={{
          border: "2px solid #8AAEE0",
          backgroundColor: "#628ECB",
           color: "#FFFFFF",
           outline: "none",
                 }}
        onFocus={(e) => {
    e.currentTarget.style.boxShadow = "0 0 0 2px #B1C9EF";
  }}
  onBlur={(e) => {
    e.currentTarget.style.boxShadow = "none";
  }}
  placeholder="Search title/content/keywords..."
  value={q}
  onChange={(e) => {
    setQ(e.target.value);
    setPage(1);
  }}
/>

<select
  className="w-full rounded-lg px-3 py-2"
  style={{
    border: "2px solid #8AAEE0",
    backgroundColor: "#628ECB",
    color: "#FFFFFF",
    outline: "none",
    paddingRight: "2rem", 
    backgroundImage: "url('data:image/svg+xml;utf8,<svg fill=\"%23D5DEEF\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.5rem center",
    backgroundSize: "1rem"
  }}
  onFocus={(e) => {
    e.currentTarget.style.boxShadow = "0 0 0 2px #B1C9EF";
  }}
  onBlur={(e) => {
    e.currentTarget.style.boxShadow = "none";
  }}
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

<select
  className="w-full rounded-lg px-3 py-2"
  style={{
    border: "2px solid #8AAEE0",
    backgroundColor: "#628ECB",
    color: "#FFFFFF",
    outline: "none",
    paddingRight: "2rem", 
    backgroundImage: "url('data:image/svg+xml;utf8,<svg fill=\"%23D5DEEF\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.5rem center",
    backgroundSize: "1rem"
  }}
  onFocus={(e) => {
    e.currentTarget.style.boxShadow = "0 0 0 2px #B1C9EF";
  }}
  onBlur={(e) => {
    e.currentTarget.style.boxShadow = "none";
  }}
  value={source}
  onChange={(e) => {
    setSource(e.target.value);
    setPage(1);
  }}
>
  {sourceOptions.map((s) => (
    <option key={s || "__all"} value={s}>
      {s || "All sources"}
    </option>
  ))}
</select>

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

      {loading && <p className="text-sm" style={{ color: "#D5DEEF" }}>Loading...</p>}
      {err && <p className="text-sm" style={{ color: "#FFDADA" }}>{err}</p>}

      {!loading && !err && (
        <>
          {items.length === 0 ? (
            <p className="text-sm" style={{ color: "#D5DEEF" }}>
              No articles found.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
     {items.map((a) => (
  <a
    key={a._id}
    href={a.link}
    target="_blank"
    rel="noreferrer"
    className="rounded-xl p-4 transition-transform"
    style={{
      border: "2px solid #8AAEE0",
      backgroundColor: "#314A6E",
      color: "#FFFFFF",
      transform: "scale(1)",
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.03)";
      (e.currentTarget as HTMLAnchorElement).style.boxShadow =
        "0 4px 15px rgba(0,0,0,0.3)";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)";
      (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
    }}
  >
    {/* Source */}
    <div
      className="text-xs mb-2"
      style={{ color: "#B1C9EF" }}
    >
      {a.source_normalized}
    </div>

    {/* Title */}
    <h3 className="font-semibold text-base leading-snug line-clamp-3">
      {a.title}
    </h3>

    {/* Category */}
    <div className="mt-3">
      <span
        className="text-xs rounded-full px-2 py-1"
        style={{ backgroundColor: "#B1C9EF", color: "#314A6E" }}
      >
        {a.category}
      </span>
    </div>
  </a>
))}
              </div>

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
    Page {page} / {totalPages} — Total {data?.total ?? items.length}
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
        </>
      )}
    </div>
  </div>
);

}
