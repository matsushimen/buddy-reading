# Data Model

## Client-side IndexedDB Tables

### books
```ts
type Book = {
  id: string;
  title: string;
  author?: string;
  format: 'pdf' | 'epub';
  fileName: string;
  fileBlobKey: string;
  createdAt: string;
  updatedAt: string;
};
```

The `epub` format value is reserved for v0.2. v0.1 import UI should accept PDF only.

### reading_progress
```ts
type ReadingProgress = {
  bookId: string;
  format: 'pdf' | 'epub';
  pdfPage?: number;
  epubCfi?: string;
  chapterHref?: string;
  updatedAt: string;
};
```

The EPUB fields are reserved for v0.2. v0.1 progress restoration uses `pdfPage`.

### annotations
```ts
type AnnotationRecord = {
  id: string;
  cacheKey: string;
  bookId: string;
  locationKey: string;
  visibleTextHash: string;
  selectedTextHash?: string;
  selectedText?: string;
  skillId: string;
  skillVersion: string;
  model: string;
  language: 'ja' | 'en' | 'auto';
  detailLevel: 'brief' | 'standard' | 'deep';
  promptVersion: string;
  memoryVersion: string;
  bookContextVersion: string;
  response: AnnotationResponse;
  createdAt: string;
};
```

`cacheKey` should be the deterministic hash of `AnnotationCacheKeyInput`. Keep the local record sufficient to decide whether a saved annotation can be reused without comparing raw page text.

### settings
```ts
type Settings = {
  apiBaseUrl?: string;
  model?: string;
  skillId: string;
  language: 'ja' | 'en' | 'auto';
  detailLevel: 'brief' | 'standard' | 'deep';
};
```

Do not store provider API keys in client-side settings when a backend is available. In local server or hosted server modes, keys belong in server-side environment variables or encrypted server-side secrets.

## Server-side SQLite Tables

### annotation_cache
```sql
CREATE TABLE annotation_cache (
  cache_key TEXT PRIMARY KEY,
  request_metadata_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

`request_metadata_json` must not include raw `visibleText` or `selectedText` by default. It should contain identifiers, location metadata, hashes, model/settings, and version values. Raw request logging is allowed only in an explicit debug mode outside the default schema.

### request_log
```sql
CREATE TABLE request_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT,
  skill_id TEXT,
  model TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL
);
```

### memory_events
```sql
CREATE TABLE memory_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  proposed_memory TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approved_at TEXT
);
```

## Location Key

Use stable keys for locations, then combine them with the full cache-key inputs below.

PDF:
```text
book:{bookId}:pdf:page:{page}
```

EPUB:
```text
book:{bookId}:epub:cfi:{hash(epubCfi)}
```

## Annotation Cache Key

Use a deterministic hash over a structured object, not manual string concatenation:

```ts
type AnnotationCacheKeyInput = {
  bookId: string;
  locationKey: string;
  visibleTextHash: string;
  selectedTextHash: string | null;
  skillId: string;
  skillVersion: string;
  model: string;
  language: 'ja' | 'en' | 'auto';
  detailLevel: 'brief' | 'standard' | 'deep';
  promptVersion: string;
  memoryVersion: string;
  bookContextVersion: string;
};
```

Version values:
- `promptVersion`: explicit application constant.
- `skillVersion`: content hash of the loaded skill Markdown.
- `memoryVersion`: content hash of the loaded user memory file, or `none`.
- `bookContextVersion`: content hash of the loaded book context file, or `none`.

## Identifier Rules

- `bookId`, `userId`, and `skillId` are opaque identifiers, not paths.
- Validate identifiers with a conservative pattern such as `[a-zA-Z0-9_-]+`.
- Resolve Markdown files only under allowlisted server directories.
- In v0.1, annotation requests read memory/book-context files only if present and must not create or mutate them.
