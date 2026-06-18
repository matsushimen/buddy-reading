# LLM JSON Schema

Use this schema contract between server and client.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["annotations", "followupQuestions", "warnings"],
  "properties": {
    "annotations": {
      "type": "array",
      "maxItems": 8,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "title", "kind", "short", "details", "whyRelevantHere", "related", "confidence"],
        "properties": {
          "id": { "type": "string", "minLength": 1, "maxLength": 80 },
          "title": { "type": "string", "minLength": 1, "maxLength": 160 },
          "kind": {
            "type": "string",
            "enum": ["term", "person", "organization", "place", "technology", "concept", "claim", "citation", "unknown"]
          },
          "short": { "type": "string", "minLength": 1, "maxLength": 280 },
          "details": {
            "type": "array",
            "maxItems": 5,
            "items": { "type": "string", "minLength": 1, "maxLength": 400 }
          },
          "whyRelevantHere": { "type": "string", "minLength": 1, "maxLength": 320 },
          "related": {
            "type": "array",
            "maxItems": 6,
            "items": { "type": "string", "minLength": 1, "maxLength": 80 }
          },
          "confidence": {
            "type": "string",
            "enum": ["low", "medium", "high"]
          }
        }
      }
    },
    "followupQuestions": {
      "type": "array",
      "maxItems": 4,
      "items": { "type": "string", "minLength": 1, "maxLength": 200 }
    },
    "warnings": {
      "type": "array",
      "maxItems": 4,
      "items": { "type": "string", "minLength": 1, "maxLength": 240 }
    }
  }
}
```

Implementation notes:
- Keep this JSON schema, shared TypeScript types, and server-side Zod validation equivalent.
- Reject unknown properties instead of silently passing them to the UI.
- Apply server-side request size limits before calling the LLM.
