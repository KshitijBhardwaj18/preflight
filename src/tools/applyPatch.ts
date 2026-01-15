import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Apply a unified diff patch using git apply
 */
export function applyPatch(repoPath: string, patch: string): void {
  const tempPatchFile = path.join(repoPath, ".preflight-patch.tmp");
  
  try {
    // Write patch to temporary file
    fs.writeFileSync(tempPatchFile, patch, "utf-8");
    
    // Apply using git apply
    execSync(`git apply "${tempPatchFile}"`, {
      cwd: repoPath,
      encoding: "utf-8",
    });
    
    console.log("✓ Patch applied successfully");
  } catch (error) {
    throw new Error(`Failed to apply patch: ${error}`);
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempPatchFile)) {
      fs.unlinkSync(tempPatchFile);
    }
  }
}
