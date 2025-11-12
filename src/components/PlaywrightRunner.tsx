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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
            <ScrollArea className="h-[70vh] border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                  <TableRow>
                    <TableHead className="w-[22%]">Title</TableHead>
                    <TableHead className="w-[14%]">Company</TableHead>
                    <TableHead className="w-[14%]">Location</TableHead>
                    <TableHead className="w-[38%]">Description</TableHead>
                    <TableHead className="w-[6%]">Link</TableHead>
                    <TableHead className="w-[6%]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job, idx) => {
                    const full = (job.description || "").replace(/\s+/g, " ").trim();
                    const short = full.length > 280 ? full.slice(0, 280) + "…" : full;
                    return (
                      <TableRow key={job.link || idx} className="odd:bg-white even:bg-muted/30 hover:bg-accent/40">
                        <TableCell className="font-medium align-top break-words">
                          {job.title}
                          {job.firma && (
                            <div className="text-[11px] text-muted-foreground">{job.firma} · {job.arbeitsort}</div>
                          )}
                        </TableCell>
                        <TableCell className="align-top break-words">{job.firma}</TableCell>
                        <TableCell className="align-top break-words">{job.arbeitsort}</TableCell>
                        <TableCell
                          title={full}
                          className="align-top text-sm text-black max-w-[720px] break-words whitespace-pre-wrap"
                        >
                          {(expanded[job.link] ? full : short) || <span className="italic text-muted-foreground">(keine Beschreibung)</span>}
                          {full && full.length > short.length && (
                            <div className="mt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-black hover:text-black"
                                onClick={() => setExpanded((prev) => ({ ...prev, [job.link]: !prev[job.link] }))}
                              >
                                {expanded[job.link] ? "Weniger" : "Mehr"}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <Button asChild variant="link" size="sm">
                            <a href={job.link} target="_blank" rel="noopener noreferrer">Öffnen</a>
                          </Button>
                        </TableCell>
                        <TableCell className="align-top">
                          <Button variant="outline" size="sm" className="text-black hover:text-black" onClick={() => onJobSelect(job)}>
                            Select
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlaywrightRunner;
