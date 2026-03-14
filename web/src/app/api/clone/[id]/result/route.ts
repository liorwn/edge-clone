import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status !== "done") {
    return NextResponse.json(
      { error: "Job not complete" },
      { status: 400 }
    );
  }

  if (!job.result) {
    return NextResponse.json(
      { error: "No results available" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: job.id,
    url: job.url,
    status: job.status,
    result: job.result,
  });
}
