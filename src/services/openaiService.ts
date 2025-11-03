import OpenAI from "openai";

export interface JobRequirements {
  technical_requirements: string[];
  professional_requirements: string[];
  soft_skills: string[];
  industry_knowledge: string[];
}

export interface SkillMatch {
  matched_skills: string[];
  missing_skills: string[];
  relevant_experiences: string[];
}

export class OpenAIService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  private extractJsonFromMarkdown(text: string): string | null {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : null;
  }

  async analyzeJobDescription(jobDescription: string, model: string): Promise<JobRequirements> {
    const prompt = `
      Analysiere diese Stellenanzeige systematisch und extrahiere alle wichtigen Anforderungen:
      
      ${jobDescription}
      
      Gib mir eine detaillierte strukturierte Analyse als JSON zurück:
      {
        "technical_requirements": ["konkrete Technologien, Programmiersprachen, Frameworks, Tools"],
        "professional_requirements": ["Berufserfahrung, Qualifikationen, Zertifikate, Bildungsabschlüsse"],
        "soft_skills": ["Kommunikation, Teamarbeit, Führung, etc."],
        "industry_knowledge": ["Branchenkenntnisse, Domänenwissen, spezifische Erfahrungen"]
      }
      
      Wichtig: Extrahiere alle explizit und implizit erwähnten Anforderungen. Sei präzise und vollständig.
    `;

    const response = await this.openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    const jsonContent = this.extractJsonFromMarkdown(response.choices[0].message.content || "");
    if (!jsonContent) {
      throw new Error("Keine gültige JSON-Antwort von der KI erhalten");
    }

    return JSON.parse(jsonContent);
  }

  async matchSkills(jobRequirements: JobRequirements, candidateSkills: string[], model: string): Promise<SkillMatch> {
    const prompt = `
    Vergleiche die folgenden Stellenanforderungen mit den explizit im Lebenslauf genannten Skills.

    STELLENANFORDERUNGEN:
    ${JSON.stringify(jobRequirements, null, 2)}

    KANDIDATEN-SKILLS (nur aus Lebenslauf):
    ${candidateSkills.join(", ")}

    Gib das Ergebnis als JSON zurück:
    {
      "matched_skills": ["Nur Skills, die sowohl in den Anforderungen als auch im Lebenslauf vorkommen"],
      "missing_skills": ["Skills aus den Anforderungen, die im Lebenslauf fehlen"],
      "relevant_experiences": ["Erfahrungen aus dem Lebenslauf, die direkt zu den Anforderungen passen"]
    }

    Wichtig: 
    - NUR Skills als 'matched_skills' aufnehmen, die EXAKT oder sehr ähnlich sowohl in den Anforderungen als auch im Lebenslauf stehen.
    - Keine Annahmen oder Ergänzungen, die nicht im Lebenslauf stehen!
    - 'missing_skills' sind alle Anforderungen, die im Lebenslauf NICHT vorkommen.
    - 'relevant_experiences' nur, wenn sie direkt zu einer Anforderung passen.
  `;

    const response = await this.openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const jsonContent = this.extractJsonFromMarkdown(response.choices[0].message.content || "");
    if (!jsonContent) {
      throw new Error("Keine gültige JSON-Antwort von der KI erhalten");
    }

    return JSON.parse(jsonContent);
  }

  async generateCoverLetter(
    baseApplication: string,
    jobRequirements: JobRequirements,
    matchResult: SkillMatch,
    jobDescription: string,
    model: string
  ): Promise<string> {
    const prompt = `
      Du bist ein Experte für Bewerbungsschreiben und hilfst dabei, perfekte, individualisierte Anschreiben zu erstellen.

      AUFGABE: Erstelle ein überzeugendes, maßgeschneidertes Anschreiben basierend auf der Stellenanalyse.

      BASIS-ANSCHREIBEN (als Struktur-Vorlage):
      ${baseApplication}

      VOLLSTÄNDIGE STELLENANZEIGE:
      ${jobDescription}

      ANALYSIERTE ANFORDERUNGEN:
      ${JSON.stringify(jobRequirements, null, 2)}

      SKILL-MATCHING ERGEBNIS:
      ${JSON.stringify(matchResult, null, 2)}

      ANWEISUNGEN FÜR EIN PERFEKTES ANSCHREIBEN:

      1. STRUKTUR UND STIL BEIBEHALTEN:
         - Behalte die Anrede "Sehr geehrte Damen und Herren" bei
         - Behalte den ersten Satz über Begeisterung für Softwareentwicklung bei
         - Behalte den letzten Absatz vor der Grußformel bei
         - Behalte die Grußformel "Mit freundlichen Grüßen" bei
         - Verwende den gleichen professionellen, enthusiastischen Ton

      2. INTELLIGENTE INDIVIDUALISIERUNG:
         - Analysiere die Stellenanforderungen genau und priorisiere die wichtigsten
         - Betone nur relevante Qualifikationen und Erfahrungen aus den matched_skills
         - Erstelle klare Verbindungen zwischen Stellenanforderungen und Kandidaten-Qualifikationen
         - Verwende spezifische Beispiele und Projekte wo passend

      3. FLEXIBLE SKILL-ERWÄHNUNGEN (nur wenn in der Stelle relevant):
         - Frontend/React/Angular/TypeScript: "Frontend-Entwicklung mit Angular und TypeScript bei MicroNova"
         - Backend/Java/Spring/Hibernate: "Backend-Entwicklung mit Java und Hibernate" oder "Java-Programmierung in der Ausbildung"
         - Python: "Python-Kenntnisse aus dem Studium der Wirtschaftsinformatik"
         - Produktmanagement/Product Owner: "Erfahrung als Produktverantwortlicher/Product Owner"
         - Agile/Scrum: "praktische Anwendung von Scrum-Methoden"
         - KI/Machine Learning: "Erfahrung im Bereich KI und maschinelles Lernen"
         - Vollstack: "Erfahrung in der Fullstack-Entwicklung"
         - Wirtschaftsinformatik: "Studium der Wirtschaftsinformatik für technisch-wirtschaftliche Verbindung"

      4. QUALITÄTSKRITERIEN:
         - Jeder Satz muss einen konkreten Mehrwert bieten
         - Keine generischen Phrasen oder Füllwörter
         - Klarer, direkter Bezug zur Stellenausschreibung
         - Überzeugende Darstellung der Eignung ohne Übertreibung
         - Natürlicher, flüssiger Sprachfluss
         - Konkrete Beispiele statt vager Aussagen

      5. ANPASSUNGSFÄHIGKEIT:
         - Passe die Betonung je nach Stellenfokus an (Frontend, Backend, Fullstack, etc.)
         - Erwähne nur Skills und Erfahrungen, die wirklich zur Stelle passen
         - Berücksichtige die Unternehmenskultur soweit erkennbar
         - Stelle die passendsten Qualifikationen in den Vordergrund

      6. TECHNISCHE DETAILS:
         - Verwende präzise Technologie-Bezeichnungen aus der Stellenausschreibung
         - Vermeide Technologien zu erwähnen, die nicht gesucht werden
         - Stelle Verbindungen zwischen verwandten Technologien her

      Erstelle jetzt das perfekte, individualisierte Anschreiben, das den Kandidaten optimal für diese spezifische Stelle positioniert und alle wichtigen Anforderungen addressiert. Beende das Anschreiben NUR mit "Mit freundlichen Grüßen" - füge KEINEN Namen oder Platzhalter wie "[DEIN NAME]" hinzu.
    `;

    const response = await this.openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 2000
    });

    return response.choices[0].message.content || "";
  }

  async extractResumeData(resumeText: string, model: string) {
    const prompt = `
      Extrahiere ALLE relevanten Skills, Technologien, Qualifikationen und Erfahrungen aus folgendem Lebenslauftext. Gib das Ergebnis als JSON zurück:
      {
        "skills": ["..."],
        "technologies": ["..."],
        "qualifications": ["..."],
        "experiences": ["..."]
      }
      Nur explizit im Lebenslauf genannte Inhalte aufnehmen. Keine Annahmen treffen!

      TEXT:
      ${resumeText}
    `;

    const response = await this.openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const jsonContent = this.extractJsonFromMarkdown(response.choices[0].message.content || "");
    if (!jsonContent) {
      throw new Error("Keine gültige JSON-Antwort von der KI erhalten");
    }

    return JSON.parse(jsonContent);
  }
}
