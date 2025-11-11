import React, { useState, useRef } from "react";
import { Button } from "./ui/button";

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
          const payload = JSON.parse(ev.data);
          // payload has type, message, data, image, etc.
          if (payload.type === "step" && payload.message) {
            setStatus(String(payload.message));
          }
          if (payload.type === "screenshot" && payload.image) {
            // The API already sends data:image/png;base64,...
            setScreenshot(String(payload.image).startsWith("data:") ? String(payload.image) : `data:image/png;base64,${payload.image}`);
          }
          if (payload.type === "data" && payload.data) {
            // For now, show job title when a job is received
            if (payload.data.title) {
              setStatus(`Found: ${payload.data.title}`);
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

      es.onerror = (ev) => {
        console.error("SSE error", ev);
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

  const stopSSE = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsRunning(false);
    setStatus("Stopped");
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <Button onClick={startSSE} disabled={isRunning}>
          {isRunning ? "Running..." : "Scrape Arbeitsagentur"}
        </Button>
        <Button variant="ghost" onClick={stopSSE} disabled={!isRunning}>
          Stop
        </Button>
      </div>
      {status && <p className="mt-2 text-sm">{status}</p>}
      {screenshot && <img className="mt-2 max-w-full rounded-md border" src={screenshot} alt="Playwright Screenshot" />}
    </div>
  );
};

export default PlaywrightRunner;
