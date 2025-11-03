import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Save, Download, FileText, Loader2, Cloud } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CoverLetterEditorProps {
  initialText: string;
  onTextChange: (newText: string) => void;
  onDownloadDocx: () => void;
  onDownloadPdf: () => void;
  isPdfLoading: boolean; // <-- Prop ergänzen
}

export default function CoverLetterEditor({
  initialText,
  onTextChange,
  onDownloadDocx,
  onDownloadPdf,
  isPdfLoading
}: CoverLetterEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(initialText);
  const { toast } = useToast();

  const handleSave = () => {
    onTextChange(editedText);
    setIsEditing(false);
    toast({
      title: "Änderungen gespeichert",
      description: "Das Anschreiben wurde aktualisiert."
    });
  };

  const handleCancel = () => {
    setEditedText(initialText);
    setIsEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editedText : initialText);
    toast({
      title: "Kopiert",
      description: "Anschreiben wurde in die Zwischenablage kopiert."
    });
  };

  return (
    <Card className="w-full bg-white shadow-lg border border-blue-200 rounded-2xl text-black">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Generiertes Anschreiben</span>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button onClick={handleSave} size="sm" className="bg-green-600 hover:bg-green-700">
                  <Save className="w-4 h-4 mr-1" />
                  Speichern
                </Button>
                <Button onClick={handleCancel} variant="outline" size="sm">
                  Abbrechen
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                <Edit3 className="w-4 h-4 mr-1" />
                Bearbeiten
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="min-h-[400px] bg-white border-primary/30 focus:border-primary/60 transition-colors resize-none font-mono text-sm"
            placeholder="Bearbeiten Sie hier Ihr Anschreiben..."
          />
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 border border-blue-100">
            <pre className="whitespace-pre-wrap text-sm font-mono text-black">
              {initialText}
            </pre>
          </div>
        )}
        
        <div className="flex gap-2 mt-4">
          <Button
            onClick={handleCopy}
            variant="outline"
            className="flex-1 text-black bg-white border border-blue-200"
          >
            <FileText className="w-4 h-4 mr-1" />
            In Zwischenablage kopieren
          </Button>
          <Button
            onClick={onDownloadDocx}
            variant="outline"
            className="flex-1 text-black bg-white border border-blue-200"
          >
            <Download className="w-4 h-4 mr-1" />
            DOCX herunterladen
          </Button>
          <Button
            onClick={onDownloadPdf}
            disabled={isPdfLoading}
            className="flex-1 text-black bg-white border border-blue-200"
          >
            {isPdfLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                PDF wird erstellt...
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 mr-2" />
                PDF herunterladen
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
