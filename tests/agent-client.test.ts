import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAnnotations } from "../lib/agent-client";
import type { AnnotationRequest, AnnotationResponse } from "../lib/types";

const request: AnnotationRequest = {
  bookId: "poll_book_001",
  bookTitle: "Polling Sample Book",
  format: "epub",
  location: {
    type: "epub_cfi",
    cfi: "epubcfi(/6/2[chapter-1]!/4/2/14)"
  },
  visibleText: "Apache Kafka is a distributed event streaming platform.",
  selectedText: "Apache Kafka",
  skillId: "default",
  userId: "default",
  options: {
    detailLevel: "standard",
    language: "ja"
  }
};

const response: AnnotationResponse = {
  annotations: [
    {
      id: "annotation_1",
      title: "Apache Kafka",
      kind: "technology",
      short: "分散イベントストリーミング基盤。",
      details: ["イベントを順序付きで配信する。"],
      whyRelevantHere: "本文で言及されているため。",
      related: ["stream processing"],
      confidence: "high"
    }
  ],
  followupQuestions: ["Kafkaとは何ですか？"],
  warnings: []
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("agent-client annotation polling", () => {
  it("polls the job endpoint until the annotation is completed", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId: "job_1", status: "queued" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId: "job_1", status: "running" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId: "job_1", status: "completed", response }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const promise = requestAnnotations(request);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/annotation-jobs");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/annotation-jobs?jobId=job_1");
  });
});
