export type EpubContentPadding = {
  blockStartRem: number;
  inlineRem: number;
  blockEndRem: number;
  blockStartCss: string;
  inlineCss: string;
  blockEndCss: string;
  css: string;
};

export const epubContentPadding: EpubContentPadding = {
  blockStartRem: 1.25,
  inlineRem: 1.5,
  blockEndRem: 1.5,
  blockStartCss: "clamp(1.25rem, 3vw, 2rem)",
  inlineCss: "clamp(1.5rem, 4vw, 2.5rem)",
  blockEndCss: "clamp(1.5rem, 3vw, 2.2rem)",
  css: "clamp(1.25rem, 3vw, 2rem) clamp(1.5rem, 4vw, 2.5rem) clamp(1.5rem, 3vw, 2.2rem)"
};
