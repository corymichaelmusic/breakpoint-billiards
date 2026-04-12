#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const envFile = process.argv[2] || ".env.production.local";
const nextArgs = process.argv.slice(3);
const envPath = path.resolve(process.cwd(), envFile);

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envFile}.`);
  console.error("Create it with the production Clerk and Supabase values, then run this command again.");
  process.exit(1);
}

const parseEnv = (contents) => {
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
};

const loadedEnv = parseEnv(fs.readFileSync(envPath, "utf8"));
const requiredKeys = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missingKeys = requiredKeys.filter((key) => !loadedEnv[key]);
if (missingKeys.length > 0) {
  console.error(`${envFile} is missing: ${missingKeys.join(", ")}`);
  process.exit(1);
}

const childEnv = {
  ...process.env,
  ...loadedEnv,
  BREAKPOINT_ENV_FILE: envFile,
};

const nextBin = path.resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);

console.log(`Starting Next.js with ${envFile}.`);
console.log("Using production-style auth/data only for this dev process.");

const child = spawn(nextBin, ["dev", ...nextArgs], {
  stdio: "inherit",
  env: childEnv,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code || 0);
});
