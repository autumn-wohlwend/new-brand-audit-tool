import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // --- 🧩 Debug: list all keys received
    const keys = Array.from(formData.keys());
    console.log("🧾 FormData keys:", keys);

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const company = formData.get("company") as string;
    const phone = formData.get("phone") as string;
    const website = formData.get("website") as string;
    const file = formData.get("pdf") as File | null;

    if (!file) {
      console.error("❌ Missing PDF attachment — formData contained:", keys);
      return NextResponse.json({ error: "Missing PDF" }, { status: 400 });
    }

    // --- 🧩 Debug: print file info
    console.log("📄 Received file:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Convert to buffer for Resend
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`📩 Sending report for ${company} (${email})...`);
    console.log(`📦 PDF size: ${buffer.length} bytes`);

    const data = await resend.emails.send({
      from: process.env.NOTIFY_FROM || "Brand Audit <onboarding@resend.dev>",
      to: process.env.NOTIFY_TO || "tiger29help@gmail.com",
      subject: `New Brand Audit Report: ${company}`,
      html: `
        <h2>New Brand Audit Completed</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Website:</strong> ${website}</p>
        <p>The audit PDF is attached.</p>
      `,
      attachments: [
  {
    filename: `${company}-brand-audit.pdf`,
    content: buffer.toString("base64"),
    contentType: "application/pdf",
  },
],
    });

    // --- 🧩 Debug: log Resend response
    if (data.error) {
      console.error("❌ Resend API error:", data.error);
      return NextResponse.json({ error: data.error }, { status: 500 });
    }

    console.log("✅ Email sent successfully:", data);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("❌ Notify API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}