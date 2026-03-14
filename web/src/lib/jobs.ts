export type JobStatus =
  | "queued"
  | "capturing"
  | "transforming"
  | "lighthouse"
  | "done"
  | "error";

export interface LighthouseMetrics {
  performanceScore: number;
  fcp: number;
  lcp: number;
  tbt: number;
  cls: number;
  si: number;
}

export interface MetricDelta {
  performanceScore: number;
  fcp: number;
  lcp: number;
  tbt: number;
  cls: number;
  si: number;
}

export interface JobResult {
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

export interface Job {
  id: string;
  url: string;
  status: JobStatus;
  progress: number; // 0-100
  message: string;
  result?: JobResult;
  error?: string;
  createdAt: Date;
}

// In-memory store. Fine for single-instance MVP.
const jobs = new Map<string, Job>();

// SSE listeners per job
const listeners = new Map<string, Set<(job: Job) => void>>();

export function createJob(url: string): Job {
  const id = crypto.randomUUID();
  const job: Job = {
    id,
    url,
    status: "queued",
    progress: 0,
    message: "Queued...",
    createdAt: new Date(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(
  id: string,
  update: Partial<Pick<Job, "status" | "progress" | "message" | "result" | "error">>
): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;

  Object.assign(job, update);

  // Notify listeners
  const jobListeners = listeners.get(id);
  if (jobListeners) {
    for (const fn of jobListeners) {
      fn(job);
    }
  }

  return job;
}

export function subscribe(id: string, fn: (job: Job) => void): () => void {
  if (!listeners.has(id)) {
    listeners.set(id, new Set());
  }
  listeners.get(id)!.add(fn);

  return () => {
    const set = listeners.get(id);
    if (set) {
      set.delete(fn);
      if (set.size === 0) listeners.delete(id);
    }
  };
}
