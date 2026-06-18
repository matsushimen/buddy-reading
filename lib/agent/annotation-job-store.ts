import { createHash } from "node:crypto";
import { runAnnotationAgent } from "./annotation-agent";
import type { AnnotationJobResult, AnnotationRequest } from "../types";

type AnnotationJobRecord = AnnotationJobResult & {
  requestKey: string;
  createdAt: string;
  updatedAt: string;
};

const jobById = new Map<string, AnnotationJobRecord>();
const jobIdByRequestKey = new Map<string, string>();

export function enqueueAnnotationJob(request: AnnotationRequest): AnnotationJobRecord {
  const requestKey = createRequestKey(request);
  const existingJobId = jobIdByRequestKey.get(requestKey);
  if (existingJobId) {
    const existing = jobById.get(existingJobId);
    if (existing && existing.status !== "failed") {
      return existing;
    }
    jobIdByRequestKey.delete(requestKey);
  }

  const now = new Date().toISOString();
  const jobId = createJobId();
  const record: AnnotationJobRecord = {
    jobId,
    requestKey,
    status: "queued",
    createdAt: now,
    updatedAt: now
  };

  jobById.set(jobId, record);
  jobIdByRequestKey.set(requestKey, jobId);
  void runAnnotationJob(jobId, request, requestKey);
  return record;
}

export function getAnnotationJob(jobId: string): AnnotationJobRecord | null {
  return jobById.get(jobId) ?? null;
}

export function resetAnnotationJobsForTest(): void {
  jobById.clear();
  jobIdByRequestKey.clear();
}

function createRequestKey(request: AnnotationRequest): string {
  return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}

function createJobId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid.replaceAll("-", "_");
  }

  return `job_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function runAnnotationJob(jobId: string, request: AnnotationRequest, requestKey: string): Promise<void> {
  updateJob(jobId, {
    status: "running"
  });

  try {
    const response = await runAnnotationAgent(request);
    updateJob(jobId, {
      status: "completed",
      response
    });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Unknown annotation job error";
    updateJob(jobId, {
      status: "failed",
      error
    });
  } finally {
    jobIdByRequestKey.set(requestKey, jobId);
  }
}

function updateJob(jobId: string, patch: Partial<Pick<AnnotationJobRecord, "status" | "response" | "error">>): void {
  const current = jobById.get(jobId);
  if (!current) {
    return;
  }

  const next: AnnotationJobRecord = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  if (patch.status === "completed") {
    delete next.error;
  }
  if (patch.status === "failed") {
    delete next.response;
  }

  jobById.set(jobId, next);
}
