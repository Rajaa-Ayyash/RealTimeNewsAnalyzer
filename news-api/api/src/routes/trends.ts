import { Router } from "express";
import { getDb } from "../db/mongo";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const db = getDb();

    // ✅ collection الصحيحة
    const col = db.collection("trending_keywords");

    const category = String(req.query.category ?? "").trim();
    const keyword = String(req.query.keyword ?? "").trim();

    // مستويات الترند (BREAKING / HOT / RISING / ...)
    const levelRaw = String(req.query.level ?? "").trim();
    const level = levelRaw ? levelRaw.toUpperCase() : "";

    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 30)));

    const filter: any = {};

    // فلترة trend_level (مرنة)
    if (level) {
      filter.trend_level = level;
    }

    // فلترة category
    if (category) {
      filter.category = category;
    }

    // فلترة keyword (اختياري)
    if (keyword) {
      filter.keyword = keyword;
    }

    const total = await col.countDocuments(filter);

    const docs = await col
      .find(filter)
      .sort({ trend_score: -1, created_at: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    const items = docs.map((d: any) => {
      const win = d?.window ?? {};

      const start =
        win?.start ??
        win?.from ??
        win?.start_time ??
        win?.startAt ??
        win?.start_at ??
        null;

      const end =
        win?.end ??
        win?.to ??
        win?.end_time ??
        win?.endAt ??
        win?.end_at ??
        null;

      return {
        _id: d?._id,

        // 🔥 بيانات الكرت
        trend_level: d?.trend_level ?? "",
        keyword: d?.keyword ?? "",
        category: d?.category ?? "",

        // Mentions
        current_count: Number(d?.current_count ?? 0), // Now
        previous_count: Number(d?.previous_count ?? 0), // Before

        trend_score: Number(d?.trend_score ?? 0),

        // Time window
        window: {
          ...win,
          start,
          end,
        },
        time_window_text:
          start && end ? `${formatTime(start)} → ${formatTime(end)}` : "",

        created_at: d?.created_at ?? null,
      };
    });

    res.json({ items, total, page, pageSize });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message ?? "Internal error" });
  }
});

function formatTime(v: any) {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v ?? "");
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export default router;