import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json();

    const apiKey = process.env.BENCHMARK_AUTH_TOKEN; // ✅ matches .env
    const listId = process.env.BENCHMARK_LIST_ID;   // ✅ matches .env

    console.log("DEBUG Benchmark Subscribe:");
    console.log("Email:", email);
    console.log("Name:", name);
    console.log("API Key Loaded:", apiKey ? "Yes" : "No");
    console.log("List ID:", listId);

    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: API key missing" },
        { status: 500 }
      );
    }

    if (!listId) {
      return NextResponse.json(
        { error: "Server misconfiguration: List ID missing" },
        { status: 500 }
      );
    }

    const [firstName, ...lastNameParts] = name?.trim().split(" ") || [];
    const lastName = lastNameParts.join(" ");

    const body = {
      Data: {
        Email: email,
        FirstName: firstName || "",
        LastName: lastName || "",
        EmailPerm: "1",
      },
    };

    const res = await fetch(
      `https://clientapi.benchmarkemail.com/Contact/${listId}/ContactDetails`,
      {
        method: "POST",
        headers: {
          "AuthToken": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const text = await res.text();
    console.log("Benchmark response:", res.status, text);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Benchmark API error", details: text },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true, data: text });
  } catch (err: any) {
    console.error("Subscribe error:", err);
    return NextResponse.json(
      { error: "Unexpected server error", details: err.message },
      { status: 500 }
    );
  }
}