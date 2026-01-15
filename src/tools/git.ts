import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Read the current git diff from a repository
 */
export function readGitDiff(repoPath: string): string {
  try {
    const diff = execSync("git diff HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    
    if (!diff.trim()) {
      throw new Error("No git diff found. Ensure there are staged or unstaged changes.");
    }
    
    return diff;
  } catch (error) {
    throw new Error(`Failed to read git diff: ${error}`);
  }
}

/**
 * Parse diff to extract list of files that were modified
 */
export function extractFilesFromDiff(diff: string): string[] {
  const files = new Set<string>();
  const lines = diff.split("\n");
  
  for (const line of lines) {
    // Match "diff --git a/path/to/file b/path/to/file"
    if (line.startsWith("diff --git")) {
      const match = line.match(/diff --git a\/(.+) b\/.+/);
      if (match) {
        files.add(match[1]);
      }
    }
    // Also match "+++ b/path/to/file"
    else if (line.startsWith("+++") && !line.includes("/dev/null")) {
      const match = line.match(/\+\+\+ b\/(.+)/);
      if (match) {
        files.add(match[1]);
      }
    }
  }
  
  return Array.from(files);
}

/**
 * Load full content of a file from the repository
 */
export function loadFileContent(repoPath: string, filePath: string): string {
  const fullPath = path.join(repoPath, filePath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  return fs.readFileSync(fullPath, "utf-8");
}

/**
 * Load full contents of multiple files
 */
export function loadMultipleFiles(
  repoPath: string,
  files: string[]
): Record<string, string> {
  const contents: Record<string, string> = {};
  
  for (const file of files) {
    try {
      contents[file] = loadFileContent(repoPath, file);
    } catch (error) {
      console.warn(`Warning: Could not load file ${file}: ${error}`);
    }
  }
  
  return contents;
}
