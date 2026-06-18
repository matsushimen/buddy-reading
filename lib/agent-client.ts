"use client";

import { annotationResponseSchema, annotationJobResultSchema, annotationChatResponseSchema, bookContextProposalResponseSchema, bookContextSnapshotSchema, memoryProposalResponseSchema, memorySnapshotSchema } from "./schemas";
import type {
  AnnotationChatRequest,
  AnnotationChatResponse,
  AnnotationJobResult,
  AnnotationRequest,
  AnnotationResponse,
  BookContextApprovalRequest,
  BookContextProposalRequest,
  BookContextProposalResponse,
  BookContextSnapshot,
  MemoryApprovalRequest,
  MemoryProposalRequest,
  MemoryProposalResponse,
  MemorySnapshot
} from "@/lib/types";

export async function requestAnnotations(request: AnnotationRequest): Promise<AnnotationResponse> {
  const submission = await fetchAnnotationJob(request);
  if (submission.status === "completed" && submission.response) {
    return submission.response;
  }

  return await pollAnnotationJob(submission.jobId);
}

async function fetchAnnotationJob(request: AnnotationRequest): Promise<AnnotationJobResult> {
  const response = await fetch("/api/annotation-jobs", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Agent API error: ${response.status} ${errorText.slice(0, 300)}`);
  }

  const payload: unknown = await response.json();
  const parsed = annotationJobResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Agent API returned invalid annotation job JSON: ${parsed.error.message.slice(0, 300)}`);
  }

  return parsed.data;
}

async function pollAnnotationJob(jobId: string): Promise<AnnotationResponse> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    await delay(500);
    const response = await fetch(`/api/annotation-jobs?jobId=${encodeURIComponent(jobId)}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Agent job API error: ${response.status} ${errorText.slice(0, 300)}`);
    }

    const payload: unknown = await response.json();
    const parsed = annotationJobResultSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Agent job API returned invalid JSON: ${parsed.error.message.slice(0, 300)}`);
    }

    if (parsed.data.status === "completed" && parsed.data.response) {
      const result = annotationResponseSchema.safeParse(parsed.data.response);
      if (!result.success) {
        throw new Error(`Agent job returned invalid annotation JSON: ${result.error.message.slice(0, 300)}`);
      }
      return result.data;
    }

    if (parsed.data.status === "failed") {
      throw new Error(parsed.data.error ?? "Annotation job failed");
    }
  }

  throw new Error("Annotation job timed out");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });
}

export async function requestAnnotationChat(request: AnnotationChatRequest): Promise<AnnotationChatResponse> {
  const response = await fetch("/api/annotation-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Agent API error: ${response.status} ${errorText.slice(0, 300)}`);
  }

  const payload: unknown = await response.json();
  const parsed = annotationChatResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Agent API returned invalid chat JSON: ${parsed.error.message.slice(0, 300)}`);
  }

  return parsed.data;
}

export async function requestMemorySnapshot(userId: string): Promise<MemorySnapshot> {
  const response = await fetch(`/api/memory?userId=${encodeURIComponent(userId)}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Memory API error: ${response.status} ${errorText.slice(0, 300)}`);
  }

  const payload: unknown = await response.json();
  const parsed = memorySnapshotSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Memory API returned invalid JSON: ${parsed.error.message.slice(0, 300)}`);
  }

  return parsed.data;
}

export async function requestBookContextSnapshot(bookId: string): Promise<BookContextSnapshot> {
  const response = await fetch(`/api/book-context?bookId=${encodeURIComponent(bookId)}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Book context API error: ${response.status} ${errorText.slice(0, 300)}`);
  }

  const payload: unknown = await response.json();
  const parsed = bookContextSnapshotSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Book context API returned invalid JSON: ${parsed.error.message.slice(0, 300)}`);
  }

  return parsed.data;
}

export async function requestBookContextProposal(request: BookContextProposalRequest): Promise<BookContextProposalResponse> {
  const response = await fetch("/api/book-context-proposal", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Book context proposal API error: ${response.status} ${errorText.slice(0, 300)}`);
  }

  const payload: unknown = await response.json();
  const parsed = bookContextProposalResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Book context proposal API returned invalid JSON: ${parsed.error.message.slice(0, 300)}`);
  }

  return parsed.data;
}

export async function approveBookContextUpdate(request: BookContextApprovalRequest): Promise<BookContextSnapshot> {
  const response = await fetch("/api/book-context", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Book context approval API error: ${response.status} ${errorText.slice(0, 300)}`);
  }

  const payload: unknown = await response.json();
  const parsed = bookContextSnapshotSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Book context approval API returned invalid JSON: ${parsed.error.message.slice(0, 300)}`);
  }

  return parsed.data;
}

export async function requestMemoryProposal(request: MemoryProposalRequest): Promise<MemoryProposalResponse> {
  const response = await fetch("/api/memory-proposal", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Memory proposal API error: ${response.status} ${errorText.slice(0, 300)}`);
  }

  const payload: unknown = await response.json();
  const parsed = memoryProposalResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Memory proposal API returned invalid JSON: ${parsed.error.message.slice(0, 300)}`);
  }

  return parsed.data;
}

export async function approveMemoryUpdate(request: MemoryApprovalRequest): Promise<MemorySnapshot> {
  const response = await fetch("/api/memory", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Memory approval API error: ${response.status} ${errorText.slice(0, 300)}`);
  }

  const payload: unknown = await response.json();
  const parsed = memorySnapshotSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Memory approval API returned invalid JSON: ${parsed.error.message.slice(0, 300)}`);
  }

  return parsed.data;
}
