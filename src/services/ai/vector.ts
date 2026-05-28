import { ProductStatus } from "../../libs/enums/product.enum";
import ProductModel from "../../schemas/product.schema";

export const VECTOR_INDEX = "product_vector_index";

export interface VectorSearchOpts {
  /** Extra $vectorSearch filter — only fields indexed as `filter` (category, price, status). */
  filter?: Record<string, any>;
  /** Product ids to drop from results (post-filtered; `_id` is not a vector filter field). */
  excludeIds?: any[];
  limit?: number;
  numCandidates?: number;
}

export interface VectorMatch {
  _id: any;
  productName: string;
  productDescription: string;
  productCategory: string;
  productPrice: number;
  productCurrency: string;
  productTags: string[];
  score: number;
}

/**
 * Runs Atlas `$vectorSearch` over product embeddings with optional structured
 * filters, returning scored products. Shared by AI search and recommendations.
 */
export const vectorSearchProducts = async (
  queryVector: number[],
  opts: VectorSearchOpts = {}
): Promise<VectorMatch[]> => {
  const limit = opts.limit ?? 8;
  const excludeCount = opts.excludeIds?.length ?? 0;
  const filter = {
    productStatus: { $eq: ProductStatus.ACTIVE },
    ...(opts.filter ?? {}),
  };

  const pipeline: any[] = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX,
        path: "productEmbedding",
        queryVector,
        numCandidates: opts.numCandidates ?? 100,
        limit: limit + excludeCount,
        filter,
      },
    },
  ];

  if (excludeCount) {
    pipeline.push({ $match: { _id: { $nin: opts.excludeIds } } });
  }

  pipeline.push(
    {
      $project: {
        productName: 1,
        productDescription: 1,
        productCategory: 1,
        productPrice: 1,
        productCurrency: 1,
        productTags: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
    { $limit: limit }
  );

  return ProductModel.aggregate(pipeline).exec();
};
