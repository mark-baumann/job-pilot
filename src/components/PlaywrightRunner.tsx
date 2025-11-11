import React, { useState } from "react";
import { Button } from "./ui/button";

export const PlaywrightRunner: React.FC = () => {
  const [status, setStatus] = useState("");
  const [screenshot, setScreenshot] = useState("");

  const runPlaywright = async () => {
    setStatus("Running Playwright script...");
    setScreenshot("");

    try {
      const response = await fetch("/api/run-playwright", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get reader from response body");
      }

      const decoder = new TextDecoder();
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value);

        const lines = result.split("\n");
        result = lines.pop() || ""; 

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.status) {
              setStatus(data.status);
            }
            if (data.screenshot) {
              setScreenshot(`data:image/png;base64,${data.screenshot}`);
            }
          } catch (e) {
            console.error("Failed to parse JSON:", line);
          }
        }
      }
    } catch (error) {
      console.error("Error running Playwright:", error);
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div>
      <Button onClick={runPlaywright}>Scrape Arbeitsagentur</Button>
      {status && <p>{status}</p>}
      {screenshot && <img src={screenshot} alt="Playwright Screenshot" />}
    </div>
  );
};

export default PlaywrightRunner;
