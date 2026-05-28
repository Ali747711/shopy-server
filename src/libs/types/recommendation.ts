import { ScoredProduct } from "./ai";

export type RecommendationSource =
  | "content"
  | "collaborative"
  | "trending"
  | "similar";

export interface RecommendedProduct extends ScoredProduct {
  reason: string;
  source: RecommendationSource;
}

export interface RecommendationResult {
  strategy: "personalized" | "cold-start";
  items: RecommendedProduct[];
  cached: boolean;
}
