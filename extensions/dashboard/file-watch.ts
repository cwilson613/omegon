import * as path from "node:path";

export function shouldRefreshDesignTreeForPath(filePath: string, docsDir: string): boolean {
  const rel = path.relative(docsDir, filePath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return false;
  return rel.endsWith(".md");
}

export function shouldRefreshOpenSpecForPath(filePath: string, repoRoot: string): boolean {
  const openspecDir = path.join(repoRoot, "openspec");
  const rel = path.relative(openspecDir, filePath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return false;
  return rel.endsWith(".md");
}
