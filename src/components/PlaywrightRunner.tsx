import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Progress } from "@/components/ui/progress";
import { Job } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { toast } from "@/hooks/use-toast";

import { Info } from "lucide-react";
export const PlaywrightRunner: React.FC<{ onJobSelect: (job: Job) => void }> = ({ onJobSelect }) => {
  const [status, setStatus] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [scraperLogs, setScraperLogs] = useState<string[]>([]);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const [newJobLinks, setNewJobLinks] = useState<Set<string>>(new Set());




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
    setScraperLogs([]);
    setLastScreenshot(null);

    try {
      const url = maxNew && maxNew > 0 ? `/api/scrape-arbeitsagentur?limit=${maxNew}` : "/api/scrape-arbeitsagentur";
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (payload.type === "step") {
            if (payload.log) {
              setScraperLogs(prev => [...prev, payload.log]);
            }
            if (payload.screenshot) {
              setLastScreenshot(payload.screenshot);
            }
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
            setNewJobLinks(prev => new Set(prev).add(payload.data.link));
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
    <Card className="w-full max-w-screen-2xl mx-auto bg-white shadow-xl border border-blue-200 rounded-2xl text-black">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl">Job Scraping</CardTitle>
        <CardDescription>Scrape Jobs von der Arbeitsagentur und zeige alle gespeicherten Ergebnisse an.</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
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

          {scraperLogs.length > 0 && (
            <div className="space-y-2 p-3 border rounded-md bg-gray-50 max-h-48 overflow-y-auto">
              <h5 className="text-xs font-semibold">Scraper Log:</h5>
              <pre className="text-xs whitespace-pre-wrap font-mono">{scraperLogs.join('\n')}</pre>
            </div>
          )}

          {lastScreenshot && (
            <div className="space-y-2 p-3 border rounded-md bg-gray-50">
              <h5 className="text-xs font-semibold">Letzter Screenshot:</h5>
              <img src={`data:image/png;base64,${lastScreenshot}`} alt="Scraper Screenshot" className="border rounded-md" />
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2">Alle Jobs (Treffer: {jobs.length})</h4>
            {/* Desktop/Tablette: Tabelle */}
            <div className="hidden md:block border rounded-md">
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
                  {jobs.map((job, idx) => {
                    return (
                      <TableRow 
                        key={job.link || idx} 
                        className={`odd:bg-white even:bg-muted/30 hover:bg-accent/40 border-b transition-colors duration-500 ${
                          newJobLinks.has(job.link) ? 'bg-green-100' : ''
                        }`}>
                        <TableCell className="font-semibold align-top break-words">
                          <div className="flex items-center gap-1">
                            <span>{job.title}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => toast({
                                title: `Beschreibung: ${job.title}`,
                                description: (
                                  <pre className="mt-2 max-h-[400px] overflow-y-auto w-full rounded-md bg-slate-950 p-4 text-white whitespace-pre-wrap">
                                    {job.description || "Keine Beschreibung verfügbar."}
                                  </pre>
                                ),
                                duration: 20000,
                              })}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="align-top break-words">{job.firma}</TableCell>
                        <TableCell className="align-top break-words">{job.arbeitsort}</TableCell>
                        <TableCell className="align-top space-y-2">
                          <div className="flex flex-col items-start gap-2">
                            <Button variant="default" size="sm" className="text-white hover:text-white w-20" onClick={() => onJobSelect(job)}>
                              Apply
                            </Button>
                            <Button asChild variant="default" size="sm" className="text-white hover:text-white w-20">
                              <a href={job.link} target="_blank" rel="noopener noreferrer">Öffnen</a>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>);
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Smartphone: Karten-Layout */}
            <div className="md:hidden space-y-3">
              {jobs.map((job, idx) => {
                return (
                  <div key={job.link || idx} className="rounded-lg border p-3 bg-white">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold break-words">{job.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => toast({
                          title: `Beschreibung: ${job.title}`,
                          description: (
                            <pre className="mt-2 max-h-[300px] overflow-y-auto w-full rounded-md bg-slate-950 p-4 text-white whitespace-pre-wrap">
                              {job.description || "Keine Beschreibung verfügbar."}
                            </pre>
                          ),
                          duration: 20000,
                        })}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1 break-words">{job.firma} · {job.arbeitsort}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button variant="default" size="sm" className="text-white hover:text-white" onClick={() => onJobSelect(job)}>
                        Apply
                      </Button>
                      <Button asChild variant="default" size="sm" className="text-white hover:text-white w-20">
                        <a href={job.link} target="_blank" rel="noopener noreferrer">Öffnen</a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlaywrightRunner;
