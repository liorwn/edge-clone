"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start optimization");
      }

      const { jobId } = await res.json();
      router.push(`/job/${jobId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <main className="flex w-full max-w-2xl flex-col items-center gap-12">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-6xl font-bold tracking-tight text-accent">
            andale
          </h1>
          <p className="text-xl text-text-muted">Your page, but faster.</p>
        </div>

        {/* Description */}
        <div className="text-center max-w-lg">
          <p className="text-text-muted leading-relaxed">
            Paste any URL. Andale captures the fully rendered page, defers
            tracking scripts, optimizes images, and outputs a static clone that
            loads in under a second. Same pixels, zero bloat.
          </p>
        </div>

        {/* URL Input Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/landing-page"
              required
              className="flex-1 rounded-lg border border-border bg-bg-input px-5 py-4 text-lg text-text placeholder:text-text-muted/50 outline-none transition-colors focus:border-border-focus focus:ring-1 focus:ring-accent/30 font-mono"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-accent px-8 py-4 text-lg font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Starting...
                </span>
              ) : (
                "Optimize"
              )}
            </button>
          </div>

          {error && (
            <p className="text-error text-sm px-1">{error}</p>
          )}
        </form>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full mt-4">
          <Feature
            title="Defer Tracking"
            description="GTM, GA, Facebook Pixel, HotJar, and 20+ vendors deferred to post-interaction. Zero TBT."
          />
          <Feature
            title="Optimize Assets"
            description="Inline images extracted and converted to WebP. Fonts preloaded. Critical path cleared."
          />
          <Feature
            title="Lighthouse Report"
            description="Before/after PageSpeed comparison. See the exact improvement in every Core Web Vital."
          />
        </div>

        {/* Footer */}
        <p className="text-text-muted/40 text-sm mt-8">
          Built for marketing teams that need speed without rebuilding.
        </p>
      </main>
    </div>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-5">
      <h3 className="text-sm font-semibold text-accent mb-2">{title}</h3>
      <p className="text-sm text-text-muted leading-relaxed">{description}</p>
    </div>
  );
}
