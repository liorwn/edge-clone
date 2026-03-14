"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";

type JobStatus =
  | "queued"
  | "capturing"
  | "transforming"
  | "lighthouse"
  | "done"
  | "error";

interface LighthouseMetrics {
  performanceScore: number;
  fcp: number;
  lcp: number;
  tbt: number;
  cls: number;
  si: number;
}

interface MetricDelta {
  performanceScore: number;
  fcp: number;
  lcp: number;
  tbt: number;
  cls: number;
  si: number;
}

interface JobResult {
  metrics?: {
    original: LighthouseMetrics;
    clone: LighthouseMetrics;
    deltas: MetricDelta;
  };
  stats?: {
    trackingScriptsDeferred: number;
    trackingScriptsStripped: number;
    imagesOptimized: number;
    fontsPreloaded: number;
    originalHtmlSize: number;
    finalHtmlSize: number;
    totalAssetSize: number;
  };
  outputPath?: string;
  deployUrl?: string;
}

interface JobData {
  id: string;
  url: string;
  status: JobStatus;
  progress: number;
  message: string;
  result?: JobResult;
  error?: string;
}

const STAGES: { key: JobStatus; label: string }[] = [
  { key: "queued", label: "Queued" },
  { key: "capturing", label: "Capturing Page" },
  { key: "transforming", label: "Optimizing" },
  { key: "lighthouse", label: "Running Lighthouse" },
  { key: "done", label: "Complete" },
];

