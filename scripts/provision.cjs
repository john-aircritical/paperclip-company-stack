// Provisioning script for authenticated mode.
// Signs up admin user, then uses the session cookie to create company, secrets, agents, plugins.

const { execFileSync } = require("child_process");
const fs = require("fs");
const http = require("http");

const PORT = process.env.PCLIP_PORT || process.env.PORT || 9000;
const PAPERCLIP = `http://localhost:${PORT}`;
const COMPANY_NAME = process.env.COMPANY_NAME || "AI Company";
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@paperclip.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "paperclip-admin-2026";

let sessionCookie = "";

function log(msg) {
  console.log(`[provision] ${msg}`);
}

async function main() {
  try {
    // Step 1: Sign up admin user
    log(`Signing up admin: ${ADMIN_EMAIL}...`);
    const signupRes = await apiFetch("/api/auth/sign-up/email", {
      method: "POST",
      body: { name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    if (!signupRes.ok) {
      // Maybe user already exists — try to sign in instead
      log(`Signup returned ${signupRes.status}, trying sign-in...`);
      const signinRes = await apiFetch("/api/auth/sign-in/email", {
        method: "POST",
        body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      });
      if (!signinRes.ok) {
        throw new Error(`Both signup (${signupRes.status}: ${signupRes.body.slice(0, 200)}) and signin (${signinRes.status}: ${signinRes.body.slice(0, 200)}) failed`);
      }
      sessionCookie = extractCookies(signinRes.headers);
      log("Signed in with existing account");
    } else {
      sessionCookie = extractCookies(signupRes.headers);
      log("Admin account created");
    }

    if (!sessionCookie) {
      throw new Error("No session cookie received from auth");
    }
    log(`Session cookie obtained (${sessionCookie.length} chars)`);

    // Step 1b: Claim bootstrap invite (become instance admin)
    // The bootstrap token is in /paperclip/instances/default/.env or we can read it
    // from the Paperclip CLI output. Paperclip generates: pcp_bootstrap_<hex>
    log("Checking bootstrap status...");
    const healthRes = await apiFetch("/api/health", { method: "GET" });
    const health = JSON.parse(healthRes.body);
    if (health.bootstrapStatus === "bootstrap_pending") {
      log("Bootstrap pending — claiming instance admin...");

      // Read the bootstrap token captured by the entrypoint from Paperclip's startup log
      let bootstrapToken = "";
      try {
        bootstrapToken = fs.readFileSync("/paperclip/.bootstrap-token", "utf-8").trim();
      } catch {}

      if (!bootstrapToken) {
        // Fallback: check the startup log directly
        try {
          const startupLog = fs.readFileSync("/tmp/paperclip-startup.log", "utf-8");
          const match = startupLog.match(/pcp_bootstrap_[a-f0-9]+/);
          if (match) bootstrapToken = match[0];
        } catch {}
      }

      if (bootstrapToken) {
        log(`Found bootstrap token: ${bootstrapToken.slice(0, 20)}...`);
        // Visit the invite URL (this is how the browser would accept it)
        const invitePageRes = await apiFetch(`/invite/${bootstrapToken}`, {
          method: "GET",
          cookie: sessionCookie,
        });
        log(`Invite page: ${invitePageRes.status}`);
        const pageCookies = extractCookies(invitePageRes.headers);
        if (pageCookies) sessionCookie = pageCookies;

        // Accept the bootstrap invite via the correct API endpoint
        const acceptRes = await apiFetch(`/api/invites/${bootstrapToken}/accept`, {
          method: "POST",
          body: { requestType: "human" },
          cookie: sessionCookie,
        });
        log(`Accept invite: ${acceptRes.status} ${acceptRes.body.slice(0, 300)}`);
        const acceptCookies = extractCookies(acceptRes.headers);
        if (acceptCookies) sessionCookie = acceptCookies;

        if (acceptRes.ok) {
          log("Bootstrap invite accepted — promoted to instance admin!");
        } else {
          log(`WARNING: Could not accept bootstrap invite (${acceptRes.status})`);
        }

        // Re-check health
        const health2 = await apiFetch("/api/health", { method: "GET" });
        log(`Health after claim: ${health2.body.slice(0, 200)}`);
      } else {
        log("WARNING: Could not find bootstrap token");
      }
    }

    // Step 2: Create company
    log(`Creating company: ${COMPANY_NAME}...`);
    const companyRes = await apiFetch("/api/companies", {
      method: "POST",
      body: { name: COMPANY_NAME },
      cookie: sessionCookie,
    });
    if (!companyRes.ok) {
      // If 403, we might need to claim instance admin first
      log(`Company creation returned ${companyRes.status}: ${companyRes.body.slice(0, 300)}`);

      // Try to check health for bootstrap info
      const healthRes = await apiFetch("/api/health", { method: "GET" });
      log(`Health: ${healthRes.body.slice(0, 300)}`);

      throw new Error(`Company creation failed (${companyRes.status}): ${companyRes.body.slice(0, 200)}`);
    }
    const company = JSON.parse(companyRes.body);
    const companyId = company.id;
    log(`Company created: ${companyId}`);

    fs.writeFileSync("/paperclip/.company-id", companyId);

    // Step 3: Store secrets
    log("Storing API secrets...");
    const secrets = {};
    for (const [envKey, secretName] of [
      ["PROVISION_ANTHROPIC_API_KEY", "anthropic-api-key"],
      ["PROVISION_OPENAI_API_KEY", "openai-api-key"],
      ["PROVISION_GOOGLE_API_KEY", "google-api-key"],
      ["PROVISION_GITHUB_API_KEY", "github-api-key"],
    ]) {
      const val = process.env[envKey];
      if (!val) continue;
      const secRes = await apiFetch(`/api/companies/${companyId}/secrets`, {
        method: "POST",
        body: { name: secretName, value: val },
        cookie: sessionCookie,
      });
      if (secRes.ok) {
        const sec = JSON.parse(secRes.body);
        secrets[secretName] = sec.id;
        log(`Secret stored: ${secretName}`);
      } else {
        log(`WARNING: Failed to store ${secretName} (${secRes.status}): ${secRes.body.slice(0, 100)}`);
      }
    }
    fs.writeFileSync(
      "/paperclip/.secret-ids.json",
      JSON.stringify(secrets, null, 2)
    );

    // Save cookie for seed scripts to use
    if (sessionCookie) {
      fs.writeFileSync("/paperclip/.session-cookie", sessionCookie);
    }

    // Step 4: Seed agents
    log("Seeding 11 agents...");
    try {
      const out = execFileSync("/bin/bash", ["/app/scripts/seed-company.sh"], {
        encoding: "utf-8",
        timeout: 120000,
        env: { ...process.env },
      });
      if (out.trim()) console.log(out);
      log("Agents seeded");
    } catch (e) {
      log(`WARNING: Agent seeding issue: ${(e.stderr || e.message).slice(0, 500)}`);
    }

    // Step 5: Install plugins
    log("Installing plugins...");
    try {
      const out = execFileSync("/bin/bash", ["/app/scripts/install-plugins.sh"], {
        encoding: "utf-8",
        timeout: 120000,
        env: { ...process.env },
      });
      if (out.trim()) console.log(out);
      log("Plugins installed");
    } catch (e) {
      log(`WARNING: Plugin install issue: ${(e.stderr || e.message).slice(0, 500)}`);
    }

    log("Provisioning complete!");
    process.exit(0);
  } catch (err) {
    log(`ERROR: ${err.message}`);
    process.exit(1);
  }
}

function extractCookies(headers) {
  const raw = headers["set-cookie"];
  if (!raw) return "";
  const cookies = Array.isArray(raw) ? raw : [raw];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

function apiFetch(urlPath, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, PAPERCLIP);
    const body = opts.body ? JSON.stringify(opts.body) : null;
    const headers = {
      "Content-Type": "application/json",
      Origin: PAPERCLIP,
      Referer: PAPERCLIP + "/",
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
    };
    const reqOpts = {
      method: opts.method || "GET",
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers,
    };
    const req = http.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

main();
