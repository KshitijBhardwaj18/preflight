import { execSync } from "child_process";
import { TestResult } from "../state/agentState.js";

/**
 * Run npm test and return structured results
 */
export function runTests(repoPath: string): TestResult {
  try {
    const output = execSync("npm test", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 60000, // 60 second timeout
    });
    
    return {
      passed: true,
      output: output,
    };
  } catch (error: any) {
    return {
      passed: false,
      output: error.stdout || error.stderr || error.message,
    };
  }
}
