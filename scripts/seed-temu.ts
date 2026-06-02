import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { ProductInput } from "../src/libs/types/product";
import ProductModel from "../src/schemas/product.schema";
import ProductService from "../src/services/product.service";

interface TemuRow {
  index: number;
  name: string;
  currentPrice: string;
  originalPrice: string;
  rating: string;
  reviews: string;
  sold: string;
  badge: string;
  imageSrc: string;
  // Source URL field name varies across files.
  url?: string;
  productUrl?: string;
}

const KRW_PER_USD = 1300;
const DEFAULT_STOCK = 100;
const DATA_DIR = path.join(__dirname, "..", "data");

// Filename → catalog category. Anything not listed is skipped.
const FILE_CATEGORY: Record<string, string> = {
  "temu_sunglasses_products.json": "sunglasses",
  "backpack_products.json": "backpack",
  "headphones_products.json": "headphones",
  "jacket_products.json": "jacket",
  "shoes_products.json": "shoes",
  "streetwear_men_products.json": "streetwear",
  "watch_products.json": "watch",
};

const SHARED_TAGS: Array<{ tag: string; pattern: RegExp }> = [
  { tag: "polarized", pattern: /polariz/i },
  { tag: "lightweight", pattern: /lightweight|ultra-?light/i },
  { tag: "vintage", pattern: /vintage|retro/i },
  { tag: "y2k", pattern: /y2k/i },
  { tag: "fashion", pattern: /fashion/i },
  { tag: "sports", pattern: /sport|cycling|riding|fishing|outdoor|hiking|gym|athletic|running|tennis/i },
  { tag: "mens", pattern: /\bmen('s)?\b/i },
  { tag: "womens", pattern: /\bwomen('s)?\b/i },
  { tag: "waterproof", pattern: /water-?proof|water-?resistant/i },
  { tag: "luxury", pattern: /luxury|premium/i },
  { tag: "gift", pattern: /gift|valentine|christmas/i },
  { tag: "wireless", pattern: /wireless|bluetooth/i },
  { tag: "noise-cancelling", pattern: /noise[- ]?canc/i },
  { tag: "smart", pattern: /smart\s?(watch|band)/i },
  { tag: "casual", pattern: /casual/i },
  { tag: "winter", pattern: /winter|insulated|down|fleece/i },
  { tag: "leather", pattern: /leather/i },
];

const CATEGORY_TAGS: Record<string, Array<{ tag: string; pattern: RegExp }>> = {
  sunglasses: [
    { tag: "frameless", pattern: /frameless|rimless/i },
    { tag: "square", pattern: /square/i },
    { tag: "round", pattern: /\bround\b/i },
    { tag: "oversized", pattern: /oversized/i },
    { tag: "uv-protection", pattern: /uv\s?(400|protection)?|sun protection/i },
    { tag: "mirror", pattern: /mirror/i },
    { tag: "steampunk", pattern: /steampunk/i },
    { tag: "cyberpunk", pattern: /cyberpunk/i },
  ],
  backpack: [
    { tag: "laptop", pattern: /laptop|notebook|computer/i },
    { tag: "travel", pattern: /travel|carry-?on|trip/i },
    { tag: "school", pattern: /school|student|college/i },
    { tag: "daypack", pattern: /daypack|day pack/i },
    { tag: "hiking", pattern: /hiking|hike|trekking/i },
    { tag: "anti-theft", pattern: /anti-?theft/i },
    { tag: "usb-charging", pattern: /usb/i },
  ],
  headphones: [
    { tag: "over-ear", pattern: /over-?ear/i },
    { tag: "in-ear", pattern: /in-?ear|earbud/i },
    { tag: "wired", pattern: /wired/i },
    { tag: "gaming", pattern: /gaming/i },
    { tag: "long-battery", pattern: /long battery|long-?life|hours? (of )?(battery|playback)/i },
    { tag: "hifi", pattern: /hi-?fi|hifi/i },
  ],
  jacket: [
    { tag: "rain", pattern: /\brain\b/i },
    { tag: "windbreaker", pattern: /windbreaker|wind-?proof/i },
    { tag: "puffer", pattern: /puffer|down/i },
    { tag: "denim", pattern: /denim/i },
    { tag: "bomber", pattern: /bomber/i },
    { tag: "hooded", pattern: /hood/i },
    { tag: "spring", pattern: /spring/i },
    { tag: "autumn", pattern: /autumn|fall/i },
  ],
  shoes: [
    { tag: "running", pattern: /running/i },
    { tag: "walking", pattern: /walking/i },
    { tag: "sneakers", pattern: /sneaker/i },
    { tag: "loafers", pattern: /loafer/i },
    { tag: "boots", pattern: /boot/i },
    { tag: "breathable", pattern: /breathable|mesh/i },
    { tag: "non-slip", pattern: /non-?slip|anti-?slip/i },
  ],
  streetwear: [
    { tag: "hoodie", pattern: /hoodie|hooded/i },
    { tag: "tshirt", pattern: /t-?shirt|tee\b/i },
    { tag: "graphic", pattern: /graphic|print/i },
    { tag: "oversized", pattern: /oversized/i },
    { tag: "harajuku", pattern: /harajuku/i },
    { tag: "vintage", pattern: /vintage|retro/i },
  ],
  watch: [
    { tag: "fitness", pattern: /fitness|tracker|step|calorie|heart-?rate/i },
    { tag: "bluetooth-call", pattern: /bluetooth call|answer call/i },
    { tag: "amoled", pattern: /amoled|hd display/i },
    { tag: "ip67", pattern: /ip67|ip68/i },
    { tag: "analog", pattern: /analog|quartz|mechanical/i },
    { tag: "leather-strap", pattern: /leather strap|leather band/i },
  ],
};

const parseKrw = (raw: string): number => {
  if (!raw) return 0;
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

const krwToUsd = (krw: number): number =>
  Math.round((krw / KRW_PER_USD) * 100) / 100;

const parseRatingCount = (raw: string): number => {
  if (!raw) return 0;
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

const deriveTags = (
  category: string,
  name: string,
  badge: string
): string[] => {
  const patterns = [...SHARED_TAGS, ...(CATEGORY_TAGS[category] ?? [])];
  const tags = patterns
    .filter(({ pattern }) => pattern.test(name))
    .map(({ tag }) => tag);
  if (badge) tags.push(badge.toLowerCase().replace(/\s+/g, "-"));
  return Array.from(new Set(tags));
};

const cleanName = (name: string): string =>
  name.replace(/\s+/g, " ").trim().slice(0, 200);

const toProductInput = (row: TemuRow, category: string): ProductInput => {
  const priceKrw = parseKrw(row.currentPrice);
  const originalKrw = parseKrw(row.originalPrice);
  return {
    productName: cleanName(row.name),
    productDescription: row.name.trim(),
    productCategory: category,
    productTags: deriveTags(category, row.name, row.badge),
    productPrice: krwToUsd(priceKrw),
    productCurrency: "USD",
    productStock: DEFAULT_STOCK,
    productImages: row.imageSrc
      ? [{ url: row.imageSrc, alt: cleanName(row.name) }]
      : [],
    productAttributes: {
      source: "temu",
      sourceIndex: row.index,
      sourceUrl: row.url ?? row.productUrl,
      originalPriceKrw: originalKrw || undefined,
      currentPriceKrw: priceKrw || undefined,
      badge: row.badge || undefined,
      sold: row.sold || undefined,
    },
  };
};

const loadDataFiles = (): Array<{ file: string; category: string; rows: TemuRow[] }> => {
  const present = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  return present
    .filter((f) => FILE_CATEGORY[f])
    .map((file) => {
      const rows: TemuRow[] = JSON.parse(
        fs.readFileSync(path.join(DATA_DIR, file), "utf8")
      );
      return { file, category: FILE_CATEGORY[file], rows };
    });
};

const run = async () => {
  const datasets = loadDataFiles();
  if (!datasets.length) {
    console.error(`No mapped data files found in ${DATA_DIR}`);
    process.exit(1);
  }

  const total = datasets.reduce((s, d) => s + d.rows.length, 0);
  console.log(`Found ${datasets.length} files, ${total} rows total:`);
  for (const d of datasets) console.log(`  - ${d.file} → ${d.category} (${d.rows.length})`);

  await connectDB();
  console.log("Clearing existing products...");
  await ProductModel.deleteMany({});

  const productService = new ProductService();
  let ok = 0;
  let failed = 0;

  for (const { file, category, rows } of datasets) {
    console.log(`\n→ Importing ${file} as "${category}"`);
    for (const row of rows) {
      const input = toProductInput(row, category);
      if (!input.productPrice) {
        console.warn(`  ! Skipping #${row.index} (${file}) — unparseable price`);
        failed++;
        continue;
      }
      try {
        const created: any = await productService.createProduct(input);

        const ratingAvg = parseFloat(row.rating);
        const ratingCount = parseRatingCount(row.reviews);
        if (Number.isFinite(ratingAvg) || ratingCount) {
          await ProductModel.updateOne(
            { _id: created._id },
            {
              $set: {
                productRatingAvg: Number.isFinite(ratingAvg) ? ratingAvg : 0,
                productRatingCount: ratingCount,
              },
            }
          );
        }

        ok++;
        if (ok % 25 === 0) console.log(`    + ${ok}/${total} inserted`);
      } catch (e) {
        failed++;
        console.error(`  x Failed #${row.index} (${file}):`, (e as Error).message);
      }
    }
  }

  const counts = await ProductModel.aggregate([
    { $group: { _id: "$productCategory", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const withEmbeddings = await ProductModel.countDocuments({
    productEmbedding: { $exists: true, $ne: null },
  });

  console.log("\n=== Result ===");
  console.log(`inserted=${ok} failed=${failed} withEmbeddings=${withEmbeddings}/${ok}`);
  console.log("by category:", counts.map((c) => `${c._id}=${c.count}`).join(", "));

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
