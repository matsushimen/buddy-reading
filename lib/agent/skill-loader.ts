import { readFile } from "node:fs/promises";
import path from "node:path";

const skillIdPattern = /^[a-zA-Z0-9_-]+$/;
const skillsDirectory = path.join(process.cwd(), "skills");

export async function loadSkill(skillId: string): Promise<string> {
  if (!skillIdPattern.test(skillId)) {
    throw new Error("Invalid skillId");
  }

  const skillPath = path.join(skillsDirectory, `${skillId}.md`);
  const relativePath = path.relative(skillsDirectory, skillPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid skill path");
  }

  try {
    return await readFile(skillPath, "utf8");
  } catch {
    if (skillId !== "default") {
      return loadSkill("default");
    }
    return "# Skill: Default\n\nReturn concise contextual annotations as structured JSON.";
  }
}
