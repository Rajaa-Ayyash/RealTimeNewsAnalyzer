import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectMongo } from "./db/mongo";

import articlesRouter from "./routes/articles";
import sentimentRouter from "./routes/sentiment";
import breakingRouter from "./routes/breaking";
import trendsRouter from "./routes/trends";
import categoryTrendsRouter from "./routes/categoryTrends";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/articles", articlesRouter);
app.use("/api/sentiment", sentimentRouter);
app.use("/api/breaking", breakingRouter);
app.use("/api/trends", trendsRouter);
app.use("/api/category-trends", categoryTrendsRouter);

const port = Number(process.env.PORT || 4000);

async function start() {
  await connectMongo();
  app.get("/", (_req, res) => {
  res.send("News API is running");
});
  app.listen(port, () => console.log(`API running on http://localhost:${port}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
