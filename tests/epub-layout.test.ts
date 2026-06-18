import { describe, expect, it } from "vitest";
import { epubContentPadding } from "../lib/epub-layout";

describe("epub layout", () => {
  it("keeps a readable inset between EPUB text and viewport edges", () => {
    expect(epubContentPadding.blockStartRem).toBeGreaterThanOrEqual(1.25);
    expect(epubContentPadding.inlineRem).toBeGreaterThanOrEqual(1.5);
    expect(epubContentPadding.blockEndRem).toBeGreaterThanOrEqual(1.5);
    expect(epubContentPadding.blockStartCss).toContain("clamp");
    expect(epubContentPadding.inlineCss).toContain("clamp");
    expect(epubContentPadding.blockEndCss).toContain("clamp");
    expect(epubContentPadding.css).toContain("clamp");
  });
});
