# Roadmap

## v0.1 MVP

- PDF upload
- PDF display
- Current page text extraction
- Server annotation endpoint
- OpenAI-compatible API call
- Responsive sidebar/bottom sheet
- Local annotation cache
- Server-side API key configuration
- Strict annotation JSON validation
- Optional read-only MEMORY.md / BOOK_CONTEXT.md loading if files already exist

## v0.2 EPUB

- EPUB upload
- EPUB display
- Current chapter/section extraction
- EPUB CFI progress tracking

## v0.3 Skills

- Skill selector
- Editable skills
- Import/export skill packs
- OpenAI-compatible Agent API connection
- Server-side skill loading
- Annotation result persistence
- Saved annotation reuse and regeneration

## v0.4 Memory

- Tap/click word explanations with compact popover or bottom sheet UI
- Reduce persistent AI sidebar footprint
- MEMORY.md display
- AI proposed memory updates
- User approval before persistence

Status:
- MEMORY.md read/display/proposal/approval flow: implemented in current build
- BOOK_CONTEXT.md read/display/proposal/approval flow: implemented in current build

## v0.5 Book Context

- BOOK_CONTEXT.md generation
- Book-level recurring terms
- Previously explained terms

## v0.6 Search/RAG

- Local full-text search
- Optional embeddings
- Book-level Q&A

## v1.0

- Robust PDF/EPUB reading
- Stable PWA
- Multi-device import/export
- Optional Capacitor packaging
