import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import nodemailer from "nodemailer";

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    {
      name: "email-sender-middleware",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use("/api/send-email", async (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }
          try {
            let body = "";
            await new Promise<void>((resolve) => {
              req.on("data", (chunk) => (body += chunk));
              req.on("end", () => resolve());
            });
            const payload = JSON.parse(body || "{}");
            const smtp = payload.smtp || {};
            const mail = payload.mail || {};

            const port = Number(smtp.port) || 587;
            const providedSecure =
              typeof smtp.secure === "boolean"
                ? smtp.secure
                : (typeof smtp.secure === "string" ? smtp.secure === "true" : undefined);
            const secure = providedSecure ?? (port === 465);

            const transporter = nodemailer.createTransport({
              host: smtp.host,
              port,
              secure,
              auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
              requireTLS: !secure && port === 587,
              tls: {
                minVersion: "TLSv1.2",
              },
            } as any);

            const attachments = Array.isArray(mail.attachments)
              ? mail.attachments.map((a: any) => ({
                  filename: a.filename,
                  content: Buffer.from(a.base64, "base64"),
                  contentType: a.contentType,
                }))
              : [];

            await transporter.sendMail({
              from: mail.from,
              to: mail.to,
              subject: mail.subject,
              text: mail.text,
              html: mail.html,
              attachments,
            });

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            let message = String(err);
            if (message.includes("Invalid login") || err?.code === "EAUTH") {
              message =
                "SMTP-Authentifizierung fehlgeschlagen. Bitte prüfen Sie Benutzer/Passwort. Bei Gmail/Outlook ggf. App-Passwort verwenden.";
            } else if (message.includes("wrong version number") || err?.code === "EPROTO") {
              message =
                "TLS-Handschlag fehlgeschlagen. Für Port 465: secure=true. Für Port 587: secure=false (STARTTLS).";
            }
            res.end(JSON.stringify({ ok: false, error: message }));
          }
        });

        // Verify SMTP credentials without sending a mail
        server.middlewares.use("/api/verify-smtp", async (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }
          try {
            let body = "";
            await new Promise<void>((resolve) => {
              req.on("data", (chunk) => (body += chunk));
              req.on("end", () => resolve());
            });
            const payload = JSON.parse(body || "{}");
            const smtp = payload.smtp || {};

            const port = Number(smtp.port) || 587;
            const providedSecure =
              typeof smtp.secure === "boolean"
                ? smtp.secure
                : (typeof smtp.secure === "string" ? smtp.secure === "true" : undefined);
            const secure = providedSecure ?? (port === 465);

            const transporter = nodemailer.createTransport({
              host: smtp.host,
              port,
              secure,
              auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
              requireTLS: !secure && port === 587,
              tls: { minVersion: "TLSv1.2" },
            } as any);

            await transporter.verify();
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            let message = String(err);
            if (message.includes("Invalid login") || err?.code === "EAUTH") {
              message =
                "SMTP-Authentifizierung fehlgeschlagen. Prüfen Sie Benutzer/Passwort. Gmail/Outlook oft App-Passwort nötig.";
            } else if (message.includes("wrong version number") || err?.code === "EPROTO") {
              message =
                "TLS-Handschlag fehlgeschlagen. Für Port 465: secure=true. Für Port 587: secure=false (STARTTLS).";
            }
            res.end(JSON.stringify({ ok: false, error: message }));
          }
        });
      },
    },
  ],
});
