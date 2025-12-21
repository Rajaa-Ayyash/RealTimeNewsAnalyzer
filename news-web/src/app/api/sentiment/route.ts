import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const BASE = process.env.NEWS_API_BASE_URL;
  if (!BASE) return NextResponse.json({ error: "Missing NEWS_API_BASE_URL" }, { status: 500 });

  const { searchParams } = new URL(req.url);

  const upstreamUrl = `${BASE}/api/sentiment?${searchParams.toString()}`;
  const r = await fetch(upstreamUrl, { cache: "no-store" });

  if (!r.ok) {
    const text = await r.text();
    return NextResponse.json({ error: `Upstream error ${r.status}`, details: text }, { status: 502 });
  }

  return NextResponse.json(await r.json());
}