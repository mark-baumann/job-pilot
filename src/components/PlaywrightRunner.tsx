import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useRef } from "react";
import { AlertCircle, CheckCircle2, Loader2, Image as ImageIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Job {
  title: string;
  link: string;
  description?: string;
  firma?: string;
  arbeitsort?: string;
}

interface ScraperEvent {
  type: "step" | "data" | "error" | "complete" | "screenshot";
  step?: number;
  message?: string;
  data?: Job;
  error?: string;
  image?: string;
}

interface ProgressItem {
  step: number;
  message: string;
}

interface PlaywrightRunnerProps {
  onJobSelect?: (job: Job) => void;
}

export function PlaywrightRunner({ onJobSelect }: PlaywrightRunnerProps) {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load jobs from localStorage on mount
  useEffect(() => {
    const cachedJobs = localStorage.getItem("scraped_jobs");
    if (cachedJobs) {
      try {
        setJobs(JSON.parse(cachedJobs));
      } catch (e) {
        console.log("Cache laden fehlgeschlagen");
      }
    }
  }, []);

  // cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        try { eventSourceRef.current.close(); } catch (e) {}
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Save jobs to localStorage whenever they change
  useEffect(() => {
    if (jobs.length > 0) {
      localStorage.setItem("scraped_jobs", JSON.stringify(jobs));
    }
  }, [jobs]);

  const scrapeJobs = async () => {
    setLoading(true);
    setMessage("🔍 Starte Scraping...");
    setProgress([]);
    setError(null);
    setScreenshots([]);

    // ensure any existing EventSource is closed before opening a new one
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch (e) {}
      eventSourceRef.current = null;
    }

    try {
      // append timestamp to avoid cached/pooled connections
      const url = `/api/scrape-arbeitsagentur?ts=${Date.now()}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        const scraperEvent: ScraperEvent = JSON.parse(event.data);

        switch (scraperEvent.type) {
          case "step":
            if (scraperEvent.step && scraperEvent.message) {
              setProgress((prev) => [...prev, { step: scraperEvent.step!, message: scraperEvent.message! }]);
              setMessage(`⏳ ${scraperEvent.message}`);
            }
            break;

          case "data":
            if (scraperEvent.data) {
              setJobs((prev) => {
                // Duplikate vermeiden - prüfe ob Job bereits vorhanden ist
                const exists = prev.some((j) => j.link === scraperEvent.data!.link);
                if (!exists) {
                  return [...prev, scraperEvent.data!];
                }
                return prev;
              });
            }
            break;

          case "screenshot":
            if (scraperEvent.image) {
              setScreenshots((prev) => (prev.includes(scraperEvent.image!) ? prev : [...prev, scraperEvent.image!]));
            }
            break;

          case "complete":
              setMessage("✅ Scraping erfolgreich abgeschlossen!");
              try { es.close(); } catch (e) {}
              eventSourceRef.current = null;
              setLoading(false);
            break;

          case "error":
            setError(scraperEvent.error || "Ein Fehler ist aufgetreten");
            setMessage(`❌ Fehler: ${scraperEvent.error}`);
            try { es.close(); } catch (e) {}
            eventSourceRef.current = null;
            setLoading(false);
            break;
        }
      };
      es.onerror = () => {
        setError("Verbindung zum Server unterbrochen");
        try { es.close(); } catch (e) {}
        eventSourceRef.current = null;
        setLoading(false);
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(errorMsg);
      setMessage(`❌ Fehler: ${errorMsg}`);
      setLoading(false);
    }
  };

  const handleJobSelect = (job: Job) => {
    if (onJobSelect) {
      onJobSelect(job);
    }
  };

  const toggleDescription = (link: string) => {
    setExpandedDescriptions((prev) => ({ ...prev, [link]: !prev[link] }));
  };

  const handleAttachCompressed = (job: Job) => {
    // Store a marker in localStorage that the compressed Zeugnis should be attached for this job
    const key = "marks_zeugnis_compressed";
    const payload = { jobLink: job.link, file: "/zeugnis-compressed.html" };
    localStorage.setItem(key, JSON.stringify(payload));
    // show a short message
    setMessage("📎 Marks Zeugnis Compressed hinzugefügt");
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <div className="w-full space-y-4">
      <Card className="w-full bg-white shadow border border-black rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-black">
            🔍 Jobs Scraper
          </CardTitle>
          <CardDescription className="text-black/80">
            Scrape Jobs von der Arbeitsagentur-Website
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Button */}
          <Button
            onClick={scrapeJobs}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base font-semibold shadow-md transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Scraping läuft...
              </>
            ) : (
              "▶ Jobs laden"
            )}
          </Button>

          {/* Status Message */}
          {message && (
            <div
              className={`flex items-center gap-2 p-4 rounded-lg font-medium transition-all ${
                error
                  ? "bg-red-100 border border-red-400 text-red-800"
                  : "bg-white border border-black text-black"
              }`}
            >
              {error ? (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              )}
              <span>{message}</span>
            </div>
          )}

          {/* Progress Steps */}
          {progress.length > 0 && (
            <div className="bg-white border border-black p-3 rounded-md space-y-2">
              <p className="text-sm font-bold text-black">Fortschritt</p>
              {progress.map((item, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-xs text-black/60">•</span>
                  <div className="text-black text-sm">{item.message}</div>
                </div>
              ))}
            </div>
          )}

          {/* Screenshots */}
          {screenshots.length > 0 && (
            <div className="bg-white border border-black p-3 rounded-md">
              <p className="text-sm font-bold text-black mb-2 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Screenshots ({screenshots.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
                {screenshots.map((screenshot, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedScreenshot(screenshot)}
                    className="border border-gray-200 rounded-md overflow-hidden bg-white"
                    aria-label={`Screenshot ${index + 1}`}
                  >
                    <img src={screenshot} alt={`Screenshot ${index + 1}`} className="w-full h-24 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Screenshot modal */}
          {selectedScreenshot && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setSelectedScreenshot(null)}>
              <div className="max-w-3xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="bg-white p-2 rounded-md">
                  <img src={selectedScreenshot} alt="Selected screenshot" className="w-full h-auto object-contain" />
                  <div className="mt-2 text-right">
                    <Button onClick={() => setSelectedScreenshot(null)} className="px-3 py-1">Schließen</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jobs Table - desktop */}
      {jobs.length > 0 && (
        <div className="w-full">
          <Card className="w-full bg-white shadow border border-black rounded-lg hidden sm:block">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-black">📋 Gefundene Jobs ({jobs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="bg-white">
                      <TableHead className="font-bold text-black">Jobtitel</TableHead>
                      <TableHead className="font-bold text-black">Firma</TableHead>
                      <TableHead className="font-bold text-black">Ort</TableHead>
                      <TableHead className="font-bold text-black">Beschreibung</TableHead>
                      <TableHead className="font-bold text-black">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.link} className="border-t border-gray-200 align-top">
                        <TableCell className="py-4 text-black font-medium w-48 max-w-xs break-words">{job.title}</TableCell>
                        <TableCell className="py-4 text-black w-36 max-w-xs break-words">{job.firma || '—'}</TableCell>
                        <TableCell className="py-4 text-black w-32">{job.arbeitsort || '—'}</TableCell>
                        <TableCell className="py-4 text-black text-sm max-w-2xl">
                          <div className="whitespace-pre-wrap">
                            {expandedDescriptions[job.link]
                              ? job.description || '—'
                              : (job.description ? job.description.substring(0, 250) : '—')}
                          </div>
                          {job.description && job.description.length > 250 && (
                            <button className="mt-2 text-xs text-black underline" onClick={() => toggleDescription(job.link)}>
                              {expandedDescriptions[job.link] ? 'Einklappen' : 'Mehr anzeigen'}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-row gap-2 flex-wrap">
                            <Button onClick={() => handleJobSelect(job)} className="px-3 py-1 border border-black text-black bg-white">Übernehmen</Button>
                            <a href={job.link} target="_blank" rel="noreferrer" className="px-3 py-1 border border-black text-black bg-white inline-flex items-center">Link</a>
                            <Button onClick={() => handleAttachCompressed(job)} className="px-3 py-1 border border-black text-black bg-white">Marks Zeugnis Compressed</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile stacked cards */}
          <div className="block sm:hidden space-y-3">
            {jobs.map((job) => (
              <Card key={job.link} className="bg-white border border-black rounded-lg">
                <CardContent>
                  <div className="mb-2 font-semibold text-black">{job.title}</div>
                  <div className="text-sm text-black mb-2">{job.firma || '—'} • {job.arbeitsort || '—'}</div>
                  <div className="text-sm text-black whitespace-pre-wrap mb-2">
                    {expandedDescriptions[job.link] ? job.description : (job.description ? job.description.substring(0, 200) : '—')}
                  </div>
                  {job.description && job.description.length > 200 && (
                    <button className="text-xs text-black underline" onClick={() => toggleDescription(job.link)}>
                      {expandedDescriptions[job.link] ? 'Einklappen' : 'Mehr anzeigen'}
                    </button>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => handleJobSelect(job)} className="px-3 py-1 border border-black text-black bg-white">Übernehmen</Button>
                    <a href={job.link} target="_blank" rel="noreferrer" className="px-3 py-1 border border-black text-black bg-white inline-flex items-center">Link</a>
                    <Button onClick={() => handleAttachCompressed(job)} className="px-3 py-1 border border-black text-black bg-white">Marks Zeugnis Compressed</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

