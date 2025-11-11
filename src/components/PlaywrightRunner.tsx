import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Progress } from "@/components/ui/progress";

export const PlaywrightRunner: React.FC = () => {
  const [status, setStatus] = useState<string>("");
  const [screenshot, setScreenshot] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const startSSE = () => {
    // If already running, do nothing
    if (isRunning) return;
    setIsRunning(true);
    setStatus("Connecting to scraper...");
    setScreenshot("");

    try {
      const es = new EventSource("/api/scrape-arbeitsagentur");
      esRef.current = es;

      es.onmessage = (ev) => {
        try {
          // ev.data should be a JSON string
          const payload = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
          // payload has type, message, data, image, etc.
          if (payload.type === "step" && payload.message) {
            setStatus(String(payload.message));
            // Update progress heuristically based on step if provided
            if (typeof payload.step === 'number') {
              const MAX_STEPS = 5; // heuristic from scraper
              const p = Math.min(100, Math.round((payload.step / MAX_STEPS) * 100));
              setProgress(p);
            }
          }
          if (payload.type === "screenshot" && payload.image) {
            // The API already sends data:image/png;base64,...
            setScreenshot(String(payload.image).startsWith("data:") ? String(payload.image) : `data:image/png;base64,${payload.image}`);
          }
          if (payload.type === "data" && payload.data) {
            // For now, show job title when a job is received
            if (payload.data.title) {
              setStatus(`Found: ${payload.data.title}`);
              // Append job to live list and cache
              setJobs(prev => {
                const exists = prev.some((j) => j.link === payload.data.link);
                if (exists) return prev;
                const next = [...prev, payload.data];
                try { localStorage.setItem('live-jobs', JSON.stringify({ timestamp: Date.now(), jobs: next })); } catch (e) {}
                return next;
              });
            }
          }
          if (payload.type === "complete") {
            setStatus(payload.message || "Scraping complete");
            // Close when complete
            es.close();
            esRef.current = null;
            setIsRunning(false);
          }
          if (payload.type === "error") {
            setStatus(`Error: ${payload.error || payload.message || "unknown"}`);
            es.close();
            esRef.current = null;
            setIsRunning(false);
          }
        } catch (e) {
          console.error("Failed to parse SSE data", e, ev.data);
        }
      };

      // Hardened onerror handler - avoid accessing forbidden properties on event in strict mode
      es.onerror = (ev) => {
        try {
          console.error("SSE error", ev);
        } catch (e) {
          // swallow logging errors
        }
        setStatus("Connection error to scraper");
        if (esRef.current) {
          try { esRef.current.close(); } catch (e) {}
          esRef.current = null;
        }
        setIsRunning(false);
      };
    } catch (e) {
      console.error("Failed to start SSE", e);
      setStatus("Failed to start scraper connection");
      setIsRunning(false);
    }
  };

  const stopSSE = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsRunning(false);
    setStatus("Stopped");
  };

  // Snapshot management (KV-backed)
  const [snapshots, setSnapshots] = useState<Array<{ timestamp: number; count: number }>>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<number | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [progress, setProgress] = useState<number>(0);

  const loadSnapshots = async () => {
    try {
      const resp = await fetch(`/api/list-cache-snapshots`);
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setSnapshots(data.snapshots || []);
    } catch (e) {
      console.error("Failed to load snapshots", e);
    }
  };

  const triggerCron = async () => {
    setStatus("Triggering cron job...");
    try {
      const resp = await fetch(`/api/scrape-arbeitsagentur-cron`, { method: "POST" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setStatus(`Cron error: ${data?.error || resp.statusText}`);
        return;
      }
      setStatus(`Cron started, saved at ${data.timestamp || 'unknown'}`);
      await loadSnapshots();
    } catch (e) {
      console.error("Failed to trigger cron", e);
      setStatus(`Failed to trigger cron: ${String(e)}`);
    }
  };

  const loadSnapshot = async (ts: number) => {
    setSelectedSnapshot(ts);
    setStatus(`Loading snapshot ${new Date(ts).toLocaleString()}...`);
    try {
      const resp = await fetch(`/api/get-jobs?timestamp=${ts}`);
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setJobs(data.jobs || []);
      // store loaded snapshot to local live cache as well
      try { localStorage.setItem('live-jobs', JSON.stringify({ timestamp: ts, jobs: data.jobs || [] })); } catch (e) {}
      setStatus(`Loaded ${data.jobs?.length || 0} jobs from ${new Date(ts).toLocaleString()}`);
    } catch (e) {
      console.error("Failed to load snapshot", e);
      setStatus(`Failed to load snapshot: ${String(e)}`);
      setJobs([]);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <Button onClick={startSSE} disabled={isRunning}>
            {isRunning ? "Running..." : "Scrape (stream)"}
          </Button>
          <Button variant="ghost" onClick={stopSSE} disabled={!isRunning}>
            Stop
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <Button onClick={triggerCron} className="bg-green-600">Bereit (Cron ausführen)</Button>
          <Button variant="ghost" onClick={loadSnapshots}>Aktivität laden</Button>
        </div>
      </div>

      {status && <p className="mt-2 text-sm">{status}</p>}
      <div className="mt-2">
        <Progress value={progress} className="h-2" />
      </div>
      {screenshot && <img className="mt-2 max-w-full rounded-md border" src={screenshot} alt="Playwright Screenshot" />}

      {/* Snapshots list */}
      <div className="mt-4">
        <h4 className="text-sm font-medium">Verfügbare Snapshots</h4>
        <div className="flex flex-wrap gap-2 mt-2">
          {snapshots.length === 0 && <div className="text-sm text-muted-foreground">Keine Snapshots gefunden</div>}
          {snapshots.map((s) => (
            <button
              key={s.timestamp}
              onClick={() => loadSnapshot(s.timestamp)}
              className={`px-3 py-1 rounded-md border ${selectedSnapshot === s.timestamp ? 'bg-blue-600 text-white' : 'bg-white'}`}
              title={`${s.count} jobs`}
            >
              {new Date(s.timestamp).toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs table for selected snapshot */}
      {selectedSnapshot && (
        <div className="mt-4">
          <h4 className="text-sm font-medium">Jobs vom {new Date(selectedSnapshot).toLocaleString()}</h4>
          <div className="overflow-x-auto mt-2">
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="text-left">
                  <th className="px-2 py-1">Titel</th>
                  <th className="px-2 py-1">Firma</th>
                  <th className="px-2 py-1">Ort</th>
                  <th className="px-2 py-1">Link</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j, idx) => (
                  <tr key={j.link || idx} className="border-t">
                    <td className="px-2 py-1 text-sm">{j.title}</td>
                    <td className="px-2 py-1 text-sm">{j.firma}</td>
                    <td className="px-2 py-1 text-sm">{j.arbeitsort}</td>
                    <td className="px-2 py-1 text-sm break-all"><a className="text-blue-600 underline" href={j.link} target="_blank" rel="noreferrer">öffnen</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaywrightRunner;
