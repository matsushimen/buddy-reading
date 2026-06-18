export type EpubPaginationSample = {
  page?: number;
  total?: number;
  revision: number;
};

export type EpubPaginationSnapshot = {
  page?: number;
  total?: number;
  revision: number;
};

export type EpubDisplayedPageSource = {
  displayed?: {
    page?: number;
    total?: number;
  };
};

export type EpubSectionPageCount = {
  sectionIndex: number;
  pageCount: number;
};

export type EpubGlobalPageInput = {
  sectionIndex?: number;
  displayedPage: {
    page?: number;
    total?: number;
  };
  sectionPageCounts: EpubSectionPageCount[];
  expectedSectionIndexes: number[];
};

export type EpubStartTargetInput = {
  initialCfi?: string;
  spineHrefs: string[];
  tocHrefs: string[];
  firstLinearHref?: string;
};

export function stabilizeEpubPagination(
  current: EpubPaginationSample,
  previous: EpubPaginationSnapshot | null
): EpubPaginationSnapshot {
  if (!previous || previous.revision !== current.revision) {
    return { ...current };
  }

  if (typeof previous.total === "number" && previous.total > 0) {
    if (typeof current.total !== "number" || current.total <= 0) {
      return { ...current, total: previous.total };
    }

    if (previous.total !== current.total) {
      return { ...current, total: previous.total };
    }
  }

  return { ...current };
}

export function formatEpubPageLabel(page?: number, total?: number): string {
  if (typeof page === "number" && typeof total === "number" && page > 0 && total > 0) {
    return `P.${page} / ${total}`;
  }

  return "";
}

export function readEpubDisplayedPage(source?: EpubDisplayedPageSource): { page?: number; total?: number } {
  const page = source?.displayed?.page;
  const total = source?.displayed?.total;

  return {
    page: isPositiveInteger(page) ? page : undefined,
    total: isPositiveInteger(total) ? total : undefined
  };
}

export function resolveEpubGlobalPage(input: EpubGlobalPageInput): { page?: number; total?: number } {
  const pageCountsBySection = new Map<number, number>();
  for (const count of input.sectionPageCounts) {
    if (isPositiveInteger(count.sectionIndex) || count.sectionIndex === 0) {
      if (isPositiveInteger(count.pageCount)) {
        pageCountsBySection.set(count.sectionIndex, count.pageCount);
      }
    }
  }

  if (!isEpubGlobalPaginationReady(input.sectionPageCounts, input.expectedSectionIndexes)) {
    return input.displayedPage;
  }

  if (typeof input.sectionIndex !== "number" || !Number.isInteger(input.sectionIndex)) {
    return input.displayedPage;
  }

  const currentSectionPageCount = pageCountsBySection.get(input.sectionIndex);
  if (!isPositiveInteger(currentSectionPageCount) || !isPositiveInteger(input.displayedPage.page)) {
    return input.displayedPage;
  }

  let pageOffset = 0;
  let total = 0;
  let foundCurrentSection = false;
  for (const expectedSectionIndex of input.expectedSectionIndexes) {
    const pageCount = pageCountsBySection.get(expectedSectionIndex);
    if (!isPositiveInteger(pageCount)) {
      return input.displayedPage;
    }

    if (expectedSectionIndex === input.sectionIndex) {
      foundCurrentSection = true;
    } else if (!foundCurrentSection) {
      pageOffset += pageCount;
    }
    total += pageCount;
  }

  if (!foundCurrentSection) {
    return input.displayedPage;
  }

  return {
    page: pageOffset + Math.min(input.displayedPage.page, currentSectionPageCount),
    total
  };
}

export function isEpubGlobalPaginationReady(sectionPageCounts: EpubSectionPageCount[], expectedSectionIndexes: number[]): boolean {
  const pageCountsBySection = new Map<number, number>();
  for (const count of sectionPageCounts) {
    if ((isPositiveInteger(count.sectionIndex) || count.sectionIndex === 0) && isPositiveInteger(count.pageCount)) {
      pageCountsBySection.set(count.sectionIndex, count.pageCount);
    }
  }

  return isCompleteGlobalPagination(pageCountsBySection, expectedSectionIndexes);
}

export function resolveEpubStartTarget(input: EpubStartTargetInput): string | undefined {
  if (input.initialCfi && input.initialCfi.trim().length > 0) {
    return input.initialCfi;
  }

  const spineHref = input.spineHrefs.find(isResolvableSpineHref);
  const tocHref = input.tocHrefs.find(isResolvableSpineHref);
  const firstLinearHref = isResolvableSpineHref(input.firstLinearHref) ? input.firstLinearHref : undefined;

  return spineHref ?? tocHref ?? firstLinearHref;
}

function isCompleteGlobalPagination(pageCountsBySection: Map<number, number>, expectedSectionIndexes: number[]): boolean {
  if (expectedSectionIndexes.length === 0) {
    return false;
  }

  return expectedSectionIndexes.every((sectionIndex) => pageCountsBySection.has(sectionIndex));
}

function isPositiveInteger(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isResolvableSpineHref(value: string | undefined): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }

  return !trimmed.includes("blob:");
}
