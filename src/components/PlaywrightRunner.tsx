import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useRef } from "react";
import { AlertCircle, CheckCircle2, Loader2, Image as ImageIcon, ExternalLink } from "lucide-react";
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

  return (
    <div className="w-full space-y-6">
      {/* Scraper Control Card */}
      <Card className="w-full bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg border border-blue-300 rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-2xl text-blue-900">
            🔍 Jobs Scraper
          </CardTitle>
          <CardDescription className="text-blue-800">
            Lade alle 25 verfügbaren Jobs von der Arbeitsagentur-Website mit vollständigen Beschreibungen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Button */}
          <Button
            onClick={scrapeJobs}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg font-semibold shadow-lg transition-all rounded-lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                Scraping läuft... ({jobs.length}/25)
              </>
            ) : (
              <>
                <Loader2 className="mr-3 h-6 w-6" style={{ visibility: 'hidden' }} />
                ▶ Jobs laden
              </>
            )}
          </Button>

          {/* Large Spinner Section (Visible while loading) */}
          {loading && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 space-y-4">
              <div className="relative w-16 h-16">
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-blue-900">{message}</p>
                <p className="text-sm text-blue-700">Bitte warten, dies kann bis zu 2 Minuten dauern...</p>
              </div>
            </div>
          )}

          {/* Status Message */}
          {message && loading && jobs.length > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-900">{message}</p>
                <p className="text-sm text-blue-700">Gefundene Jobs: {jobs.length}/25</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-300">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900">Fehler</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Completion Message */}
          {!loading && message && jobs.length > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-300">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900">{message}</p>
                <p className="text-sm text-green-700">{jobs.length} Jobs erfolgreich geladen</p>
              </div>
            </div>
          )}

          {/* Progress Steps (collapsible) */}
          {progress.length > 0 && !loading && (
            <div className="bg-white border border-blue-200 p-4 rounded-lg max-h-64 overflow-y-auto">
              <p className="text-sm font-bold text-blue-900 mb-3">📋 Verarbeitungsschritte</p>
              <div className="space-y-2">
                {progress.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-blue-600 font-bold min-w-6">{item.step}.</span>
                    <div className="text-gray-800">{item.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Screenshots (collapsible) */}
          {screenshots.length > 0 && (
            <div className="bg-white border border-blue-200 p-4 rounded-lg">
              <p className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Screenshots ({screenshots.length})
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                {screenshots.map((screenshot, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedScreenshot(screenshot)}
                    className="border-2 border-blue-200 rounded-md overflow-hidden bg-gray-100 hover:border-blue-600 transition-all"
                    aria-label={`Screenshot ${index + 1}`}
                  >
                    <img src={screenshot} alt={`Screenshot ${index + 1}`} className="w-full h-20 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Screenshot Modal */}
          {selectedScreenshot && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setSelectedScreenshot(null)}>
              <div className="max-w-4xl w-full mx-2 sm:mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="bg-white p-3 rounded-lg">
                  <img src={selectedScreenshot} alt="Selected screenshot" className="w-full h-auto object-contain max-h-[80vh]" />
                  <div className="mt-3 text-right">
                    <Button onClick={() => setSelectedScreenshot(null)} variant="outline" className="bg-white text-black border-blue-300">
                      Schließen
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jobs Table - Only show after loading complete */}
      {!loading && jobs.length > 0 && (
        <div className="w-full space-y-4">
          {/* Summary Card */}
          <Card className="w-full bg-gradient-to-br from-green-50 to-green-100 border border-green-300 rounded-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-900">{jobs.length} Jobs gefunden</p>
                  <p className="text-sm text-green-700">Klicke "Übernehmen" um eine Stelle auszuwählen oder "Link" um mehr Details zu sehen</p>
                </div>
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </CardContent>
          </Card>

          {/* Desktop Table */}
          <div className="hidden sm:block">
            <Card className="w-full bg-white shadow-lg border border-gray-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-300">
                      <TableHead className="font-bold text-blue-900 text-left py-3 px-4">Jobtitel</TableHead>
                      <TableHead className="font-bold text-blue-900 text-left py-3 px-4">Firma</TableHead>
                      <TableHead className="font-bold text-blue-900 text-left py-3 px-4">Ort</TableHead>
                      <TableHead className="font-bold text-blue-900 text-left py-3 px-4">Beschreibung (Preview)</TableHead>
                      <TableHead className="font-bold text-blue-900 text-center py-3 px-4">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job, idx) => (
                      <TableRow key={job.link} className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <TableCell className="py-4 px-4 text-black font-semibold text-sm max-w-xs truncate">{job.title}</TableCell>
                        <TableCell className="py-4 px-4 text-gray-700 text-sm max-w-xs truncate">{job.firma || '—'}</TableCell>
                        <TableCell className="py-4 px-4 text-gray-700 text-sm whitespace-nowrap">{job.arbeitsort || '—'}</TableCell>
                        <TableCell className="py-4 px-4 text-gray-600 text-xs max-w-2xl">
                          <div className="line-clamp-2">
                            {job.description ? job.description.substring(0, 120) + (job.description.length > 120 ? '...' : '') : '—'}
                          </div>
                          {job.description && job.description.length > 250 && (
                            <button 
                              className="mt-1 text-xs text-blue-600 font-semibold hover:underline" 
                              onClick={() => toggleDescription(job.link)}
                            >
                              {expandedDescriptions[job.link] ? 'Einklappen' : 'Mehr'}
                            </button>
                          )}
                          {expandedDescriptions[job.link] && job.description && (
                            <div className="mt-2 p-2 bg-white border border-blue-200 rounded text-xs text-gray-800 max-h-48 overflow-y-auto">
                              {job.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-4 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button 
                              onClick={() => handleJobSelect(job)} 
                              className="px-3 py-1 h-8 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-md transition-all"
                            >
                              ✓ Übernehmen
                            </Button>
                            <a 
                              href={job.link} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="px-3 py-1 h-8 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1 transition-all"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Link
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="block sm:hidden space-y-3">
            {jobs.map((job, idx) => (
              <Card 
                key={job.link} 
                className="bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all"
              >
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {/* Title */}
                    <div>
                      <p className="font-bold text-base text-black line-clamp-2">{idx + 1}. {job.title}</p>
                    </div>

                    {/* Company & Location */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {job.firma && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">🏢 {job.firma}</span>
                      )}
                      {job.arbeitsort && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full font-semibold">📍 {job.arbeitsort}</span>
                      )}
                    </div>

                    {/* Description Preview */}
                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <p className="line-clamp-3">
                        {job.description ? job.description.substring(0, 200) + (job.description.length > 200 ? '...' : '') : '—'}
                      </p>
                      {job.description && job.description.length > 200 && (
                        <button 
                          className="mt-2 text-xs text-blue-600 font-semibold hover:underline" 
                          onClick={() => toggleDescription(job.link)}
                        >
                          {expandedDescriptions[job.link] ? '▲ Einklappen' : '▼ Mehr anzeigen'}
                        </button>
                      )}
                    </div>

                    {/* Full Description (if expanded) */}
                    {expandedDescriptions[job.link] && job.description && (
                      <div className="text-sm text-gray-800 bg-blue-50 p-3 rounded-lg border border-blue-200 max-h-48 overflow-y-auto">
                        {job.description}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button 
                        onClick={() => handleJobSelect(job)} 
                        className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all"
                      >
                        ✓ Übernehmen
                      </Button>
                      <a 
                        href={job.link} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg inline-flex items-center justify-center gap-2 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Link
                      </a>
                    </div>
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

