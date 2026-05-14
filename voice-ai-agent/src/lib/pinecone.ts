import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function clients() {
  const pc = new Pinecone({ apiKey: requireEnv("PINECONE_API_KEY") });
  const index = pc.index(requireEnv("PINECONE_INDEX"));
  const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  return { index, openai };
}

async function embed(text: string) {
  const { openai } = clients();
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    dimensions: 1024,
    input: text,
  });
  return res.data[0].embedding;
}

export async function upsertChunks(
  chunks: string[],
  metadata: Record<string, string>
) {
  const { index } = clients();
  const vectors = await Promise.all(
    chunks.map(async (text, i) => ({
      id: `${metadata.source}-${i}-${Date.now()}`,
      values: await embed(text),
      metadata: { ...metadata, text },
    }))
  );
  await index.upsert({ records: vectors });
  return vectors.length;
}

export async function querySimilar(text: string, topK = 4) {
  const { index } = clients();
  const vector = await embed(text);
  const result = await index.query({
    vector,
    topK,
    includeMetadata: true,
  });
  return result.matches.map(m => m.metadata?.text as string);
}
