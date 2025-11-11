import { kv } from "@vercel/kv";

export default async function handler(req: any, res: any) {
  try {
    // Allow optional timestamp query to fetch a historical snapshot
    const url = req.url ? new URL(req.url, "http://localhost") : null;
    const qp = req.query && req.query.timestamp ? req.query.timestamp : url ? url.searchParams.get("timestamp") : null;

    const key = qp ? `jobs-cache:${qp}` : "jobs-cache";

    const cacheData = await kv.get(key as string);

    if (!cacheData) {
      return res.status(404).json({
        error: "Cache not available for the requested timestamp.",
        timestamp: null,
        jobs: [],
      });
    }

    const data = typeof cacheData === "string" ? JSON.parse(cacheData) : cacheData;

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: null,
      jobs: [],
    });
  }
}
