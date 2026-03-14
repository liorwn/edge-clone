import { NextRequest } from "next/server";
import { getJob, subscribe } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return new Response("Job not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send current state immediately
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      sendEvent({
        id: job.id,
        url: job.url,
        status: job.status,
        progress: job.progress,
        message: job.message,
        result: job.result,
        error: job.error,
      });

      // If already terminal, close
      if (job.status === "done" || job.status === "error") {
        controller.close();
        return;
      }

      // Subscribe to updates
      const unsubscribe = subscribe(id, (updatedJob) => {
        try {
          sendEvent({
            id: updatedJob.id,
            url: updatedJob.url,
            status: updatedJob.status,
            progress: updatedJob.progress,
            message: updatedJob.message,
            result: updatedJob.result,
            error: updatedJob.error,
          });

          if (
            updatedJob.status === "done" ||
            updatedJob.status === "error"
          ) {
            controller.close();
            unsubscribe();
          }
        } catch {
          // Stream closed by client
          unsubscribe();
        }
      });

      // Clean up on cancel
      _request.signal.addEventListener("abort", () => {
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
