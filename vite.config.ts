import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import nodemailer from "nodemailer";
import { VitePWA } from "vite-plugin-pwa";
import { spawn } from "child_process";
import path from "path";

export default defineConfig({
  optimizeDeps: {
    // Verhindert, dass serverseitige Pakete von Vite vorgebundled werden
    exclude: [
      "playwright-core",
      "@sparticuz/chromium",
      "pg",
      "nodemailer",
      "@vercel/kv",
    ],
  },
  ssr: {
    // Stellt sicher, dass diese Pakete als externe Node-Deps behandelt werden
    external: ["pg", "playwright-core", "@sparticuz/chromium", "nodemailer"],
  },
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "JobPilot",
        short_name: "JobPilot",
        start_url: "/",
        display: "standalone",
        description: "Intelligenter Bewerbungsassistent",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        icons: [
          { src: "/android-icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
          { src: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
          { src: "/favicon-16x16.png", sizes: "16x16", type: "image/png" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg}"]
      },
      includeAssets: [
        "favicon.ico",
        "apple-icon-57x57.png",
        "apple-icon-60x60.png",
        "apple-icon-72x72.png",
        "apple-icon-76x76.png",
        "apple-icon-114x114.png",
        "apple-icon-120x120.png",
        "apple-icon-144x144.png",
        "apple-icon-152x152.png",
        "apple-icon-180x180.png",
        "android-icon-192x192.png"
      ]
    }),
    {
      name: "custom-middlewares", 
      apply: "serve",
      configureServer(server) {
        // Dev-API: scrape-arbeitsagentur (SSE)
        server.middlewares.use("/api/scrape-arbeitsagentur", async (req, res) => {
          if (req.method !== "GET" && req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }
          const mod = await server.ssrLoadModule(path.resolve(__dirname, "api/scrape-arbeitsagentur.ts"));
          return (mod as any).default(req, res);
        });

        // Dev-API: list-jobs (Postgres)
        server.middlewares.use("/api/list-jobs", async (req, res) => {
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }
          const mod = await server.ssrLoadModule(path.resolve(__dirname, "api/list-jobs.ts"));
          return (mod as any).default(req, res);
        });

        // Dev-API: CloudConvert Keys
        server.middlewares.use("/api/cloudconvert", async (req, res) => {
          const mod = await server.ssrLoadModule(
            path.resolve(__dirname, "api/cloudconvert.ts")
          );
          return (mod as any).default(req, res);
        });

        // Dev-API: Verify App Password
        server.middlewares.use("/api/verify-app-password", async (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }
          const mod = await server.ssrLoadModule(
            path.resolve(__dirname, "api/verify-app-password.ts")
          );
          return (mod as any).default(req, res);
        });

        // Dev-API: Job Links Management
        server.middlewares.use("/api/job-links", async (req, res) => {
          const mod = await server.ssrLoadModule(
            path.resolve(__dirname, "api/job-links.ts")
          );
          return (mod as any).default(req, res);
        });

        // Dev-API: Cron Job (for testing)
        server.middlewares.use("/api/scrape-arbeitsagentur-cron", async (req, res) => {
          const mod = await server.ssrLoadModule(
            path.resolve(__dirname, "api/scrape-arbeitsagentur-cron.ts")
          );
          return (mod as any).default(req, res);
        });




        // Playwright runner middleware
        server.middlewares.use("/api/run-playwright", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }

          res.setHeader("Content-Type", "application/octet-stream");

          const playwrightTestPath = path.resolve(__dirname, "scripts/arbeitsagentur.spec.ts");
          const command = "npx";
          const args = ["playwright", "test", playwrightTestPath];

          const child = spawn(command, args, {
            stdio: ["pipe", "pipe", "pipe"],
            shell: true,
          });

          const send = (data: object) => {
            res.write(JSON.stringify(data) + "\n");
          };

          child.stdout.on("data", (data) => {
            const output = data.toString();
            send({ status: output });

            const screenshotMatch = output.match(/SCREENSHOT_PATH:(.*)/);
            if (screenshotMatch && screenshotMatch[1]) {
              const fs = require("fs");
              const screenshotPath = screenshotMatch[1].trim();
              if (fs.existsSync(screenshotPath)) {
                const screenshotBase64 = fs.readFileSync(screenshotPath, "base64");
                send({ screenshot: screenshotBase64 });
              }
            }
          });

          child.stderr.on("data", (data) => {
            send({ status: `ERROR: ${data.toString()}` });
          });

          child.on("close", (code) => {
            send({ status: `Playwright script finished with code ${code}` });
            res.end();
          });

          child.on("error", (err) => {
            send({ status: `Failed to start Playwright script: ${err.message}` });
            res.end();
          });
        });

        // Email sender middleware
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
