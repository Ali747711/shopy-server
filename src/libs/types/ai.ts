/** Structured filters extracted from a natural-language query by the LLM. */
export interface SearchIntent {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  attributes?: string[];
  keywords?: string;
}

export interface AiSearchInput {
  query: string;
}

export interface ScoredProduct {
  _id: string;
  productName: string;
  productDescription: string;
  productCategory: string;
  productPrice: number;
  productCurrency: string;
  productTags: string[];
  score: number;
}

export interface AiSearchResult {
  query: string;
  intent: SearchIntent;
  products: ScoredProduct[];
  explanation: string;
  cached: boolean;
  /** true when LLM steps were skipped (e.g. daily budget exceeded). */
  degraded: boolean;
}
