import { pipeline } from "@huggingface/transformers";

class EmbeddingManager {
  constructor() {
    this.model = null;
    this.modelName = "Xenova/all-MiniLM-L6-v2";
    this.loadPromise = this.loadModel();
  }

  async loadModel() {
    try {
      console.log(`Loading embedding model: ${this.modelName}`);

      this.model = await pipeline(
        "feature-extraction",
        this.modelName
      );

      console.log(
        `Embedding model loaded successfully: ${this.modelName}`
      );
    } catch (error) {
      console.error("Error loading embedding model:", error);
      throw error;
    }
  }

  async embedDocuments(texts) {
    await this.loadPromise;

    if (!texts.length) return [];

    const output = await this.model(texts, {
      pooling: "mean",
      normalize: true,
    });

    return output.tolist();
  }

  async embedQuery(text) {
    const [embedding] = await this.embedDocuments([text]);
    return embedding;
  }
}

export const embeddings = new EmbeddingManager();
