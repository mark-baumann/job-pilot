import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Progress } from "@/components/ui/progress";
import { Job } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { ScrollArea } from "./ui/scroll-area";
import { toast } from "@/hooks/use-toast";

interface Snapshot {
  timestamp: number;
  count: number;
}

export const PlaywrightRunner: React.FC<{ onJobSelect: (job: Job) => void }> = ({ onJobSelect }) => {
  const [status, setStatus] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [progress, setProgress] = useState<number>(0);

  const startScraping = () => {
    if (isRunning) return;
    setIsRunning(true);
    setStatus("Connecting to scraper...");
    setJobs([]);
    setProgress(0);

    try {
      const es = new EventSource("/api/scrape-arbeitsagentur");
      esRef.current = es;

      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (payload.type === "step") {
            setStatus(payload.message);
            if (typeof payload.step === 'number') {
              const MAX_STEPS = 5;
              const p = Math.min(100, Math.round((payload.step / MAX_STEPS) * 100));
              setProgress(p);
            }
          } else if (payload.type === "data" && payload.data) {
            setStatus(`Found: ${payload.data.title}`);
            setJobs(prev => {
              const exists = prev.some(j => j.link === payload.data.link);
              return exists ? prev : [...prev, payload.data];
            });
          } else if (payload.type === "complete") {
            setStatus(payload.message || "Scraping complete");
            setProgress(100);
            es.close();
            esRef.current = null;
            setIsRunning(false);
            loadSnapshots(); // Refresh snapshots after scraping
          } else if (payload.type === "error") {
            setStatus(`Error: ${payload.error || "Unknown error"}`);
            toast({ title: "Scraping Error", description: payload.error || "Unknown error", variant: "destructive" });
            es.close();
            esRef.current = null;
            setIsRunning(false);
          }
        } catch (e) {
          console.error("Failed to parse SSE data", e, ev.data);
        }
      };

      es.onerror = () => {
        setStatus("Connection error to scraper");
        if (esRef.current) {
          esRef.current.close();
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

  const stopScraping = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsRunning(false);
    setStatus("Stopped");
  };

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

  const loadSnapshot = async (ts: number) => {
    setSelectedSnapshot(ts);
    setStatus(`Loading snapshot ${new Date(ts).toLocaleString()}...`);
    try {
      const resp = await fetch(`/api/get-jobs?timestamp=${ts}`);
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setJobs(data.jobs || []);
      setStatus(`Loaded ${data.jobs?.length || 0} jobs from ${new Date(ts).toLocaleString()}`);
    } catch (e) {
      console.error("Failed to load snapshot", e);
      setJobs([]);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  return (
    <Card className="w-full bg-white shadow-xl border border-blue-200 rounded-2xl text-black">
      <CardHeader>
        <CardTitle>Job Scraping</CardTitle>
        <CardDescription>Scrape jobs from Arbeitsagentur and view results.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button onClick={startScraping} disabled={isRunning}>
              {isRunning ? "Scraping..." : "Scrape Arbeitsagentur"}
            </Button>
            <Button variant="ghost" onClick={stopScraping} disabled={!isRunning}>
              Stop
            </Button>
            <Button variant="outline" onClick={loadSnapshots}>Refresh Snapshots</Button>
          </div>

          {isRunning && (
            <div className="space-y-2">
              <p className="text-sm">{status}</p>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2">Available Snapshots</h4>
            <ScrollArea className="h-32 border rounded-md">
              <div className="p-2 space-y-2">
                {snapshots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No snapshots found.</p>
                ) : (
                  snapshots.map((s) => (
                    <div
                      key={s.timestamp}
                      onClick={() => loadSnapshot(s.timestamp)}
                      className={`p-2 rounded-md cursor-pointer ${selectedSnapshot === s.timestamp ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                    >
                      <p className="font-semibold">{new Date(s.timestamp).toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">{s.count} jobs</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {(jobs.length > 0) && (
            <div>
              <h4 className="text-sm font-medium mb-2">
                {selectedSnapshot ? `Jobs from ${new Date(selectedSnapshot).toLocaleString()}` : "Live Scraping Results"}
              </h4>
              <ScrollArea className="h-64 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job, idx) => (
                      <TableRow key={job.link || idx}>
                        <TableCell>{job.title}</TableCell>
                        <TableCell>{job.firma}</TableCell>
                        <TableCell>{job.arbeitsort}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => onJobSelect(job)}>
                            Select
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PlaywrightRunner;
