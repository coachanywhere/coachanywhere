/*
 * seed-demo-data.js
 *
 * One-time script to populate Supabase with demo coaches and athletes
 * from CoachAnywhere_Demo_Profiles.xlsx in this folder.
 *
 * SETUP (one-time):
 *   1. npm install
 *   2. Grab your Supabase Secret key:
 *        Dashboard → Project Settings → API Keys → secret (sb_secret_...) → Reveal
 *        (Older projects: use the service_role JWT under "Project API keys" — also accepted.)
 *      Treat it like a database password. Do NOT commit it.
 *   3. Set env vars in your shell BEFORE running. Either name works:
 *        PowerShell:  $env:SUPABASE_SECRET_KEY="sb_secret_..."
 *        cmd.exe:     set SUPABASE_SECRET_KEY=sb_secret_...
 *        bash:        export SUPABASE_SECRET_KEY=sb_secret_...
 *
 * RUN:
 *   node seed-demo-data.js              ← actually creates everything
 *   node seed-demo-data.js --dry-run    ← parses + plans, doesn't touch Supabase
 *
 * SAFETY:
 *   - Idempotent. Re-run anytime — existing users won't be duplicated, profile
 *     rows are upserted, and athlete↔coach links are refreshed.
 *   - Confirmation emails are skipped (admin.createUser with email_confirm:true).
 *   - The script does NOT delete anything except an athlete's own
 *     subscriptions/athlete_coaches rows when re-linking them.
 *
 * CLEANUP (delete all demo users before launch):
 *   You can write a sibling delete-demo-data.js — or in Supabase Dashboard,
 *   filter users by email ending in '@demo.com' and bulk delete.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const DRY_RUN = process.argv.includes("--dry-run");
const XLSX_PATH = path.join(__dirname, "CoachAnywhere_Demo_Profiles.xlsx");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://rtaxjewvshhpdnkpojjn.supabase.co";
// Accept either the new-format secret key (sb_secret_...) or the legacy service_role JWT.
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if(!DRY_RUN){
  if(!SERVICE_KEY){
    console.error("\n❌ Missing secret key env var (SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY).\n");
    console.error("   Get it at: Supabase Dashboard → Project Settings → API Keys → secret (sb_secret_...)\n");
    console.error("   Older projects: use the legacy service_role JWT (eyJ...) — both formats are accepted.\n");
    console.error("   Then set it before running:");
    console.error("     PowerShell:  $env:SUPABASE_SECRET_KEY=\"sb_secret_...\"");
    console.error("     cmd.exe:     set SUPABASE_SECRET_KEY=sb_secret_...");
    console.error("     bash:        export SUPABASE_SECRET_KEY=sb_secret_...\n");
    console.error("   Or run a dry-run first to preview what would happen:");
    console.error("     node seed-demo-data.js --dry-run\n");
    process.exit(1);
  }
  let createClient;
  try{
    ({ createClient } = require("@supabase/supabase-js"));
  }catch(err){
    console.error("\n❌ @supabase/supabase-js is not installed.\n");
    console.error("   Run:  npm install\n");
    process.exit(1);
  }
  supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// ─────────────────────────────────────────────────────────────
// XLSX reader — zero npm deps. Reads only what we need.
// ─────────────────────────────────────────────────────────────
function readXlsx(filePath){
  const buf = fs.readFileSync(filePath);
  const entries = parseZip(buf);
  const strings = parseSharedStrings(entries["xl/sharedStrings.xml"] || "");
  const sheets = {};
  for(const name of Object.keys(entries)){
    const m = name.match(/^xl\/worksheets\/sheet(\d+)\.xml$/);
    if(m) sheets[parseInt(m[1])] = parseSheet(entries[name], strings);
  }
  return sheets;
}

function parseZip(buf){
  // Find EOCD record near end of file
  const out = {};
  let eocd = -1;
  for(let i = buf.length - 22; i >= 0 && i >= buf.length - 65536; i--){
    if(buf.readUInt32LE(i) === 0x06054b50){eocd = i; break;}
  }
  if(eocd < 0) throw new Error("Not a valid xlsx: EOCD not found");
  const cdOff = buf.readUInt32LE(eocd + 16);
  const numEntries = buf.readUInt16LE(eocd + 10);
  let p = cdOff;
  for(let n = 0; n < numEntries; n++){
    if(buf.readUInt32LE(p) !== 0x02014b50) break;
    const compMethod = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const fnameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const fname = buf.slice(p + 46, p + 46 + fnameLen).toString("utf8");
    const lFnLen = buf.readUInt16LE(localOff + 26);
    const lExLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lFnLen + lExLen;
    const data = buf.slice(dataStart, dataStart + compSize);
    if(compMethod === 0) out[fname] = data.toString("utf8");
    else if(compMethod === 8) out[fname] = zlib.inflateRawSync(data).toString("utf8");
    p += 46 + fnameLen + extraLen + commentLen;
  }
  return out;
}

function decodeEntities(s){
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/&#10;/g, "\n").replace(/&#13;/g, "")
          .replace(/&#x?\d+;/g, "")
          .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml){
  const out = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while((m = siRe.exec(xml))){
    const parts = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tm;
    while((tm = tRe.exec(m[1]))) parts.push(tm[1]);
    out.push(decodeEntities(parts.join("")));
  }
  return out;
}

function cellRefCol(ref){
  const m = ref.match(/^([A-Z]+)/);
  if(!m) return 0;
  let n = 0;
  for(const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseSheet(xml, strings){
  const rows = [];
  const rowRe = /<row\b[^>]*?\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while((rm = rowRe.exec(xml))){
    const inner = rm[2];
    const cells = {};
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^/]*)\/>/g;
    let cm;
    while((cm = cellRe.exec(inner))){
      const attrs = cm[1] || cm[3] || "";
      const body = cm[2] || "";
      const refM = attrs.match(/\br="([A-Z]+\d+)"/);
      if(!refM) continue;
      const col = cellRefCol(refM[1]);
      const typeM = attrs.match(/\bt="([^"]+)"/);
      const type = typeM ? typeM[1] : "n";
      let val = "";
      const vM = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
      const isM = body.match(/<is\b[^>]*>([\s\S]*?)<\/is>/);
      if(vM){
        if(type === "s") val = strings[parseInt(vM[1])] ?? "";
        else if(type === "b") val = vM[1] === "1";
        else val = decodeEntities(vM[1]);
      } else if(isM){
        const tM = isM[1].match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
        val = tM ? decodeEntities(tM[1]) : "";
      }
      cells[col] = val;
    }
    rows.push(cells);
  }
  return rows;
}

function tabulate(rows, headerRowIdx){
  if(!rows || rows.length <= headerRowIdx) return [];
  const headerCells = rows[headerRowIdx];
  const cols = Object.keys(headerCells).map(Number).sort((a, b) => a - b);
  const headers = cols.map(c => String(headerCells[c] || "").trim());
  const out = [];
  for(let i = headerRowIdx + 1; i < rows.length; i++){
    const obj = {};
    let any = false;
    for(let j = 0; j < cols.length; j++){
      const v = rows[i][cols[j]];
      if(v !== undefined && v !== "") any = true;
      obj[headers[j]] = v ?? "";
    }
    if(any) out.push(obj);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function splitName(full){
  const parts = String(full).trim().split(/\s+/);
  if(parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function parseEmailPassword(combined){
  const parts = String(combined).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return { email: parts[0] || "", password: parts[1] || "Demo1234" };
}

// Cache of all auth users (single listUsers call) to avoid 60 separate lookups
let _userCache = null;
async function getAllUsers(){
  if(_userCache) return _userCache;
  _userCache = [];
  let page = 1;
  while(true){
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if(error) throw error;
    _userCache.push(...(data.users || []));
    if((data.users || []).length < 1000) break;
    page++;
  }
  return _userCache;
}

async function findUserByEmail(email){
  const users = await getAllUsers();
  return users.find(u => (u.email || "").toLowerCase() === email.toLowerCase()) || null;
}

async function findOrCreateUser(email, password){
  // Try lookup first (cheaper if user already exists from a previous run)
  const existing = await findUserByEmail(email);
  if(existing) return { id: existing.id, created: false };
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true
  });
  if(error) throw error;
  _userCache.push(data.user); // keep cache fresh for subsequent lookups
  return { id: data.user.id, created: true };
}

// Discover a table's real columns via PostgREST's auto-generated OpenAPI schema.
// Returns an array of column names, or null if the table doesn't exist.
async function getTableColumns(tableName){
  const res = await fetch(SUPABASE_URL + "/rest/v1/", {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  if(!res.ok){
    const body = await res.text().catch(()=> "");
    throw new Error(`Schema fetch failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  const schema = await res.json();
  const defs = schema.definitions || schema.components?.schemas || {};
  const def = defs[tableName];
  if(!def || !def.properties) return null;
  return Object.keys(def.properties);
}

// Drop any keys from `obj` that aren't in `allowed`. If `allowed` is null/falsy,
// the caller should have already decided not to call this — return {} as a safety.
function pickCols(obj, allowed){
  if(!allowed) return {};
  const out = {};
  for(const k of Object.keys(obj)){
    if(allowed.includes(k) && obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n${DRY_RUN ? "🟡 DRY RUN — no changes will be made.\n" : ""}📂 Reading ${path.basename(XLSX_PATH)}...`);

  if(!fs.existsSync(XLSX_PATH)){
    console.error(`\n❌ File not found: ${XLSX_PATH}\n`);
    process.exit(1);
  }

  const sheets = readXlsx(XLSX_PATH);
  // Sheet IDs from workbook.xml: 1=ReadMe, 2=Coaches, 3=Athletes.
  // Header rows (1-indexed in display, 0-indexed in array): coaches row 3 → idx 2, athletes row 3 → idx 2.
  const coachRows = tabulate(sheets[2], 2);
  const athleteRows = tabulate(sheets[3], 2);

  console.log(`   Parsed ${coachRows.length} coaches and ${athleteRows.length} athletes.\n`);

  if(DRY_RUN){
    console.log("── Preview: first 3 coaches ──");
    for(const r of coachRows.slice(0, 3)) console.log("  •", r["Full Name"], "·", r["Sport"], "·", r["Coach Tier"], "·", r["Login Email"]);
    console.log("── Preview: first 3 athletes ──");
    for(const r of athleteRows.slice(0, 3)){
      const ep = parseEmailPassword(r["Login Email / Password"]);
      console.log("  •", r["Full Name"], "·", r["Sport"], "·", `↔ ${r["Assigned Coach"]}`, "·", ep.email);
    }
    console.log("\n(Run without --dry-run to actually create users in Supabase.)\n");
    return;
  }

  // ── SCHEMA DISCOVERY ──
  // Inspect the real columns of the relevant tables so we only send what exists.
  console.log("🔍 Discovering your Supabase schema...");
  let profileCols, subscriptionCols, athleteCoachCols;
  try{
    profileCols = await getTableColumns("profiles");
  }catch(err){
    console.error(`\n❌ Couldn't fetch the Supabase schema: ${err.message}`);
    console.error(`   Check that SUPABASE_URL is correct and your key is the SECRET key, not the publishable one.\n`);
    process.exit(1);
  }
  if(!profileCols){
    console.error("\n❌ 'profiles' table not found in your Supabase project. Create it first.\n");
    process.exit(1);
  }
  subscriptionCols = await getTableColumns("subscriptions").catch(()=>null);
  athleteCoachCols = await getTableColumns("athlete_coaches").catch(()=>null);

  const wantedProfile = ["id","role","first_name","last_name","sport","location","bio","selected_tier","coaching_style","profile_status","accepting_athletes","billing_cycle","age","main_goal"];
  const useProfile    = wantedProfile.filter(c => profileCols.includes(c));
  const skipProfile   = wantedProfile.filter(c => !profileCols.includes(c));

  console.log(`   profiles: ${profileCols.length} cols in your table`);
  console.log(`     using:   ${useProfile.join(", ")}`);
  if(skipProfile.length) console.log(`     skipping (not in your table): ${skipProfile.join(", ")}`);
  console.log(`   subscriptions:   ${subscriptionCols ? `OK (${subscriptionCols.length} cols)` : "missing — links will be skipped"}`);
  console.log(`   athlete_coaches: ${athleteCoachCols ? `OK (${athleteCoachCols.length} cols)` : "missing — links will be skipped"}`);
  console.log("");

  // ── PHASE 1: Coaches ──
  console.log("👥 Creating coaches and upserting their profiles...");
  const coachByName = new Map();
  let okCoach = 0, failCoach = 0;
  for(const row of coachRows){
    const fullName = String(row["Full Name"] || "").trim();
    const email = String(row["Login Email"] || "").trim();
    if(!fullName || !email){
      console.log(`  ⚠️  Skipping row with missing name/email.`);
      continue;
    }
    const password = String(row["Password"] || "Demo1234");
    const { first, last } = splitName(fullName);

    try{
      const { id, created } = await findOrCreateUser(email, password);
      coachByName.set(fullName.toLowerCase(), { id, fullName });

      const profile = pickCols({
        id,
        role: "coach",
        first_name: first,
        last_name: last,
        sport: String(row["Sport"] || "").trim() || null,
        location: String(row["Location"] || "").trim() || null,
        bio: String(row["Bio"] || "").trim() || null,
        selected_tier: String(row["Coach Tier"] || "").trim() || null,
        coaching_style: String(row["Coaching Specialty / Skills"] || "").trim() || null,
        profile_status: "Live",
        accepting_athletes: true,
        billing_cycle: "Monthly"
      }, profileCols);
      const { error: upErr } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });
      if(upErr) throw upErr;

      const mark = created ? "✚ new" : "↻ upd";
      console.log(`  ${mark}  ${fullName.padEnd(22)} ${email.padEnd(30)} ${(row["Sport"]||"").padEnd(10)} ${row["Coach Tier"]||""}`);
      okCoach++;
    }catch(err){
      console.error(`  ❌ ${fullName} (${email}): ${err.message || err}`);
      failCoach++;
    }
  }
  console.log(`\n   Coaches: ${okCoach} ok, ${failCoach} failed.\n`);

  // ── PHASE 2: Athletes + links ──
  console.log("🏃 Creating athletes and linking to coaches...");
  let okAth = 0, failAth = 0;
  for(const row of athleteRows){
    const fullName = String(row["Full Name"] || "").trim();
    const { email, password } = parseEmailPassword(row["Login Email / Password"]);
    if(!fullName || !email){
      console.log(`  ⚠️  Skipping athlete row with missing name/email.`);
      continue;
    }
    const { first, last } = splitName(fullName);
    const assignedCoachName = String(row["Assigned Coach"] || "").trim();
    const coach = coachByName.get(assignedCoachName.toLowerCase());
    if(!coach){
      console.error(`  ❌ ${fullName}: assigned coach "${assignedCoachName}" not in coaches sheet — skipping link.`);
      failAth++;
      continue;
    }

    try{
      const { id, created } = await findOrCreateUser(email, password);

      const profile = pickCols({
        id,
        role: "athlete",
        first_name: first,
        last_name: last,
        sport: String(row["Sport"] || "").trim() || null,
        age: parseInt(row["Age"]) || null,
        bio: String(row["Bio"] || "").trim() || null,
        main_goal: String(row["Skill Wants & Needs"] || "").trim() || null,
        // Dummy goals/skills so the dashboard renders something on first login.
        // pickCols silently drops these if the columns don't exist yet.
        goals: [
          { id: "g_jumpshot",    name: "Improve Jump Shot", progress: 75 },
          { id: "g_speed",       name: "Increase Speed",    progress: 60 },
          { id: "g_ballhandle",  name: "Ball Handling",     progress: 80 }
        ],
        skills: [
          { id: "s_shooting",  name: "Shooting",  level: 55 },
          { id: "s_dribbling", name: "Dribbling", level: 70 },
          { id: "s_defence",   name: "Defence",   level: 40 }
        ]
      }, profileCols);
      const { error: upErr } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });
      if(upErr) throw upErr;

      // Refresh links: delete then insert (idempotent without relying on a unique constraint)
      const packageName = String(row["Current Plan"] || row["Active Package"] || "").trim() || null;

      // subscriptions (only if table exists)
      if(subscriptionCols){
        const { error: delErr } = await supabase.from("subscriptions").delete().eq("athlete_id", id);
        if(delErr) console.warn(`     subscriptions cleanup: ${delErr.message}`);
        const subPayload = pickCols({
          athlete_id: id,
          coach_id: coach.id,
          status: "active",
          package_name: packageName,
          billing_cycle: "Monthly"
        }, subscriptionCols);
        const { error: insErr } = await supabase.from("subscriptions").insert(subPayload);
        if(insErr) console.warn(`     subscriptions insert: ${insErr.message}`);
      }

      // athlete_coaches (only if table exists)
      if(athleteCoachCols){
        const { error: delErr } = await supabase.from("athlete_coaches").delete().eq("athlete_id", id);
        if(delErr) console.warn(`     athlete_coaches cleanup: ${delErr.message}`);
        const linkPayload = pickCols({
          athlete_id: id,
          coach_id: coach.id
        }, athleteCoachCols);
        const { error: insErr } = await supabase.from("athlete_coaches").insert(linkPayload);
        if(insErr) console.warn(`     athlete_coaches insert: ${insErr.message}`);
      }

      const mark = created ? "✚ new" : "↻ upd";
      console.log(`  ${mark}  ${fullName.padEnd(20)} ${email.padEnd(30)} ↔ ${assignedCoachName}`);
      okAth++;
    }catch(err){
      console.error(`  ❌ ${fullName} (${email}): ${err.message || err}`);
      failAth++;
    }
  }
  console.log(`\n   Athletes: ${okAth} ok, ${failAth} failed.\n`);

  console.log("✅ Done.");
  console.log(`   Login with any of these emails + password 'Demo1234'.`);
  console.log(`   To clean up before launch, delete users whose email ends in '@demo.com'.\n`);
})().catch(err => {
  console.error("\nFatal:", err);
  process.exit(1);
});
