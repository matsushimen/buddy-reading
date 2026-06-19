import { z } from "zod";

export const annotationKindSchema = z.enum([
  "term",
  "person",
  "organization",
  "place",
  "technology",
  "concept",
  "claim",
  "citation",
  "unknown"
]);

export const annotationSchema = z
  .object({
    id: z.string().min(1).max(80),
    title: z.string().min(1).max(160),
    kind: annotationKindSchema,
    short: z.string().min(1).max(280),
    details: z.array(z.string().min(1).max(400)).max(5),
    whyRelevantHere: z.string().min(1).max(320),
    related: z.array(z.string().min(1).max(80)).max(6),
    confidence: z.enum(["low", "medium", "high"])
  })
  .strict();

export const annotationResponseSchema = z
  .object({
    annotations: z.array(annotationSchema).max(8),
    followupQuestions: z.array(z.string().min(1).max(200)).max(4),
    warnings: z.array(z.string().min(1).max(240)).max(4)
  })
  .strict();

export const annotationJobStatusSchema = z.enum(["queued", "running", "completed", "failed"]);

export const annotationJobSubmissionSchema = z
  .object({
    jobId: z.string().min(1).max(80),
    status: annotationJobStatusSchema
  })
  .strict();

export const annotationJobResultSchema = annotationJobSubmissionSchema
  .extend({
    response: annotationResponseSchema.optional(),
    error: z.string().max(400).optional()
  })
  .strict();

export const annotationChatTurnSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(600)
  })
  .strict();

export const annotationChatResponseSchema = z
  .object({
    answer: z.string().min(1).max(1200),
    followupQuestions: z.array(z.string().min(1).max(200)).max(4),
    warnings: z.array(z.string().min(1).max(240)).max(4)
  })
  .strict();

export const memorySnapshotSchema = z
  .object({
    content: z.string(),
    version: z.string(),
    exists: z.boolean(),
    template: z.string()
  })
  .strict();

export const memoryProposalRequestSchema = z
  .object({
    userId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    currentMemory: z.string().max(20000),
    bookTitle: z.string().max(240),
    format: z.enum(["pdf", "epub"]),
    selectedText: z.string().max(2000).optional(),
    visibleText: z.string().max(12000),
    explanationSummary: z.string().max(1200),
    followupSummary: z.string().max(1200)
  })
  .strict();

export const memoryProposalResponseSchema = z
  .object({
    proposedMemory: z.string().max(20000),
    reason: z.string().min(1).max(1200),
    warnings: z.array(z.string().min(1).max(240)).max(4)
  })
  .strict();

export const memoryApprovalRequestSchema = z
  .object({
    userId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    content: z.string().min(1).max(20000)
  })
  .strict();

export const bookContextSnapshotSchema = z
  .object({
    content: z.string(),
    version: z.string(),
    exists: z.boolean(),
    template: z.string()
  })
  .strict();

export const bookContextProposalRequestSchema = z
  .object({
    bookId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    currentBookContext: z.string().max(20000),
    bookTitle: z.string().max(240),
    format: z.enum(["pdf", "epub"]),
    selectedText: z.string().max(2000).optional(),
    visibleText: z.string().max(12000),
    explanationSummary: z.string().max(1200),
    followupSummary: z.string().max(1200)
  })
  .strict();

export const bookContextProposalResponseSchema = z
  .object({
    proposedBookContext: z.string().max(20000),
    reason: z.string().min(1).max(1200),
    warnings: z.array(z.string().min(1).max(240)).max(4)
  })
  .strict();

export const bookContextApprovalRequestSchema = z
  .object({
    bookId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    content: z.string().min(1).max(20000)
  })
  .strict();

export const annotationRequestSchema = z
  .object({
    bookId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    bookTitle: z.string().min(1).max(240),
    format: z.enum(["pdf", "epub"]),
    location: z
      .object({
        type: z.enum(["pdf_page", "epub_cfi"]),
        page: z.number().int().positive().optional(),
        cfi: z.string().max(500).optional()
      })
      .strict(),
    visibleText: z.string().max(12000),
    selectedText: z.string().max(2000).optional(),
    skillId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    userId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    options: z
      .object({
        detailLevel: z.enum(["brief", "standard", "deep"]),
        language: z.enum(["ja", "en", "auto"])
      })
      .strict()
  })
  .strict()
  .refine((request) => request.visibleText.trim().length > 0 || (request.selectedText?.trim().length ?? 0) > 0, {
    message: "visibleText or selectedText is required",
    path: ["visibleText"]
  });

export const annotationChatRequestSchema = z
  .object({
    bookId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    bookTitle: z.string().min(1).max(240),
    format: z.enum(["pdf", "epub"]),
    location: z
      .object({
        type: z.enum(["pdf_page", "epub_cfi"]),
        page: z.number().int().positive().optional(),
        cfi: z.string().max(500).optional()
      })
      .strict(),
    visibleText: z.string().max(12000),
    selectedText: z.string().max(2000).optional(),
    question: z.string().min(1).max(400),
    conversation: z.array(annotationChatTurnSchema).max(6),
    skillId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    userId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    options: z
      .object({
        detailLevel: z.enum(["brief", "standard", "deep"]),
        language: z.enum(["ja", "en", "auto"])
      })
      .strict(),
    retrievedChunks: z.array(z.string().max(8000)).max(10).optional()
  })
  .strict()
  .refine((request) => request.visibleText.trim().length > 0 || (request.selectedText?.trim().length ?? 0) > 0, {
    message: "visibleText or selectedText is required",
    path: ["visibleText"]
  });

export const embeddingRequestSchema = z
  .object({
    input: z.union([z.string().max(8000), z.array(z.string().max(8000)).max(100)])
  })
  .strict();

export const embeddingResponseSchema = z
  .object({
    embeddings: z.array(z.array(z.number()))
  })
  .strict();

