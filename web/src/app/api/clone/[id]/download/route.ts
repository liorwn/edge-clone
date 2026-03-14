import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Collect all files recursively
function getAllFiles(dir: string, base: string = dir): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.name === "_raw.html") continue; // skip raw capture
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, base));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = getJob(id);

  if (!job || job.status !== "done" || !job.result?.outputPath) {
    return NextResponse.json({ error: "Job not found or not complete" }, { status: 404 });
  }

  const outputDir = job.result.outputPath;

  if (!existsSync(outputDir)) {
    return NextResponse.json({ error: "Output directory not found" }, { status: 404 });
  }

  // For single-file clones, just serve the index.html directly
  const indexPath = join(outputDir, "index.html");
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="andale-clone-${id.slice(0, 8)}.html"`,
      },
    });
  }

  return NextResponse.json({ error: "No output file found" }, { status: 404 });
}
