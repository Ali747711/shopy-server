import OpenAI from "openai";
import { openai } from "../../config/openai";
import { env } from "../../config/env";
import { ChatMessage, ScoredProduct } from "../../libs/types/ai";
import { logger } from "../../libs/utils/logger";
import AiSearchService from "./search.service";
import CostService from "./cost.service";

const CHAT_SYSTEM_PROMPT = `You are Shopy's friendly shopping assistant for an online store. Hold a natural, concise conversation to help the shopper find the right product.

Guidelines:
- If the request is vague or missing key details (budget, category, size/colour, or use-case), ask ONE short clarifying question instead of guessing. Suggest a couple of concrete options when it helps.
- Ask at most two clarifying questions before searching. Once you know enough to be useful, call the search_products tool with a concise query that combines what you've learned.
- After receiving product results, recommend 2-4 of them, each with a one-line reason grounded in its price or attributes. Only mention products returned by the tool. If none were found, say so and suggest how to adjust the request.
- Keep replies short and warm (1-3 sentences). Never invent products, prices, or stock.`;

const RECOMMEND_GUIDANCE = `Use the product results below to recommend 2-4 options to the shopper. Give each a one-line reason grounded in concrete details (price, category, attributes). Only reference these products. Keep it concise and friendly.`;

const SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_products",
    description:
      "Search the store catalog for products matching a natural-language query. Call this only once you know enough (a category plus a budget or a key preference) to return relevant results.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "A concise natural-language product query combining the shopper's needs (category, budget, attributes).",
        },
      },
      required: ["query"],
    },
  },
};

export interface ChatStreamHandlers {
  onToken: (token: string) => void;
  onProducts: (products: ScoredProduct[]) => void;
}

export class AiChatService {
  private readonly searchService = new AiSearchService();
  private readonly costService = new CostService();

  /**
   * Drives a multi-turn shopping conversation. The model either asks a
   * clarifying question or calls the search tool; on a tool call we retrieve
   * grounded products and stream a recommendation referencing only those.
   */
  public streamChat = async (
    messages: ChatMessage[],
    handlers: ChatStreamHandlers
  ): Promise<void> => {
    if (await this.costService.budgetExceeded()) {
      logger.warn("AI daily budget exceeded — degrading chat to plain search");
      return this.degradedReply(messages, handlers);
    }

    const conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const decision = await openai.chat.completions.create({
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.5,
      messages: conversation,
      tools: [SEARCH_TOOL],
      tool_choice: "auto",
    });
    await this.recordUsage(decision.usage);

    const choice = decision.choices[0]?.message;
    const toolCall = choice?.tool_calls?.[0];

    // No tool call → the assistant asked a question or replied conversationally.
    if (!toolCall) {
      handlers.onToken(choice?.content ?? "Could you tell me a bit more about what you're after?");
      return;
    }

    // Tool call → retrieve grounded products, then stream a recommendation.
    const query = this.parseQuery(toolCall, messages);
    const { products } = await this.searchService.resolve(query);
    handlers.onProducts(products);

    const followUp: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...conversation,
      choice as OpenAI.Chat.Completions.ChatCompletionMessageParam,
      {
        role: "tool",
        tool_call_id: toolCall.id,
        content: `${RECOMMEND_GUIDANCE}\n\n${this.buildProductContext(query, products)}`,
      },
    ];

    const stream = await openai.chat.completions.create({
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.5,
      stream: true,
      stream_options: { include_usage: true },
      messages: followUp,
    });

    let usage: OpenAI.CompletionUsage | undefined;
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) handlers.onToken(token);
      if (chunk.usage) usage = chunk.usage;
    }
    await this.recordUsage(usage);
  };

  /** Budget-exhausted path: skip the LLM, run a plain search on the last message. */
  private degradedReply = async (
    messages: ChatMessage[],
    handlers: ChatStreamHandlers
  ): Promise<void> => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const { products } = await this.searchService.resolve(lastUser);
    handlers.onProducts(products);
    handlers.onToken(
      products.length
        ? "Here are some options from the catalog that match your request."
        : "I couldn't find a match — try adjusting your budget or category and ask again."
    );
  };

  private parseQuery = (
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
    messages: ChatMessage[]
  ): string => {
    const fallback = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    try {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      return typeof args.query === "string" && args.query.trim() ? args.query : fallback;
    } catch {
      return fallback;
    }
  };

  private buildProductContext = (query: string, products: ScoredProduct[]): string => {
    if (!products.length) {
      return `Query: ${query}\n\nNo matching products were found in the catalog.`;
    }
    const lines = products
      .map(
        (p) =>
          `- ${p.productName} ($${p.productPrice} ${p.productCurrency}, ${p.productCategory}; tags: ${p.productTags.join(", ")})`
      )
      .join("\n");
    return `Query: ${query}\n\nProducts:\n${lines}`;
  };

  private recordUsage = async (usage?: OpenAI.CompletionUsage): Promise<void> => {
    if (!usage) return;
    await this.costService.record(
      env.OPENAI_CHAT_MODEL,
      usage.prompt_tokens ?? 0,
      usage.completion_tokens ?? 0
    );
  };
}

export default AiChatService;
