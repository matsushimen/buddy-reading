import { afterEach, describe, expect, it } from "vitest";
import { enqueueAnnotationJob, getAnnotationJob, resetAnnotationJobsForTest } from "../lib/agent/annotation-job-store";
import type { AnnotationRequest } from "../lib/types";

const request: AnnotationRequest = {
  bookId: "job_book_001",
  bookTitle: "Job Sample Book",
  format: "pdf",
  location: {
    type: "pdf_page",
    page: 7
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

afterEach(() => {
  resetAnnotationJobsForTest();
});

describe("annotation job store", () => {
  it("deduplicates identical requests while the job is in flight", () => {
    const first = enqueueAnnotationJob(request);
    const second = enqueueAnnotationJob(request);

    expect(second.jobId).toBe(first.jobId);
    expect(["queued", "running", "completed"]).toContain(getAnnotationJob(first.jobId)?.status);
  });

  it("completes a queued job with a structured response", async () => {
    const job = enqueueAnnotationJob(request);

    for (let index = 0; index < 50; index += 1) {
      const current = getAnnotationJob(job.jobId);
      if (current?.status === "completed") {
        expect(current.response?.annotations.length).toBeGreaterThan(0);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error("annotation job did not complete in time");
  });
});
