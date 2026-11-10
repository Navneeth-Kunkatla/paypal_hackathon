import { streamText } from "ai";
import { agentConfig, keysMissing } from "@/lib/agent";

export async function POST(req: Request) {
  try {
    if (keysMissing()) {
      return Response.json({ error: "Missing ANTHROPIC_API_KEY or PayPal credentials" }, { status: 503 });
    }
    const { messages } = await req.json();
    const result = streamText({ ...agentConfig(), messages });
    return result.toDataStreamResponse({
      getErrorMessage: (e) => (e instanceof Error ? e.message : "Agent error"),
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Chat failed" }, { status: 500 });
  }
}
