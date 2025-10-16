// src/app/api/serp/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }
  if (!query) {
    return NextResponse.json({ error: "Missing query parameter `q`" }, { status: 400 });
  }

  try {
    const serpRes = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(
        query
      )}&engine=google&api_key=${apiKey}`,
      { headers: { "User-Agent": "BrandAuditTool/1.0" } }
    );

    if (!serpRes.ok) {
      return NextResponse.json({ error: "SerpAPI request failed" }, { status: serpRes.status });
    }

    const data = await serpRes.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
