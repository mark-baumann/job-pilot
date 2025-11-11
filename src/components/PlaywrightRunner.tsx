import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Progress } from "@/components/ui/progress";
import { Job } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { ScrollArea } from "./ui/scroll-area";
import { toast } from "@/hooks/use-toast";

export const PlaywrightRunner: React.FC<{ onJobSelect: (job: Job) => void }> = ({ onJobSelect }) => {
  const [status, setStatus] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [progress, setProgress] = useState<number>(0);

  const [maxNew, setMaxNew] = useState<number>(5);

  const loadAllJobs = async () => {
    try {
      const resp = await fetch(`/api/list-jobs`);
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setJobs(data.jobs || []);
      setStatus(`Geladene Jobs: ${data.jobs?.length || 0}`);
    } catch (e) {
      console.error("Failed to load jobs", e);
    }
  };

  const startScraping = () => {
    if (isRunning) return;
    setIsRunning(true);
    setStatus("Verbinde zum Scraper...");
    setProgress(0);

    try {
      const url = maxNew && maxNew > 0 ? `/api/scrape-arbeitsagentur?limit=${maxNew}` : "/api/scrape-arbeitsagentur";
      const es = new EventSource(url);
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
            setStatus(`Neu: ${payload.data.title}`);
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
            loadAllJobs(); // nach Abschluss: komplette Liste aus DB laden
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
        setStatus("Verbindungsfehler zum Scraper");
        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
        }
        setIsRunning(false);
      };
    } catch (e) {
      console.error("Failed to start SSE", e);
      setStatus("Konnte Scraper-Verbindung nicht starten");
      setIsRunning(false);
    }
  };

  const stopScraping = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsRunning(false);
    setStatus("Gestoppt");
  };

  useEffect(() => {
    loadAllJobs();
  }, []);

  return (
    <Card className="w-full bg-white shadow-xl border border-blue-200 rounded-2xl text-black">
      <CardHeader>
        <CardTitle>Job Scraping</CardTitle>
        <CardDescription>Scrape Jobs von der Arbeitsagentur und zeige alle gespeicherten Ergebnisse an.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Neue Treffer laden:</label>
              <input
                type="number"
                min={1}
                value={maxNew}
                onChange={(e) => setMaxNew(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 h-9 px-2 border rounded-md"
              />
            </div>
            <Button onClick={startScraping} disabled={isRunning}>
              {isRunning ? "Scraping..." : "Scrape Arbeitsagentur"}
            </Button>
            <Button variant="ghost" onClick={stopScraping} disabled={!isRunning}>
              Stop
            </Button>
          </div>

          {isRunning && (
            <div className="space-y-2">
              <p className="text-sm">{status}</p>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2">Alle Jobs</h4>
            {(() => {
              const rowHeight = 48; // approximate row height
              const headerHeight = 56; // header + padding
              const minH = 240; // minimum height
              const maxH = 720; // cap height
              const computed = Math.min(maxH, Math.max(minH, headerHeight + jobs.length * rowHeight));
              return (
                <ScrollArea className="border rounded-md" style={{ height: computed }}>
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
                            <div className="flex items-center gap-2">
                              <a href={job.link} target="_blank" rel="noopener noreferrer">
                                <Button variant="secondary" size="sm">Link</Button>
                              </a>
                              <Button variant="default" size="sm" className="text-white" onClick={() => onJobSelect(job)}>
                                Übernehmen
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              );
            })()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlaywrightRunner;
