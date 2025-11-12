import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, MapPin, Building, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Job {
  title: string;
  description: string;
  link: string;
  firma: string;
  arbeitsort: string;
}

interface JobListProps {
  onJobSelect: (job: Job) => void;
}

export default function JobList({ onJobSelect }: JobListProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/get-jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
      toast({ title: "Fehler", description: "Jobs konnten nicht geladen werden", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full bg-white shadow-xl border border-blue-200 rounded-2xl text-black">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Job-Liste
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadJobs}
            disabled={isLoading}
          >
            {isLoading ? "Laden..." : "Aktualisieren"}
          </Button>
        </CardTitle>
        <CardDescription>
          Aktuelle Stellen aus der Datenbank (automatisch via Cron Job gefüllt)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Jobs werden geladen...
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Keine Jobs gefunden</p>
            <p className="text-sm">Fügen Sie Quellen hinzu und warten Sie auf den nächsten Cron Job</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {jobs.map((job, index) => (
              <div 
                key={index} 
                className="p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => onJobSelect(job)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base mb-2 line-clamp-2">
                      {job.title}
                    </h3>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {job.firma && (
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          <span>{job.firma}</span>
                        </div>
                      )}
                      {job.arbeitsort && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{job.arbeitsort}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="shrink-0">
                      Auswählen
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(job.link, '_blank');
                      }}
                      className="shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {job.description && (
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
                    {job.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
