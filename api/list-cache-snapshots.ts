import { kv } from "@vercel/kv";

export default async function handler(req: any, res: any) {
  try {
    const raw = await kv.get("jobs-cache-index");
    const index = typeof raw === "string" ? JSON.parse(raw) : raw || [];
    // Return index (array of { timestamp, count }) sorted descending
    const sorted = Array.isArray(index) ? index.sort((a: any, b: any) => b.timestamp - a.timestamp) : [];
    res.status(200).json({ snapshots: sorted });
  } catch (error) {
    console.error("Error listing snapshots:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error", snapshots: [] });
  }
}
