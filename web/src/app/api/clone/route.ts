import { NextRequest, NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";
import { runPipeline } from "@/lib/pipeline";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, options } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL" },
        { status: 400 }
      );
    }

    // Create job
    const job = createJob(url);

    // Kick off pipeline in background (no await — fire and forget)
    runPipeline(job.id, url, options).catch((err) => {
      console.error(`Pipeline error for job ${job.id}:`, err);
    });

    return NextResponse.json({ jobId: job.id });
  } catch (err: unknown) {
    console.error("Clone API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
