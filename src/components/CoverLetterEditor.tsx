import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Save, Download, FileText, Loader2 } from "lucide-react";

interface CoverLetterEditorProps {
  initialText: string;
  onTextChange: (newText: string) => void;
  onDownloadDocx: () => void;
  onDownloadPdf: () => void;
  isPdfLoading: boolean;
  emailTo: string;
  onEmailToChange: (val: string) => void;
  emailSubject: string;
  onEmailSubjectChange: (val: string) => void;
  emailBody: string;
  onEmailBodyChange: (val: string) => void;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  fromEmail: string;
  onSmtpFieldChange: (field: string, value: string | number | boolean) => void;
  sendDocx: boolean;
  sendPdf: boolean;
  onSendOptionChange: (field: "docx" | "pdf", value: boolean) => void;
  onSendEmail: () => void;
  isEmailSending: boolean;
  onReset: () => void;
}

export default function CoverLetterEditor({
  initialText,
  onTextChange,
  onDownloadDocx,
  onDownloadPdf,
  isPdfLoading,
  emailTo,
  onEmailToChange,
  emailSubject,
  onEmailSubjectChange,
  emailBody,
  onEmailBodyChange,
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPass,
  smtpSecure,
  fromEmail,
  onSmtpFieldChange,
  sendDocx,
  sendPdf,
  onSendOptionChange,
  onSendEmail,
  isEmailSending,
  onReset,
}: CoverLetterEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(initialText);
  const [showSmtp, setShowSmtp] = useState(false);
  const { toast } = useToast();
  const [isSmtpVerifying, setIsSmtpVerifying] = useState(false);
  // Keep editor buffer in sync when not editing
  useEffect(() => {
    if (!isEditing) setEditedText(initialText);
  }, [initialText, isEditing]);

  const handleSave = () => {
    onTextChange(editedText);
    setIsEditing(false);
    toast({ title: "Änderungen gespeichert", description: "Das Anschreiben wurde aktualisiert." });
  };

  const handleCancel = () => {
    setEditedText(initialText);
    setIsEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editedText : initialText);
    toast({ title: "Kopiert", description: "Anschreiben wurde in die Zwischenablage kopiert." });
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
                  <Save className="w-4 h-4 mr-1" /> Speichern
                </Button>
                <Button onClick={handleCancel} variant="outline" size="sm">
                  Abbrechen
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                <Edit3 className="w-4 h-4 mr-1" /> Bearbeiten
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
            <pre className="whitespace-pre-wrap text-sm font-mono text-black">{initialText}</pre>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Button onClick={handleCopy} variant="outline" className="flex-1 text-black bg-white border border-blue-200">
            <FileText className="w-4 h-4 mr-1" /> In Zwischenablage kopieren
          </Button>
          <Button onClick={onDownloadDocx} variant="outline" className="flex-1 text-black bg-white border border-blue-200">
            <Download className="w-4 h-4 mr-1" /> DOCX herunterladen
          </Button>
          <Button onClick={onDownloadPdf} disabled={isPdfLoading} className="flex-1 text-black bg-white border border-blue-200">
            {isPdfLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> PDF wird erstellt...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" /> PDF herunterladen
              </>
            )}
          </Button>
        </div>

        <Separator className="my-4" />

        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="email-to">E-Mail an</Label>
              <Input
                id="email-to"
                placeholder="bewerbung@firma.de"
                value={emailTo}
                onChange={(e) => onEmailToChange(e.target.value)}
                className="bg-white border-blue-200"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox id="send-docx" checked={sendDocx} onCheckedChange={(v) => onSendOptionChange("docx", Boolean(v))} />
                <Label htmlFor="send-docx">DOCX anhängen</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="send-pdf" checked={sendPdf} onCheckedChange={(v) => onSendOptionChange("pdf", Boolean(v))} />
                <Label htmlFor="send-pdf">PDF anhängen</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-2">
            <Label htmlFor="email-subject">Betreff</Label>
            <Input
              id="email-subject"
              placeholder="Bewerbung als ..."
              value={emailSubject}
              onChange={(e) => onEmailSubjectChange(e.target.value)}
              className="bg-white text-black placeholder:text-gray-500 border-blue-200"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-body">E-Mail Text</Label>
            <Textarea
              id="email-body"
              placeholder="Ihre Nachricht ..."
              value={emailBody}
              onChange={(e) => onEmailBodyChange(e.target.value)}
              className="min-h-[120px] bg-white text-black placeholder:text-gray-500 border-blue-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="show-smtp" checked={showSmtp} onCheckedChange={setShowSmtp} />
            <Label htmlFor="show-smtp">Eigene SMTP-Einstellungen</Label>
            {showSmtp && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSmtpVerifying}
                onClick={async () => {
                  try {
                    setIsSmtpVerifying(true);
                    const resp = await fetch("/api/verify-smtp", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        smtp: {
                          host: smtpHost,
                          port: smtpPort,
                          secure: smtpSecure,
                          user: smtpUser,
                          pass: smtpPass,
                        },
                      }),
                    });
                    const data = await resp.json();
                    if (!resp.ok || !data.ok) throw new Error(data.error || "SMTP-Überprüfung fehlgeschlagen");
                    toast({ title: "SMTP erfolgreich", description: "Login & TLS ok." });
                  } catch (e) {
                    toast({ title: "SMTP fehlgeschlagen", description: String(e), variant: "destructive" });
                  } finally {
                    setIsSmtpVerifying(false);
                  }
                }}
                className="ml-2 bg-white text-black border border-blue-200 hover:bg-blue-50 hover:text-black"
              >
                {isSmtpVerifying ? "Teste..." : "SMTP testen"}
              </Button>
            )}
          </div>

          {showSmtp && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="from-email">Absender (From)</Label>
                <Input id="from-email" placeholder="ich@meine-domain.de" value={fromEmail} onChange={(e) => onSmtpFieldChange("fromEmail", e.target.value)} className="bg-white text-black border-primary/30 focus:border-primary/60" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="smtp-host">SMTP Host</Label>
                <Input id="smtp-host" placeholder="smtp.meine-domain.de" value={smtpHost} onChange={(e) => onSmtpFieldChange("host", e.target.value)} className="bg-white text-black border-primary/30 focus:border-primary/60" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="smtp-port">SMTP Port</Label>
                <Input id="smtp-port" type="number" placeholder="587" value={smtpPort} onChange={(e) => onSmtpFieldChange("port", Number(e.target.value))} className="bg-white text-black border-primary/30 focus:border-primary/60" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="smtp-secure">TLS/SSL (secure)</Label>
                <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-white text-black border-blue-200">
                  <Switch id="smtp-secure" checked={smtpSecure} onCheckedChange={(v) => onSmtpFieldChange("secure", Boolean(v))} />
                  <span className="text-sm">465 = an, 587 = aus</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="smtp-user">SMTP Benutzer</Label>
                <Input id="smtp-user" value={smtpUser} onChange={(e) => onSmtpFieldChange("user", e.target.value)} className="bg-white text-black border-primary/30 focus:border-primary/60" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="smtp-pass">SMTP Passwort</Label>
                <Input id="smtp-pass" type="password" value={smtpPass} onChange={(e) => onSmtpFieldChange("pass", e.target.value)} className="bg-white text-black border-primary/30 focus:border-primary/60" />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={onSendEmail} disabled={isEmailSending || !emailTo} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isEmailSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Senden...
                </>
              ) : (
                "E-Mail senden"
              )}
            </Button>
          </div>
          <div className="flex justify-end mt-3">
            <Button onClick={onReset} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
              Neue Bewerbung
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
