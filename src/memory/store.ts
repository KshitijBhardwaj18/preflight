import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const embeddings = new GoogleGenerativeAIEmbeddings({
  modelName: "text-embedding-004",
  apiKey: process.env.GOOGLE_API_KEY,
});

let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
}

export interface MemoryEntry {
  type: "repo_summary" | "coding_convention" | "successful_fix";
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Store a memory entry in Pinecone
 */
export async function storeMemory(entry: MemoryEntry): Promise<void> {
  const pc = getPineconeClient();
  const indexName = process.env.PINECONE_INDEX || "preflight-memory";
  
  try {
    const index = pc.index(indexName);
    
    // Generate embedding
    const embedding = await embeddings.embedQuery(entry.content);
    
    // Create unique ID based on timestamp and type
    const id = `${entry.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store in Pinecone
    await index.upsert([
      {
        id,
        values: embedding,
        metadata: {
          type: entry.type,
          content: entry.content,
          timestamp: new Date().toISOString(),
          ...entry.metadata,
        },
      },
    ]);
    
    console.log(`✓ Stored memory: ${entry.type}`);
  } catch (error) {
    console.warn(`Warning: Failed to store memory: ${error}`);
  }
}

/**
 * Store multiple successful fix learnings
 */
export async function storeSuccessfulFix(
  repoPath: string,
  findings: Array<{ file: string; issue: string; suggestion: string }>,
  patch: string
): Promise<void> {
  // Extract repo name from path
  const repoName = repoPath.split("/").pop() || "unknown";
  
  // Store each finding as a learning
  for (const finding of findings) {
    const content = `In ${repoName}, fixed issue in ${finding.file}: ${finding.issue}. Solution: ${finding.suggestion}`;
    
    await storeMemory({
      type: "successful_fix",
      content,
      metadata: {
        repo: repoName,
        file: finding.file,
      },
    });
  }
}

/**
 * Store coding conventions discovered from a codebase
 */
export async function storeCodingConvention(
  repoPath: string,
  convention: string
): Promise<void> {
  const repoName = repoPath.split("/").pop() || "unknown";
  
  await storeMemory({
    type: "coding_convention",
    content: `In ${repoName}: ${convention}`,
    metadata: {
      repo: repoName,
    },
  });
}
