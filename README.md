# Preflight

Autonomous PR review and fix agent powered by LangGraph, Gemini, and Pinecone.

## What It Does

Takes a local git repository, reviews the current diff, identifies issues, generates fixes, applies them, runs tests, and learns from successful outcomes.

**One run = one outcome. No chat. No user interaction.**

## Architecture

```
Initialize → Review → Fix → Apply → Test → Decide
                                      ↓
                                  Success → Store to Memory → END
                                      ↓
                                  Failed & Retries < 3 → Retry Review
                                      ↓
                                  Failed & No Retries → END
```

### Tech Stack

- **LangGraph**: StateGraph API for agent orchestration
- **Gemini 1.5 Flash**: Code review and fix generation
- **Gemini text-embedding-004**: Semantic embeddings
- **Pinecone**: Long-term vector memory
- **TypeScript + Node.js**

## Setup

```bash
npm install
```

Create `.env`:

```bash
GOOGLE_API_KEY=your_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=preflight-memory
```

**Pinecone Index Requirements:**
- Dimensions: 768
- Metric: cosine

## Usage

```bash
npm start /path/to/your/repo
```

The agent will:
1. Read git diff
2. Load full file contents
3. Review changes with AI + memory
4. Generate unified diff patch
5. Apply patch via `git apply`
6. Run `npm test`
7. Retry up to 3 times on failure
8. Store learnings on success

## Features

- **Explicit State Machine**: Single state object flows through all nodes
- **Transparent Retries**: Up to 3 attempts with visible counter
- **Tool-Grounded**: Real git operations, file I/O, test execution
- **Long-Term Memory**: Stores successful fixes in Pinecone, retrieves relevant context during review
- **Test-Gated Success**: Memory only written if tests pass

## Project Structure

```
src/
├── graph/prAgentGraph.ts      # LangGraph StateGraph definition
├── state/agentState.ts        # Agent state schema
├── agents/
│   ├── reviewAgent.ts         # Identifies issues in PR
│   └── fixAgent.ts            # Generates patches
├── tools/
│   ├── git.ts                 # Git diff & file operations
│   ├── applyPatch.ts          # Patch application
│   └── testRunner.ts          # Test execution
└── memory/
    ├── store.ts               # Pinecone write ops
    └── retrieve.ts            # Pinecone read ops
```

## License

MIT
