import { describe, expect, it } from "vitest";
import {
  formatEpubPageLabel,
  isEpubGlobalPaginationReady,
  readEpubDisplayedPage,
  resolveEpubGlobalPage,
  resolveEpubStartTarget,
  stabilizeEpubPagination
} from "../lib/epub-pagination";

describe("epub pagination", () => {
  it("keeps the total stable within the same pagination revision", () => {
    const previous = {
      page: 3,
      total: 40,
      revision: 1
    };

    const next = stabilizeEpubPagination(
      {
        page: 4,
        total: 419,
        revision: 1
      },
      previous
    );

    expect(next.page).toBe(4);
    expect(next.total).toBe(40);
  });

  it("accepts a new total after the pagination revision changes", () => {
    const previous = {
      page: 3,
      total: 40,
      revision: 1
    };

    const next = stabilizeEpubPagination(
      {
        page: 1,
        total: 52,
        revision: 2
      },
      previous
    );

    expect(next.page).toBe(1);
    expect(next.total).toBe(52);
  });

  it("formats page labels only when both page and total are present", () => {
    expect(formatEpubPageLabel(3, 40)).toBe("P.3 / 40");
    expect(formatEpubPageLabel(3, undefined)).toBe("");
    expect(formatEpubPageLabel(undefined, 40)).toBe("");
  });

  it("reads page labels from displayed pagination instead of generated locations", () => {
    const displayed = readEpubDisplayedPage({
      displayed: {
        page: 2,
        total: 6
      }
    });

    expect(displayed).toEqual({
      page: 2,
      total: 6
    });
  });

  it("ignores invalid displayed pagination samples", () => {
    expect(
      readEpubDisplayedPage({
        displayed: {
          page: 0,
          total: 6
        }
      })
    ).toEqual({
      page: undefined,
      total: 6
    });
  });

  it("restores a saved CFI before choosing a start section", () => {
    expect(
      resolveEpubStartTarget({
        initialCfi: "epubcfi(/6/10!/4/2)",
        spineHrefs: ["cover.xhtml"],
        tocHrefs: ["toc-cover.xhtml"],
        firstLinearHref: "chapter-1.xhtml"
      })
    ).toBe("epubcfi(/6/10!/4/2)");
  });

  it("starts at the first spine item so non-linear covers are readable", () => {
    expect(
      resolveEpubStartTarget({
        spineHrefs: ["cover.xhtml", "titlepage.xhtml"],
        tocHrefs: ["chapter-1.xhtml"],
        firstLinearHref: "titlepage.xhtml"
      })
    ).toBe("cover.xhtml");
  });

  it("skips blob-based spine hrefs when choosing the initial EPUB target", () => {
    expect(
      resolveEpubStartTarget({
        spineHrefs: ["blob:http://127.0.0.1:3000/abc", "cover.xhtml"],
        tocHrefs: ["chapter-1.xhtml"],
        firstLinearHref: "cover.xhtml"
      })
    ).toBe("cover.xhtml");
  });

  it("resolves a book-wide EPUB page from section page counts", () => {
    expect(
      resolveEpubGlobalPage({
        sectionIndex: 2,
        displayedPage: { page: 4, total: 12 },
        sectionPageCounts: [
          { sectionIndex: 0, pageCount: 1 },
          { sectionIndex: 1, pageCount: 5 },
          { sectionIndex: 2, pageCount: 12 }
        ],
        expectedSectionIndexes: [0, 1, 2]
      })
    ).toEqual({ page: 10, total: 18 });
  });

  it("keeps section pagination until every spine section has a measured page count", () => {
    expect(
      resolveEpubGlobalPage({
        sectionIndex: 1,
        displayedPage: { page: 2, total: 5 },
        sectionPageCounts: [{ sectionIndex: 0, pageCount: 1 }],
        expectedSectionIndexes: [0, 1]
      })
    ).toEqual({ page: 2, total: 5 });
  });

  it("reports book-wide EPUB pagination as ready only after every spine section is measured", () => {
    expect(
      isEpubGlobalPaginationReady(
        [
          { sectionIndex: 0, pageCount: 1 },
          { sectionIndex: 1, pageCount: 5 }
        ],
        [0, 1]
      )
    ).toBe(true);

    expect(isEpubGlobalPaginationReady([{ sectionIndex: 0, pageCount: 1 }], [0, 1])).toBe(false);
  });

  it("uses the declared spine order when resolving global EPUB pages", () => {
    expect(
      resolveEpubGlobalPage({
        sectionIndex: 4,
        displayedPage: { page: 3, total: 7 },
        sectionPageCounts: [
          { sectionIndex: 4, pageCount: 7 },
          { sectionIndex: 2, pageCount: 5 }
        ],
        expectedSectionIndexes: [4, 2]
      })
    ).toEqual({ page: 3, total: 12 });
  });
});
