import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const userIdPattern = /^[a-zA-Z0-9_-]+$/;
const memoryRootDirectory = path.join(process.cwd(), "memory", "users");
const memoryTemplatePath = path.join(process.cwd(), "server_templates", "MEMORY.md");

export type LoadedMemory = {
  content: string;
  version: string;
  exists: boolean;
};

export async function loadUserMemory(userId: string): Promise<LoadedMemory> {
  if (!userIdPattern.test(userId)) {
    throw new Error("Invalid userId");
  }

  const memoryPath = path.join(memoryRootDirectory, userId, "MEMORY.md");
  const relativePath = path.relative(memoryRootDirectory, memoryPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid memory path");
  }

  try {
    const content = await readFile(memoryPath, "utf8");
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

export async function saveUserMemory(userId: string, content: string): Promise<LoadedMemory> {
  if (!userIdPattern.test(userId)) {
    throw new Error("Invalid userId");
  }

  const memoryPath = path.join(memoryRootDirectory, userId, "MEMORY.md");
  const relativePath = path.relative(memoryRootDirectory, memoryPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid memory path");
  }

  await mkdir(path.dirname(memoryPath), { recursive: true });
  await writeFile(memoryPath, content, "utf8");

  return {
    content,
    version: await sha256(content),
    exists: true
  };
}

export async function loadMemoryTemplate(): Promise<string> {
  try {
    return await readFile(memoryTemplatePath, "utf8");
  } catch {
    return "# MEMORY.md\n\n- Preferred annotation language: Japanese\n- Preferred explanation style: concise but technically precise\n- Preferred detail level: standard\n";
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
