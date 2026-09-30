/* eslint-disable no-console */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import {
  generateEmbedding,
  generateEmbeddingsBatch,
  GEMINI_EMBEDDING_API_MODEL,
} from "../src/lib/features/projects/embedding.server";

async function smokeTest() {
  console.log(`Starting smoke test with model: ${GEMINI_EMBEDDING_API_MODEL}...`);

  // 1. Single test
  console.log("1. Testing single embedding...");
  const singleVector = await generateEmbedding(
    "Vikini knowledge retrieval smoke test single query"
  );
  if (singleVector.length !== 3072) {
    throw new Error(
      `Single embedding failed: expected 3072 dimensions, got ${singleVector.length}`
    );
  }
  console.log("✓ Single embedding OK: Exactly 3072 dimensions returned.");

  // 2. Batch test
  console.log("2. Testing batch embedding with multiple chunks...");
  const testChunks = [
    "First chunk text for Vikini batch test.",
    "Second chunk text for Vikini batch test with different content.",
    "Third chunk text verifying independent embeddings generation.",
  ];
  const batchVectors = await generateEmbeddingsBatch(testChunks);
  if (batchVectors.length !== testChunks.length) {
    throw new Error(
      `Batch embedding failed: expected ${testChunks.length} vectors, got ${batchVectors.length}`
    );
  }
  for (let i = 0; i < batchVectors.length; i++) {
    if (batchVectors[i].length !== 3072) {
      throw new Error(`Chunk ${i} failed: expected 3072 dimensions, got ${batchVectors[i].length}`);
    }
  }
  console.log(`✓ Batch embedding OK: Exactly ${batchVectors.length} vectors of 3072d returned.`);
  console.log("ALL SMOKE TESTS PASSED!");
  process.exit(0);
}

smokeTest().catch((err) => {
  console.error("SMOKE TEST ERROR:", err);
  process.exit(1);
});
