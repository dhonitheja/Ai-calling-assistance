import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index(process.env.PINECONE_INDEX!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function embed(text: string) {
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
  const vector = await embed(text);
  const result = await index.query({
    vector,
    topK,
    includeMetadata: true,
  });
  return result.matches.map(m => m.metadata?.text as string);
}
