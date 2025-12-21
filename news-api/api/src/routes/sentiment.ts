import { Router } from "express";
import { getDb } from "../db/mongo";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const db = getDb();
    const col = db.collection("news_sentiment");

    const q = String(req.query.q ?? "").trim();
    const category = String(req.query.category ?? "").trim();
    const source = String(req.query.source ?? "").trim();
    const sentiment = String(req.query.sentiment ?? "").trim(); // Positive/Negative/Neutral

    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));

    const filter: any = {};
    if (category) filter.category = category;
    if (source) filter.source_normalized = source;
    if (sentiment) filter.sentiment = sentiment;

    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { keywords: { $elemMatch: { $regex: q, $options: "i" } } },
      ];
    }

    const total = await col.countDocuments(filter);

    const items = await col
      .find(filter)
      .sort({ published: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    res.json({ items, total, page, pageSize });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Internal error" });
  }
});

export default router;
