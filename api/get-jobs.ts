import { kv } from "@vercel/kv";

export default async function handler(req: any, res: any) {
  try {
    const cacheData = await kv.get("jobs-cache");

    if (!cacheData) {
      return res.status(404).json({
        error: "Cache not available yet. Cron job will run daily at 2:00 UTC.",
        timestamp: null,
        jobs: [],
      });
    }

    // cacheData ist bereits ein JSON-String
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
