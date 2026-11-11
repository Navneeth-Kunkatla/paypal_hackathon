import { generateText } from "ai";
import { z } from "zod";
import { agentConfig } from "./agent";
import { addEvent } from "./store";

export const JobBody = z.object({
  client_name: z.string().min(1),
  client_email: z.string().email(),
  amount: z.coerce.number().positive(),
  description: z.string().min(1),
  due_days: z.coerce.number().int().min(0).max(120).default(14),
  currency: z.string().length(3).default("USD"),
});

// Shared by the Zapier hook (/api/jobs) and the in-app test form.
export async function runJob(j: z.infer<typeof JobBody>): Promise<string> {
  addEvent("info", `Job completed via Zapier: ${j.description} for ${j.client_name}`);
  const { text } = await generateText({
    ...agentConfig("zapier"),
    prompt: `A job was just marked complete in the freelancer's task tool. Create an invoice and send it: client ${j.client_name} ${j.client_email}, ${j.amount} ${j.currency.toUpperCase()} for "${j.description}", due in ${j.due_days} days.`,
  });
  return text;
}
