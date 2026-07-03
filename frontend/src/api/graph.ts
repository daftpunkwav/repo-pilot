import { api } from "./client";

export async function fetchGraph() {
  const res = await api.get("/graph");
  return res as { data: { nodes: Array<{ id: string; name: string; language?: string; category?: string }>; edges: Array<{ source: string; target: string; relation?: string }> } };
}
