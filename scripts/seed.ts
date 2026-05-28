import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { ProductInput } from "../src/libs/types/product";
import ProductModel from "../src/schemas/product.schema";
import ProductService from "../src/services/product.service";

const productService = new ProductService();

const SAMPLE_PRODUCTS: ProductInput[] = [
  {
    productName: "Stratus Lightweight Rain Jacket",
    productDescription:
      "Ultra-light packable shell with a waterproof breathable membrane and taped seams. Folds into its own pocket — ideal for rainy commutes and travel.",
    productCategory: "jacket",
    productTags: ["lightweight", "waterproof", "packable", "rain"],
    productPrice: 69,
    productStock: 40,
  },
  {
    productName: "Trailhead Insulated Parka",
    productDescription:
      "Heavyweight down parka rated to -20C with a fur-lined hood. Built for harsh winter conditions, not packability.",
    productCategory: "jacket",
    productTags: ["winter", "insulated", "down", "warm"],
    productPrice: 220,
    productStock: 15,
  },
  {
    productName: "Drizzle Windbreaker",
    productDescription:
      "Minimalist water-resistant windbreaker for spring showers. Lightweight nylon, elastic cuffs, under budget.",
    productCategory: "jacket",
    productTags: ["lightweight", "water-resistant", "windbreaker"],
    productPrice: 45,
    productStock: 60,
  },
  {
    productName: "Cloudpath Running Shoes",
    productDescription:
      "Responsive everyday running shoes with breathable mesh upper and cushioned midsole for road running.",
    productCategory: "shoes",
    productTags: ["running", "breathable", "cushioned"],
    productPrice: 110,
    productStock: 80,
  },
  {
    productName: "Summit 30L Hiking Backpack",
    productDescription:
      "Lightweight 30-liter daypack with hydration sleeve, rain cover, and ventilated back panel for day hikes.",
    productCategory: "backpack",
    productTags: ["hiking", "lightweight", "daypack", "water-resistant"],
    productPrice: 85,
    productStock: 50,
  },
  {
    productName: "Nomad Travel Backpack 40L",
    productDescription:
      "Carry-on sized 40L travel pack with laptop compartment, lockable zippers, and a clamshell opening.",
    productCategory: "backpack",
    productTags: ["travel", "laptop", "carry-on"],
    productPrice: 130,
    productStock: 35,
  },
  {
    productName: "Pulse Wireless Headphones",
    productDescription:
      "Over-ear active noise cancelling headphones with 30-hour battery life and plush memory-foam earcups.",
    productCategory: "headphones",
    productTags: ["wireless", "noise-cancelling", "over-ear"],
    productPrice: 150,
    productStock: 70,
  },
  {
    productName: "Horizon Polarized Sunglasses",
    productDescription:
      "UV400 polarized sunglasses with a lightweight frame and anti-glare coating for bright outdoor conditions.",
    productCategory: "sunglasses",
    productTags: ["polarized", "lightweight", "uv-protection"],
    productPrice: 55,
    productStock: 90,
  },
];

const run = async () => {
  await connectDB();
  console.log("Clearing existing products...");
  await ProductModel.deleteMany({});

  console.log(`Seeding ${SAMPLE_PRODUCTS.length} products (with embeddings)...`);
  for (const p of SAMPLE_PRODUCTS) {
    const created = await productService.createProduct(p);
    console.log(`  + ${created.productName}`);
  }

  const withEmbeddings = await ProductModel.countDocuments({
    productEmbedding: { $exists: true, $ne: null },
  });
  console.log(`Done. ${withEmbeddings}/${SAMPLE_PRODUCTS.length} have embeddings.`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
