import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const engineBaseUrl =
    process.env.OMR_ENGINE_URL ||
    process.env.NEXT_PUBLIC_OMR_ENGINE_URL ||
    "http://localhost:8000";

  const apiKey = process.env.OMR_API_KEY || "";

  try {
    const contentType = req.headers.get("content-type") || "";

    // Proxy JSON
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers["X-API-Key"] = apiKey;

      const engineRes = await fetch(`${engineBaseUrl}/v1/scan/json`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = await engineRes.json();
      return NextResponse.json(data, { status: engineRes.status });
    }

    // Proxy Multipart Form Data
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const headers: Record<string, string> = {};
      if (apiKey) headers["X-API-Key"] = apiKey;

      const engineRes = await fetch(`${engineBaseUrl}/v1/scan`, {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await engineRes.json();
      return NextResponse.json(data, { status: engineRes.status });
    }

    return NextResponse.json(
      { error: "Content-Type tidak didukung" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Engine OMR tidak dapat dijangkau",
        detail: err?.message || String(err),
      },
      { status: 503 }
    );
  }
}
