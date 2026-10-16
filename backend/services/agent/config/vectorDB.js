import { ChromaClient } from "chromadb";
import dotenv from "dotenv";
import { embeddings } from "./embeddings.js";

dotenv.config();

const client = new ChromaClient({
  path: process.env.CHROMA_URL,
});

const stores = new Map();

class VectorStore {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.collection = null;
    this.initPromise = this.initializeStore();
  }

  async initializeStore() {
    this.collection = await client.getOrCreateCollection({
      name: this.collectionName,
      metadata: {
        description: "NoBound AI PDF embeddings",
        "hnsw:space": "cosine",
      },
      embeddingFunction: null,
    });

    console.log(
      `Collection: ${this.collectionName}, documents: ${await this.collection.count()}`,
    );
  }

  async count() {
    await this.initPromise;
    return this.collection.count();
  }

  async addDocuments(documents) {
    await this.initPromise;

    if (!documents.length) return;

    // Keep embedding memory usage low.
    const batchSize = 1;

    for (let start = 0; start < documents.length; start += batchSize) {
      const batch = documents.slice(start, start + batchSize);

      const texts = batch.map((doc) => doc.pageContent);

      // Generate embeddings only for this batch.
      const vectors = await embeddings.embedDocuments(texts);

      const ids = batch.map((_, i) => `${this.collectionName}-${start + i}`);

      const metadatas = batch.map((doc, i) => {
        const metadata = {};

        for (const [key, value] of Object.entries(doc.metadata || {})) {
          if (["string", "number", "boolean"].includes(typeof value)) {
            metadata[key] = value;
          }
        }

        metadata.doc_index = start + i;
        metadata.content_length = doc.pageContent.length;

        return metadata;
      });

      // Upsert makes retries safe if a previous batch succeeded.
      await this.collection.upsert({
        ids,
        documents: texts,
        embeddings: vectors,
        metadatas,
      });

      console.log(
        `Embedded ${Math.min(start + batch.length, documents.length)}/${documents.length} chunks`,
      );
    }

    console.log(`Successfully indexed ${documents.length} chunks.`);
  }

  async search(query, topK = 5) {
    await this.initPromise;

    const count = await this.collection.count();

    if (count === 0) return [];

    const queryVector = await embeddings.embedQuery(query);

    const results = await this.collection.query({
      queryEmbeddings: [queryVector],
      nResults: Math.min(topK, count),
      include: ["documents", "metadatas", "distances"],
    });

    return (results.documents[0] || []).map((pageContent, i) => ({
      pageContent,
      metadata: results.metadatas[0][i],
      distance: results.distances[0][i],
    }));
  }
}

export function getVectorStore(collectionName) {
  if (!stores.has(collectionName)) {
    stores.set(collectionName, new VectorStore(collectionName));
  }

  return stores.get(collectionName);
}
