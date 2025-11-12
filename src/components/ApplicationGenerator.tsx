import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Key,
  FileText,
  Upload,
  Sparkles,
  Brain,
  ExternalLink,
  Eye,
  EyeOff,
  CheckCircle
} from "lucide-react";
import { saveAs } from "file-saver";

// Services
import { OpenAIService } from "../services/openaiService";
import { CloudConvertService } from "../services/cloudConvertService";
import { ResumeAnalysisService } from "../services/resumeAnalysisService";

// Components
import CoverLetterEditor from "./CoverLetterEditor";
import SourcesManager from "./SourcesManager";
import JobList from "./JobList";



interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  details?: string;
}

interface AnalysisResult {
  requirements: string[];
  matchedSkills: string[];
  suggestedChanges: string[];
  finalApplication: string;
}

export default function ApplicationGenerator() {
  // API Configuration
  const [apiKey, setApiKey] = useState("");
  const [openaiApiKeys, setOpenaiApiKeys] = useState<{id: string, key_value: string}[]>([]);
  const [selectedOpenaiKeyIndex, setSelectedOpenaiKeyIndex] = useState<number>(-1);
  const [showSelectedOpenaiKey, setShowSelectedOpenaiKey] = useState(false);
  const [newOpenaiKey, setNewOpenaiKey] = useState("");
  const [appPassword, setAppPassword] = useState(""); // This is the app password for backend auth and now UI unlock
  const [showAppPassword, setShowAppPassword] = useState(false); // This is for the app password input visibility
  const [isAppPasswordUnlocked, setIsAppPasswordUnlocked] = useState(false); // New state for UI unlock
  
  const [cloudConvertApiKey, setCloudConvertApiKey] = useState("");
  const [cloudConvertApiKeys, setCloudConvertApiKeys] = useState<{id: string, key_value: string}[]>([]);
  const [selectedCloudConvertKeyIndex, setSelectedCloudConvertKeyIndex] = useState<number>(-1);
  const [showSelectedCloudConvertKey, setShowSelectedCloudConvertKey] = useState(false);
  const [newCloudConvertKey, setNewCloudConvertKey] = useState("");
  
  const [selectedModel, setSelectedModel] = useState("gpt-4.1-2025-04-14");
  const [showSourcesManager, setShowSourcesManager] = useState(false);

  // Form Data
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [firmaInput, setFirmaInput] = useState("");
  const [adresseInput, setAdresseInput] = useState("");
  const [titleInput, setTitleInput] = useState("");

  // Handle job selection from JobList
  const handleJobSelect = (job: any) => {
    setTitleInput(job.title || "");
    setFirmaInput(job.firma || "");
    setAdresseInput(job.arbeitsort || "");
    setJobDescription(job.description || "");
    
    // Save to localStorage
    localStorage.setItem("title", job.title || "");
    localStorage.setItem("firma", job.firma || "");
    localStorage.setItem("adresse", job.arbeitsort || "");
    localStorage.setItem("job-description", job.description || "");
  };

  // Load persisted form inputs and check for saved password
  useEffect(() => {
    try {
      const jd = localStorage.getItem("job-description");
      const f = localStorage.getItem("firma");
      const a = localStorage.getItem("adresse");
      const t = localStorage.getItem("title");
      const cl = localStorage.getItem("cover-letter");
      if (jd) setJobDescription(jd);
      if (f) setFirmaInput(f);
      if (a) setAdresseInput(a);
      if (t) setTitleInput(t);
      if (cl) setCurrentCoverLetter(cl);
      
      // Check for saved password in cookie
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
          return parts.pop()?.split(';').shift();
        }
        return null;
      };
      
      const savedPassword = getCookie('app-password');
      if (savedPassword) {
        setAppPassword(savedPassword);
        // Auto-unlock with a small delay to ensure state is set
        setTimeout(() => {
          validateSavedPassword(savedPassword);
        }, 100);
      }
    } catch {}
  }, []);

  // Separate function for validating saved password
  const validateSavedPassword = async (password: string) => {
    try {
      const response = await fetch('/api/verify-app-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      
      if (response.ok) {
        const { valid } = await response.json();
        if (valid) {
          setIsAppPasswordUnlocked(true);
          loadOpenaiKeys();
          loadCloudConvertKeys();
        }
      }
    } catch (error) {
      console.log('Auto-unlock failed, user will need to unlock manually');
    }
  };

  // ... (rest of the component)
  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  // Editable Cover Letter
  const [currentCoverLetter, setCurrentCoverLetter] = useState("");

  const { toast } = useToast();

  const gptModels = [
    { value: "gpt-4.1-2025-04-14", label: "GPT-4.1 (Empfohlen)", description: "Neuestes und leistungsstärkstes Modell" },
    { value: "o4-mini-2025-04-16", label: "O4 Mini", description: "Schnelles Reasoning-Modell" },
    { value: "o3-2025-04-16", label: "O3", description: "Mächtiges Reasoning-Modell" },
    { value: "gpt-4o", label: "GPT-4o", description: "Vorheriges Flagship-Modell" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", description: "Günstigeres Modell" }
  ];

  const loadOpenaiKeys = async () => {
    try {
      if (!isAppPasswordUnlocked || !appPassword) { // Only load if unlocked and password is set
        return;
      }
      if (!appPassword) {
        return;
      }
      const response = await fetch('/api/openai', {
        headers: {
          'X-App-Password': appPassword
        }
      });
      if (!response.ok) throw new Error('Failed to fetch OpenAI keys');
      const data = await response.json();
      const keys = data.keys || [];
      setOpenaiApiKeys(keys);

      if (keys.length > 0) {
        const idxStr = localStorage.getItem("openai-api-key-selected-index");
        const idx = idxStr ? parseInt(idxStr, 10) : 0;
        const safeIdx = isNaN(idx) ? 0 : Math.min(Math.max(idx, 0), keys.length - 1);
        setSelectedOpenaiKeyIndex(safeIdx);
        setApiKey(keys[safeIdx]?.key_value || "");
      } else {
        setSelectedOpenaiKeyIndex(-1);
        setApiKey("");
      }
    } catch (error) {
      console.error("Failed to load OpenAI keys:", error);
      toast({
        title: "Fehler beim Laden der OpenAI-Schlüssel",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const loadCloudConvertKeys = async () => {
    if (!isAppPasswordUnlocked) { // Only load if unlocked
      return;
    }
    try {
      const response = await fetch('/api/cloudconvert');
      if (!response.ok) throw new Error('Failed to fetch keys');
      const data = await response.json();
      const keys = data.keys || [];
      setCloudConvertApiKeys(keys);

      if (keys.length > 0) {
        const idxStr = localStorage.getItem("cloudconvert-api-key-selected-index");
        const idx = idxStr ? parseInt(idxStr, 10) : 0;
        const safeIdx = isNaN(idx) ? 0 : Math.min(Math.max(idx, 0), keys.length - 1);
        setSelectedCloudConvertKeyIndex(safeIdx);
        setCloudConvertApiKey(keys[safeIdx]?.key_value || "");
      } else {
        setSelectedCloudConvertKeyIndex(-1);
        setCloudConvertApiKey("");
      }
    } catch (error) {
      console.error("Failed to load CloudConvert keys:", error);
      toast({
        title: "Fehler beim Laden der CloudConvert-Schlüssel",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  // Load saved settings
  useEffect(() => {
    const savedAppPassword = localStorage.getItem("app-password");
    if (savedAppPassword) setAppPassword(savedAppPassword);
    
    const savedApiKey = localStorage.getItem("openai-api-key");
    const savedModel = localStorage.getItem("openai-model");
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedModel) setSelectedModel(savedModel);

    loadCloudConvertKeys();
    // Do NOT automatically unlock here. User must explicitly unlock.
  }, []);

  // Load OpenAI keys when app password changes
  useEffect(() => {
    if (isAppPasswordUnlocked && appPassword) { // Only load if unlocked
      loadOpenaiKeys();
      loadCloudConvertKeys(); // Load CloudConvert keys here too
    }
  }, [appPassword, isAppPasswordUnlocked]);

  const handleUnlockAppPassword = async () => {
    try {
      const response = await fetch('/api/verify-app-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: appPassword }),
      });
      
      if (!response.ok) {
        toast({ title: "Konfigurationsfehler", description: "Server nicht erreichbar", variant: "destructive" });
        return;
      }
      
      const { valid } = await response.json();
      
      if (valid) {
        setIsAppPasswordUnlocked(true);
        
        // Save password in cookie permanently (expires in 1 year for browser compatibility)
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);
        document.cookie = `app-password=${appPassword}; expires=${expires.toUTCString()}; path=/; secure; samesite=strict`;
        
        toast({ title: "Zugriff gewährt", description: "API-Schlüssel-Bereich entsperrt." });
        loadOpenaiKeys(); // Load keys after successful unlock
        loadCloudConvertKeys();
      } else {
        toast({ title: "Falsches Passwort", description: "Das eingegebene App-Passwort ist nicht korrekt.", variant: "destructive" });
        setIsAppPasswordUnlocked(false);
      }
    } catch (error) {
      toast({ title: "Fehler", description: "Verbindung zum Server fehlgeschlagen", variant: "destructive" });
      setIsAppPasswordUnlocked(false);
    }
  };
  // Save settings
  useEffect(() => {
    if (appPassword) localStorage.setItem("app-password", appPassword);
  }, [appPassword]);

  useEffect(() => {
    if (selectedOpenaiKeyIndex >= 0) {
      localStorage.setItem("openai-api-key-selected-index", String(selectedOpenaiKeyIndex));
      setApiKey(openaiApiKeys[selectedOpenaiKeyIndex]?.key_value || "");
    } else {
      setApiKey("");
    }
  }, [openaiApiKeys, selectedOpenaiKeyIndex]);

  useEffect(() => {
    if (apiKey) localStorage.setItem("openai-api-key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (selectedCloudConvertKeyIndex >= 0) {
      localStorage.setItem("cloudconvert-api-key-selected-index", String(selectedCloudConvertKeyIndex));
      setCloudConvertApiKey(cloudConvertApiKeys[selectedCloudConvertKeyIndex]?.key_value || ""); // Corrected to use cloudConvertApiKeys
    } else {
      setCloudConvertApiKey("");
    }
  }, [cloudConvertApiKeys, selectedCloudConvertKeyIndex]);

  useEffect(() => {
    if (selectedModel) localStorage.setItem("openai-model", selectedModel);
  }, [selectedModel]);

  // Persist form inputs & cover letter
  useEffect(() => { localStorage.setItem("job-description", jobDescription); }, [jobDescription]);
  useEffect(() => { localStorage.setItem("firma", firmaInput); }, [firmaInput]);
  useEffect(() => { localStorage.setItem("adresse", adresseInput); }, [adresseInput]);
  useEffect(() => { localStorage.setItem("title", titleInput); }, [titleInput]);
  useEffect(() => { localStorage.setItem("cover-letter", currentCoverLetter); }, [currentCoverLetter]);

  

  const baseApplication = `Sehr geehrte Damen und Herren,
 
Softwareentwicklung begeistert mich – vor allem dann, wenn ich damit echte Mehrwerte für Nutzer schaffen kann.

Als ausgebildeter IT-Kaufmann mit technischer Zusatzqualifikation zum IT-Assistenten und einem laufenden Studium der Wirtschaftsinformatik verbinde ich fundiertes technisches Wissen mit wirtschaftlichem Verständnis. Aktuell bin ich bei der CIB software GmbH als Produktverantwortlicher tätig – dem Unternehmen, bei dem ich bereits erfolgreich die Ausbildung absolviert habe.

Im Studium steht die Programmiersprache Python im Fokus. Ergänzt wird dieses Wissen durch praktische Erfahrung im Frontend-Bereich, insbesondere mit Angular und TypeScript, die im Rahmen eines Praktikums bei MicroNova vertieft wurde. 

So ergibt sich ein solides Fundament für die Fullstack-Webentwicklung – sowohl im Backend als auch im Frontend.

Gerne überzeuge ich Sie in einem persönlichen Gespräch von meiner Motivation und meinen Fähigkeiten.

Mit freundlichen Grüßen`;

  const initializeSteps = () => [
    { id: "validate-inputs", title: "Eingaben validieren", description: "Überprüfung der API-Schlüssel und Eingabedaten", status: "pending" as const },
    { id: "analyze-job", title: "Stellenanzeige analysieren", description: "Extrahierung der Anforderungen und Qualifikationen", status: "pending" as const },
    { id: "process-resume", title: "Lebenslauf verarbeiten", description: "Analyse der vorhandenen Qualifikationen", status: "pending" as const },
    { id: "match-skills", title: "Skills matchen", description: "Abgleich zwischen Anforderungen und Qualifikationen", status: "pending" as const },
    { id: "generate-application", title: "Anschreiben generieren", description: "Erstellung des individualisierten Anschreibens", status: "pending" as const }
  ];

  const updateStep = (stepId: string, updates: Partial<ProcessingStep>) => {
    setProcessingSteps(prev => prev.map(step => step.id === stepId ? { ...step, ...updates } : step));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setResumeFile(file);
        toast({ title: "Datei hochgeladen", description: `${file.name} wurde erfolgreich hochgeladen.` });
      } else {
        toast({ title: "Ungültiges Dateiformat", description: "Bitte laden Sie eine PDF-Datei hoch.", variant: "destructive" });
      }
    }
  };

  const handleLoadDemoCv = async () => {
    try {
      const resp = await fetch('/lebenslauf.pdf');
      if (!resp.ok) throw new Error('lebenslauf.pdf nicht gefunden');
      const blob = await resp.blob();
      const file = new File([blob], 'lebenslauf.pdf', { type: 'application/pdf' });
      setResumeFile(file);
      toast({ title: 'Demo-Lebenslauf geladen', description: 'lebenslauf.pdf wurde geladen.' });
    } catch (e) {
      toast({ title: 'Fehler', description: String(e), variant: 'destructive' });
    }
  };

  const generateApplication = async () => {
    if (!apiKey) {
      toast({ title: "API-Schlüssel fehlt", description: "Bitte geben Sie Ihren OpenAI API-Schlüssel ein.", variant: "destructive" });
      return;
    }
    if (!jobDescription) {
      toast({ title: "Stellenanzeige fehlt", description: "Bitte fügen Sie eine Stellenanzeige ein.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setAnalysisResult(null);
    const steps = initializeSteps();
    setProcessingSteps(steps);

    try {
      // Services initialisieren
      const openaiService = new OpenAIService(apiKey);
      const resumeService = new ResumeAnalysisService();

      // Schritt 1: Eingaben validieren
      updateStep("validate-inputs", { status: "processing" });
      setProgress(10);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStep("validate-inputs", { status: "completed", details: "API-Schlüssel und Eingaben sind gültig" });
      setProgress(20);

      // Schritt 2: Stellenanzeige analysieren
      updateStep("analyze-job", { status: "processing" });
      const jobRequirements = await openaiService.analyzeJobDescription(jobDescription, selectedModel);
      updateStep("analyze-job", { status: "completed", details: `${jobRequirements.technical_requirements?.length || 0} technische Anforderungen gefunden` });
      setProgress(40);

      // Schritt 3: Lebenslauf verarbeiten
      updateStep("process-resume", { status: "processing" });
      const resumeAnalysis = await resumeService.analyzeResume(resumeFile);
      const candidateSkills = resumeService.formatSkillsForAI(resumeAnalysis);
      updateStep("process-resume", { status: "completed", details: `${candidateSkills.length} Qualifikationen extrahiert` });
      setProgress(60);

      // Schritt 4: Skills matchen
      updateStep("match-skills", { status: "processing" });
      const matchResult = await openaiService.matchSkills(jobRequirements, candidateSkills, selectedModel);
      updateStep("match-skills", { status: "completed", details: `${matchResult.matched_skills?.length || 0} passende Skills gefunden` });
      setProgress(80);

      // Schritt 5: Anschreiben generieren
      updateStep("generate-application", { status: "processing" });
      const finalApplication = await openaiService.generateCoverLetter(
        baseApplication,
        jobRequirements,
        matchResult,
        jobDescription,
        selectedModel
      );
      updateStep("generate-application", { status: "completed", details: "Individualisiertes Anschreiben erstellt" });
      setProgress(100);

      const result = {
        requirements: [
          ...(jobRequirements.technical_requirements || []),
          ...(jobRequirements.professional_requirements || [])
        ],
        matchedSkills: matchResult.matched_skills || [],
        suggestedChanges: matchResult.relevant_experiences || [],
        finalApplication
      };

      setAnalysisResult(result);
      setCurrentCoverLetter(finalApplication);

      // Trigger PDF generation in the background
      const generatePdfInBackground = async () => {
        if (!cloudConvertApiKey) {
          console.log("No CloudConvert API key, skipping background PDF generation.");
          return;
        }
        try {
          const cloudConvertService = new CloudConvertService(cloudConvertApiKey);
          const docx = await cloudConvertService.generateDocxAsync(
            finalApplication,
            firmaInput,
            adresseInput,
            titleInput
          );
          const pdf = await cloudConvertService.convertDocxBlobToPdf(docx);
          setPdfBlob(pdf);
          toast({ title: "PDF bereit", description: "Das PDF für den Anhang wurde im Hintergrund erstellt." });
        } catch (error) {
          console.error("Background PDF generation failed:", error);
          toast({ 
            title: "Fehler bei PDF-Generierung", 
            description: `Das PDF konnte nicht im Hintergrund erstellt werden: ${error}`,
            variant: "destructive"
          });
        }
      };
      generatePdfInBackground();

      toast({ title: "Anschreiben generiert", description: "Ihr individualisiertes Anschreiben wurde erfolgreich erstellt.", variant: "default" });

    } catch (error) {
      console.error("Fehler bei der Generierung:", error);
      toast({ title: "Fehler aufgetreten", description: "Bei der Generierung ist ein Fehler aufgetreten. Bitte prüfen Sie Ihre API-Schlüssel.", variant: "destructive" });
      setProcessingSteps(prev => prev.map(step => step.status === "processing" ? { ...step, status: "error" as const } : step));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCoverLetterChange = (newText: string) => {
    setCurrentCoverLetter(newText);
    if (analysisResult) {
      setAnalysisResult({
        ...analysisResult,
        finalApplication: newText
      });
    }
  };

  const handleResetApplication = () => {
    // Clear state
    setJobDescription("");
    setResumeFile(null);
    setFirmaInput("");
    setAdresseInput("");
    setTitleInput("");
    setCurrentCoverLetter("");
    setEmailSubject("");
    setEmailBody("");
    setPdfBlob(null);
    setAnalysisResult(null);
    setProcessingSteps([]);
    setSelectedStep(null);
    setSelectedSkill(null);
    setProgress(0);
    // Clear persisted keys (keep API/SMTP settings)
    localStorage.removeItem("job-description");
    localStorage.removeItem("firma");
    localStorage.removeItem("adresse");
    localStorage.removeItem("title");
    localStorage.removeItem("cover-letter");
    localStorage.removeItem("email-subject");
    localStorage.removeItem("email-body");
    toast({ title: "Neue Bewerbung", description: "Eingaben wurden zurückgesetzt." });
  };

  const handleDocxDownload = async () => {
    if (!currentCoverLetter) {
      toast({ title: "Kein Anschreiben", description: "Bitte generieren Sie zuerst ein Anschreiben.", variant: "destructive" });
      return;
    }

    try {
      const cloudConvertService = new CloudConvertService(cloudConvertApiKey || "dummy");
      const docxBlob = await cloudConvertService.generateDocxAsync(
        currentCoverLetter,
        firmaInput,
        adresseInput,
        titleInput
      );
      saveAs(docxBlob, "Bewerbung.docx");
      toast({ title: "DOCX erstellt", description: "Die DOCX-Datei wurde heruntergeladen." });
    } catch (error) {
      console.error("DOCX Export Error:", error);
      toast({ title: "Fehler beim DOCX-Export", description: String(error), variant: "destructive" });
    }
  };

  const [isPdfLoading, setIsPdfLoading] = useState(false);
  // Email + SMTP state
  const [emailTo, setEmailTo] = useState("");
  const [emailBcc, setEmailBcc] = useState("kontakt@markb.de");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [fromEmail, setFromEmail] = useState("");
  const [sendDocx, setSendDocx] = useState(false);
  const [sendPdf, setSendPdf] = useState(true);
  const [sendZeugnisse, setSendZeugnisse] = useState(true);
  const [sendCv, setSendCv] = useState(true);
  const [zeugnisseFile, setZeugnisseFile] = useState<File | null>(null);
  const [useCompressedZeugnis, setUseCompressedZeugnis] = useState(false);
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  // Persist: SMTP + Email settings (load on mount)
  useEffect(() => {
    try {
      const sEmailTo = localStorage.getItem("email-to");

      const sEmailSubject = localStorage.getItem("email-subject");
      const sEmailBody = localStorage.getItem("email-body");
      const sHost = localStorage.getItem("smtp-host");
      const sPort = localStorage.getItem("smtp-port");
      const sUser = localStorage.getItem("smtp-user");
      const sPass = localStorage.getItem("smtp-pass");
      const sSecure = localStorage.getItem("smtp-secure");
      const sFrom = localStorage.getItem("smtp-from");
      const sSendDocx = localStorage.getItem("send-docx");
      const sSendPdf = localStorage.getItem("send-pdf");

      if (sEmailTo) setEmailTo(sEmailTo);

      if (sEmailSubject) setEmailSubject(sEmailSubject);
      if (sEmailBody) setEmailBody(sEmailBody);
      if (sHost) setSmtpHost(sHost);
      if (sPort) setSmtpPort(parseInt(sPort, 10) || 587);
      if (sUser) setSmtpUser(sUser);
      if (sPass) setSmtpPass(sPass);
      if (sSecure) setSmtpSecure(sSecure === "true");
      if (sFrom) setFromEmail(sFrom);
      if (sSendDocx) setSendDocx(sSendDocx === "true");
      if (sSendPdf) setSendPdf(sSendPdf === "true");
    } catch {}
  }, []);

  // Persist changes
  useEffect(() => { localStorage.setItem("email-to", emailTo); }, [emailTo]);

  useEffect(() => { localStorage.setItem("smtp-host", smtpHost); }, [smtpHost]);
  useEffect(() => { localStorage.setItem("email-subject", emailSubject); }, [emailSubject]);
  useEffect(() => { localStorage.setItem("email-body", emailBody); }, [emailBody]);
  useEffect(() => { localStorage.setItem("smtp-port", String(smtpPort)); }, [smtpPort]);
  useEffect(() => { localStorage.setItem("smtp-user", smtpUser); }, [smtpUser]);
  useEffect(() => { localStorage.setItem("smtp-pass", smtpPass); }, [smtpPass]);
  useEffect(() => { localStorage.setItem("smtp-secure", String(smtpSecure)); }, [smtpSecure]);
  useEffect(() => { localStorage.setItem("smtp-from", fromEmail); }, [fromEmail]);
  useEffect(() => { localStorage.setItem("send-docx", String(sendDocx)); }, [sendDocx]);
  useEffect(() => { localStorage.setItem("send-pdf", String(sendPdf)); }, [sendPdf]);

  const [emailTemplate, setEmailTemplate] = useState("");

  useEffect(() => {
    async function loadTemplate() {
      try {
        const response = await fetch('/templates/email-template.txt');
        if (response.ok) {
          setEmailTemplate(await response.text());
        } else {
          setEmailTemplate(
`Sehr geehrte Damen und Herren,

anbei sende ich Ihnen mein Anschreiben für die Position als {{position}}.
Im Anhang finden Sie mein Anschreiben.

Ich freue mich sehr über die Möglichkeit, mich Ihnen persönlich vorzustellen, und stehe für Rückfragen gerne zur Verfügung.

Mit freundlichen Grüßen

Mark Baumann`
          );
        }
      } catch (e) {
        console.error("Failed to load email template", e);
      }
    }
    loadTemplate();
  }, []);

  // Auto-prefill Betreff und E-Mail-Text; aktualisiert bei Titel-Änderung oder vorhandenem Anschreiben
  useEffect(() => {
    if (!emailTemplate) return;

    const position = titleInput || "[Stellenbezeichnung]";
    const subjectDefault = titleInput ? `Bewerbung ${titleInput} - Mark Baumann` : "Bewerbung - Mark Baumann";
    
    const bodyDefault = emailTemplate.replace(/{{position}}/g, position);

    setEmailSubject(subjectDefault);

    setEmailBody(bodyDefault);
  }, [titleInput, emailTemplate]);

  // Keep secure flag in sync with common ports (helps gegen TLS-Fehler)
  useEffect(() => {
    if (smtpPort === 465 && !smtpSecure) setSmtpSecure(true);
    if (smtpPort === 587 && smtpSecure) setSmtpSecure(false);
  }, [smtpPort]);

  const handlePdfDownload = async () => {
    if (!currentCoverLetter) {
      toast({ title: "Kein Anschreiben", description: "Bitte generieren Sie zuerst ein Anschreiben.", variant: "destructive" });
      return;
    }
    if (!cloudConvertApiKey) {
      toast({ title: "CloudConvert API-Schlüssel fehlt", description: "Bitte geben Sie Ihren CloudConvert API-Schlüssel ein.", variant: "destructive" });
      return;
    }

    setIsPdfLoading(true); // Ladebalken starten
    try {
      if (pdfBlob) {
        saveAs(pdfBlob, "Bewerbung.pdf");
        toast({ title: "PDF heruntergeladen", description: "Die PDF-Datei wurde heruntergeladen." });
      } else {
        const cloudConvertService = new CloudConvertService(cloudConvertApiKey);
        const docxBlob = await cloudConvertService.generateDocxAsync(
          currentCoverLetter,
          firmaInput,
          adresseInput,
          titleInput
        );
        const pdf = await cloudConvertService.convertDocxBlobToPdf(docxBlob);
        setPdfBlob(pdf); // Cache for next time
        saveAs(pdf, "Bewerbung.pdf");
        toast({ title: "PDF erstellt", description: "Die PDF-Datei wurde heruntergeladen." });
      }
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast({ 
        title: "Fehler beim PDF-Export", 
        description: `PDF-Konvertierung fehlgeschlagen: ${error}`, 
        variant: "destructive" 
      });
    } finally {
      setIsPdfLoading(false); // Ladebalken beenden
    }
  };


  const blobToBase64 = async (blob: Blob): Promise<string> => {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const handleSendEmail = async () => {
    if (!currentCoverLetter) {
      toast({ title: "Kein Anschreiben", description: "Bitte generieren Sie zuerst ein Anschreiben.", variant: "destructive" });
      return;
    }
    if (!emailTo) {
      toast({ title: "Empfänger fehlt", description: "Bitte geben Sie die E-Mail-Adresse ein.", variant: "destructive" });
      return;
    }

    setIsEmailSending(true);
    try {
      const attachments: Array<{ filename: string; contentType: string; base64: string }> = [];

      if (sendCv) {
        let cvBlob: Blob | null = null;
        if (resumeFile) {
          cvBlob = resumeFile;
        } else {
          try {
            const resp = await fetch('/lebenslauf.pdf');
            if (resp.ok) {
              cvBlob = await resp.blob();
            }
          } catch (e) {
            console.error("Could not fetch fallback CV", e);
          }
        }
        if (cvBlob) {
          attachments.push({
            filename: "Lebenslauf Mark Baumann.pdf",
            contentType: cvBlob.type,
            base64: await blobToBase64(cvBlob),
          });
        }
      }

      let docxBlob: Blob | null = null;
      if (sendDocx || sendPdf) {
        const cloudConvertService = new CloudConvertService(cloudConvertApiKey || "dummy");
        docxBlob = await cloudConvertService.generateDocxAsync(
          currentCoverLetter,
          firmaInput,
          adresseInput,
          titleInput
        );
      }

      if (sendDocx && docxBlob) {
        attachments.push({
          filename: "Bewerbung.docx",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          base64: await blobToBase64(docxBlob),
        });
      }

      if (sendPdf) {
        if (pdfBlob) {
          attachments.push({
            filename: "Bewerbung.pdf",
            contentType: "application/pdf",
            base64: await blobToBase64(pdfBlob),
          });
        } else if (!cloudConvertApiKey) {
          toast({ title: "PDF nicht konfiguriert", description: "Bitte CloudConvert API-Schlüssel eintragen oder nur DOCX senden.", variant: "destructive" });
        } else {
          const cloudConvertService = new CloudConvertService(cloudConvertApiKey);
          const docxBlob = await cloudConvertService.generateDocxAsync(
            currentCoverLetter,
            firmaInput,
            adresseInput,
            titleInput
          );
          const pdf = await cloudConvertService.convertDocxBlobToPdf(docxBlob);
          setPdfBlob(pdf); // Cache for next time
          attachments.push({
            filename: "Bewerbung.pdf",
            contentType: "application/pdf",
            base64: await blobToBase64(pdf),
          });
        }
      }

      if (sendZeugnisse) {
        try {
          let zeugnisBlob: Blob | null = null;
          let zeugnisFilename = '';
          let zeugnisContentType = '';

          if (useCompressedZeugnis) {
            try {
              const resp = await fetch('/zeugnis_compressed.pdf');
              if (resp.ok) {
                zeugnisBlob = await resp.blob();
                zeugnisFilename = 'Marks_Zeugnis_Compressed.pdf';
                zeugnisContentType = zeugnisBlob.type || 'application/pdf';
              }
            } catch (e) {
              console.error('Could not fetch compressed zeugnis', e);
            }
          } else {
            zeugnisBlob = zeugnisseFile; // Use uploaded file if present
            if (!zeugnisBlob) { // Fallback to demo file
              const resp = await fetch('/zeugnis.pdf');
              if (resp.ok) zeugnisBlob = await resp.blob();
            }
            zeugnisFilename = zeugnisseFile?.name || 'Marks_Zeugnis.pdf';
            zeugnisContentType = zeugnisBlob?.type || 'application/pdf'; // Ensure correct content type
          }

          if (zeugnisBlob) {
            attachments.push({ filename: zeugnisFilename, contentType: zeugnisContentType, base64: await blobToBase64(zeugnisBlob) });
          }
        } catch (e) { console.error('Error attaching zeugnis:', e) }
      }

      const subject = emailSubject || (titleInput ? `Bewerbung ${titleInput} - Mark Baumann` : "Bewerbung - Mark Baumann");
      
      const text = emailBody;

      const html = `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(text)}</pre>`;

      const resp = await fetch("/api/send-email", {
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
          mail: {
            from: fromEmail || smtpUser || "no-reply@localhost",
            to: emailTo,

            subject,
            text,
            html,
            attachments,
          },
        }),
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "Unbekannter Fehler");
      toast({ title: "E-Mail gesendet", description: `Nachricht an ${emailTo} versendet.` });
    } catch (error) {
      console.error("E-Mail Versand Fehler:", error);
      toast({ title: "E-Mail Versand fehlgeschlagen", description: String(error), variant: "destructive" });
    } finally {
      setIsEmailSending(false);
    }
  };

  const getStepIcon = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-muted" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100 flex flex-col items-center justify-center py-8 text-black">
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-8 items-center">
        {/* Header */}
        <div className="text-center space-y-2 mb-2">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-400 bg-clip-text text-transparent drop-shadow">
            JobPilot
          </h1>
          <p className="text-lg text-black/80">
            Generiere individuelle Anschreiben basierend auf Stellenanzeigen
          </p>
        </div>

        {/* Job List */}
        <JobList 
          onJobSelect={handleJobSelect} 
          onSourcesClick={() => setShowSourcesManager(true)}
        />

        {/* Sources Manager */}
        <SourcesManager 
          isOpen={showSourcesManager} 
          onClose={() => setShowSourcesManager(false)} 
        />

        {/* API Configuration */}
        <Card className="w-full bg-white shadow-xl border border-blue-200 rounded-2xl text-black">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Key className="w-5 h-5 text-primary" />
              KI-Konfiguration
            </CardTitle>
            <CardDescription>
              Konfigurieren Sie Ihre API-Schlüssel und wählen Sie das gewünschte Modell
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="app-password">App Passwort (zum Anzeigen der API-Schlüssel)</Label>
              <div className="relative">
                <Input
                  id="app-password"
                  type={showAppPassword ? "text" : "password"}
                  placeholder="App Passwort eingeben"
                  value={appPassword}
                  onChange={(e) => {
                    setAppPassword(e.target.value);
                    setIsAppPasswordUnlocked(false); // Reset unlock status on change
                  }}
                  className="pr-20 bg-white border-primary/30 focus:border-primary/60 transition-colors"
                  disabled={isAppPasswordUnlocked}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setShowAppPassword(!showAppPassword)}
                  className="absolute right-16 top-0 h-full px-3 hover:bg-primary/10"
                  disabled={isAppPasswordUnlocked}
                >
                  {showAppPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  onClick={handleUnlockAppPassword}
                  disabled={isAppPasswordUnlocked || appPassword.length === 0}
                  className="absolute right-0 top-0 h-full px-3 hover:bg-primary/10"
                >
                  {isAppPasswordUnlocked ? "Entsperrt" : "Entsperren"}
                </Button>
              </div>
              {isAppPasswordUnlocked && (
                <div>
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> API-Schlüssel-Ansicht entsperrt.
                  </p>
                </div>
              )}
            </div>

            {isAppPasswordUnlocked && (
              <div className="space-y-2">
                <Label>OpenAI API-Schlüssel</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedOpenaiKeyIndex >= 0 ? String(selectedOpenaiKeyIndex) : ""}
                  onValueChange={(val) => {
                    const idx = parseInt(val, 10);
                    setSelectedOpenaiKeyIndex(idx);
                    setApiKey(openaiApiKeys[idx]?.key_value || "");
                    setShowSelectedOpenaiKey(false);
                  }}
                >
                  <SelectTrigger className="bg-white border-primary/30 focus:border-primary/60 transition-colors w-full">
                    <SelectValue placeholder={openaiApiKeys.length ? "Schlüssel wählen" : "Kein Schlüssel gespeichert"} />
                  </SelectTrigger>
                  <SelectContent>
                    {openaiApiKeys.length === 0 ? (
                      <SelectItem value="-1" disabled>
                        Kein Schlüssel vorhanden
                      </SelectItem>
                    ) : (
                      openaiApiKeys.map((k, i) => {
                        const masked = k.key_value.length > 8 ? `•••• ${k.key_value.slice(-4)}` : "••••";
                        return (
                          <SelectItem key={i} value={String(i)}>
                            {`Key ${i + 1} (${masked})`}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setShowSelectedOpenaiKey(!showSelectedOpenaiKey);
                  }}
                  className="shrink-0 h-full px-3 hover:bg-primary/10"
                  disabled={selectedOpenaiKeyIndex < 0 || !isAppPasswordUnlocked}
                >
                  {showSelectedOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm" variant="destructive"
                  type="button"
                  className="shrink-0 bg-white text-black border border-blue-200 hover:bg-blue-50 hover:text-black"
                  onClick={async () => {
                    if (selectedOpenaiKeyIndex >= 0) {
                      const keyToDelete = openaiApiKeys[selectedOpenaiKeyIndex];
                      try {
                        await fetch('/api/openai', {
                          method: 'DELETE',
                          headers: { 
                            'Content-Type': 'application/json',
                            'X-App-Password': appPassword
                          },
                          body: JSON.stringify({ id: keyToDelete.id }),
                        });
                        toast({ title: "Schlüssel entfernt", description: "Der API-Schlüssel wurde aus der Datenbank gelöscht." });
                        await loadOpenaiKeys();
                      } catch (error) {
                        toast({
                          title: "Fehler beim Löschen",
                          description: String(error),
                          variant: "destructive",
                        });
                      }
                    }
                  }}
                  disabled={selectedOpenaiKeyIndex < 0 || !isAppPasswordUnlocked}
                >
                  Entfernen
                </Button>
              </div>
              {showSelectedOpenaiKey && selectedOpenaiKeyIndex >= 0 && (
                <Input
                  type={showSelectedOpenaiKey ? "text" : "password"}
                  value={openaiApiKeys[selectedOpenaiKeyIndex]?.key_value || ""}
                  readOnly
                  className="bg-white border-primary/30"
                />
              )}
              <div className="flex items-center gap-2 mt-2">
                <Input
                  placeholder="Neuen Schlüssel eingeben (sk-...)"
                  value={newOpenaiKey}
                  onChange={(e) => setNewOpenaiKey(e.target.value)}
                  className="bg-white border-primary/30"
                  disabled={!isAppPasswordUnlocked}
                />
                <Button
                  type="button"
                  onClick={async () => {
                    const v = newOpenaiKey.trim();
                    if (!v || !appPassword) return;
                    try {
                      await fetch('/api/openai', {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'X-App-Password': appPassword
                        },
                        body: JSON.stringify({ key: v }),
                      });
                      setNewOpenaiKey("");
                      toast({ title: "Schlüssel hinzugefügt", description: "Der neue API-Schlüssel wurde in der Datenbank gespeichert." });
                      await loadOpenaiKeys();
                    } catch (error) {
                      toast({ title: "Fehler beim Speichern", description: String(error), variant: "destructive" });
                    }
                  }}
                  disabled={!newOpenaiKey || !isAppPasswordUnlocked}
                >
                  Hinzufügen
                </Button>
              </div>
            </div>
            )}
            {isAppPasswordUnlocked && (
              <div className="space-y-2">
                <Label>CloudConvert API-Schlüssel (für PDF-Export)</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedCloudConvertKeyIndex >= 0 ? String(selectedCloudConvertKeyIndex) : ""}
                    onValueChange={(val) => {
                      const idx = parseInt(val, 10);
                      setSelectedCloudConvertKeyIndex(idx);
                      setCloudConvertApiKey(cloudConvertApiKeys[idx]?.key_value || "");
                      setShowSelectedCloudConvertKey(false);
                    }}
                  >
                  <SelectTrigger className="bg-white border-primary/30 focus:border-primary/60 transition-colors w-full">
                    <SelectValue placeholder={cloudConvertApiKeys.length ? "Schlüssel wählen" : "Kein Schlüssel gespeichert"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cloudConvertApiKeys.length === 0 ? (
                      <SelectItem value="-1" disabled>
                        Kein Schlüssel vorhanden
                      </SelectItem>
                    ) : (
                      cloudConvertApiKeys.map((k, i) => {
                        const masked = k.key_value.length > 8 ? `•••• ${k.key_value.slice(-4)}` : "••••";
                        return (
                          <SelectItem key={i} value={String(i)}>
                            {`Key ${i + 1} (${masked})`}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setShowSelectedCloudConvertKey(!showSelectedCloudConvertKey);
                  }}
                  className="shrink-0 h-full px-3 hover:bg-primary/10"
                  disabled={selectedCloudConvertKeyIndex < 0 || !isAppPasswordUnlocked}
                >
                  {showSelectedCloudConvertKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm" variant="destructive"
                  type="button"
                  className="shrink-0 bg-white text-black border border-blue-200 hover:bg-blue-50 hover:text-black"
                  onClick={async () => {
                    if (selectedCloudConvertKeyIndex >= 0) {
                      const keyToDelete = cloudConvertApiKeys[selectedCloudConvertKeyIndex];
                      try {
                        await fetch('/api/cloudconvert', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: keyToDelete.id }),
                        });
                        toast({ title: "Schlüssel entfernt", description: "Der API-Schlüssel wurde aus der Datenbank gelöscht." });
                        await loadCloudConvertKeys();
                      } catch (error) {
                        toast({
                          title: "Fehler beim Löschen",
                          description: String(error),
                          variant: "destructive",
                        });
                      }
                    }
                  }}
                  disabled={selectedCloudConvertKeyIndex < 0 || !isAppPasswordUnlocked}
                >
                  Entfernen
                </Button>
              </div>
              {showSelectedCloudConvertKey && selectedCloudConvertKeyIndex >= 0 && (
                <Input
                  type={showSelectedCloudConvertKey ? "text" : "password"}
                  value={cloudConvertApiKeys[selectedCloudConvertKeyIndex]?.key_value || ""}
                  readOnly
                  className="bg-white border-primary/30"
                />
              )}
              <div className="flex items-center gap-2 mt-2">
                <Input
                  placeholder="Neuen Schlüssel eingeben (Bearer …)"
                  value={newCloudConvertKey}
                  onChange={(e) => setNewCloudConvertKey(e.target.value)}
                  disabled={!isAppPasswordUnlocked}
                  className="bg-white border-primary/30"
                />
                <Button
                  type="button"
                  onClick={async () => {
                    const v = newCloudConvertKey.trim();
                    if (!v) return;
                    try {
                      await fetch('/api/cloudconvert', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: v }),
                      });
                      setNewCloudConvertKey("");
                      toast({ title: "Schlüssel hinzugefügt", description: "Der neue API-Schlüssel wurde in der Datenbank gespeichert." });
                      await loadCloudConvertKeys();
                    } catch (error) {
                      toast({ title: "Fehler beim Speichern", description: String(error), variant: "destructive" });
                    }
                  }}
                  disabled={!newCloudConvertKey || !isAppPasswordUnlocked}
                >
                  Hinzufügen
                </Button>
              </div>
            </div>
            )}
            
            {isAppPasswordUnlocked && (
            <div className="space-y-2">
              <Label htmlFor="model-select">KI-Modell</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="bg-white border-primary/30 focus:border-primary/60 transition-colors">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    <SelectValue placeholder="Wählen Sie ein Modell" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-white backdrop-blur-sm border-primary/20 shadow-xl">
                  {gptModels.map((model) => (
                    <SelectItem key={model.value} value={model.value} className="hover:bg-primary/10 focus:bg-primary/10 text-black">
                      <div className="flex flex-col">
                        <span className="font-medium text-black">{model.label}</span>
                        <span className="text-xs text-muted-foreground">{model.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Stellenanzeige */}
        <Card className="w-full bg-white shadow-xl border border-blue-200 rounded-2xl text-black">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-primary" />
              Stellenanzeige
            </CardTitle>
            <CardDescription>
              Fügen Sie hier die komplette Stellenanzeige ein
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Fügen Sie hier die Stellenanzeige ein..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="min-h-[200px] bg-white border-primary/30 focus:border-primary/60 transition-colors resize-none"
            />
            <div className="flex flex-col gap-2 mt-4">
              <Label>Firma</Label>
              <Input
                value={firmaInput}
                onChange={e => setFirmaInput(e.target.value)}
                placeholder="z.B. ACME GmbH"
                className="bg-white"
              />
              <Label>Adresse</Label>
              <Input
                value={adresseInput}
                onChange={e => setAdresseInput(e.target.value)}
                placeholder="z.B. Musterstraße 1, 12345 Musterstadt"
                className="bg-white"
              />
              <Label>Titel</Label>
              <Input
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                placeholder="z.B. Bewerbung als Softwareentwickler"
                className="bg-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lebenslauf Upload */}
        <Card className="w-full bg-white shadow-xl border border-blue-200 rounded-2xl text-black">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="w-5 h-5 text-primary" />
              Lebenslauf Upload
            </CardTitle>
            <CardDescription>
              Laden Sie Ihren Lebenslauf als PDF-Datei hoch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <Label htmlFor="resume-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary/30 rounded-lg cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all duration-200">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 mb-3 text-primary/70" />
                    <p className="mb-2 text-sm text-foreground/80">
                      <span className="font-semibold">Klicken Sie hier</span> oder ziehen Sie die Datei hinein
                    </p>
                    <p className="text-xs text-muted-foreground">Nur PDF-Dateien</p>
                  </div>
                  <Input
                    id="resume-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </Label>
              </div>
              <div className="flex items-center justify-end">
                <Button type="button" variant="outline" onClick={handleLoadDemoCv} className="bg-white text-black border-blue-200">
                  Marks CV
                </Button>
              </div>
              {resumeFile && (
                <Badge variant="success" className="w-fit">
                  {resumeFile.name}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Generate Button */}
        <Card className="w-full bg-gradient-to-r from-indigo-50 to-blue-100 shadow-xl border border-blue-200 rounded-2xl text-black">
          <CardContent className="pt-6">
            <Button
              onClick={generateApplication}
              disabled={isProcessing || !apiKey || !jobDescription}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generiere Anschreiben...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Anschreiben generieren
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Status und Ergebnis Sektion */}
        <div className="w-full flex flex-col gap-6 items-center mt-4">
          {/* Verarbeitungsfortschritt */}
          {processingSteps.length > 0 && (
            <Card className="w-full bg-white shadow-lg border border-blue-200 rounded-2xl text-black">
              <CardHeader>
                <CardTitle>Verarbeitungsfortschritt</CardTitle>
                <CardDescription>
                  Echtzeitüberwachung der KI-Verarbeitung
                </CardDescription>
              </CardHeader>
               <CardContent className="space-y-4">
                 <div className="space-y-2">
                   <div className="flex justify-between items-center">
                     <span className="text-sm font-medium">Fortschritt</span>
                     <span className="text-sm text-muted-foreground">{progress}%</span>
                   </div>
                   <Progress 
                     value={progress} 
                     className="w-full cursor-pointer hover:opacity-80 transition-opacity" 
                     onClick={() => {
                       toast({
                         title: "Fortschritt Details",
                         description: `Verarbeitung zu ${progress}% abgeschlossen. ${processingSteps.filter(s => s.status === 'completed').length} von ${processingSteps.length} Schritten fertig.`
                       });
                     }}
                   />
                 </div>
                 <div className="space-y-3">
                   {processingSteps.map((step) => (
                     <div 
                       key={step.id} 
                       className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                         selectedStep === step.id 
                           ? 'border-primary bg-primary/5' 
                           : 'border-transparent hover:border-muted'
                     }`}
                     onClick={() => {
                       setSelectedStep(selectedStep === step.id ? null : step.id);
                       toast({
                         title: step.title,
                         description: step.details || step.description
                       });
                     }}
                   >
                     <div className="mt-1">
                       {getStepIcon(step.status)}
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="text-sm font-medium">{step.title}</p>
                       <p className="text-xs text-muted-foreground">{step.description}</p>
                       {step.details && (
                         <p className="text-xs text-primary mt-1">{step.details}</p>
                       )}
                       {selectedStep === step.id && (
                         <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                           <Info className="w-3 h-3 inline mr-1" />
                           Klicken Sie auf andere Schritte um Details zu sehen.
                         </div>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             </CardContent>
            </Card>
          )}

          {/* Analyse Ergebnis */}
          {analysisResult && (
            <Card className="w-full bg-white shadow-lg border border-blue-200 rounded-2xl text-black">
              <CardHeader>
                <CardTitle>Analyse Ergebnis</CardTitle>
                <CardDescription>
                  Zusammenfassung der gefundenen Übereinstimmungen
                </CardDescription>
              </CardHeader>
               <CardContent className="space-y-6">
                 <div className="space-y-3">
                   <Label className="text-sm">Stellenanforderungen</Label>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     {analysisResult.requirements.map((req, index) => (
                       <Badge 
                         key={index} 
                         variant="outline" 
                         className="text-xs cursor-pointer bg-blue-100 border-blue-200 text-blue-800 transition-colors p-2 justify-start"
                         onClick={() => {
                           setSelectedSkill(selectedSkill === `req-${index}` ? null : `req-${index}`);
                           toast({
                             title: "Anforderung",
                             description: `Diese Stelle sucht nach: ${req}. Prüfen Sie ob Ihre Erfahrung dazu passt.`
                           });
                         }}
                       >
                         {req}
                         {selectedSkill === `req-${index}` && (
                           <Info className="w-3 h-3 ml-1" />
                         )}
                       </Badge>
                     ))}
                   </div>
                 </div>

                 <div className="space-y-3">
                   <Label className="text-sm">Passende Skills</Label>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     {analysisResult.matchedSkills.map((skill, index) => (
                       <Badge 
                         key={index} 
                         variant="success" 
                         className="text-xs cursor-pointer bg-green-100 border-green-300 text-green-800 transition-colors p-2 justify-start"
                         onClick={() => {
                           setSelectedSkill(selectedSkill === `skill-${index}` ? null : `skill-${index}`);
                           toast({
                             title: "Passender Skill",
                             description: `Ihr Skill "${skill}" passt perfekt zu den Anforderungen dieser Stelle!`
                           });
                         }}
                       >
                         {skill}
                         {selectedSkill === `skill-${index}` && (
                           <Info className="w-3 h-3 ml-1" />
                         )}
                       </Badge>
                     ))}
                   </div>
                 </div>
               </CardContent>
            </Card>
          )}



          {/* Editable Cover Letter */}
          {currentCoverLetter && (
            <CoverLetterEditor
              initialText={currentCoverLetter}
              onTextChange={handleCoverLetterChange}
              onDownloadDocx={handleDocxDownload}
              onDownloadPdf={handlePdfDownload}
              isPdfLoading={isPdfLoading}
              emailTo={emailTo}
              onEmailToChange={setEmailTo}
              emailBcc={emailBcc}
              onEmailBccChange={setEmailBcc}
              emailSubject={emailSubject}
              onEmailSubjectChange={setEmailSubject}
              emailBody={emailBody}
              onEmailBodyChange={setEmailBody}
              smtpHost={smtpHost}
              smtpPort={smtpPort}
              smtpUser={smtpUser}
              smtpPass={smtpPass}
              smtpSecure={smtpSecure}
              fromEmail={fromEmail}
              onSmtpFieldChange={(field, value) => {
                switch (field) {
                  case "host":
                    setSmtpHost(String(value));
                    break;
                  case "port":
                    setSmtpPort(Number(value));
                    break;
                  case "user":
                    setSmtpUser(String(value));
                    break;
                  case "pass":
                    setSmtpPass(String(value));
                    break;
                  case "secure":
                    setSmtpSecure(Boolean(value));
                    break;
                  case "fromEmail":
                    setFromEmail(String(value));
                    break;
                }
              }}
              sendDocx={sendDocx}
              sendPdf={sendPdf}
              sendZeugnisse={sendZeugnisse}
              sendCv={sendCv}
              onSendOptionChange={(field, value) => {
                if (field === "docx") setSendDocx(value);
                if (field === "pdf") setSendPdf(value);
                if (field === "zeugnisse") setSendZeugnisse(value);
                if (field === "cv") setSendCv(value);
              }}
              onCvUploadClick={() => document.getElementById('resume-upload')?.click()}
              onZeugnisseUpload={(file) => setZeugnisseFile(file)}
              zeugnisseFileName={zeugnisseFile?.name}
              useCompressedZeugnis={useCompressedZeugnis} // Pass the state
              onUseCompressedZeugnisChange={(v) => setUseCompressedZeugnis(v)}
              onLoadDemoZeugnisse={async () => {
                try {
                  const resp = await fetch('/zeugnis.pdf');
                  if (!resp.ok) throw new Error('zeugnisse.pdf nicht gefunden');
                  const blob = await resp.blob();
                  const file = new File([blob], 'zeugnis.pdf', { type: 'application/pdf' });
                  setZeugnisseFile(file);
                  setUseCompressedZeugnis(false); // Make sure standard is selected
                  toast({ title: 'Zeugnisse geladen', description: 'Demodatei zeugnis.pdf geladen.' });
                } catch (e) {
                  toast({ title: 'Fehler', description: String(e), variant: 'destructive' });
                }
              }}
              onLoadDemoZeugnisCompressed={() => {
                setUseCompressedZeugnis(true);
                setZeugnisseFile(null);
                toast({ title: 'Komprimiertes Zeugnis ausgewählt', description: 'Beim Senden wird "Marks_Zeugnis_Compressed.pdf" angehängt.' });
              }}
              onSendEmail={handleSendEmail}
              isEmailSending={isEmailSending}
              onReset={handleResetApplication}
            />
          )}
        </div>
      </div>
    </div>
  );
}
