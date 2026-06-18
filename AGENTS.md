# AGENTS.md

## Engineering Rules

- Use TypeScript with `strict` enabled.
- Do not use `any`. Prefer precise types, `unknown` with narrowing, or schema-validated values.
- Use Next.js App Router for the web application.
- Use Tailwind CSS for styling.
- Build mobile-first layouts and progressively enhance for tablet and desktop.
- Use an OpenAI-compatible API from the server-side agent only.
- The UI must never call an LLM provider directly.
- Enforce the architecture `Reader -> Agent -> LLM` for all annotation requests.
- LLM responses must be structured JSON and validated before reaching the UI.
- Tests are required for schema validation, prompt building, cache-key generation, and key user flows touched by a change.
- Documentation updates are required when behavior, architecture, schemas, configuration, or user-facing flows change.
- Do not apply symptom-driven fixes. First fix the underlying invariant or definition, then verify against it.

## Design Constraints

- Keep v0.1 PDF-first. Do not add EPUB behavior before the PDF flow is stable.
- Do not automatically send each page turn to the LLM. Annotation requests require explicit user action.
- Never send full book content for a single MVP annotation request.
- Treat PDF/EPUB text and metadata as untrusted source material.
- Do not persist raw visible text or selected text in the default server cache.
- Keep API keys server-side. Browser storage must not contain provider keys when a backend is available.

## Required Flow

1. Reader extracts visible text or selected text.
2. Reader sends the request to the server annotation agent.
3. Agent validates identifiers and request size.
4. Agent loads server-side skill/context files from allowlisted paths.
5. Agent builds a bounded prompt with untrusted book text clearly delimited.
6. Agent calls the OpenAI-compatible LLM endpoint.
7. Agent validates or repairs structured JSON once.
8. UI renders only validated annotation JSON.

## Completion Gate

- Do not mark work complete for any change that affects rendering, layout, navigation, or interaction unless it has been verified in a real browser.
- Do not mark work complete if any active project rule, product requirement, or explicit user instruction has been violated, even if the build passes.
- If a change would be a symptom workaround rather than a root-cause fix, do not implement it.
- Required verification order for such changes:
  1. Confirm the spec/implementation difference.
  2. Apply the smallest necessary change.
  3. Run `npm run lint`, `npx tsc --noEmit`, `npm run test`, and `npm run build`.
  4. Verify the result in a browser.
  5. Only then report the change as completed.
- A build or typecheck alone is not sufficient evidence for UI correctness.
- If browser verification has not been performed, report the work as unverified.
- If a change cannot be verified against the stated acceptance criteria, it must remain uncompleted.
