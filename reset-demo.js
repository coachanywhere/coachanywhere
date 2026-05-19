/*
 * reset-demo.js
 *
 * Wipe existing demo users (anything matching @demo.com) and re-seed
 * from CoachAnywhere_Demo_Profiles.xlsx in one go.
 *
 * Internally just spawns delete-demo-data.js then seed-demo-data.js so
 * the behaviour stays in lockstep with those scripts.
 *
 * USAGE:
 *   node reset-demo.js                ← DRY-RUN both phases (DEFAULT, safe)
 *   node reset-demo.js --confirm      ← actually delete + re-seed
 *
 * SAFETY:
 *   - Default is dry-run for both phases. You'll see the list of users
 *     that would be deleted and a preview of the rows that would be
 *     seeded, with zero side effects.
 *   - With --confirm: first deletes all matching demo users (and their
 *     child rows), then re-creates everything from the xlsx. Seed is
 *     idempotent, so any users that survive the delete phase get
 *     upserted instead of duplicated.
 *   - If the delete phase fails fatally (bad credentials, network), the
 *     seed phase is skipped — you get the same error twice otherwise.
 */

const { spawnSync } = require("child_process");
const path = require("path");

const CONFIRM = process.argv.includes("--confirm");

// Accept either the new-format secret key or the legacy service_role JWT.
if(!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY){
  console.error("\n❌ Missing secret key env var (SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY).\n");
  console.error("   Get it at: Supabase Dashboard → Project Settings → API Keys → secret (sb_secret_...)\n");
  console.error("   Older projects: use the legacy service_role JWT (eyJ...) — both formats are accepted.\n");
  console.error("   Then set it before running:");
  console.error("     PowerShell:  $env:SUPABASE_SECRET_KEY=\"sb_secret_...\"");
  console.error("     cmd.exe:     set SUPABASE_SECRET_KEY=sb_secret_...");
  console.error("     bash:        export SUPABASE_SECRET_KEY=sb_secret_...\n");
  process.exit(1);
}

function bar(title){
  const line = "─".repeat(Math.max(0, 60 - title.length - 4));
  return `\n──── ${title} ${line}`;
}

function run(script, extraArgs){
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...extraArgs], {
    stdio: "inherit",
    env: process.env
  });
  return result.status ?? 1;
}

console.log("\n🔄 RESET DEMO DATA");
console.log(`   Mode: ${CONFIRM ? "LIVE (will delete + re-seed)" : "dry-run (preview both phases)"}`);
console.log(`   To switch modes, ${CONFIRM ? "omit --confirm" : "re-run with --confirm"}.\n`);

console.log(bar("PHASE 1 / 2: DELETE EXISTING DEMO USERS"));
const delStatus = run("delete-demo-data.js", CONFIRM ? ["--confirm"] : []);
if(delStatus !== 0){
  console.error(`\n❌ Delete phase exited with status ${delStatus}. Aborting before seed.\n`);
  process.exit(delStatus);
}

console.log(bar("PHASE 2 / 2: SEED FROM XLSX"));
const seedStatus = run("seed-demo-data.js", CONFIRM ? [] : ["--dry-run"]);
if(seedStatus !== 0){
  console.error(`\n❌ Seed phase exited with status ${seedStatus}.\n`);
  process.exit(seedStatus);
}

console.log(`\n✅ Reset complete${CONFIRM ? "" : " (dry-run — no changes made)"}.\n`);
