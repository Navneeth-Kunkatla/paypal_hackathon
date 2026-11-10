import { getEvents } from "@/lib/store";

export async function GET() {
  return Response.json({ events: getEvents() });
}
