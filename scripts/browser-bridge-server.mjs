import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { resolve } from "node:path";

const host = "127.0.0.1";
const port = Number(process.env.SCR_BRIDGE_PORT || 43127);
const token = randomBytes(24).toString("hex");
const importerPath = resolve("scripts/import-browser-batch.mjs");
const collectorPath = resolve("scripts/scr-browser-collector.js");
const maxBodyBytes = 15 * 1024 * 1024;

function page(body) {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SCR local inventory bridge</title>
<style>
  body{font:16px/1.5 system-ui;max-width:760px;margin:40px auto;padding:0 20px;color:#172033}
  textarea{box-sizing:border-box;width:100%;min-height:45vh;font:12px/1.4 ui-monospace,monospace}
  button{margin-top:12px;padding:10px 16px;font:inherit}
  pre{white-space:pre-wrap;background:#f3f5f8;padding:16px;border-radius:8px}
</style>
${body}
</html>`;
}

function send(response, status, body) {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
  });
  response.end(page(body));
}

function sendJson(response, status, body, origin) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  if (origin === "https://scr.sci.gov.in") {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "origin";
  }
  response.writeHead(status, headers);
  response.end(`${JSON.stringify(body)}\n`);
}

function sendJavaScript(response, status, body, origin) {
  const headers = {
    "content-type": "text/javascript; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  if (origin === "https://scr.sci.gov.in") {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "origin";
  }
  response.writeHead(status, headers);
  response.end(body);
}

function runImporter(payload) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [importerPath], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(stdout.trim());
      else reject(new Error(stderr.trim() || `Importer exited with code ${code}`));
    });
    child.stdin.end(payload);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  const origin = request.headers.origin;

  if (request.method === "OPTIONS" && url.pathname === "/api/import") {
    if (origin !== "https://scr.sci.gov.in") {
      sendJson(response, 403, { ok: false, error: "Origin not allowed" });
      return;
    }
    response.writeHead(204, {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "600",
      vary: "origin",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/status" && url.searchParams.get("token") === token) {
    sendJson(response, 200, { ok: true, bridge: "ready" }, origin);
    return;
  }

  if (request.method === "GET" && url.pathname === "/collector.js" && url.searchParams.get("token") === token) {
    if (origin !== "https://scr.sci.gov.in") {
      sendJson(response, 403, { ok: false, error: "Origin not allowed" }, origin);
      return;
    }
    readFile(collectorPath, "utf8")
      .then((source) => {
        const bridgePageUrl = `http://${host}:${port}/?token=${token}`;
        const prepared = source.replace(
          'const bridgePageUrl = prompt("Paste the SCR bridge URL printed by npm run inventory:bridge");',
          `const bridgePageUrl = ${JSON.stringify(bridgePageUrl)};`,
        );
        sendJavaScript(response, 200, prepared, origin);
      })
      .catch((error) => sendJavaScript(response, 500, `throw new Error(${JSON.stringify(String(error.message))});`, origin));
    return;
  }

  if (request.method === "GET" && url.pathname === "/" && url.searchParams.get("token") === token) {
    send(response, 200, `<h1>SCR local inventory bridge</h1>
      <p>Paste one validated browser batch. Data is stored only in this project.</p>
      <form method="post" action="/import?token=${token}">
        <textarea name="payload" aria-label="SCR metadata JSON" required></textarea>
        <button type="submit">Import batch</button>
      </form>`);
    return;
  }

  if (request.method === "POST" && url.pathname === "/import" && url.searchParams.get("token") === token) {
    let body = "";
    let bytes = 0;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxBodyBytes) request.destroy();
      else body += chunk;
    });
    request.on("end", async () => {
      try {
        const payload = new URLSearchParams(body).get("payload");
        if (!payload) throw new Error("Missing payload");
        const result = await runImporter(payload);
        send(response, 200, `<h1>Import complete</h1><pre>${result.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</pre>`);
      } catch (error) {
        send(response, 400, `<h1>Import failed</h1><pre>${String(error.message).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</pre>`);
      }
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/import" && url.searchParams.get("token") === token) {
    if (origin !== "https://scr.sci.gov.in") {
      sendJson(response, 403, { ok: false, error: "Origin not allowed" });
      return;
    }
    let body = "";
    let bytes = 0;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxBodyBytes) request.destroy();
      else body += chunk;
    });
    request.on("end", async () => {
      try {
        JSON.parse(body);
        const result = await runImporter(body);
        sendJson(response, 200, { ok: true, result }, origin);
      } catch (error) {
        sendJson(response, 400, { ok: false, error: String(error.message) }, origin);
      }
    });
    return;
  }

  send(response, 404, "<h1>Not found</h1>");
});

server.listen(port, host, () => {
  console.log(`SCR bridge ready: http://${host}:${port}/?token=${token}`);
});
