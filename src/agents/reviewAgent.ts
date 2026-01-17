import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentStateType, ReviewFinding } from "../state/agentState.js";
import { retrieveRelevantContext } from "../memory/retrieve.js";

const llm = new ChatGoogleGenerativeAI({
  modelName: "gemini-1.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0.1,
});

/**
 * Review agent: analyzes diff and full file contents to find issues
 */
export async function reviewAgent(state: AgentStateType): Promise<Partial<AgentStateType>> {
  console.log(`\n🔍 Review Agent (Attempt ${state.attempt}/${state.maxAttempts})`);
  
  // Retrieve relevant memories
  const memoryQuery = `Code review for files: ${state.filesTouched.join(", ")}`;
  const memories = await retrieveRelevantContext(state.filesTouched, memoryQuery);
  
  // Build context for review
  const fileContexts = Object.entries(state.fullFileContents)
    .map(([file, content]) => {
      return `=== FILE: ${file} ===\n${content}\n`;
    })
    .join("\n");
  
  const memoryContext = memories.length > 0
    ? `\n=== RELEVANT PAST LEARNINGS ===\n${memories.join("\n\n")}\n`
    : "";
  
  const retryContext = state.testResult && !state.testResult.passed
    ? `\n=== PREVIOUS TEST FAILURE ===\n${state.testResult.output}\n\nThe previous fix failed tests. Consider this when reviewing.\n`
    : "";
  
  const prompt = `You are a senior code reviewer. Analyze the following PR diff and provide concrete, actionable issues.

${memoryContext}${retryContext}
=== GIT DIFF ===
${state.diff}

${fileContexts}

Review the changes and identify specific issues. Focus on:
- Bugs and logic errors
- Security vulnerabilities
- Performance problems
- Code style violations
- Missing error handling
- Breaking changes

OUTPUT FORMAT (STRICT JSON ARRAY ONLY, NO MARKDOWN):
[
  {
    "file": "exact/file/path.ts",
    "severity": "low" | "medium" | "high",
    "issue": "specific problem description",
    "suggestion": "concrete fix suggestion"
  }
]

If no issues found, return empty array: []

IMPORTANT: Return ONLY the JSON array, no markdown code blocks, no explanations.`;

  try {
    const response = await llm.invoke(prompt);
    let content = response.content as string;
    
    // Clean up response - remove markdown code blocks if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    // Parse JSON
    const findings: ReviewFinding[] = JSON.parse(content);
    
    console.log(`✓ Found ${findings.length} issue(s)`);
    findings.forEach((f, i) => {
      console.log(`  ${i + 1}. [${f.severity}] ${f.file}: ${f.issue}`);
    });
    
    return {
      reviewFindings: findings,
      retrievedMemory: memories,
    };
  } catch (error) {
    console.error("Review agent error:", error);
    throw new Error(`Review agent failed: ${error}`);
  }
}
