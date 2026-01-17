import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentStateType } from "../state/agentState.js";

const llm = new ChatGoogleGenerativeAI({
  modelName: "gemini-1.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0.2,
});

/**
 * Fix agent: generates a unified diff patch to address review findings
 */
export async function fixAgent(state: AgentStateType): Promise<Partial<AgentStateType>> {
  console.log(`\n🔧 Fix Agent (Attempt ${state.attempt}/${state.maxAttempts})`);
  
  if (state.reviewFindings.length === 0) {
    console.log("✓ No issues to fix");
    return { patch: null };
  }
  
  // Build file contexts for files mentioned in findings
  const relevantFiles = new Set(state.reviewFindings.map(f => f.file));
  const fileContexts = Array.from(relevantFiles)
    .map(file => {
      const content = state.fullFileContents[file] || "";
      return `=== FILE: ${file} ===\n${content}\n`;
    })
    .join("\n");
  
  const findingsText = state.reviewFindings
    .map((f, i) => `${i + 1}. [${f.severity}] ${f.file}\n   Issue: ${f.issue}\n   Suggestion: ${f.suggestion}`)
    .join("\n\n");
  
  const memoryContext = state.retrievedMemory && state.retrievedMemory.length > 0
    ? `\n=== CODING CONVENTIONS TO FOLLOW ===\n${state.retrievedMemory.join("\n\n")}\n`
    : "";
  
  const testFailureContext = state.testResult && !state.testResult.passed
    ? `\n=== TEST FAILURE FROM PREVIOUS ATTEMPT ===\n${state.testResult.output}\n\nYour previous fix caused test failures. Adjust your approach.\n`
    : "";
  
  const prompt = `You are a senior software engineer. Generate a unified diff patch to fix the following issues.

${memoryContext}${testFailureContext}
=== ISSUES TO FIX ===
${findingsText}

${fileContexts}

Generate a unified diff patch that fixes ALL issues listed above. The patch must:
1. Be a valid unified diff format (like git diff output)
2. Only modify files listed in the issues
3. Include proper diff headers: --- a/file.ts and +++ b/file.ts
4. Include @@ line numbers
5. Show context lines around changes

OUTPUT FORMAT (STRICT - NO MARKDOWN, NO EXPLANATIONS):
Output ONLY the unified diff. Start with "diff --git" or "---" lines.

Example format:
--- a/src/example.ts
+++ b/src/example.ts
@@ -10,7 +10,7 @@
 function example() {
-  const x = 1;
+  const x = 2;
   return x;
 }

Generate the patch now:`;

  try {
    const response = await llm.invoke(prompt);
    let patch = response.content as string;
    
    // Clean up response - remove markdown code blocks if present
    patch = patch.replace(/```diff\n?/g, "").replace(/```\n?/g, "").trim();
    
    // Validate it looks like a diff
    if (!patch.includes("---") || !patch.includes("+++")) {
      throw new Error("Generated patch is not in valid unified diff format");
    }
    
    console.log(`✓ Generated patch (${patch.split("\n").length} lines)`);
    
    return { patch };
  } catch (error) {
    console.error("Fix agent error:", error);
    throw new Error(`Fix agent failed: ${error}`);
  }
}
