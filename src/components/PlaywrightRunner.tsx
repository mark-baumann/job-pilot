import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Loader2, ExternalLink, Check, Image as ImageIcon } from "lucide-react";
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

    try {
      const eventSource = new EventSource("/api/scrape-arbeitsagentur");

      eventSource.onmessage = (event) => {
        const scraperEvent: ScraperEvent = JSON.parse(event.data);

        switch (scraperEvent.type) {
          case "step":
            if (scraperEvent.step && scraperEvent.message) {
              setProgress((prev) => [...prev, scraperEvent]);
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
              setScreenshots((prev) => [...prev, scraperEvent.image!]);
            }
            break;

          case "complete":
            setMessage("✅ Scraping erfolgreich abgeschlossen!");
            eventSource.close();
            setLoading(false);
            break;

          case "error":
            setError(scraperEvent.error || "Ein Fehler ist aufgetreten");
            setMessage(`❌ Fehler: ${scraperEvent.error}`);
            eventSource.close();
            setLoading(false);
            break;
        }
      };

      eventSource.onerror = () => {
        setError("Verbindung zum Server unterbrochen");
        eventSource.close();
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

  return (
    <div className="w-full space-y-4">
      <Card className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 shadow-xl border border-blue-300 rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-blue-900">
            🔍 Jobs Scraper
          </CardTitle>
          <CardDescription className="text-blue-700">
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
                  : "bg-green-100 border border-green-400 text-green-800"
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
            <div className="bg-white border border-blue-200 p-4 rounded-lg space-y-2">
              <p className="text-sm font-bold text-blue-900">Fortschritt:</p>
              {progress.map((item, index) => (
                <div key={index} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">
                    <span className="font-semibold text-blue-800">Schritt {item.step}:</span>{" "}
                    {item.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Screenshots */}
          {screenshots.length > 0 && (
            <div className="bg-white border border-green-200 p-4 rounded-lg">
              <p className="text-sm font-bold text-green-900 mb-3 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Screenshots ({screenshots.length})
              </p>
              <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {screenshots.map((screenshot, index) => (
                  <div key={index} className="border border-gray-300 rounded-lg overflow-hidden">
                    <img
                      src={screenshot}
                      alt={`Screenshot ${index + 1}`}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jobs Table */}
      {jobs.length > 0 && (
        <Card className="w-full bg-gradient-to-br from-green-50 to-emerald-50 shadow-xl border border-green-300 rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-green-900">
              📋 Gefundene Jobs ({jobs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-green-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-green-200 hover:bg-green-200">
                    <TableHead className="font-bold text-green-900 w-48">
                      Jobtitel
                    </TableHead>
                    <TableHead className="font-bold text-green-900 w-40">
                      Firma
                    </TableHead>
                    <TableHead className="font-bold text-green-900 w-36">
                      Ort
                    </TableHead>
                    <TableHead className="font-bold text-green-900 w-80">
                      Beschreibung
                    </TableHead>
                    <TableHead className="font-bold text-green-900 w-32">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job, index) => (
                    <TableRow
                      key={index}
                      className="hover:bg-green-100 transition-colors border-b border-green-200 align-top"
                    >
                      <TableCell className="font-semibold text-gray-900 py-4">
                        {job.title}
                      </TableCell>
                      <TableCell className="text-gray-700 py-4">
                        {job.firma || "—"}
                      </TableCell>
                      <TableCell className="text-gray-700 py-4">
                        {job.arbeitsort || "—"}
                      </TableCell>
                      <TableCell className="text-gray-700 text-sm py-4 whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {job.description
                          ? job.description.substring(0, 600)
                          : "—"}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => handleJobSelect(job)}
                            className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-semibold transition-colors shadow-md"
                          >
                            <Check className="h-4 w-4" />
                            Übernehmen
                          </Button>
                          <a
                            href={job.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-semibold transition-colors shadow-md"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Link
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

