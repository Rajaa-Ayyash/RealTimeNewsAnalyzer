import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const BASE = process.env.NEWS_API_BASE_URL;
  if (!BASE) {
    return NextResponse.json(
      { error: "Missing NEWS_API_BASE_URL" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const searchParams = url.searchParams;

  // (اختياري) Defaults لطيفة بدون ما نكسر أي باراميتر موجود
  // إذا ما بدك defaults احكيلي وبشيلهم
  if (!searchParams.has("page")) searchParams.set("page", "1");
  if (!searchParams.has("pageSize")) searchParams.set("pageSize", "30");

  // ✅ نفس endpoint
  const upstreamUrl = `${BASE}/api/trends?${searchParams.toString()}`;

  const r = await fetch(upstreamUrl, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!r.ok) {
    const text = await r.text();
    return NextResponse.json(
      { error: `Upstream error ${r.status}`, details: text },
      { status: 502 }
    );
  }

  return NextResponse.json(await r.json());
}