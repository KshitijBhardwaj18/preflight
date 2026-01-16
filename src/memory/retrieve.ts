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

/**
 * Retrieve relevant memories from Pinecone based on query
 */
export async function retrieveMemory(
  query: string,
  topK: number = 3
): Promise<string[]> {
  const pc = getPineconeClient();
  const indexName = process.env.PINECONE_INDEX || "preflight-memory";
  
  try {
    const index = pc.index(indexName);
    
    // Generate query embedding
    const queryEmbedding = await embeddings.embedQuery(query);
    
    // Query Pinecone
    const results = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });
    
    // Extract content from metadata
    const memories: string[] = [];
    for (const match of results.matches) {
      if (match.metadata && match.metadata.content) {
        memories.push(match.metadata.content as string);
      }
    }
    
    return memories;
  } catch (error) {
    console.warn(`Warning: Failed to retrieve memory: ${error}`);
    return [];
  }
}

/**
 * Retrieve coding conventions and successful fixes relevant to current changes
 */
export async function retrieveRelevantContext(
  files: string[],
  issues: string
): Promise<string[]> {
  const query = `Reviewing changes in files: ${files.join(", ")}. Looking for: ${issues}`;
  return retrieveMemory(query, 3);
}