function stageIndex(status: JobStatus): number {
  if (status === "error") return -1;
  return STAGES.findIndex((s) => s.key === status);
}

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<JobData | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/clone/${id}/progress`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setJob(data);
        if (data.status === "done" || data.status === "error") {
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [id]);

  if (!job) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-text-muted">Connecting to job...</p>
        </div>
      </div>
    );
  }

  const currentStage = stageIndex(job.status);
  const isError = job.status === "error";
  const isDone = job.status === "done";

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-16">
      <div className="w-full max-w-3xl flex flex-col gap-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-accent hover:text-accent-hover transition-colors text-sm font-medium"
          >
            &larr; New optimization
          </Link>
          {connected && !isDone && !isError && (
            <span className="flex items-center gap-2 text-xs text-text-muted">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse-glow" />
              Live
            </span>
          )}
        </div>

        {/* URL */}
        <div>
          <p className="text-text-muted text-sm mb-1">Optimizing</p>
          <p className="font-mono text-lg text-text break-all">{job.url}</p>
        </div>

        {/* Progress Stages */}
        <div className="flex flex-col gap-1">
          {STAGES.map((stage, i) => {
            const isActive = i === currentStage && !isDone && !isError;
            const isComplete = i < currentStage || isDone;
            const isPending = i > currentStage && !isDone;

            return (
              <div
                key={stage.key}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? "bg-accent-dim border border-accent/20"
                    : isComplete
                    ? "opacity-60"
                    : "opacity-30"
                }`}
              >
                {/* Status icon */}
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  {isComplete && (
                    <svg
                      className="w-5 h-5 text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {isActive && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  )}
                  {isPending && (
                    <div className="h-3 w-3 rounded-full border border-border" />
                  )}
                </div>

                <span
                  className={`text-sm font-medium ${
                    isActive ? "text-accent" : "text-text"
                  }`}
                >
                  {stage.label}
                </span>

                {isActive && job.message && (
                  <span className="text-xs text-text-muted ml-auto">
                    {job.message}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        {!isDone && !isError && (
          <div className="w-full h-1.5 rounded-full bg-bg-card overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="rounded-lg border border-error/30 bg-error/5 p-6">
            <p className="text-error font-medium mb-2">Optimization failed</p>
            <p className="text-text-muted text-sm font-mono">{job.error}</p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm text-accent hover:text-accent-hover transition-colors"
            >
              Try again
            </Link>
          </div>
        )}

        {/* Results */}
        {isDone && job.result && (
          <div className="flex flex-col gap-8">
            {/* Transform Stats */}
            {job.result.stats && <TransformStats stats={job.result.stats} />}

            {/* Lighthouse Comparison */}
            {job.result.metrics && (
              <ComparisonTable metrics={job.result.metrics} />
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {job.result.outputPath && (
                <a
                  href={`/api/clone/${id}/result`}
                  className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
                >
                  Download Clone
                </a>
              )}
              {job.result.deployUrl && (
                <a
                  href={job.result.deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-text transition-colors hover:bg-bg-card"
                >
                  View Deployed Page
                </a>
              )}
              <Link
                href="/"
                className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-text transition-colors hover:bg-bg-card"
              >
                Optimize Another
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TransformStats({
  stats,
}: {
  stats: NonNullable<JobResult["stats"]>;
}) {
  const htmlSaved = stats.originalHtmlSize - stats.finalHtmlSize;
  const htmlPct =
    stats.originalHtmlSize > 0
      ? Math.round((htmlSaved / stats.originalHtmlSize) * 100)
      : 0;

  return (
    <div className="rounded-lg border border-border bg-bg-card p-6">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
        Optimization Summary
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="HTML Size"
          value={`${formatBytes(stats.finalHtmlSize)}`}
          detail={htmlSaved > 0 ? `${htmlPct}% smaller` : undefined}
        />
        <StatCard
          label="Tracking Deferred"
          value={String(stats.trackingScriptsDeferred)}
          detail="scripts"
        />
        <StatCard
          label="Images Optimized"
          value={String(stats.imagesOptimized)}
          detail="to WebP"
        />
        <StatCard
          label="Fonts Preloaded"
          value={String(stats.fontsPreloaded)}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className="text-2xl font-bold text-text">{value}</p>
      {detail && <p className="text-xs text-text-muted">{detail}</p>}
    </div>
  );
}

function ComparisonTable({
  metrics,
}: {
  metrics: NonNullable<JobResult["metrics"]>;
}) {
  const rows: {
    label: string;
    key: keyof LighthouseMetrics;
    format: (v: number) => string;
    lowerIsBetter: boolean;
  }[] = [
    {
      label: "Performance Score",
      key: "performanceScore",
      format: (v) => String(v),
      lowerIsBetter: false,
    },
    {
      label: "LCP",
      key: "lcp",
      format: formatMs,
      lowerIsBetter: true,
    },
    {
      label: "TBT",
      key: "tbt",
      format: formatMs,
      lowerIsBetter: true,
    },
    {
      label: "CLS",
      key: "cls",
      format: (v) => v.toFixed(2),
      lowerIsBetter: true,
    },
    {
      label: "Speed Index",
      key: "si",
      format: formatMs,
      lowerIsBetter: true,
    },
    {
      label: "FCP",
      key: "fcp",
      format: formatMs,
      lowerIsBetter: true,
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          PageSpeed Comparison
        </h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-xs text-text-muted uppercase tracking-wider">
            <th className="text-left px-6 py-3 font-medium">Metric</th>
            <th className="text-right px-6 py-3 font-medium">Original</th>
            <th className="text-right px-6 py-3 font-medium">Clone</th>
            <th className="text-right px-6 py-3 font-medium">Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const orig = metrics.original[row.key];
            const clone = metrics.clone[row.key];
            const delta = metrics.deltas[row.key];

            const improved = row.lowerIsBetter ? delta < 0 : delta > 0;
            const regressed = row.lowerIsBetter ? delta > 0 : delta < 0;

            const deltaStr = row.key === "cls"
              ? `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`
              : row.key === "performanceScore"
              ? `${delta > 0 ? "+" : ""}${delta}`
              : `${delta > 0 ? "+" : ""}${formatMs(delta)}`;

            return (
              <tr key={row.key} className="border-b border-border/50 last:border-0">
                <td className="px-6 py-3 text-sm text-text">{row.label}</td>
                <td className="px-6 py-3 text-sm text-text-muted text-right font-mono">
                  {row.format(orig)}
                </td>
                <td className="px-6 py-3 text-sm text-text font-bold text-right font-mono">
                  {row.format(clone)}
                </td>
                <td
                  className={`px-6 py-3 text-sm font-medium text-right font-mono ${
                    improved
                      ? "text-improvement"
                      : regressed
                      ? "text-regression"
                      : "text-text-muted"
                  }`}
                >
                  {deltaStr}
                  {improved ? " \u2191" : regressed ? " \u2193" : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatMs(ms: number): string {
  const abs = Math.abs(ms);
  if (abs >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  return `${Math.round(bytes / 1024)}KB`;
}
