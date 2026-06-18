declare module "epubjs" {
export type RenditionLocation = {
    start?: {
      cfi?: string;
      percentage?: number;
      displayed?: {
        page?: number;
        total?: number;
      };
    };
  };

  export type RenditionView = {
    document?: Document;
  };

  export type Rendition = {
    display(target?: string): Promise<unknown>;
    next(): Promise<unknown>;
    prev(): Promise<unknown>;
    resize(width?: number | string, height?: number | string): void;
    destroy(): void;
    on(event: "rendered", callback: (section: unknown, view: RenditionView) => void): void;
    on(event: "relocated", callback: (location: RenditionLocation) => void): void;
    themes: {
      default(theme: object | string): void;
    };
  };

  export type Book = {
    opened: Promise<unknown>;
    ready: Promise<void>;
    locations: {
      generate(chars: number): Promise<string[]>;
      percentageFromCfi(cfi: string): number;
      length(): number;
    };
    open(input: ArrayBuffer, what?: "binary" | "base64" | "epub" | "opf" | "json" | "directory"): Promise<unknown>;
    renderTo(
      element: Element,
      options: {
        width: string | number;
        height: string | number;
        flow?: string;
        spread?: string;
        method?: "srcdoc" | "blobUrl" | "write";
        minSpreadWidth?: number;
        resizeOnOrientationChange?: boolean;
        overflow?: string;
      }
    ): Rendition;
    destroy(): void;
  };

  export default function ePub(data?: ArrayBuffer, options?: { replacements?: "blobUrl" | "base64" | "none"; openAs?: string }): Book;
}
