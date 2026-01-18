import { StateGraph, END } from "@langchain/langgraph";
import { AgentState, AgentStateType } from "../state/agentState.js";
import { reviewAgent } from "../agents/reviewAgent.js";
import { fixAgent } from "../agents/fixAgent.js";
import { readGitDiff, extractFilesFromDiff, loadMultipleFiles } from "../tools/git.js";
import { applyPatch } from "../tools/applyPatch.js";
import { runTests } from "../tools/testRunner.js";
import { storeSuccessfulFix } from "../memory/store.js";

/**
 * Initialize node: Load git diff and file contents
 */
async function initializeNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  console.log("\n📂 Initializing PR Agent");
  console.log(`Repository: ${state.repoPath}`);
  
  // Read git diff
  const diff = readGitDiff(state.repoPath);
  console.log(`✓ Read git diff (${diff.split("\n").length} lines)`);
  
  // Extract files touched by diff
  const filesTouched = extractFilesFromDiff(diff);
  console.log(`✓ Files touched: ${filesTouched.join(", ")}`);
  
  // Load full content of each file
  const fullFileContents = loadMultipleFiles(state.repoPath, filesTouched);
  console.log(`✓ Loaded ${Object.keys(fullFileContents).length} file(s)`);
  
  return {
    diff,
    filesTouched,
    fullFileContents,
    attempt: 1,
    reviewFindings: [],
    retrievedMemory: [],
    patch: null,
    testResult: null,
    success: false,
    error: null,
  };
}

/**
 * Review node: Run review agent
 */
async function reviewNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  return await reviewAgent(state);
}

/**
 * Fix node: Run fix agent
 */
async function fixNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  return await fixAgent(state);
}

/**
 * Apply patch node: Apply the generated patch to the repository
 */
async function applyPatchNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  console.log("\n📝 Applying patch");
  
  if (!state.patch) {
    console.log("✓ No patch to apply");
    return {};
  }
  
  try {
    applyPatch(state.repoPath, state.patch);
    return {};
  } catch (error) {
    console.error("Failed to apply patch:", error);
    return {
      error: `Failed to apply patch: ${error}`,
    };
  }
}

/**
 * Test node: Run tests
 */
async function testNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  console.log("\n🧪 Running tests");
  
  const testResult = runTests(state.repoPath);
  
  if (testResult.passed) {
    console.log("✓ Tests passed");
  } else {
    console.log("✗ Tests failed");
    console.log(testResult.output.substring(0, 500));
  }
  
  return { testResult };
}

/**
 * Success node: Store learnings to memory
 */
async function successNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  console.log("\n✅ Success! Storing learnings to memory");
  
  try {
    await storeSuccessfulFix(
      state.repoPath,
      state.reviewFindings,
      state.patch || ""
    );
    console.log("✓ Learnings stored in Pinecone");
  } catch (error) {
    console.warn(`Warning: Failed to store memory: ${error}`);
  }
  
  return { success: true };
}

/**
 * Failure node: Log failure
 */
async function failureNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  console.log("\n❌ Failed after maximum retries");
  return {
    success: false,
    error: state.testResult?.output || "Unknown error",
  };
}

/**
 * Routing logic: Decide next step based on test results and retry count
 */
function decideNextStep(state: AgentStateType): string {
  // If there was an error applying patch, fail immediately
  if (state.error) {
    return "failure";
  }
  
  // If no patch was generated (no issues found), go to success
  if (!state.patch) {
    return "success";
  }
  
  // If tests passed, go to success
  if (state.testResult && state.testResult.passed) {
    return "success";
  }
  
  // If tests failed and we have retries left, retry review
  if (state.testResult && !state.testResult.passed && state.attempt < state.maxAttempts) {
    console.log(`\n⟳ Retrying (${state.attempt}/${state.maxAttempts})`);
    return "retry";
  }
  
  // Otherwise, we've exhausted retries
  return "failure";
}

/**
 * Retry node: Increment attempt counter for retry
 */
async function retryNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  return {
    attempt: state.attempt + 1,
  };
}

/**
 * Build the PR Agent StateGraph
 */
export function buildPRAgentGraph() {
  const workflow = new StateGraph(AgentState)
    // Add nodes
    .addNode("initialize", initializeNode)
    .addNode("review", reviewNode)
    .addNode("fix", fixNode)
    .addNode("apply_patch", applyPatchNode)
    .addNode("test", testNode)
    .addNode("retry", retryNode)
    .addNode("success", successNode)
    .addNode("failure", failureNode)
    
    // Define edges
    .addEdge("__start__", "initialize")
    .addEdge("initialize", "review")
    .addEdge("review", "fix")
    .addEdge("fix", "apply_patch")
    .addEdge("apply_patch", "test")
    
    // Conditional routing after test
    .addConditionalEdges("test", decideNextStep, {
      success: "success",
      failure: "failure",
      retry: "retry",
    })
    
    // Retry loops back to review
    .addEdge("retry", "review")
    
    // Terminal nodes
    .addEdge("success", END)
    .addEdge("failure", END);
  
  return workflow.compile();
}
