import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X, RefreshCw, Clock, CheckCircle, AlertCircle, Loader } from "lucide-react";

interface ActivityLogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CronLog {
  id: string;
  createdAt: string;
  status: "SUCCESS" | "ERROR" | "TIMEOUT" | "PROCESSING";
  duration: number;
  message?: string;
  details?: any;
}

export default function ActivityLog({ isOpen, onClose }: ActivityLogProps) {
  const [logs, setLogs] = useState<CronLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/activity-logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'ERROR':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'TIMEOUT':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'PROCESSING':
        return <Loader className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <Loader className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'SUCCESS': 'default',
      'ERROR': 'destructive',
      'TIMEOUT': 'secondary',
      'PROCESSING': 'secondary'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Aktivitätsprotokoll
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadLogs}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Aktualisieren
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 animate-spin mr-2" />
              <span>Logs werden geladen...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Keine Aktivitätsprotokolle gefunden</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {logs.map((log) => (
                  <Card key={log.id} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(log.status)}
                          <div>
                            <div className="font-medium">Cron Job Ausführung</div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(log.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(log.status)}
                          <Badge variant="outline">
                            {formatDuration(log.duration)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {log.message && (
                        <div className="mb-3">
                          <div className="text-sm font-medium mb-1">Nachricht:</div>
                          <div className="text-sm bg-muted p-2 rounded">
                            {log.message}
                          </div>
                        </div>
                      )}
                      
                      {log.details && (
                        <div>
                          <div className="text-sm font-medium mb-1">Details:</div>
                          <div className="text-sm bg-muted p-2 rounded font-mono text-xs">
                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                          </div>
                        </div>
                      )}
                      
                      {log.screenshot && (
                        <div>
                          <div className="text-sm font-medium mb-2">Screenshot:</div>
                          <div className="border rounded-lg overflow-hidden">
                            <img 
                              src={log.screenshot} 
                              alt="Cron Job Screenshot" 
                              className="w-full h-auto"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
