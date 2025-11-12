import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Trash2, ExternalLink, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface JobLink {
  id: number;
  url: string;
  title: string | null;
  active: boolean;
  created_at: string;
  last_used: string | null;
}

interface SourcesManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SourcesManager({ isOpen, onClose }: SourcesManagerProps) {
  const [links, setLinks] = useState<JobLink[]>([
    {
      id: 1,
      url: "https://www.arbeitsagentur.de/jobsuche/suche/detaillierte-benachrichtigung.html?was=entwickler&wo=",
      title: null,
      active: true,
      created_at: new Date().toISOString(),
      last_used: null
    }
  ]);
  const [newUrl, setNewUrl] = useState("");

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      const response = await fetch('/api/job-links');
      if (response.ok) {
        const data = await response.json();
        setLinks(data.links || []);
      }
    } catch (error) {
      console.error('Failed to load links:', error);
    }
  };

  const addLink = async () => {
    if (!newUrl.trim()) return;

    try {
      const response = await fetch('/api/job-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim(), title: null }),
      });

      if (response.ok) {
        setNewUrl("");
        loadLinks();
        toast({ title: "Link hinzugefügt", description: "Die Quelle wurde erfolgreich hinzugefügt." });
      } else {
        const error = await response.json();
        toast({ title: "Fehler", description: error.error || "Link konnte nicht hinzugefügt werden.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Fehler", description: "Verbindung zum Server fehlgeschlagen", variant: "destructive" });
    }
  };

  const toggleLink = async (id: number, active: boolean) => {
    try {
      const response = await fetch('/api/job-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active }),
      });

      if (response.ok) {
        loadLinks();
        toast({ title: "Status geändert", description: `Die Quelle wurde ${active ? 'aktiviert' : 'deaktiviert'}.` });
      }
    } catch (error) {
      toast({ title: "Fehler", description: "Status konnte nicht geändert werden", variant: "destructive" });
    }
  };

  const deleteLink = async (id: number) => {
    try {
      const response = await fetch('/api/job-links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        loadLinks();
        toast({ title: "Link gelöscht", description: "Die Quelle wurde erfolgreich entfernt." });
      }
    } catch (error) {
      toast({ title: "Fehler", description: "Link konnte nicht gelöscht werden", variant: "destructive" });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-primary" />
            Quellen-Verwaltung
          </SheetTitle>
          <SheetDescription>
            Verwalten Sie Ihre Job-Quellen für den automatischen Cron Job
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* Add new link */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Neue Quelle hinzufügen</h3>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                placeholder="https://www.arbeitsagentur.de/jobsuche..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="bg-white border-primary/30"
              />
            </div>
            <Button onClick={addLink} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Quelle hinzufügen
            </Button>
          </div>

          {/* Links list */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Aktuelle Links</h3>
            <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
              <strong>Automatischer Cron Job:</strong> Die Datenbank wird jede Stunde automatisch mit zufällig ausgewählten aktiven Quellen gefüllt.
            </div>
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Quellen konfiguriert</p>
            ) : (
              links.map((link) => (
                <div key={link.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleLink(link.id, !link.active)}
                    className="shrink-0"
                  >
                    {link.active ? (
                      <ToggleRight className="w-5 h-5 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                    )}
                  </Button>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {link.title || link.url}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {link.url}
                    </div>
                    {link.last_used && (
                      <div className="text-xs text-muted-foreground">
                        Zuletzt verwendet: {new Date(link.last_used).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={link.active ? "default" : "secondary"}>
                      {link.active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteLink(link.id)}
                      className="shrink-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
