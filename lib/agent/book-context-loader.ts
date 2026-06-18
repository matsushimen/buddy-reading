import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const bookIdPattern = /^[a-zA-Z0-9_-]+$/;
const bookContextRootDirectory = path.join(process.cwd(), "memory", "books");
const bookContextTemplatePath = path.join(process.cwd(), "server_templates", "BOOK_CONTEXT.md");

export type LoadedBookContext = {
  content: string;
  version: string;
  exists: boolean;
};

export async function loadBookContext(bookId: string): Promise<LoadedBookContext> {
  if (!bookIdPattern.test(bookId)) {
    throw new Error("Invalid bookId");
  }

  const bookContextPath = path.join(bookContextRootDirectory, bookId, "BOOK_CONTEXT.md");
  const relativePath = path.relative(bookContextRootDirectory, bookContextPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid book context path");
  }

  try {
    const content = await readFile(bookContextPath, "utf8");
    return {
      content,
      version: await sha256(content),
      exists: true
    };
  } catch {
    return {
      content: "",
      version: "none",
      exists: false
    };
  }
}

export async function saveBookContext(bookId: string, content: string): Promise<LoadedBookContext> {
  if (!bookIdPattern.test(bookId)) {
    throw new Error("Invalid bookId");
  }

  const bookContextPath = path.join(bookContextRootDirectory, bookId, "BOOK_CONTEXT.md");
  const relativePath = path.relative(bookContextRootDirectory, bookContextPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid book context path");
  }

  await mkdir(path.dirname(bookContextPath), { recursive: true });
  await writeFile(bookContextPath, content, "utf8");

  return {
    content,
    version: await sha256(content),
    exists: true
  };
}

export async function loadBookContextTemplate(): Promise<string> {
  try {
    return await readFile(bookContextTemplatePath, "utf8");
  } catch {
    return "# BOOK_CONTEXT.md\n\n- Title:\n- Author:\n- Format:\n\n## Structure\n\n- Unknown until parsed.\n\n## Recurring Concepts\n\n- None yet.\n\n## Previously Explained Terms\n\n- None yet.\n\n## Reader Notes\n\n- None yet.\n\n## Agent Notes\n\nUse this context only to improve local passage explanations. Do not treat it as a complete representation of the book.\n";
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
