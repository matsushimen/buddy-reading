# Codex Implementation Prompt

You are implementing an AI Reading Assistant as a production-quality MVP.

## Goal

Build a Next.js + TypeScript PWA that can open PDF files in v0.1, display them responsively, extract visible or selected text, call a backend annotation agent, and display structured AI annotations as a sidebar or mobile bottom sheet. Add EPUB support in v0.2 after the PDF flow is stable.

## Stack

Frontend:
- Next.js App Router
- TypeScript
- Tailwind CSS
- PDF.js/react-pdf for PDF rendering
- epub.js for EPUB rendering in v0.2
- Dexie for IndexedDB

Backend:
- Hono + TypeScript
- OpenAI-compatible chat completions API
- SQLite for cache/logs
- Markdown file loaders for skills and memory

## Required Features v0.1

1. Library page
   - Add PDF file
   - List imported books
   - Open a book

2. Reader page
   - Render PDF pages
   - Track reading position
   - Allow text selection
   - Provide an “AI Explain” action

3. Responsive annotation UI
   - >=1024px: right sidebar
   - 600-1023px: collapsible overlay side panel
   - <600px: floating AI button + bottom sheet

4. Server agent
   - POST /api/annotations
   - Validate `bookId`, `userId`, and `skillId` before loading server-side files
   - Load `skills/{skillId}.md`
   - Load `memory/users/{userId}/MEMORY.md` read-only if present
   - Load `memory/books/{bookId}/BOOK_CONTEXT.md` read-only if present
   - Build prompt
   - Call OpenAI-compatible `/v1/chat/completions`
   - Return validated JSON

5. Settings
   - API base URL
   - API key only for server-side configuration; do not persist provider keys in browser storage when a backend is available
   - Model
   - Default skill
   - Output language
   - Detail level

## Implementation Constraints

- Do not auto-send every page to the LLM.
- Never send full book content in v0.1.
- Use explicit user action for AI requests.
- Cache annotation results with a key that includes bookId, locationKey, visibleTextHash, selectedTextHash, skillId, skillVersion, model, language, detailLevel, promptVersion, memoryVersion, and bookContextVersion.
- Do not persist raw visible text or selected text in the default server cache.
- Treat extracted book text and document metadata as untrusted source material during prompt assembly.
- Sanitize any rendered Markdown.
- Do not store API keys in frontend if a backend is available.
- Keep all types shared and explicit.
- Validate `bookId`, `userId`, and `skillId` as opaque identifiers before resolving any server-side files.

## Output Requirements

- Provide working code, not pseudocode.
- Include README setup instructions.
- Include `.env.example`.
- Include basic tests for schema validation and prompt building.
- Keep components small and named clearly.

## Important Design

Return annotations as JSON, not free-form Markdown. UI should render the JSON.

AnnotationResponse schema:

```ts
export type AnnotationKind =
  | 'term'
  | 'person'
  | 'organization'
  | 'place'
  | 'technology'
  | 'concept'
  | 'claim'
  | 'citation'
  | 'unknown';

export type Annotation = {
  id: string;
  title: string;
  kind: AnnotationKind;
  short: string;
  details: string[];
  whyRelevantHere: string;
  related: string[];
  confidence: 'low' | 'medium' | 'high';
};

export type AnnotationResponse = {
  annotations: Annotation[];
  followupQuestions: string[];
  warnings: string[];
};
```

## First Milestone

Implement PDF-only v0.1:
- Upload PDF
- Render PDF
- Extract current page text
- Send to annotation API
- Render JSON response

Then add EPUB support in v0.2.
