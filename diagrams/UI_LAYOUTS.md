# UI Layouts

## Wide Layout

```mermaid
flowchart LR
  A[Reader viewport: PDF v0.1 / EPUB v0.2] --- B[Persistent AI sidebar]
  B --> C[Annotations]
  B --> D[Selected text actions]
  B --> E[Follow-up questions]
```

```text
┌────────────────────────────────────┬──────────────────────┐
│                                    │ AI Annotations       │
│       PDF v0.1 / EPUB v0.2         │ ───────────────────  │
│                                    │ Term                 │
│                                    │ Short explanation    │
│                                    │ Details              │
└────────────────────────────────────┴──────────────────────┘
```

## Phone Layout

```mermaid
flowchart TB
  A[Reader viewport] --> B[Floating AI button]
  B --> C[Bottom sheet]
  C --> D[Annotations]
```

```text
┌──────────────────────┐
│                      │
│ PDF v0.1 / EPUB v0.2 │
│                      │
│                 AI ○ │
└──────────────────────┘

After tapping AI:

┌──────────────────────┐
│ PDF v0.1 / EPUB v0.2 │
├──────────────────────┤
│ AI Annotations        │
│ Term / explanation    │
└──────────────────────┘
```
