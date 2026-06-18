export type BookFormat = "pdf" | "epub";

export type StoredBook = {
  id: string;
  title: string;
  author?: string;
  format: BookFormat;
  fileName: string;
  fileBlobKey: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredBookFile = {
  key: string;
  blob: Blob;
};

export type ReadingProgress = {
  bookId: string;
  format: BookFormat;
  pdfPage?: number;
  epubCfi?: string;
  updatedAt: string;
};

export type AnnotationKind =
  | "term"
  | "person"
  | "organization"
  | "place"
  | "technology"
  | "concept"
  | "claim"
  | "citation"
  | "unknown";

export type Annotation = {
  id: string;
  title: string;
  kind: AnnotationKind;
  short: string;
  details: string[];
  whyRelevantHere: string;
  related: string[];
  confidence: "low" | "medium" | "high";
};

export type AnnotationResponse = {
  annotations: Annotation[];
  followupQuestions: string[];
  warnings: string[];
};

export type AnnotationJobStatus = "queued" | "running" | "completed" | "failed";

export type AnnotationJobSubmission = {
  jobId: string;
  status: AnnotationJobStatus;
};

export type AnnotationJobResult = AnnotationJobSubmission & {
  response?: AnnotationResponse;
  error?: string;
};

export type AnnotationChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AnnotationChatRequest = {
  bookId: string;
  bookTitle: string;
  format: BookFormat;
  location: {
    type: "pdf_page" | "epub_cfi";
    page?: number;
    cfi?: string;
  };
  visibleText: string;
  selectedText?: string;
  question: string;
  conversation: AnnotationChatTurn[];
  skillId: string;
  userId: string;
  options: {
    detailLevel: "brief" | "standard" | "deep";
    language: "ja" | "en" | "auto";
  };
};

export type AnnotationChatResponse = {
  answer: string;
  followupQuestions: string[];
  warnings: string[];
};

export type MemorySnapshot = {
  content: string;
  version: string;
  exists: boolean;
  template: string;
};

export type MemoryProposalRequest = {
  userId: string;
  currentMemory: string;
  bookTitle: string;
  format: BookFormat;
  selectedText?: string;
  visibleText: string;
  explanationSummary: string;
  followupSummary: string;
};

export type MemoryProposalResponse = {
  proposedMemory: string;
  reason: string;
  warnings: string[];
};

export type MemoryApprovalRequest = {
  userId: string;
  content: string;
};

export type BookContextSnapshot = {
  content: string;
  version: string;
  exists: boolean;
  template: string;
};

export type BookContextProposalRequest = {
  bookId: string;
  currentBookContext: string;
  bookTitle: string;
  format: BookFormat;
  selectedText?: string;
  visibleText: string;
  explanationSummary: string;
  followupSummary: string;
};

export type BookContextProposalResponse = {
  proposedBookContext: string;
  reason: string;
  warnings: string[];
};

export type BookContextApprovalRequest = {
  bookId: string;
  content: string;
};

export type AnnotationRecord = {
  id: string;
  cacheKey: string;
  bookId: string;
  location:
    | {
        type: "pdf_page";
        page: number;
      }
    | {
        type: "epub_cfi";
        cfi?: string;
      };
  locationKey: string;
  selectedText?: string;
  skillId: string;
  userId: string;
  model: string;
  language: "ja" | "en" | "auto";
  detailLevel: "brief" | "standard" | "deep";
  memoryVersion: string;
  bookContextVersion: string;
  readingPositionLabel?: string;
  response: AnnotationResponse;
  createdAt: string;
  updatedAt: string;
};

export type AnnotationRequest = {
  bookId: string;
  bookTitle: string;
  format: BookFormat;
  location: {
    type: "pdf_page" | "epub_cfi";
    page?: number;
    cfi?: string;
  };
  visibleText: string;
  selectedText?: string;
  skillId: string;
  userId: string;
  options: {
    detailLevel: "brief" | "standard" | "deep";
    language: "ja" | "en" | "auto";
  };
};

export type AppSettings = {
  userId: string;
  skillId: string;
  model: string;
  language: "ja" | "en" | "auto";
  detailLevel: "brief" | "standard" | "deep";
};
