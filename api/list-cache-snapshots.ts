export default async function handler(req: any, res: any) {
  // KV-Snapshots wurden entfernt. Endpoint bleibt als Stub bestehen, um 500-Fehler zu vermeiden.
  res.status(200).json({ snapshots: [] });
}
