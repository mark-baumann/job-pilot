
export interface ResumeAnalysis {
  skills: string[];
  experiences: string[];
  education: string[];
  certifications: string[];
}

export class ResumeAnalysisService {
  // Simuliert die Lebenslauf-Analyse - kann später durch echte PDF-Parsing erweitert werden
  async analyzeResume(resumeFile: File | null): Promise<ResumeAnalysis> {
    // Basis-Skills die immer verfügbar sind (aus dem ursprünglichen Code)
    const baseSkills = [
      "Python", "Angular", "TypeScript", "Java", "Hibernate", 
      "Scrum", "Produktverantwortung", "Software Architektur",
      "Wirtschaftsinformatik", "IT-Kaufmann", "KI", "React",
      "Node.js", "Express", "MongoDB", "PostgreSQL", "Docker",
      "Kubernetes", "AWS", "Git", "Agile Methoden", "Frontend",
      "Backend", "Fullstack", "REST APIs", "GraphQL", "Microservices"
    ];

    const baseExperiences = [
      "Frontend-Entwicklung mit Angular und TypeScript bei MicroNova",
      "Backend-Entwicklung mit Java und Hibernate",
      "Produktverantwortlicher bei CIB software GmbH",
      "IT-Kaufmann Ausbildung bei CIB software GmbH",
      "Studium der Wirtschaftsinformatik",
      "Praktikum bei MicroNova im Frontend-Bereich",
      "Anwendung von Scrum-Methoden",
      "Erfahrung mit KI und maschinellem Lernen"
    ];

    const education = [
      "Studium Wirtschaftsinformatik (laufend)",
      "IT-Kaufmann (abgeschlossen)",
      "IT-Assistent (technische Zusatzqualifikation)"
    ];

    // Simuliere eine Verarbeitungszeit
    await new Promise(resolve => setTimeout(resolve, 1500));

    // TODO: Hier könnte später echte PDF-Parsing Logik implementiert werden
    // if (resumeFile) {
    //   const pdfText = await extractTextFromPdf(resumeFile);
    //   const extractedSkills = await extractSkillsFromText(pdfText);
    //   return { skills: extractedSkills, experiences: [], education: [], certifications: [] };
    // }

    return {
      skills: baseSkills,
      experiences: baseExperiences,
      education,
      certifications: []
    };
  }

  // Hilfsmethode um Skills für die OpenAI API zu formatieren
  formatSkillsForAI(analysis: ResumeAnalysis): string[] {
    return [
      ...analysis.skills,
      ...analysis.experiences.map(exp => this.extractSkillFromExperience(exp))
    ].filter(Boolean);
  }

  private extractSkillFromExperience(experience: string): string {
    // Extrahiert den Hauptskill aus einer Erfahrungsbeschreibung
    if (experience.includes("Angular")) return "Angular";
    if (experience.includes("Java")) return "Java";
    if (experience.includes("Python")) return "Python";
    if (experience.includes("Scrum")) return "Scrum";
    if (experience.includes("Produktverantwortlicher")) return "Produktmanagement";
    return "";
  }
}
