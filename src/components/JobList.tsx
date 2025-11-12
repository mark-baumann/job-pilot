import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, MapPin, Building, ExternalLink, Settings, History } from "lucide-react";
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
  onSourcesClick: () => void;
  onActivityLogClick: () => void;
}

export default function JobList({ onJobSelect, onSourcesClick, onActivityLogClick }: JobListProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        <CardTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Job-Liste</h3>
              {!isLoading && (
                <Badge variant="secondary" className="ml-2">
                  {jobs.length} Treffer
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onActivityLogClick}
                className="text-white hover:text-white border-white hover:bg-white hover:text-primary mr-2"
              >
                <History className="w-4 h-4 mr-2" />
                Aktivitätsprotokoll
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onSourcesClick}
                className="text-white hover:text-white border-white hover:bg-white hover:text-primary"
              >
                <Settings className="w-4 h-4 mr-2" />
                Quellen verwalten
              </Button>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Jobs werden geladen...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground px-6">
              <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Keine Jobs gefunden</h3>
              <p className="text-sm mb-4">Fügen Sie Quellen hinzu und warten Sie auf den nächsten Cron Job</p>
              <Button onClick={onSourcesClick} variant="outline" className="text-white hover:text-white border-white hover:bg-white hover:text-primary">
                <Settings className="w-4 h-4 mr-2" />
                Quellen konfigurieren
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {jobs.map((job, index) => (
                <div 
                  key={index} 
                  className="p-6 hover:bg-blue-50 cursor-pointer transition-colors group"
                  onClick={() => onJobSelect(job)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-3 text-gray-900 group-hover:text-blue-600 transition-colors">
                        {job.title}
                      </h3>
                      <div className="space-y-2 text-sm text-gray-600 mb-3">
                        {job.firma && (
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{job.firma}</span>
                          </div>
                        )}
                        {job.arbeitsort && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>{job.arbeitsort}</span>
                          </div>
                        )}
                      </div>
                      {job.description && (
                        <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
                          {job.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-3">
                      <Badge variant="secondary" className="shrink-0 px-3 py-1">
                        Auswählen
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(job.link, '_blank');
                        }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
