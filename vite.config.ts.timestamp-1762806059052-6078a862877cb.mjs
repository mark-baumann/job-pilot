// vite.config.ts
import { defineConfig } from "file:///C:/Users/Konta/OneDrive/Desktop/job-pilot/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Konta/OneDrive/Desktop/job-pilot/node_modules/@vitejs/plugin-react-swc/index.mjs";
import tsconfigPaths from "file:///C:/Users/Konta/OneDrive/Desktop/job-pilot/node_modules/vite-tsconfig-paths/dist/index.js";
import nodemailer from "file:///C:/Users/Konta/OneDrive/Desktop/job-pilot/node_modules/nodemailer/lib/nodemailer.js";
import { VitePWA } from "file:///C:/Users/Konta/OneDrive/Desktop/job-pilot/node_modules/vite-plugin-pwa/dist/index.js";
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxLb250YVxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXGpvYi1waWxvdFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcS29udGFcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxqb2ItcGlsb3RcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0tvbnRhL09uZURyaXZlL0Rlc2t0b3Avam9iLXBpbG90L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHRzY29uZmlnUGF0aHMgZnJvbSBcInZpdGUtdHNjb25maWctcGF0aHNcIjtcclxuaW1wb3J0IG5vZGVtYWlsZXIgZnJvbSBcIm5vZGVtYWlsZXJcIjtcclxuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIHRzY29uZmlnUGF0aHMoKSxcclxuICAgIFZpdGVQV0Eoe1xyXG4gICAgICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxyXG4gICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgIG5hbWU6IFwiSm9iUGlsb3RcIixcclxuICAgICAgICBzaG9ydF9uYW1lOiBcIkpvYlBpbG90XCIsXHJcbiAgICAgICAgc3RhcnRfdXJsOiBcIi9cIixcclxuICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcclxuICAgICAgICBkZXNjcmlwdGlvbjogXCJJbnRlbGxpZ2VudGVyIEJld2VyYnVuZ3Nhc3Npc3RlbnRcIixcclxuICAgICAgICB0aGVtZV9jb2xvcjogXCIjZmZmZmZmXCIsXHJcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogXCIjZmZmZmZmXCIsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHsgc3JjOiBcIi9hbmRyb2lkLWljb24tMTkyeDE5Mi5wbmdcIiwgc2l6ZXM6IFwiMTkyeDE5MlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiIH0sXHJcbiAgICAgICAgICB7IHNyYzogXCIvYXBwbGUtaWNvbi0xODB4MTgwLnBuZ1wiLCBzaXplczogXCIxODB4MTgwXCIsIHR5cGU6IFwiaW1hZ2UvcG5nXCIgfSxcclxuICAgICAgICAgIHsgc3JjOiBcIi9mYXZpY29uLTMyeDMyLnBuZ1wiLCBzaXplczogXCIzMngzMlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiIH0sXHJcbiAgICAgICAgICB7IHNyYzogXCIvZmF2aWNvbi0xNngxNi5wbmdcIiwgc2l6ZXM6IFwiMTZ4MTZcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiB9XHJcbiAgICAgICAgXVxyXG4gICAgICB9LFxyXG4gICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbXCIqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2ZyxqcGcsanBlZ31cIl1cclxuICAgICAgfSxcclxuICAgICAgaW5jbHVkZUFzc2V0czogW1xyXG4gICAgICAgIFwiZmF2aWNvbi5pY29cIixcclxuICAgICAgICBcImFwcGxlLWljb24tNTd4NTcucG5nXCIsXHJcbiAgICAgICAgXCJhcHBsZS1pY29uLTYweDYwLnBuZ1wiLFxyXG4gICAgICAgIFwiYXBwbGUtaWNvbi03Mng3Mi5wbmdcIixcclxuICAgICAgICBcImFwcGxlLWljb24tNzZ4NzYucG5nXCIsXHJcbiAgICAgICAgXCJhcHBsZS1pY29uLTExNHgxMTQucG5nXCIsXHJcbiAgICAgICAgXCJhcHBsZS1pY29uLTEyMHgxMjAucG5nXCIsXHJcbiAgICAgICAgXCJhcHBsZS1pY29uLTE0NHgxNDQucG5nXCIsXHJcbiAgICAgICAgXCJhcHBsZS1pY29uLTE1MngxNTIucG5nXCIsXHJcbiAgICAgICAgXCJhcHBsZS1pY29uLTE4MHgxODAucG5nXCIsXHJcbiAgICAgICAgXCJhbmRyb2lkLWljb24tMTkyeDE5Mi5wbmdcIlxyXG4gICAgICBdXHJcbiAgICB9KSxcclxuICAgIHtcclxuICAgICAgbmFtZTogXCJlbWFpbC1zZW5kZXItbWlkZGxld2FyZVwiLFxyXG4gICAgICBhcHBseTogXCJzZXJ2ZVwiLFxyXG4gICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XHJcbiAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvc2VuZC1lbWFpbFwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcclxuICAgICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikge1xyXG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwNTtcclxuICAgICAgICAgICAgcmVzLmVuZChcIk1ldGhvZCBOb3QgQWxsb3dlZFwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgbGV0IGJvZHkgPSBcIlwiO1xyXG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICAgIHJlcS5vbihcImRhdGFcIiwgKGNodW5rKSA9PiAoYm9keSArPSBjaHVuaykpO1xyXG4gICAgICAgICAgICAgIHJlcS5vbihcImVuZFwiLCAoKSA9PiByZXNvbHZlKCkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoYm9keSB8fCBcInt9XCIpO1xyXG4gICAgICAgICAgICBjb25zdCBzbXRwID0gcGF5bG9hZC5zbXRwIHx8IHt9O1xyXG4gICAgICAgICAgICBjb25zdCBtYWlsID0gcGF5bG9hZC5tYWlsIHx8IHt9O1xyXG5cclxuICAgICAgICAgICAgY29uc3QgcG9ydCA9IE51bWJlcihzbXRwLnBvcnQpIHx8IDU4NztcclxuICAgICAgICAgICAgY29uc3QgcHJvdmlkZWRTZWN1cmUgPVxyXG4gICAgICAgICAgICAgIHR5cGVvZiBzbXRwLnNlY3VyZSA9PT0gXCJib29sZWFuXCJcclxuICAgICAgICAgICAgICAgID8gc210cC5zZWN1cmVcclxuICAgICAgICAgICAgICAgIDogKHR5cGVvZiBzbXRwLnNlY3VyZSA9PT0gXCJzdHJpbmdcIiA/IHNtdHAuc2VjdXJlID09PSBcInRydWVcIiA6IHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNlY3VyZSA9IHByb3ZpZGVkU2VjdXJlID8/IChwb3J0ID09PSA0NjUpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgdHJhbnNwb3J0ZXIgPSBub2RlbWFpbGVyLmNyZWF0ZVRyYW5zcG9ydCh7XHJcbiAgICAgICAgICAgICAgaG9zdDogc210cC5ob3N0LFxyXG4gICAgICAgICAgICAgIHBvcnQsXHJcbiAgICAgICAgICAgICAgc2VjdXJlLFxyXG4gICAgICAgICAgICAgIGF1dGg6IHNtdHAudXNlciAmJiBzbXRwLnBhc3MgPyB7IHVzZXI6IHNtdHAudXNlciwgcGFzczogc210cC5wYXNzIH0gOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgcmVxdWlyZVRMUzogIXNlY3VyZSAmJiBwb3J0ID09PSA1ODcsXHJcbiAgICAgICAgICAgICAgdGxzOiB7XHJcbiAgICAgICAgICAgICAgICBtaW5WZXJzaW9uOiBcIlRMU3YxLjJcIixcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9IGFzIGFueSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBhdHRhY2htZW50cyA9IEFycmF5LmlzQXJyYXkobWFpbC5hdHRhY2htZW50cylcclxuICAgICAgICAgICAgICA/IG1haWwuYXR0YWNobWVudHMubWFwKChhOiBhbnkpID0+ICh7XHJcbiAgICAgICAgICAgICAgICAgIGZpbGVuYW1lOiBhLmZpbGVuYW1lLFxyXG4gICAgICAgICAgICAgICAgICBjb250ZW50OiBCdWZmZXIuZnJvbShhLmJhc2U2NCwgXCJiYXNlNjRcIiksXHJcbiAgICAgICAgICAgICAgICAgIGNvbnRlbnRUeXBlOiBhLmNvbnRlbnRUeXBlLFxyXG4gICAgICAgICAgICAgICAgfSkpXHJcbiAgICAgICAgICAgICAgOiBbXTtcclxuXHJcbiAgICAgICAgICAgIGF3YWl0IHRyYW5zcG9ydGVyLnNlbmRNYWlsKHtcclxuICAgICAgICAgICAgICBmcm9tOiBtYWlsLmZyb20sXHJcbiAgICAgICAgICAgICAgdG86IG1haWwudG8sXHJcbiAgICAgICAgICAgICAgc3ViamVjdDogbWFpbC5zdWJqZWN0LFxyXG4gICAgICAgICAgICAgIHRleHQ6IG1haWwudGV4dCxcclxuICAgICAgICAgICAgICBodG1sOiBtYWlsLmh0bWwsXHJcbiAgICAgICAgICAgICAgYXR0YWNobWVudHMsXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBvazogdHJ1ZSB9KSk7XHJcbiAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcclxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgICAgIGxldCBtZXNzYWdlID0gU3RyaW5nKGVycik7XHJcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLmluY2x1ZGVzKFwiSW52YWxpZCBsb2dpblwiKSB8fCBlcnI/LmNvZGUgPT09IFwiRUFVVEhcIikge1xyXG4gICAgICAgICAgICAgIG1lc3NhZ2UgPVxyXG4gICAgICAgICAgICAgICAgXCJTTVRQLUF1dGhlbnRpZml6aWVydW5nIGZlaGxnZXNjaGxhZ2VuLiBCaXR0ZSBwclx1MDBGQ2ZlbiBTaWUgQmVudXR6ZXIvUGFzc3dvcnQuIEJlaSBHbWFpbC9PdXRsb29rIGdnZi4gQXBwLVBhc3N3b3J0IHZlcndlbmRlbi5cIjtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChtZXNzYWdlLmluY2x1ZGVzKFwid3JvbmcgdmVyc2lvbiBudW1iZXJcIikgfHwgZXJyPy5jb2RlID09PSBcIkVQUk9UT1wiKSB7XHJcbiAgICAgICAgICAgICAgbWVzc2FnZSA9XHJcbiAgICAgICAgICAgICAgICBcIlRMUy1IYW5kc2NobGFnIGZlaGxnZXNjaGxhZ2VuLiBGXHUwMEZDciBQb3J0IDQ2NTogc2VjdXJlPXRydWUuIEZcdTAwRkNyIFBvcnQgNTg3OiBzZWN1cmU9ZmFsc2UgKFNUQVJUVExTKS5cIjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgb2s6IGZhbHNlLCBlcnJvcjogbWVzc2FnZSB9KSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIFZlcmlmeSBTTVRQIGNyZWRlbnRpYWxzIHdpdGhvdXQgc2VuZGluZyBhIG1haWxcclxuICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS92ZXJpZnktc210cFwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcclxuICAgICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikge1xyXG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwNTtcclxuICAgICAgICAgICAgcmVzLmVuZChcIk1ldGhvZCBOb3QgQWxsb3dlZFwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgbGV0IGJvZHkgPSBcIlwiO1xyXG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICAgIHJlcS5vbihcImRhdGFcIiwgKGNodW5rKSA9PiAoYm9keSArPSBjaHVuaykpO1xyXG4gICAgICAgICAgICAgIHJlcS5vbihcImVuZFwiLCAoKSA9PiByZXNvbHZlKCkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoYm9keSB8fCBcInt9XCIpO1xyXG4gICAgICAgICAgICBjb25zdCBzbXRwID0gcGF5bG9hZC5zbXRwIHx8IHt9O1xyXG5cclxuICAgICAgICAgICAgY29uc3QgcG9ydCA9IE51bWJlcihzbXRwLnBvcnQpIHx8IDU4NztcclxuICAgICAgICAgICAgY29uc3QgcHJvdmlkZWRTZWN1cmUgPVxyXG4gICAgICAgICAgICAgIHR5cGVvZiBzbXRwLnNlY3VyZSA9PT0gXCJib29sZWFuXCJcclxuICAgICAgICAgICAgICAgID8gc210cC5zZWN1cmVcclxuICAgICAgICAgICAgICAgIDogKHR5cGVvZiBzbXRwLnNlY3VyZSA9PT0gXCJzdHJpbmdcIiA/IHNtdHAuc2VjdXJlID09PSBcInRydWVcIiA6IHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNlY3VyZSA9IHByb3ZpZGVkU2VjdXJlID8/IChwb3J0ID09PSA0NjUpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgdHJhbnNwb3J0ZXIgPSBub2RlbWFpbGVyLmNyZWF0ZVRyYW5zcG9ydCh7XHJcbiAgICAgICAgICAgICAgaG9zdDogc210cC5ob3N0LFxyXG4gICAgICAgICAgICAgIHBvcnQsXHJcbiAgICAgICAgICAgICAgc2VjdXJlLFxyXG4gICAgICAgICAgICAgIGF1dGg6IHNtdHAudXNlciAmJiBzbXRwLnBhc3MgPyB7IHVzZXI6IHNtdHAudXNlciwgcGFzczogc210cC5wYXNzIH0gOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgcmVxdWlyZVRMUzogIXNlY3VyZSAmJiBwb3J0ID09PSA1ODcsXHJcbiAgICAgICAgICAgICAgdGxzOiB7IG1pblZlcnNpb246IFwiVExTdjEuMlwiIH0sXHJcbiAgICAgICAgICAgIH0gYXMgYW55KTtcclxuXHJcbiAgICAgICAgICAgIGF3YWl0IHRyYW5zcG9ydGVyLnZlcmlmeSgpO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IG9rOiB0cnVlIH0pKTtcclxuICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgICAgbGV0IG1lc3NhZ2UgPSBTdHJpbmcoZXJyKTtcclxuICAgICAgICAgICAgaWYgKG1lc3NhZ2UuaW5jbHVkZXMoXCJJbnZhbGlkIGxvZ2luXCIpIHx8IGVycj8uY29kZSA9PT0gXCJFQVVUSFwiKSB7XHJcbiAgICAgICAgICAgICAgbWVzc2FnZSA9XHJcbiAgICAgICAgICAgICAgICBcIlNNVFAtQXV0aGVudGlmaXppZXJ1bmcgZmVobGdlc2NobGFnZW4uIFByXHUwMEZDZmVuIFNpZSBCZW51dHplci9QYXNzd29ydC4gR21haWwvT3V0bG9vayBvZnQgQXBwLVBhc3N3b3J0IG5cdTAwRjZ0aWcuXCI7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobWVzc2FnZS5pbmNsdWRlcyhcIndyb25nIHZlcnNpb24gbnVtYmVyXCIpIHx8IGVycj8uY29kZSA9PT0gXCJFUFJPVE9cIikge1xyXG4gICAgICAgICAgICAgIG1lc3NhZ2UgPVxyXG4gICAgICAgICAgICAgICAgXCJUTFMtSGFuZHNjaGxhZyBmZWhsZ2VzY2hsYWdlbi4gRlx1MDBGQ3IgUG9ydCA0NjU6IHNlY3VyZT10cnVlLiBGXHUwMEZDciBQb3J0IDU4Nzogc2VjdXJlPWZhbHNlIChTVEFSVFRMUykuXCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IG9rOiBmYWxzZSwgZXJyb3I6IG1lc3NhZ2UgfSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIF0sXHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlULFNBQVMsb0JBQW9CO0FBQ3RWLE9BQU8sV0FBVztBQUNsQixPQUFPLG1CQUFtQjtBQUMxQixPQUFPLGdCQUFnQjtBQUN2QixTQUFTLGVBQWU7QUFFeEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLElBQ2QsUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsVUFBVTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osV0FBVztBQUFBLFFBQ1gsU0FBUztBQUFBLFFBQ1QsYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2Isa0JBQWtCO0FBQUEsUUFDbEIsT0FBTztBQUFBLFVBQ0wsRUFBRSxLQUFLLDZCQUE2QixPQUFPLFdBQVcsTUFBTSxZQUFZO0FBQUEsVUFDeEUsRUFBRSxLQUFLLDJCQUEyQixPQUFPLFdBQVcsTUFBTSxZQUFZO0FBQUEsVUFDdEUsRUFBRSxLQUFLLHNCQUFzQixPQUFPLFNBQVMsTUFBTSxZQUFZO0FBQUEsVUFDL0QsRUFBRSxLQUFLLHNCQUFzQixPQUFPLFNBQVMsTUFBTSxZQUFZO0FBQUEsUUFDakU7QUFBQSxNQUNGO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUCxj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
