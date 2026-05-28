import mongoose from "mongoose";
import { connectDB } from "../src/config/db";

const INDEX_NAME = "product_vector_index";

const definition = {
  fields: [
    {
      type: "vector",
      path: "productEmbedding",
      numDimensions: 1536, // text-embedding-3-small
      similarity: "cosine",
    },
    { type: "filter", path: "productStatus" },
    { type: "filter", path: "productCategory" },
    { type: "filter", path: "productPrice" },
  ],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  await connectDB();
  const collection = mongoose.connection.db!.collection("products");

  const existing = await collection.listSearchIndexes().toArray();
  if (existing.some((i: any) => i.name === INDEX_NAME)) {
    console.log(`Index "${INDEX_NAME}" already exists. Nothing to do.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`Creating vector search index "${INDEX_NAME}"...`);
  await collection.createSearchIndex({
    name: INDEX_NAME,
    type: "vectorSearch",
    definition,
  } as any);

  console.log("Waiting for index to become queryable (can take ~1-2 min on M0)...");
  for (let i = 0; i < 60; i++) {
    const list = await collection.listSearchIndexes().toArray();
    const idx: any = list.find((x: any) => x.name === INDEX_NAME);
    if (idx?.queryable) {
      console.log(`Index "${INDEX_NAME}" is READY and queryable.`);
      await mongoose.disconnect();
      process.exit(0);
    }
    process.stdout.write(`  status: ${idx?.status ?? "PENDING"}\r`);
    await sleep(3000);
  }

  console.log("\nIndex created but not queryable yet — check Atlas UI shortly.");
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => {
  console.error("Index creation failed:", e);
  process.exit(1);
});
