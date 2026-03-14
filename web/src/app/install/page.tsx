"use client";

import { useState } from "react";

type Step = "input" | "snippet" | "verify";

interface SiteResult {
  siteId: string;
  snippet: string;
  snippetUrl: string;
  url: string;
}

export default function InstallPage() {
  const [step, setStep] = useState<Step>("input");
  const [siteUrl, setSiteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SiteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "checking" | "found" | "not-found">(
    "idle"
  );

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: siteUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register site");
      setResult(data);
      setVerifyUrl(siteUrl);
      setStep("snippet");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!result) return;
    setVerifyStatus("checking");
    try {
      const res = await fetch(
        `/api/verify-install?url=${encodeURIComponent(verifyUrl)}&siteId=${result.siteId}`
      );
      const data = await res.json();
      setVerifyStatus(data.installed ? "found" : "not-found");
    } catch {
      setVerifyStatus("not-found");
    }
  }

  function copySnippet() {
    if (!result) return;
    navigator.clipboard.writeText(result.snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <main className="flex w-full max-w-2xl flex-col gap-10">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <a href="/" className="text-accent font-bold text-2xl tracking-tight">
            andale
          </a>
          <h1 className="text-3xl font-bold text-text">Install the snippet</h1>
          <p className="text-text-muted">
            One line. Any site. Instant speed optimization — deferred tracking, lazy images, font
            preloading, and live performance monitoring.
          </p>
        </div>

        {/* Step 1 — Register */}
        {step === "input" && (
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text">Your website URL</span>
              <input
                type="url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://example.com"
                required
                className="rounded-lg border border-border bg-bg-input px-4 py-3 text-text placeholder:text-text-muted/50 outline-none transition-colors focus:border-border-focus focus:ring-1 focus:ring-accent/30 font-mono"
              />
            </label>
            {error && <p className="text-error text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-accent px-6 py-3 font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed self-start"
            >
              {loading ? "Generating…" : "Get My Snippet"}
            </button>
          </form>
        )}

        {/* Step 2 — Show snippet + instructions */}
        {step === "snippet" && result && (
          <div className="flex flex-col gap-8">
            {/* Snippet box */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text">Your snippet</h2>
                <span className="text-xs text-text-muted font-mono">
                  site ID: {result.siteId}
                </span>
              </div>
              <div className="relative rounded-lg border border-border bg-bg-card overflow-hidden">
                <pre className="px-4 py-4 text-sm text-accent font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {result.snippet}
                </pre>
                <button
                  onClick={copySnippet}
                  className="absolute top-3 right-3 rounded-md bg-accent/10 border border-accent/20 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-text-muted">
                Add this tag inside{" "}
                <code className="font-mono text-accent bg-accent/10 px-1 rounded">&lt;head&gt;</code>{" "}
                or just before{" "}
                <code className="font-mono text-accent bg-accent/10 px-1 rounded">&lt;/body&gt;</code>.
                The <code className="font-mono text-accent bg-accent/10 px-1 rounded">async</code>{" "}
                attribute ensures it never blocks rendering.
              </p>
            </div>

            {/* Instructions */}
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-text">How to install</h2>
              <div className="grid grid-cols-1 gap-4">
                <InstallMethod
                  title="Direct (any site)"
                  icon="⟨/⟩"
                  steps={[
                    "Open your site's HTML or template file.",
                    "Paste the snippet inside <head> or just before </body>.",
                    "Publish or deploy your changes.",
                  ]}
                />

                <InstallMethod
                  title="Google Tag Manager"
                  icon="GTM"
                  steps={[
                    "In GTM, go to Tags → New → Custom HTML.",
                    'Paste the snippet as the tag content.',
                    "Set trigger to: All Pages.",
                    "Save, then publish the container.",
                  ]}
                  note="Using GTM? Remove the outer <script> tags — paste just the src attribute URL as a Custom HTML tag body wrapping it in <script> yourself, or use a Custom HTML tag with the full tag included."
                />

                <InstallMethod
                  title="WordPress"
                  icon="WP"
                  steps={[
                    "Go to Appearance → Theme File Editor → header.php (or use a header/footer plugin).",
                    "Paste the snippet before </head>.",
                    "Save. Done.",
                  ]}
                  note="Recommended plugin: Insert Headers and Footers (WPCode). Paste in the Head section."
                />

                <InstallMethod
                  title="Shopify"
                  icon="SF"
                  steps={[
                    "Go to Online Store → Themes → Edit Code.",
                    "Open layout/theme.liquid.",
                    "Paste the snippet before </head>.",
                    "Save.",
                  ]}
                />

                <InstallMethod
                  title="HubSpot"
                  icon="HS"
                  steps={[
                    "Go to Settings → Website → Pages → Custom Code.",
                    "Paste the snippet in the Head HTML section.",
                    "Save and publish.",
                  ]}
                />
              </div>
            </div>

            {/* Verify install */}
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg-card p-5">
              <h2 className="text-lg font-semibold text-text">Verify installation</h2>
              <p className="text-sm text-text-muted">
                After installing, paste your URL below to confirm the snippet is live.
              </p>
              <form onSubmit={handleVerify} className="flex gap-3">
                <input
                  type="url"
                  value={verifyUrl}
                  onChange={(e) => setVerifyUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                  className="flex-1 rounded-lg border border-border bg-bg-input px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50 outline-none transition-colors focus:border-border-focus font-mono"
                />
                <button
                  type="submit"
                  disabled={verifyStatus === "checking"}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text hover:border-accent/50 hover:text-accent transition-colors disabled:opacity-50"
                >
                  {verifyStatus === "checking" ? "Checking…" : "Check"}
                </button>
              </form>
              {verifyStatus === "found" && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <span className="text-base">✓</span>
                  Snippet detected! Andale is live on your site.
                </div>
              )}
              {verifyStatus === "not-found" && (
                <div className="flex items-center gap-2 text-sm text-error">
                  <span className="text-base">✗</span>
                  Snippet not detected. Make sure you&apos;ve published your changes and the URL is
                  publicly accessible.
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex gap-4">
              <button
                onClick={() => { setStep("input"); setResult(null); setSiteUrl(""); }}
                className="text-sm text-text-muted hover:text-text transition-colors"
              >
                ← Register another site
              </button>
              <a
                href="/"
                className="text-sm text-text-muted hover:text-accent transition-colors"
              >
                Optimize a page →
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function InstallMethod({
  title,
  icon,
  steps,
  note,
}: {
  title: string;
  icon: string;
  steps: string[];
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-bg bg-accent rounded px-2 py-1 font-mono">
          {icon}
        </span>
        <h3 className="font-semibold text-text text-sm">{title}</h3>
      </div>
      <ol className="flex flex-col gap-1.5 pl-1">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-text-muted">
            <span className="text-accent font-mono text-xs mt-0.5 w-4 shrink-0">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {note && (
        <p className="text-xs text-text-muted/70 border-t border-border pt-3 leading-relaxed">
          {note}
        </p>
      )}
    </div>
  );
}
