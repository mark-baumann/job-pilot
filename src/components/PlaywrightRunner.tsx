import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

interface Job {
  title: string;
  link: string;
}

export function PlaywrightRunner() {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");

  const runTest = async () => {
    setLoading(true);
    setJobs([]);
    setMessage("");
    try {
      const response = await fetch("/api/run-playwright");
      const data = await response.json();
      if (response.ok) {
        setJobs(data.jobs || []);
        setMessage(data.message || "Jobs loaded successfully.");
      } else {
        setMessage(data.message || "An error occurred.");
      }
    } catch (error) {
      setMessage("An error occurred while fetching the jobs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <Button onClick={runTest} disabled={loading}>
        {loading ? "Searching for Jobs..." : "Find Jobs via Playwright"}
      </Button>
      {message && !loading && (
        <p className="mt-4 text-sm text-gray-600">{message}</p>
      )}
      {jobs.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job, index) => (
            <a
              href={job.link}
              key={index}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">{job.title}</CardTitle>
                </CardHeader>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

