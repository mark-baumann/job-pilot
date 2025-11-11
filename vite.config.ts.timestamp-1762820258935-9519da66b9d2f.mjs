var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// vite.config.ts
import { defineConfig } from "file:///C:/Users/Konta/OneDrive/Desktop/job-pilot/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Konta/OneDrive/Desktop/job-pilot/node_modules/@vitejs/plugin-react-swc/index.mjs";
import tsconfigPaths from "file:///C:/Users/Konta/OneDrive/Desktop/job-pilot/node_modules/vite-tsconfig-paths/dist/index.js";
import nodemailer from "file:///C:/Users/Konta/OneDrive/Desktop/job-pilot/node_modules/nodemailer/lib/nodemailer.js";
import { VitePWA } from "file:///C:/Users/Konta/OneDrive/Desktop/job-pilot/node_modules/vite-plugin-pwa/dist/index.js";
import { spawn } from "child_process";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\Konta\\OneDrive\\Desktop\\job-pilot";
var vite_config_default = defineConfig({
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
        server.middlewares.use("/api/run-playwright", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }
          res.setHeader("Content-Type", "application/octet-stream");
          const playwrightTestPath = path.resolve(__vite_injected_original_dirname, "scripts/arbeitsagentur.spec.ts");
          const command = "npx";
          const args = ["playwright", "test", playwrightTestPath];
          const child = spawn(command, args, {
            stdio: ["pipe", "pipe", "pipe"],
            shell: true
          });
          const send = (data) => {
            res.write(JSON.stringify(data) + "\n");
          };
          child.stdout.on("data", (data) => {
            const output = data.toString();
            send({ status: output });
            const screenshotMatch = output.match(/SCREENSHOT_PATH:(.*)/);
            if (screenshotMatch && screenshotMatch[1]) {
              const fs = __require("fs");
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
        server.middlewares.use("/api/send-email", async (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }
          try {
            let body = "";
            await new Promise((resolve) => {
              req.on("data", (chunk) => body += chunk);
              req.on("end", () => resolve());
            });
            const payload = JSON.parse(body || "{}");
            const smtp = payload.smtp || {};
            const mail = payload.mail || {};
            const port = Number(smtp.port) || 587;
            const providedSecure = typeof smtp.secure === "boolean" ? smtp.secure : typeof smtp.secure === "string" ? smtp.secure === "true" : void 0;
            const secure = providedSecure ?? port === 465;
            const transporter = nodemailer.createTransport({
              host: smtp.host,
              port,
              secure,
              auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : void 0,
              requireTLS: !secure && port === 587,
              tls: {
                minVersion: "TLSv1.2"
              }
            });
            const attachments = Array.isArray(mail.attachments) ? mail.attachments.map((a) => ({
              filename: a.filename,
              content: Buffer.from(a.base64, "base64"),
              contentType: a.contentType
            })) : [];
            await transporter.sendMail({
              from: mail.from,
              to: mail.to,
              subject: mail.subject,
              text: mail.text,
              html: mail.html,
              attachments
            });
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            let message = String(err);
            if (message.includes("Invalid login") || err?.code === "EAUTH") {
              message = "SMTP-Authentifizierung fehlgeschlagen. Bitte pr\xFCfen Sie Benutzer/Passwort. Bei Gmail/Outlook ggf. App-Passwort verwenden.";
            } else if (message.includes("wrong version number") || err?.code === "EPROTO") {
              message = "TLS-Handschlag fehlgeschlagen. F\xFCr Port 465: secure=true. F\xFCr Port 587: secure=false (STARTTLS).";
            }
            res.end(JSON.stringify({ ok: false, error: message }));
          }
        });
        server.middlewares.use("/api/verify-smtp", async (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }
          try {
            let body = "";
            await new Promise((resolve) => {
              req.on("data", (chunk) => body += chunk);
              req.on("end", () => resolve());
            });
            const payload = JSON.parse(body || "{}");
            const smtp = payload.smtp || {};
            const port = Number(smtp.port) || 587;
            const providedSecure = typeof smtp.secure === "boolean" ? smtp.secure : typeof smtp.secure === "string" ? smtp.secure === "true" : void 0;
            const secure = providedSecure ?? port === 465;
            const transporter = nodemailer.createTransport({
              host: smtp.host,
              port,
              secure,
              auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : void 0,
              requireTLS: !secure && port === 587,
              tls: { minVersion: "TLSv1.2" }
            });
            await transporter.verify();
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            let message = String(err);
            if (message.includes("Invalid login") || err?.code === "EAUTH") {
              message = "SMTP-Authentifizierung fehlgeschlagen. Pr\xFCfen Sie Benutzer/Passwort. Gmail/Outlook oft App-Passwort n\xF6tig.";
            } else if (message.includes("wrong version number") || err?.code === "EPROTO") {
              message = "TLS-Handschlag fehlgeschlagen. F\xFCr Port 465: secure=true. F\xFCr Port 587: secure=false (STARTTLS).";
            }
            res.end(JSON.stringify({ ok: false, error: message }));
          }
        });
      }
    }
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxLb250YVxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXGpvYi1waWxvdFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcS29udGFcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxqb2ItcGlsb3RcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0tvbnRhL09uZURyaXZlL0Rlc2t0b3Avam9iLXBpbG90L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHRzY29uZmlnUGF0aHMgZnJvbSBcInZpdGUtdHNjb25maWctcGF0aHNcIjtcclxuaW1wb3J0IG5vZGVtYWlsZXIgZnJvbSBcIm5vZGVtYWlsZXJcIjtcclxuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcclxuaW1wb3J0IHsgc3Bhd24gfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgdHNjb25maWdQYXRocygpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogXCJhdXRvVXBkYXRlXCIsXHJcbiAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgbmFtZTogXCJKb2JQaWxvdFwiLFxyXG4gICAgICAgIHNob3J0X25hbWU6IFwiSm9iUGlsb3RcIixcclxuICAgICAgICBzdGFydF91cmw6IFwiL1wiLFxyXG4gICAgICAgIGRpc3BsYXk6IFwic3RhbmRhbG9uZVwiLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIkludGVsbGlnZW50ZXIgQmV3ZXJidW5nc2Fzc2lzdGVudFwiLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiBcIiNmZmZmZmZcIixcclxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiBcIiNmZmZmZmZcIixcclxuICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAgeyBzcmM6IFwiL2FuZHJvaWQtaWNvbi0xOTJ4MTkyLnBuZ1wiLCBzaXplczogXCIxOTJ4MTkyXCIsIHR5cGU6IFwiaW1hZ2UvcG5nXCIgfSxcclxuICAgICAgICAgIHsgc3JjOiBcIi9hcHBsZS1pY29uLTE4MHgxODAucG5nXCIsIHNpemVzOiBcIjE4MHgxODBcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiB9LFxyXG4gICAgICAgICAgeyBzcmM6IFwiL2Zhdmljb24tMzJ4MzIucG5nXCIsIHNpemVzOiBcIjMyeDMyXCIsIHR5cGU6IFwiaW1hZ2UvcG5nXCIgfSxcclxuICAgICAgICAgIHsgc3JjOiBcIi9mYXZpY29uLTE2eDE2LnBuZ1wiLCBzaXplczogXCIxNngxNlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiIH1cclxuICAgICAgICBdXHJcbiAgICAgIH0sXHJcbiAgICAgIHdvcmtib3g6IHtcclxuICAgICAgICBnbG9iUGF0dGVybnM6IFtcIioqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLGpwZyxqcGVnfVwiXVxyXG4gICAgICB9LFxyXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbXHJcbiAgICAgICAgXCJmYXZpY29uLmljb1wiLFxyXG4gICAgICAgIFwiYXBwbGUtaWNvbi01N3g1Ny5wbmdcIixcclxuICAgICAgICBcImFwcGxlLWljb24tNjB4NjAucG5nXCIsXHJcbiAgICAgICAgXCJhcHBsZS1pY29uLTcyeDcyLnBuZ1wiLFxyXG4gICAgICAgIFwiYXBwbGUtaWNvbi03Nng3Ni5wbmdcIixcclxuICAgICAgICBcImFwcGxlLWljb24tMTE0eDExNC5wbmdcIixcclxuICAgICAgICBcImFwcGxlLWljb24tMTIweDEyMC5wbmdcIixcclxuICAgICAgICBcImFwcGxlLWljb24tMTQ0eDE0NC5wbmdcIixcclxuICAgICAgICBcImFwcGxlLWljb24tMTUyeDE1Mi5wbmdcIixcclxuICAgICAgICBcImFwcGxlLWljb24tMTgweDE4MC5wbmdcIixcclxuICAgICAgICBcImFuZHJvaWQtaWNvbi0xOTJ4MTkyLnBuZ1wiXHJcbiAgICAgIF1cclxuICAgIH0pLFxyXG4gICAge1xyXG4gICAgICBuYW1lOiBcImN1c3RvbS1taWRkbGV3YXJlc1wiLFxyXG4gICAgICBhcHBseTogXCJzZXJ2ZVwiLFxyXG4gICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XHJcbiAgICAgICAgLy8gUGxheXdyaWdodCBydW5uZXIgbWlkZGxld2FyZVxyXG4gICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3J1bi1wbGF5d3JpZ2h0XCIsIChyZXEsIHJlcykgPT4ge1xyXG4gICAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7XHJcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDA1O1xyXG4gICAgICAgICAgICByZXMuZW5kKFwiTWV0aG9kIE5vdCBBbGxvd2VkXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiKTtcclxuXHJcbiAgICAgICAgICBjb25zdCBwbGF5d3JpZ2h0VGVzdFBhdGggPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInNjcmlwdHMvYXJiZWl0c2FnZW50dXIuc3BlYy50c1wiKTtcclxuICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBcIm5weFwiO1xyXG4gICAgICAgICAgY29uc3QgYXJncyA9IFtcInBsYXl3cmlnaHRcIiwgXCJ0ZXN0XCIsIHBsYXl3cmlnaHRUZXN0UGF0aF07XHJcblxyXG4gICAgICAgICAgY29uc3QgY2hpbGQgPSBzcGF3bihjb21tYW5kLCBhcmdzLCB7XHJcbiAgICAgICAgICAgIHN0ZGlvOiBbXCJwaXBlXCIsIFwicGlwZVwiLCBcInBpcGVcIl0sXHJcbiAgICAgICAgICAgIHNoZWxsOiB0cnVlLFxyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgY29uc3Qgc2VuZCA9IChkYXRhOiBvYmplY3QpID0+IHtcclxuICAgICAgICAgICAgcmVzLndyaXRlKEpTT04uc3RyaW5naWZ5KGRhdGEpICsgXCJcXG5cIik7XHJcbiAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgIGNoaWxkLnN0ZG91dC5vbihcImRhdGFcIiwgKGRhdGEpID0+IHtcclxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gZGF0YS50b1N0cmluZygpO1xyXG4gICAgICAgICAgICBzZW5kKHsgc3RhdHVzOiBvdXRwdXQgfSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBzY3JlZW5zaG90TWF0Y2ggPSBvdXRwdXQubWF0Y2goL1NDUkVFTlNIT1RfUEFUSDooLiopLyk7XHJcbiAgICAgICAgICAgIGlmIChzY3JlZW5zaG90TWF0Y2ggJiYgc2NyZWVuc2hvdE1hdGNoWzFdKSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgZnMgPSByZXF1aXJlKFwiZnNcIik7XHJcbiAgICAgICAgICAgICAgY29uc3Qgc2NyZWVuc2hvdFBhdGggPSBzY3JlZW5zaG90TWF0Y2hbMV0udHJpbSgpO1xyXG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHNjcmVlbnNob3RQYXRoKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyZWVuc2hvdEJhc2U2NCA9IGZzLnJlYWRGaWxlU3luYyhzY3JlZW5zaG90UGF0aCwgXCJiYXNlNjRcIik7XHJcbiAgICAgICAgICAgICAgICBzZW5kKHsgc2NyZWVuc2hvdDogc2NyZWVuc2hvdEJhc2U2NCB9KTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgIGNoaWxkLnN0ZGVyci5vbihcImRhdGFcIiwgKGRhdGEpID0+IHtcclxuICAgICAgICAgICAgc2VuZCh7IHN0YXR1czogYEVSUk9SOiAke2RhdGEudG9TdHJpbmcoKX1gIH0pO1xyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgY2hpbGQub24oXCJjbG9zZVwiLCAoY29kZSkgPT4ge1xyXG4gICAgICAgICAgICBzZW5kKHsgc3RhdHVzOiBgUGxheXdyaWdodCBzY3JpcHQgZmluaXNoZWQgd2l0aCBjb2RlICR7Y29kZX1gIH0pO1xyXG4gICAgICAgICAgICByZXMuZW5kKCk7XHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICBjaGlsZC5vbihcImVycm9yXCIsIChlcnIpID0+IHtcclxuICAgICAgICAgICAgc2VuZCh7IHN0YXR1czogYEZhaWxlZCB0byBzdGFydCBQbGF5d3JpZ2h0IHNjcmlwdDogJHtlcnIubWVzc2FnZX1gIH0pO1xyXG4gICAgICAgICAgICByZXMuZW5kKCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gRW1haWwgc2VuZGVyIG1pZGRsZXdhcmVcclxuICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9zZW5kLWVtYWlsXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xyXG4gICAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7XHJcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDA1O1xyXG4gICAgICAgICAgICByZXMuZW5kKFwiTWV0aG9kIE5vdCBBbGxvd2VkXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBsZXQgYm9keSA9IFwiXCI7XHJcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgICAgcmVxLm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IChib2R5ICs9IGNodW5rKSk7XHJcbiAgICAgICAgICAgICAgcmVxLm9uKFwiZW5kXCIsICgpID0+IHJlc29sdmUoKSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShib2R5IHx8IFwie31cIik7XHJcbiAgICAgICAgICAgIGNvbnN0IHNtdHAgPSBwYXlsb2FkLnNtdHAgfHwge307XHJcbiAgICAgICAgICAgIGNvbnN0IG1haWwgPSBwYXlsb2FkLm1haWwgfHwge307XHJcblxyXG4gICAgICAgICAgICBjb25zdCBwb3J0ID0gTnVtYmVyKHNtdHAucG9ydCkgfHwgNTg3O1xyXG4gICAgICAgICAgICBjb25zdCBwcm92aWRlZFNlY3VyZSA9XHJcbiAgICAgICAgICAgICAgdHlwZW9mIHNtdHAuc2VjdXJlID09PSBcImJvb2xlYW5cIlxyXG4gICAgICAgICAgICAgICAgPyBzbXRwLnNlY3VyZVxyXG4gICAgICAgICAgICAgICAgOiAodHlwZW9mIHNtdHAuc2VjdXJlID09PSBcInN0cmluZ1wiID8gc210cC5zZWN1cmUgPT09IFwidHJ1ZVwiIDogdW5kZWZpbmVkKTtcclxuICAgICAgICAgICAgY29uc3Qgc2VjdXJlID0gcHJvdmlkZWRTZWN1cmUgPz8gKHBvcnQgPT09IDQ2NSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCB0cmFuc3BvcnRlciA9IG5vZGVtYWlsZXIuY3JlYXRlVHJhbnNwb3J0KHtcclxuICAgICAgICAgICAgICBob3N0OiBzbXRwLmhvc3QsXHJcbiAgICAgICAgICAgICAgcG9ydCxcclxuICAgICAgICAgICAgICBzZWN1cmUsXHJcbiAgICAgICAgICAgICAgYXV0aDogc210cC51c2VyICYmIHNtdHAucGFzcyA/IHsgdXNlcjogc210cC51c2VyLCBwYXNzOiBzbXRwLnBhc3MgfSA6IHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICByZXF1aXJlVExTOiAhc2VjdXJlICYmIHBvcnQgPT09IDU4NyxcclxuICAgICAgICAgICAgICB0bHM6IHtcclxuICAgICAgICAgICAgICAgIG1pblZlcnNpb246IFwiVExTdjEuMlwiLFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0gYXMgYW55KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGF0dGFjaG1lbnRzID0gQXJyYXkuaXNBcnJheShtYWlsLmF0dGFjaG1lbnRzKVxyXG4gICAgICAgICAgICAgID8gbWFpbC5hdHRhY2htZW50cy5tYXAoKGE6IGFueSkgPT4gKHtcclxuICAgICAgICAgICAgICAgICAgZmlsZW5hbWU6IGEuZmlsZW5hbWUsXHJcbiAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IEJ1ZmZlci5mcm9tKGEuYmFzZTY0LCBcImJhc2U2NFwiKSxcclxuICAgICAgICAgICAgICAgICAgY29udGVudFR5cGU6IGEuY29udGVudFR5cGUsXHJcbiAgICAgICAgICAgICAgICB9KSlcclxuICAgICAgICAgICAgICA6IFtdO1xyXG5cclxuICAgICAgICAgICAgYXdhaXQgdHJhbnNwb3J0ZXIuc2VuZE1haWwoe1xyXG4gICAgICAgICAgICAgIGZyb206IG1haWwuZnJvbSxcclxuICAgICAgICAgICAgICB0bzogbWFpbC50byxcclxuICAgICAgICAgICAgICBzdWJqZWN0OiBtYWlsLnN1YmplY3QsXHJcbiAgICAgICAgICAgICAgdGV4dDogbWFpbC50ZXh0LFxyXG4gICAgICAgICAgICAgIGh0bWw6IG1haWwuaHRtbCxcclxuICAgICAgICAgICAgICBhdHRhY2htZW50cyxcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IG9rOiB0cnVlIH0pKTtcclxuICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgICAgbGV0IG1lc3NhZ2UgPSBTdHJpbmcoZXJyKTtcclxuICAgICAgICAgICAgaWYgKG1lc3NhZ2UuaW5jbHVkZXMoXCJJbnZhbGlkIGxvZ2luXCIpIHx8IGVycj8uY29kZSA9PT0gXCJFQVVUSFwiKSB7XHJcbiAgICAgICAgICAgICAgbWVzc2FnZSA9XHJcbiAgICAgICAgICAgICAgICBcIlNNVFAtQXV0aGVudGlmaXppZXJ1bmcgZmVobGdlc2NobGFnZW4uIEJpdHRlIHByXHUwMEZDZmVuIFNpZSBCZW51dHplci9QYXNzd29ydC4gQmVpIEdtYWlsL091dGxvb2sgZ2dmLiBBcHAtUGFzc3dvcnQgdmVyd2VuZGVuLlwiO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKG1lc3NhZ2UuaW5jbHVkZXMoXCJ3cm9uZyB2ZXJzaW9uIG51bWJlclwiKSB8fCBlcnI/LmNvZGUgPT09IFwiRVBST1RPXCIpIHtcclxuICAgICAgICAgICAgICBtZXNzYWdlID1cclxuICAgICAgICAgICAgICAgIFwiVExTLUhhbmRzY2hsYWcgZmVobGdlc2NobGFnZW4uIEZcdTAwRkNyIFBvcnQgNDY1OiBzZWN1cmU9dHJ1ZS4gRlx1MDBGQ3IgUG9ydCA1ODc6IHNlY3VyZT1mYWxzZSAoU1RBUlRUTFMpLlwiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBvazogZmFsc2UsIGVycm9yOiBtZXNzYWdlIH0pKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gVmVyaWZ5IFNNVFAgY3JlZGVudGlhbHMgd2l0aG91dCBzZW5kaW5nIGEgbWFpbFxyXG4gICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3ZlcmlmeS1zbXRwXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xyXG4gICAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7XHJcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDA1O1xyXG4gICAgICAgICAgICByZXMuZW5kKFwiTWV0aG9kIE5vdCBBbGxvd2VkXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBsZXQgYm9keSA9IFwiXCI7XHJcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgICAgcmVxLm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IChib2R5ICs9IGNodW5rKSk7XHJcbiAgICAgICAgICAgICAgcmVxLm9uKFwiZW5kXCIsICgpID0+IHJlc29sdmUoKSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShib2R5IHx8IFwie31cIik7XHJcbiAgICAgICAgICAgIGNvbnN0IHNtdHAgPSBwYXlsb2FkLnNtdHAgfHwge307XHJcblxyXG4gICAgICAgICAgICBjb25zdCBwb3J0ID0gTnVtYmVyKHNtdHAucG9ydCkgfHwgNTg3O1xyXG4gICAgICAgICAgICBjb25zdCBwcm92aWRlZFNlY3VyZSA9XHJcbiAgICAgICAgICAgICAgdHlwZW9mIHNtdHAuc2VjdXJlID09PSBcImJvb2xlYW5cIlxyXG4gICAgICAgICAgICAgICAgPyBzbXRwLnNlY3VyZVxyXG4gICAgICAgICAgICAgICAgOiAodHlwZW9mIHNtdHAuc2VjdXJlID09PSBcInN0cmluZ1wiID8gc210cC5zZWN1cmUgPT09IFwidHJ1ZVwiIDogdW5kZWZpbmVkKTtcclxuICAgICAgICAgICAgY29uc3Qgc2VjdXJlID0gcHJvdmlkZWRTZWN1cmUgPz8gKHBvcnQgPT09IDQ2NSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCB0cmFuc3BvcnRlciA9IG5vZGVtYWlsZXIuY3JlYXRlVHJhbnNwb3J0KHtcclxuICAgICAgICAgICAgICBob3N0OiBzbXRwLmhvc3QsXHJcbiAgICAgICAgICAgICAgcG9ydCxcclxuICAgICAgICAgICAgICBzZWN1cmUsXHJcbiAgICAgICAgICAgICAgYXV0aDogc210cC51c2VyICYmIHNtdHAucGFzcyA/IHsgdXNlcjogc210cC51c2VyLCBwYXNzOiBzbXRwLnBhc3MgfSA6IHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICByZXF1aXJlVExTOiAhc2VjdXJlICYmIHBvcnQgPT09IDU4NyxcclxuICAgICAgICAgICAgICB0bHM6IHsgbWluVmVyc2lvbjogXCJUTFN2MS4yXCIgfSxcclxuICAgICAgICAgICAgfSBhcyBhbnkpO1xyXG5cclxuICAgICAgICAgICAgYXdhaXQgdHJhbnNwb3J0ZXIudmVyaWZ5KCk7XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgb2s6IHRydWUgfSkpO1xyXG4gICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgICAgICAgICBsZXQgbWVzc2FnZSA9IFN0cmluZyhlcnIpO1xyXG4gICAgICAgICAgICBpZiAobWVzc2FnZS5pbmNsdWRlcyhcIkludmFsaWQgbG9naW5cIikgfHwgZXJyPy5jb2RlID09PSBcIkVBVVRIXCIpIHtcclxuICAgICAgICAgICAgICBtZXNzYWdlID1cclxuICAgICAgICAgICAgICAgIFwiU01UUC1BdXRoZW50aWZpemllcnVuZyBmZWhsZ2VzY2hsYWdlbi4gUHJcdTAwRkNmZW4gU2llIEJlbnV0emVyL1Bhc3N3b3J0LiBHbWFpbC9PdXRsb29rIG9mdCBBcHAtUGFzc3dvcnQgblx1MDBGNnRpZy5cIjtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChtZXNzYWdlLmluY2x1ZGVzKFwid3JvbmcgdmVyc2lvbiBudW1iZXJcIikgfHwgZXJyPy5jb2RlID09PSBcIkVQUk9UT1wiKSB7XHJcbiAgICAgICAgICAgICAgbWVzc2FnZSA9XHJcbiAgICAgICAgICAgICAgICBcIlRMUy1IYW5kc2NobGFnIGZlaGxnZXNjaGxhZ2VuLiBGXHUwMEZDciBQb3J0IDQ2NTogc2VjdXJlPXRydWUuIEZcdTAwRkNyIFBvcnQgNTg3OiBzZWN1cmU9ZmFsc2UgKFNUQVJUVExTKS5cIjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgb2s6IGZhbHNlLCBlcnJvcjogbWVzc2FnZSB9KSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIF0sXHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7OztBQUF5VCxTQUFTLG9CQUFvQjtBQUN0VixPQUFPLFdBQVc7QUFDbEIsT0FBTyxtQkFBbUI7QUFDMUIsT0FBTyxnQkFBZ0I7QUFDdkIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsYUFBYTtBQUN0QixPQUFPLFVBQVU7QUFOakIsSUFBTSxtQ0FBbUM7QUFRekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLElBQ2QsUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1B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
