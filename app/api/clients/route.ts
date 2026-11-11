import { listClients } from "@/lib/clients";

export async function GET() {
  try {
    return Response.json({ clients: await listClients() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
