import { Button } from "@/components/ui/button";
import { useState } from "react";

export function PlaywrightRunner() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [screenshot, setScreenshot] = useState("");

  const runTest = async () => {
    setLoading(true);
    setResult("");
    setScreenshot("");
    try {
      const response = await fetch("/api/run-playwright");
      const data = await response.json();
      setResult(data.message);
      if (data.screenshot) {
        setScreenshot(data.screenshot);
      }
    } catch (error) {
      setResult("An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <Button onClick={runTest} disabled={loading}>
        {loading ? "Running..." : "Run Playwright Test"}
      </Button>
      {result && (
        <pre className="mt-4 bg-gray-100 p-4 rounded-md">{result}</pre>
      )}
      {screenshot && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Screenshot</h3>
          <img
            src={screenshot}
            alt="Playwright test screenshot"
            className="mt-2 border border-gray-300 rounded-md"
          />
        </div>
      )}
    </div>
  );
}

