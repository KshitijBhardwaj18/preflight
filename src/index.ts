#!/usr/bin/env node
import * as dotenv from "dotenv";
import { buildPRAgentGraph } from "./graph/prAgentGraph.js";
import { AgentStateType } from "./state/agentState.js";

// Load environment variables
dotenv.config();

/**
 * Main entry point for the PR Agent
 */
async function main() {
  // Validate environment variables
  if (!process.env.GOOGLE_API_KEY) {
    console.error("Error: GOOGLE_API_KEY environment variable is required");
    process.exit(1);
  }
  
  if (!process.env.PINECONE_API_KEY) {
    console.error("Error: PINECONE_API_KEY environment variable is required");
    process.exit(1);
  }
  
  // Get repository path from command line args
  const repoPath = process.argv[2];
  
  if (!repoPath) {
    console.error("Usage: npm start <repo-path>");
    console.error("Example: npm start /path/to/my/repo");
    process.exit(1);
  }
  
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         PREFLIGHT - Autonomous PR Review & Fix Agent        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  
  try {
    // Build the agent graph
    const graph = buildPRAgentGraph();
    
    // Initialize state
    const initialState: Partial<AgentStateType> = {
      repoPath,
      maxAttempts: 3,
    };
    
    // Run the agent
    const startTime = Date.now();
    const finalState = await graph.invoke(initialState);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Print summary
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║                         FINAL REPORT                         ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log(`Repository: ${finalState.repoPath}`);
    console.log(`Files reviewed: ${finalState.filesTouched?.length || 0}`);
    console.log(`Issues found: ${finalState.reviewFindings?.length || 0}`);
    console.log(`Attempts: ${finalState.attempt}/${finalState.maxAttempts}`);
    console.log(`Duration: ${duration}s`);
    console.log(`Status: ${finalState.success ? "✅ SUCCESS" : "❌ FAILED"}`);
    
    if (finalState.success) {
      console.log("\n✨ Changes applied and tests passed!");
      console.log("💾 Learnings stored in Pinecone for future use");
    } else {
      console.log("\n❌ Agent failed to fix issues");
      if (finalState.error) {
        console.log(`Error: ${finalState.error}`);
      }
    }
    
    process.exit(finalState.success ? 0 : 1);
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run main
main().catch(console.error);
