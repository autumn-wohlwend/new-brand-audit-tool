"use client";
import React, { useState, useEffect } from "react";
import { Search, AlertCircle, Info, CheckCircle } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// ---------- Types ----------
type Result = {
  title: string;
  link: string;
  snippet: string;
  controlType: "FullControl" | "PartialControl" | "NoControl" | "Missed Opportunities";
};

type AuditResult = {
  label: string;
  query: string;
  results: Result[];
  counts: Record<string, number>;
  percentages: Record<string, number>;
};

export default function Page() {
  // ---------- State ----------
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [results, setResults] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  // ---------- Colors ----------
  const colors: Record<string, string> = {
    FullControl: "#ff8800",
    PartialControl: "#ffb366",
    NoControl: "#ffd4b3",
    "Missed Opportunities": "#6fbf73",
  };

  // ---------- Validation ----------
  const validateInputs = () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Name is required.");
    if (!email.trim()) errs.push("Email is required.");
    if (!companyName.trim()) errs.push("Company name is required.");
    if (!address.trim()) errs.push("Address is required.");
    if (!phone.trim()) errs.push("Phone number is required.");
    if (!website.trim()) errs.push("Website URL is required.");
    return errs;
  };

  const normalizeDomain = (url: string) => {
    try {
      return new URL(url.includes("http") ? url : `https://${url}`)
        .hostname.replace(/^www\./, "")
        .toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  };

  const classifyResult = (
    title: string,
    snippet: string,
    url: string,
    businessName: string,
    officialDomain: string
  ): Result["controlType"] => {
    const lowerTitle = (title || "").toLowerCase();
    const lowerSnippet = (snippet || "").toLowerCase();
    const lowerName = (businessName || "").toLowerCase();
    const domain = normalizeDomain(url);
    const official = normalizeDomain(officialDomain);

    if (official && domain.includes(official)) return "FullControl";

    const partialSites = [
      "facebook.com",
      "instagram.com",
      "linkedin.com",
      "twitter.com",
      "x.com",
      "youtube.com",
      "yelp.com",
      "google.com",
      "maps.google.com",
      "bbb.org",
      "yellowpages.com",
      "tripadvisor.com",
      "chamberofcommerce.com",
      "clutch.co",
      "designrush.com",
    ];
    if (partialSites.some((site) => domain.includes(site))) return "PartialControl";

    if (lowerTitle.includes(lowerName) || lowerSnippet.includes(lowerName))
      return "NoControl";

    return "Missed Opportunities";
  };

  // ---------- API Calls ----------
  const fetchResults = async (query: string): Promise<any[]> => {
    const url = `/api/serp?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch");
    const data = await response.json();
    return data.organic_results || [];
  };

  const autoSubscribe = async () => {
    try {
      await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, companyName }),
      });
      setSubscribed(true);
      setTimeout(() => setSubscribed(false), 4000);
    } catch (err) {
      console.error("Auto-subscribe failed:", err);
    }
  };

  // ---------- Color Fix ----------
  const sanitizeOKLCH = (doc: Document) => {
    const win = doc.defaultView || window;
    const allElems = doc.querySelectorAll<HTMLElement>("*");
    allElems.forEach((el) => {
      const cs = win.getComputedStyle(el);
      if (cs.color.includes("oklch")) el.style.color = "#000";
      if (cs.backgroundColor.includes("oklch")) el.style.backgroundColor = "#fff";
      if (cs.backgroundImage.includes("oklch")) el.style.backgroundImage = "none";
    });
  };

  // ---------- Run Audit ----------
  const runAudit = async () => {
    setLoading(true);
    setError("");
    setResults([]);
    setSubscribed(false);

    try {
      const queries = [
        { label: "Company Name Search", query: companyName },
        { label: "Business Address Search", query: address },
        { label: "Phone Number Search", query: phone },
      ];

      const audits: AuditResult[] = [];

      for (const q of queries) {
        const organic = await fetchResults(q.query);

        const classified: Result[] = organic.map((r: any) => ({
          title: r.title || "",
          link: r.link || "",
          snippet: r.snippet || "",
          controlType: classifyResult(
            r.title,
            r.snippet,
            r.link || "",
            companyName,
            website
          ),
        }));

        const counts = {
          FullControl: classified.filter((r) => r.controlType === "FullControl").length,
          PartialControl: classified.filter((r) => r.controlType === "PartialControl").length,
          NoControl: classified.filter((r) => r.controlType === "NoControl").length,
          "Missed Opportunities": classified.filter(
            (r) => r.controlType === "Missed Opportunities"
          ).length,
        };

        const total = classified.length || 1;
        const percentages = {
          FullControl: Math.round((counts.FullControl / total) * 100),
          PartialControl: Math.round((counts.PartialControl / total) * 100),
          NoControl: Math.round((counts.NoControl / total) * 100),
          "Missed Opportunities": Math.round(
            (counts["Missed Opportunities"] / total) * 100
          ),
        };

        audits.push({ label: q.label, query: q.query, results: classified, counts, percentages });
      }

      setResults(audits);
      await autoSubscribe();
    } catch (err) {
      console.error(err);
      setError("Failed to fetch results. Please check your API key or try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    const errs = validateInputs();
    setErrors(errs);
    if (errs.length === 0) runAudit();
  };

  // ---------- Email PDF ----------
  useEffect(() => {
  const sendReport = async () => {
    const report = document.getElementById("audit-report");
    if (!report || results.length === 0) return;

    try {
      const canvas = await html2canvas(report, {
        scale: 1.5, // slightly lower for smaller output
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        scrollY: -window.scrollY,
        onclone: (clonedDoc) => sanitizeOKLCH(clonedDoc),
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.75); // compress the image itself
      const pdf = new jsPDF("p", "mm", "a4", true);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // 👇 compress final PDF stream (significant size drop)
const arrayBuffer = pdf.output("arraybuffer");
const blob = new Blob([arrayBuffer], { type: "application/pdf" });

console.log("📄 Compressed PDF size:", blob.size / 1024 / 1024, "MB");

      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("company", companyName);
      formData.append("phone", phone);
      formData.append("website", website);
      formData.append("pdf", blob, "brand-audit-report.pdf");

      console.log("📬 Sending Brand Audit report via /api/notify...");
      const res = await fetch("/api/notify", { method: "POST", body: formData });
      const result = await res.json();
      console.log("📧 Email API response:", result);
    } catch (err) {
      console.error("❌ Failed to send audit report:", err);
    }
  };

  sendReport();
}, [results]);

  // ---------- Download PDF ----------
  const downloadPDF = async () => {
    const report = document.getElementById("audit-report");
    if (!report) {
      alert("Could not find report content to export.");
      return;
    }

    try {
      const canvas = await html2canvas(report, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        scrollY: -window.scrollY,
        onclone: (clonedDoc) => sanitizeOKLCH(clonedDoc),
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save("brand-audit-report.pdf");
    } catch (e) {
      console.error("Error generating PDF:", e);
      alert("Something went wrong while generating the PDF.");
    }
  };

  // ---------- UI Helpers ----------
  const renderPie = (
  counts: Record<string, number>,
  percentages: Record<string, number>
) => {
  const data = Object.keys(counts)
    .filter((k) => percentages[k] > 0) // hide zero-value slices
    .map((k) => ({
      name: k,
      value: percentages[k],
      count: counts[k],
    }));

  // fallback if everything is zero
  const pieData = data.length ? data : [{ name: "No Data", value: 1 }];

  return (
    <div className="w-full h-80 mb-6 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            outerRadius="70%"
            labelLine={false}
            label={(props) => {
  const { name, value } = props as unknown as { name: string; value: number };
  return value > 0 ? `${name}: ${value}%` : "";
}}
          >
            {pieData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.name === "No Data" ? "#e5e7eb" : colors[entry.name]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name, props) =>
              [`${value}% (${props.payload.count})`, name]
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

  const InfoBubble = ({ text }: { text: string }) => (
    <span className="inline-flex items-center ml-2 text-gray-400 group relative cursor-pointer">
      <Info className="w-4 h-4" />
      <span className="absolute left-6 top-0 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
        {text}
      </span>
    </span>
  );

  // ---------- Render ----------
  return (
    <div className="max-w-5xl mx-auto p-8 bg-white rounded-2xl shadow-2xl border border-gray-100">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Brand Control Audit Tool</h1>

      {/* User Info */}
      <div className="space-y-6 mb-8">
        <div>
          <label className="block font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">
            Company Name <InfoBubble text="Use exact GBP company name" />
          </label>
          <input
            type="text"
            placeholder="Tiger29"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">
            Business Address <InfoBubble text="Use exact GBP business address" />
          </label>
          <input
            type="text"
            placeholder="Park Place Center, 3101 W 41st St #211, Sioux Falls, SD 57105"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">
            Phone Number <InfoBubble text="Use exact GBP phone number" />
          </label>
          <input
            type="tel"
            placeholder="(605) 275-2122"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">
            Website URL <InfoBubble text="Use exact GBP website URL" />
          </label>
          <input
            type="text"
            placeholder="https://www.tiger29.com/"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>

        {errors.length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="w-5 h-5 inline mr-2" />
            {errors.map((err, idx) => (
              <div key={idx}>{err}</div>
            ))}
          </div>
        )}
<p className="text-sm text-gray-500 italic">
  By starting your audit, you’ll be automatically subscribed to our SEO insights newsletter.
  You can unsubscribe at any time with one click.
</p>
        <button
          onClick={handleSubmit}
          className="w-full py-3 px-6 bg-orange-600 text-white font-semibold rounded-xl shadow-md hover:bg-orange-700 flex items-center justify-center gap-2"
          disabled={loading}
        >
          <Search className="w-5 h-5" />
          {loading ? "Analyzing..." : "Start Brand Control Audit"}
        </button>

        {subscribed && (
          <div className="mt-2 text-green-600 text-sm fade-in-out">
            <CheckCircle className="inline-block w-4 h-4 mr-1" />
            You’ve been successfuly subscribed to the Tiger29 SEO Newsletter.
          </div>
        )}
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {results.length > 0 && (
        <div id="audit-report" className="space-y-10">
          {results.map((res, idx) => (
            <div key={idx}>
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                {res.label}: "{res.query}"
              </h3>
              {renderPie(res.counts, res.percentages)}
              <ul className="space-y-2">
                {res.results.map((r, i) => (
                  <li key={i} className="border-b pb-2">
                    <div className="flex flex-col">
  <a
    href={r.link}
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-600 hover:underline font-semibold"
  >
    {r.title}
  </a>
  <span className="text-xs text-gray-500 break-all">{r.link}</span>
</div>

                    <p className="text-gray-600 text-sm">{r.snippet}</p>
                    <span
                      className="inline-block text-xs px-2 py-1 mt-1 rounded"
                      style={{ backgroundColor: colors[r.controlType], color: "white" }}
                    >
                      {r.controlType}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Actions */}
          <div className="mt-6 flex justify-between">
            <button
              onClick={downloadPDF}
              className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
            >
              Download PDF
            </button>

            <a
              href="https://www.tiger29.com/contact/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Schedule SEO Power Hour
            </a>
          </div>
        </div>
      )}
    </div>
  );
}