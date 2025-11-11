import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (
    request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return response.status(401).end("Unauthorized");
  }

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const scrapeResponse = await fetch(`${baseUrl}/api/scrape-arbeitsagentur`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!scrapeResponse.ok) {
      throw new Error("Failed to trigger scrape");
    }

    const result = await scrapeResponse.json();
    response.status(200).json(result);
  } catch (error) {
    console.error("Cron handler error:", error);
    response
      .status(500)
      .json({ success: false, error: (error as Error).message });
  }
}
