import { Annotation } from "@langchain/langgraph";

export interface ReviewFinding {
  file: string;
  severity: "low" | "medium" | "high";
  issue: string;
  suggestion: string;
}

export interface TestResult {
  passed: boolean;
  output: string;
}

// Define the agent state using LangGraph Annotation
export const AgentState = Annotation.Root({
  // Input
  repoPath: Annotation<string>,
  
  // Git data
  diff: Annotation<string>,
  filesTouched: Annotation<string[]>,
  fullFileContents: Annotation<Record<string, string>>,
  
  // Review outputs
  reviewFindings: Annotation<ReviewFinding[]>,
  retrievedMemory: Annotation<string[]>,
  
  // Fix outputs
  patch: Annotation<string | null>,
  
  // Test results
  testResult: Annotation<TestResult | null>,
  
  // Retry logic
  attempt: Annotation<number>,
  maxAttempts: Annotation<number>,
  
  // Final status
  success: Annotation<boolean>,
  error: Annotation<string | null>,
});

export type AgentStateType = typeof AgentState.State;
