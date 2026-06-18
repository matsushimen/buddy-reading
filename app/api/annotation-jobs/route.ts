import { NextResponse } from "next/server";
import { enqueueAnnotationJob, getAnnotationJob } from "@/lib/agent/annotation-job-store";
import { annotationJobResultSchema, annotationRequestSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const parsed = annotationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid annotation request", issues: parsed.error.issues }, { status: 400 });
  }

  const job = enqueueAnnotationJob(parsed.data);
  return NextResponse.json(serializeJob(job));
}

export function GET(request: Request): NextResponse {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") ?? "";

  if (!jobId.trim()) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = getAnnotationJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Annotation job not found" }, { status: 404 });
  }

  const parsed = annotationJobResultSchema.safeParse(serializeJob(job));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid annotation job state" }, { status: 500 });
  }

  return NextResponse.json(serializeJob(parsed.data));
}

function serializeJob(job: {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  response?: unknown;
  error?: string;
}): Record<string, unknown> {
  return {
    jobId: job.jobId,
    status: job.status,
    ...(job.response ? { response: job.response } : {}),
    ...(job.error ? { error: job.error } : {})
  };
}
