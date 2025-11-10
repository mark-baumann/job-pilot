import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ExternalLink, Check } from "lucide-react";
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
  type: "step" | "data" | "error" | "complete";
  step?: number;
  message?: string;
  data?: Job;
  error?: string;
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

  const scrapeJobs = async () => {
    setLoading(true);
    setJobs([]);
    setMessage("🔍 Starte Scraping...");
    setProgress([]);
    setError(null);

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
              setJobs((prev) => [...prev, scraperEvent.data!]);
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
      <Card className="w-full bg-white shadow-lg border border-blue-200 rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            🔍 Jobs Scraper
          </CardTitle>
          <CardDescription>
            Scrape Jobs von der Arbeitsagentur-Website
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Button */}
          <Button
            onClick={scrapeJobs}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Scraping läuft...
              </>
            ) : (
              "▶ Scrape Jobs"
            )}
          </Button>

          {/* Status Message */}
          {message && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                error
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-blue-50 border border-blue-200 text-blue-700"
              }`}
            >
              {error ? (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="text-sm">{message}</span>
            </div>
          )}

          {/* Progress Steps */}
          {progress.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm font-semibold text-gray-700">Fortschritt:</p>
              {progress.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">
                    <span className="font-semibold">Schritt {item.step}:</span>{" "}
                    {item.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jobs Table */}
      {jobs.length > 0 && (
        <Card className="w-full bg-white shadow-lg border border-green-200 rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              📋 Gefundene Jobs ({jobs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-blue-200">
                    <TableHead className="font-bold text-gray-800 max-w-xs">
                      Jobtitel
                    </TableHead>
                    <TableHead className="font-bold text-gray-800">
                      Firma
                    </TableHead>
                    <TableHead className="font-bold text-gray-800">
                      Ort
                    </TableHead>
                    <TableHead className="font-bold text-gray-800">
                      Beschreibung
                    </TableHead>
                    <TableHead className="font-bold text-gray-800">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job, index) => (
                    <TableRow
                      key={index}
                      className="hover:bg-blue-50 transition-colors"
                    >
                      <TableCell className="font-semibold text-gray-800 max-w-xs">
                        {job.title}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm max-w-xs truncate">
                        {job.firma || "-"}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm max-w-xs truncate">
                        {job.arbeitsort || "-"}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm max-w-lg truncate">
                        {job.description
                          ? job.description.substring(0, 100) + "..."
                          : "-"}
                      </TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          onClick={() => handleJobSelect(job)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-md text-sm font-medium transition-colors"
                        >
                          <Check className="h-4 w-4" />
                          Übernehmen
                        </Button>
                        <a
                          href={job.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md text-sm font-medium transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Link
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Jobs Message */}
      {!loading && jobs.length === 0 && !error && (
        <Card className="w-full bg-gray-50 border border-gray-200 rounded-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 text-lg">
              Klicke auf "Scrape Jobs" um Jobs zu laden
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

