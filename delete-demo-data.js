/*
 * delete-demo-data.js
 *
 * Cleanup script — deletes all demo auth users + their profile rows
 * and child rows (subscriptions, athlete_coaches, submissions, feedback,
 * mentor_subscriptions) for any user whose email matches the demo pattern.
 *
 * DEFAULT IS DRY-RUN — you must pass --confirm to actually delete anything.
 *
 * USAGE:
 *   node delete-demo-data.js                  ← list matches only (DEFAULT, safe)
 *   node delete-demo-data.js --confirm        ← actually delete
 *   node delete-demo-data.js --pattern '@demo\.com$'   ← custom regex (default: @demo.com)
 *
 * SAFETY:
 *   - Default pattern only matches emails ending in @demo.com.
 *   - Prints every matched email before deleting so you can spot surprises.
 *   - Stops on first 'are you sure' moment unless --confirm is passed.
 *   - Child-row deletes are best-effort: missing tables produce a warning,
 *     not a hard fail. The auth user is the last thing deleted, so if a
 *     child-row delete dies, the user still exists for a retry.
 */

const DEFAULT_PATTERN = "@demo\\.com$";

const args = process.argv.slice(2);
const CONFIRM = args.includes("--confirm");
const patternIdx = args.indexOf("--pattern");
const PATTERN = patternIdx >= 0 ? args[patternIdx + 1] : DEFAULT_PATTERN;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://rtaxjewvshhpdnkpojjn.supabase.co";
// Accept either the new-format secret key (sb_secret_...) or the legacy service_role JWT.
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if(!SERVICE_KEY){
  console.error("\n❌ Missing secret key env var (SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY).\n");
  console.error("   Get it at: Supabase Dashboard → Project Settings → API Keys → secret (sb_secret_...)\n");
  console.error("   Older projects: use the legacy service_role JWT (eyJ...) — both formats are accepted.\n");
  console.error("   Then set it before running:");
  console.error("     PowerShell:  $env:SUPABASE_SECRET_KEY=\"sb_secret_...\"");
  console.error("     cmd.exe:     set SUPABASE_SECRET_KEY=sb_secret_...");
  console.error("     bash:        export SUPABASE_SECRET_KEY=sb_secret_...\n");
  process.exit(1);
}

let createClient;
try{
  ({ createClient } = require("@supabase/supabase-js"));
}catch(err){
  console.error("\n❌ @supabase/supabase-js is not installed.\n   Run:  npm install\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

let emailRegex;
try{
  emailRegex = new RegExp(PATTERN, "i");
}catch(err){
  console.error(`\n❌ Invalid --pattern regex: ${err.message}\n`);
  process.exit(1);
}

// Tables whose rows reference users via these foreign-key columns.
// child-row deletes are best-effort: relation-does-not-exist is logged & skipped.
const CHILD_TABLES = [
  { table: "subscriptions",        cols: ["athlete_id", "coach_id"] },
  { table: "athlete_coaches",      cols: ["athlete_id", "coach_id"] },
  { table: "submissions",          cols: ["athlete_id", "coach_id"] },
  { table: "feedback",             cols: ["athlete_id", "coach_id"] },
  { table: "mentor_subscriptions", cols: ["coach_id", "mentor_id"] }
];

async function listAllUsers(){
  const out = [];
  let page = 1;
  while(true){
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if(error) throw error;
    out.push(...(data.users || []));
    if((data.users || []).length < 1000) break;
    page++;
  }
  return out;
}

async function deleteChildRows(userId){
  const warnings = [];
  for(const t of CHILD_TABLES){
    for(const col of t.cols){
      const { error } = await supabase.from(t.table).delete().eq(col, userId);
      if(error){
        if(/relation .* does not exist/i.test(error.message)){
          warnings.push(`     table '${t.table}' missing — skipped`);
          break; // no point trying the other col on a missing table
        }
        // Column missing on existing table is also fine; log once
        if(/column .* does not exist/i.test(error.message)){
          warnings.push(`     ${t.table}.${col} column missing — skipped`);
          continue;
        }
        warnings.push(`     ${t.table}.${col}: ${error.message}`);
      }
    }
  }
  return warnings;
}

(async () => {
  console.log(`\n🔎 Looking for users matching /${PATTERN}/i ...`);

  const users = await listAllUsers();
  const matches = users.filter(u => u.email && emailRegex.test(u.email));

  if(!matches.length){
    console.log(`   No matching users found. Nothing to do.\n`);
    return;
  }

  console.log(`   Found ${matches.length} matching user(s):\n`);
  for(const u of matches){
    console.log(`     • ${u.email.padEnd(34)} ${u.id}`);
  }
  console.log("");

  if(!CONFIRM){
    console.log("🟡 DRY RUN — nothing deleted.");
    console.log("   Re-run with --confirm to actually delete these users plus their");
    console.log("   profile rows and child rows (subscriptions, athlete_coaches,");
    console.log("   submissions, feedback, mentor_subscriptions).");
    console.log("");
    console.log("   Example:  node delete-demo-data.js --confirm\n");
    return;
  }

  console.log("⚠️  Deleting child rows, profile rows, and auth users...\n");

  let okU = 0, failU = 0;
  for(const u of matches){
    try{
      const warnings = await deleteChildRows(u.id);

      // Delete profile row (separate so we get a clear log line for it)
      const { error: profErr } = await supabase.from("profiles").delete().eq("id", u.id);
      if(profErr && !/relation .* does not exist/i.test(profErr.message)){
        warnings.push(`     profiles: ${profErr.message}`);
      }

      // Finally delete the auth user
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if(delErr) throw delErr;

      console.log(`  ✓ ${u.email.padEnd(34)} ${u.id}`);
      // De-dup and print any warnings
      const uniq = [...new Set(warnings)];
      for(const w of uniq) console.log(w);
      okU++;
    }catch(err){
      console.error(`  ❌ ${u.email}: ${err.message || err}`);
      failU++;
    }
  }

  console.log(`\n✅ Done. ${okU} deleted, ${failU} failed.\n`);
})().catch(err => {
  console.error("\nFatal:", err);
  process.exit(1);
});
