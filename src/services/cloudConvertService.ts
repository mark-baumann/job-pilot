
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export interface CloudConvertJobResponse {
  data: {
    id: string;
    status: string;
    tasks: {
      [key: string]: {
        operation: string;
        result?: {
          form?: {
            url: string;
            parameters?: { [key: string]: string };
          };
          files?: Array<{ url: string }>;
        };
      };
    };
  };
}

export class CloudConvertService {
  private apiKey: string;
  private baseUrl = 'https://api.cloudconvert.com/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createConversionJob(): Promise<CloudConvertJobResponse> {
    const response = await fetch(`${this.baseUrl}/jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tasks: {
          'import-my-file': {
            operation: 'import/upload'
          },
          'convert-my-file': {
            operation: 'convert',
            input: 'import-my-file',
            output_format: 'pdf'
          },
          'export-my-file': {
            operation: 'export/url',
            input: 'convert-my-file'
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Job creation failed: ${response.status} - ${errorText}`);
    }

    const jobData = await response.json();
    if (!jobData.data || !jobData.data.tasks) {
      throw new Error('Invalid job response structure - missing tasks');
    }

    return jobData;
  }

  async uploadFile(jobData: CloudConvertJobResponse, docxBlob: Blob): Promise<void> {
    const uploadTaskKey = Object.keys(jobData.data.tasks).find(key => 
      jobData.data.tasks[key].operation === 'import/upload'
    );
    
    if (!uploadTaskKey) {
      throw new Error('Upload-Task nicht gefunden in Job Response');
    }
    
    const uploadTask = jobData.data.tasks[uploadTaskKey];
    if (!uploadTask.result || !uploadTask.result.form) {
      throw new Error('Upload-Task Form nicht verfügbar');
    }

    const uploadFormData = new FormData();
    
    if (uploadTask.result.form.parameters) {
      Object.entries(uploadTask.result.form.parameters).forEach(([key, value]) => {
        uploadFormData.append(key, value as string);
      });
    }
    
    uploadFormData.append('file', docxBlob, 'document.docx');

    const uploadResponse = await fetch(uploadTask.result.form.url, {
      method: 'POST',
      body: uploadFormData
    });

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${uploadError}`);
    }
  }

  async waitForCompletion(jobId: string, maxAttempts: number = 30): Promise<CloudConvertJobResponse> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      console.log(`Job status: ${statusData.data.status}, attempt: ${attempts + 1}`);
      
      if (statusData.data.status === 'finished') {
        return statusData;
      }
      
      if (statusData.data.status === 'error') {
        throw new Error('PDF-Konvertierung fehlgeschlagen');
      }
      
      attempts++;
    }

    throw new Error('PDF-Konvertierung Timeout erreicht');
  }

  async downloadPdf(jobData: CloudConvertJobResponse): Promise<Blob> {
    const exportTaskKey = Object.keys(jobData.data.tasks).find(key => 
      jobData.data.tasks[key].operation === 'export/url'
    );

    if (!exportTaskKey) {
      throw new Error('Export-Task nicht gefunden');
    }
    
    const exportTask = jobData.data.tasks[exportTaskKey];
    if (!exportTask.result || !exportTask.result.files || !exportTask.result.files[0]) {
      throw new Error('Export-Task keine Datei verfügbar');
    }

    const pdfUrl = exportTask.result.files[0].url;
    const pdfResponse = await fetch(pdfUrl);
    
    if (!pdfResponse.ok) {
      throw new Error(`PDF download failed: ${pdfResponse.status}`);
    }

    return await pdfResponse.blob();
  }

  async convertDocxToPdf(
    applicationText: string,
    firma: string,
    adresse: string,
    title: string
  ): Promise<Blob> {
    // DOCX erstellen
    const response = await fetch("/Vorlage.docx");
    const arrayBuffer = await response.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const datum = new Date().toLocaleDateString("de-DE");

    doc.render({
      inhalt: applicationText,
      title: title || "Bewerbung",
      datum,
      firma,
      adresse
    });

    const docxBlob = doc.getZip().generate({ type: "blob" });

    // Conversion Job erstellen
    const jobData = await this.createConversionJob();
    
    // Datei hochladen
    await this.uploadFile(jobData, docxBlob);
    
    // Auf Fertigstellung warten
    const completedJob = await this.waitForCompletion(jobData.data.id);
    
    // PDF herunterladen
    return await this.downloadPdf(completedJob);
  }

  generateDocx(
    applicationText: string,
    firma: string,
    adresse: string,
    title: string
  ): Blob {
    const response = fetch("/Vorlage.docx").then(async (res) => {
      const arrayBuffer = await res.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      const datum = new Date().toLocaleDateString("de-DE");

      doc.render({
        inhalt: applicationText,
        title: title || "Bewerbung",
        datum,
        firma,
        adresse
      });

      return doc.getZip().generate({ type: "blob" });
    });

    throw new Error("Async operation - use async version");
  }

  async generateDocxAsync(
    applicationText: string,
    firma: string,
    adresse: string,
    title: string
  ): Promise<Blob> {
    const response = await fetch("/Vorlage.docx");
    const arrayBuffer = await response.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const datum = new Date().toLocaleDateString("de-DE");

    doc.render({
      inhalt: applicationText,
      title: title || "Bewerbung",
      datum,
      firma,
      adresse
    });

    return doc.getZip().generate({ type: "blob" });
  }
}
