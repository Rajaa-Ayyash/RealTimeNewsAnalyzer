import type { CategoryTrend, PagedResponse } from "@/types/api";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

async function getTrends(): Promise<CategoryTrend[]> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("Missing request host header");

  const url = `${proto}://${host}/api/category-trends?page=1&pageSize=300`;
  const r = await fetch(url, { cache: "no-store" });

  if (!r.ok) {
    const body = await r.text();
    throw new Error(`API error ${r.status}: ${body}`);
  }

  const data = (await r.json()) as PagedResponse<CategoryTrend>;
  return data.items ?? [];
}

function fmt(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function levelMeta(raw: string) {
  const level = (raw ?? "").toUpperCase();

  // عندك: ACTIVE / NORMAL / SPIKE
  if (level.includes("SPIKE")) {
    return {
      label: "SPIKE",
      badge: "bg-red-500/20 text-red-200 border border-red-400/30",
      ring: "ring-1 ring-red-400/20",
    };
  }
  if (level.includes("ACTIVE")) {
    return {
      label: "ACTIVE",
      badge: "bg-amber-500/20 text-amber-200 border border-amber-400/30",
      ring: "ring-1 ring-amber-400/20",
    };
  }
  return {
    label: "NORMAL",
    badge: "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30",
    ring: "ring-1 ring-emerald-400/20",
  };
}

function KpiCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-[#314A6E] p-4 shadow-sm border border-white/10">
      <div className="text-xs uppercase tracking-wide text-[#B1C9EF]">
        {title}
      </div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
      {sub ? (
        <div className="mt-2 text-xs text-[#8AAEE0]">{sub}</div>
      ) : null}
    </div>
  );
}

function CategoryCard({ t }: { t: CategoryTrend }) {
  const m = levelMeta(t.activity_level);

  return (
    <div
      className={[
        "rounded-2xl p-4 shadow-sm transition-colors",
        "bg-[#314A6E] hover:bg-[#35527A] border border-white/10",
        m.ring,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{t.category}</div>
          <div className="mt-1 text-xs text-[#B1C9EF]">Mentions</div>
        </div>

        <span className={["text-xs rounded-full px-2.5 py-1 font-semibold", m.badge].join(" ")}>
          {m.label}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div className="text-3xl font-bold text-white">{t.category_count}</div>
        <div className="text-right">
          <div className="text-[11px] text-[#8AAEE0]">Updated</div>
          <div className="text-[11px] text-[#D5DEEF]">{fmt(t.window_end)}</div>
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const trends = await getTrends();

  // ============ 1) KPIs على كل الداتا ============
  const totalMentionsAll = trends.reduce((sum, t) => sum + (t.category_count ?? 0), 0);

  const globalLastUpdated =
    trends
      .map((t) => new Date(t.window_end).getTime())
      .reduce((mx, v) => (v > mx ? v : mx), 0) || 0;

  // ============ 2) نجمع كل الداتا حسب category ============
  type CategoryAgg = {
    category: string;
    total_mentions: number;
    last_window_end: string; // ISO
    max_level: "NORMAL" | "ACTIVE" | "SPIKE";
    // للـ lists:
    spike_docs: number;
    active_docs: number;
    total_docs: number;
  };

  function normalizeLevel(raw: string): "NORMAL" | "ACTIVE" | "SPIKE" {
    const lv = (raw ?? "").toUpperCase();
    if (lv.includes("SPIKE")) return "SPIKE";
    if (lv.includes("ACTIVE")) return "ACTIVE";
    return "NORMAL";
  }

  function levelRank(lv: "NORMAL" | "ACTIVE" | "SPIKE") {
    // أعلى = أخطر/أقوى
    if (lv === "SPIKE") return 3;
    if (lv === "ACTIVE") return 2;
    return 1;
  }

  const byCategory = Object.values(
    trends.reduce<Record<string, CategoryAgg>>((acc, t) => {
      const key = (t.category ?? "unknown").toLowerCase();
      const cat = t.category ?? "unknown";

      const lv = normalizeLevel(t.activity_level);
      const wEnd = t.window_end;

      if (!acc[key]) {
        acc[key] = {
          category: cat,
          total_mentions: 0,
          last_window_end: wEnd,
          max_level: lv,
          spike_docs: 0,
          active_docs: 0,
          total_docs: 0,
        };
      }

      const a = acc[key];
      a.total_mentions += t.category_count ?? 0;
      a.total_docs += 1;

      if (lv === "SPIKE") a.spike_docs += 1;
      if (lv === "ACTIVE") a.active_docs += 1;

      // آخر تحديث لهذه category
      if (new Date(wEnd).getTime() > new Date(a.last_window_end).getTime()) {
        a.last_window_end = wEnd;
      }

      // أعلى مستوى وصل له (SPIKE > ACTIVE > NORMAL)
      if (levelRank(lv) > levelRank(a.max_level)) {
        a.max_level = lv;
      }

      return acc;
    }, {})
  );

  // ============ 3) KPIs مبنية على التجميع ============
  const mostMentionedCategory =
    byCategory.reduce((best, c) => (!best || c.total_mentions > best.total_mentions ? c : best), null as CategoryAgg | null) ??
    null;

  const spikeCategoriesCount = byCategory.filter((c) => c.max_level === "SPIKE").length;
  const activeOrSpikeCategoriesCount = byCategory.filter((c) => c.max_level === "SPIKE" || c.max_level === "ACTIVE").length;

  const lastUpdatedIso = globalLastUpdated ? new Date(globalLastUpdated).toISOString() : "";

  // Lists
  const top5 = [...byCategory].sort((a, b) => b.total_mentions - a.total_mentions).slice(0, 5);
  const hotNow = [...byCategory]
    .filter((c) => c.max_level === "SPIKE" || c.max_level === "ACTIVE")
    .sort((a, b) => b.total_mentions - a.total_mentions)
    .slice(0, 8);

  // ============ 4) نحول CategoryAgg إلى الشكل اللي CategoryCard بتفهمه ============
  // (عشان ما نغيّر CategoryCard)
  const cardsData: CategoryTrend[] = byCategory
    .sort((a, b) => new Date(b.last_window_end).getTime() - new Date(a.last_window_end).getTime())
    .map((c) => ({
      _id: c.category, // key مؤقت
      category: c.category,
      category_count: c.total_mentions, // صار يمثل total mentions
      activity_level: c.max_level, // أعلى مستوى وصل له
      window_start: c.last_window_end, // مش مهم كثير بالعرض
      window_end: c.last_window_end,
      created_at: c.last_window_end,
    }));

 return (
  <div className="space-y-6" style={{ color: "#D5DEEF" }}>
    {/* ✅ Category Overview فقط */}
    <section
      className="rounded-2xl p-5 shadow"
      style={{ backgroundColor: "#628ECB", color: "#D5DEEF" }}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white">Category Overview</h2>
        <div className="text-xs text-white/80">
          {lastUpdatedIso ? `Last DB update: ${fmt(lastUpdatedIso)}` : ""}
        </div>
      </div>

      {cardsData.length === 0 ? (
        <p className="text-sm" style={{ color: "#B1C9EF" }}>
          No category trends yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cardsData.map((t) => (
            <CategoryCard key={t._id} t={t} />
          ))}
        </div>
      )}
    </section>
  </div>
);
}