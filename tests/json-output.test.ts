import { describe, expect, it } from "vitest";
import { parseAnnotationJson } from "../lib/agent/json-output";

describe("LLM JSON output parsing", () => {
  it("normalizes loose local LLM JSON into the annotation schema", () => {
    const response = parseAnnotationJson(
      JSON.stringify({
        annotations: [
          {
            title: "Kafka",
            kind: "tool",
            description: "分散イベントストリーミング基盤。",
            explanation: "ログやイベントを扱う文脈で使われる。"
          }
        ],
        followupQuestions: ["KafkaとRabbitMQの違いは？"],
        extra: "ignored"
      })
    );

    expect(response.annotations[0]?.id).toBe("annotation_1");
    expect(response.annotations[0]?.kind).toBe("unknown");
    expect(response.annotations[0]?.short).toBe("分散イベントストリーミング基盤。");
    expect(response.annotations[0]?.details).toEqual(["ログやイベントを扱う文脈で使われる。"]);
  });
});
