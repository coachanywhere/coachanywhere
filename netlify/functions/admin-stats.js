// netlify/functions/admin-stats.js
// Admin-only aggregator. Caller must present a Supabase auth JWT whose
// user_id matches ADMIN_UUID. Uses the service role to bypass RLS for the
// platform-wide reads admin.html needs.

const { createClient } = require("@supabase/supabase-js");

const ADMIN_UUID = "405840be-8ce2-4c8c-acfa-cb27d7e15291";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

// Tier monthly price (mirrors coach-profile-setup.html TIERS const)
const TIER_PRICE = {
  "Level 1 — Development Coach":       49,
  "Level 2 — Performance Coach":       99,
  "Level 3 — Elite Coach":            199,
  "Level 4 — Verified Elite Coach":   399
};

// Athlete package price (mirrors coach-profile-setup.html PACKAGES const)
const PACKAGE_PRICE = {
  starter: 15, standard: 35, pro: 75, elite: 120, premium: 199
};

const COMMISSION_PCT = 0.20;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors({ statusCode: 204 });

  // ── Auth: caller's JWT must resolve to ADMIN_UUID ─────────────
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return cors(json(401, { error: "missing token" }));

  const auth = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: userRes, error: authErr } = await auth.auth.getUser(token);
  if (authErr || !userRes?.user) return cors(json(401, { error: "invalid token" }));
  if (userRes.user.id !== ADMIN_UUID) return cors(json(403, { error: "not admin" }));

  // ── Service-role client for everything below ──────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  // Build the 12-week window. Each entry is [start, end) in UTC, Monday-aligned.
  const mondayUTC = (offset = 0) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dow = d.getUTCDay() || 7;  // Sunday -> 7
    d.setUTCDate(d.getUTCDate() - (dow - 1) - 7 * offset);
    return d;
  };
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const start = mondayUTC(i);
    const end   = new Date(start.getTime() + 7 * 86400000);
    weeks.push({
      label:    `${start.getUTCMonth() + 1}/${start.getUTCDate()}`,
      startISO: start.toISOString(),
      endISO:   end.toISOString(),
      signups: 0, revenueProxy: 0, uploads: 0
    });
  }

  // ── Fetch ─────────────────────────────────────────────────────
  // Six parallel reads. None of these depend on each other.
  const [
    profilesRes,
    submissionsRes,
    subscriptionsRes,
    athleteCoachesRes,
    feedbackRes,
    authUsersRes
  ] = await Promise.all([
    admin.from("profiles").select("id, role, first_name, last_name, selected_tier, created_at, avatar_url"),
    admin.from("submissions").select("id, athlete_id, coach_id, video_url, status, created_at, updated_at"),
    admin.from("subscriptions").select("id, athlete_id, coach_id, status, package_name, created_at, updated_at"),
    admin.from("athlete_coaches").select("id, athlete_id, coach_id, created_at"),
    admin.from("feedback").select("id, coach_id, athlete_id, created_at"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  ]);

  const profiles       = profilesRes.data       || [];
  const submissions    = submissionsRes.data    || [];
  const subscriptions  = subscriptionsRes.data  || [];
  const athleteCoaches = athleteCoachesRes.data || [];
  const feedback       = feedbackRes.data       || [];
  const authUsers      = authUsersRes.data?.users || [];

  const athletes    = profiles.filter(p => p.role === "athlete");
  const coaches     = profiles.filter(p => p.role === "coach");
  const profileById = Object.fromEntries(profiles.map(p => [p.id, p]));

  // ── KPIs (Row 1) ──────────────────────────────────────────────
  const totalAthletes = athletes.length;
  const totalCoaches  = coaches.length;

  // "Potential MRR" — coaches who completed setup, summed by tier monthly price.
  // Not actual paying coaches; no Stripe subscription state is linked yet.
  const potentialMRR = coaches.reduce(
    (sum, c) => sum + (TIER_PRICE[c.selected_tier] || 0), 0
  );

  // "Estimated commission this month" — 20% of athlete-package revenue from
  // active subscriptions. Approximation, since no real payment events flow yet.
  const activeSubs = subscriptions.filter(s => s.status === "active");
  const estCommissionThisMonth = activeSubs
    .reduce((sum, s) => sum + (PACKAGE_PRICE[s.package_name] || 0), 0) * COMMISSION_PCT;

  const uploadsThisMonth   = submissions.filter(s => s.created_at >= monthStart).length;
  const completedThisMonth = submissions.filter(
    s => s.status === "completed" && s.updated_at >= monthStart
  ).length;

  // Avg response — submission created_at → completed updated_at, completed only.
  const completedSubs = submissions.filter(s => s.status === "completed");
  const avgResponseHours = completedSubs.length
    ? (completedSubs.reduce((sum, s) =>
        sum + (new Date(s.updated_at) - new Date(s.created_at)), 0
      ) / completedSubs.length) / 3600000
    : 0;

  // Churn — subs that existed before this month and are no longer active and
  // moved status this month. Rough; no explicit "cancelled" event today.
  const activeAtMonthStart = subscriptions.filter(
    s => s.created_at < monthStart && s.status === "active"
  ).length;
  const churnedThisMonth = subscriptions.filter(
    s => s.status !== "active" && s.updated_at >= monthStart && s.created_at < monthStart
  ).length;
  const churnRate = activeAtMonthStart > 0
    ? (churnedThisMonth / activeAtMonthStart)
    : 0;

  // Conversion — distinct athletes with at least one active sub / total athletes.
  const athletesWithSub = new Set(activeSubs.map(s => s.athlete_id));
  const conversionToPaid = totalAthletes > 0
    ? (athletesWithSub.size / totalAthletes)
    : 0;

  // ── Charts (Row 2) ────────────────────────────────────────────
  function bucket(ts, key, value = 1) {
    if (!ts) return;
    for (const w of weeks) {
      if (ts >= w.startISO && ts < w.endISO) { w[key] += value; return; }
    }
  }
  athletes.forEach(a       => bucket(a.created_at, "signups"));
  subscriptions.forEach(s  => bucket(s.created_at, "revenueProxy", PACKAGE_PRICE[s.package_name] || 0));
  submissions.forEach(s    => bucket(s.created_at, "uploads"));

  // ── Top 5 coaches (Row 3 left) ────────────────────────────────
  const topCoaches = coaches.map(c => {
    const assigned = athleteCoaches.filter(ac => ac.coach_id === c.id).length;
    const reviews  = feedback.filter(f => f.coach_id === c.id).length;
    return {
      id:       c.id,
      name:     ((c.first_name || "") + " " + (c.last_name || "")).trim() || "Coach",
      tier:     c.selected_tier || "—",
      assigned, reviews,
      // composite: weight reviews 2× since they're rarer and more meaningful
      _score:   assigned + reviews * 2
    };
  })
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)
    .map(({ _score, ...rest }) => rest);

  // ── Activity feed (Row 3 right, top 20) ───────────────────────
  // Skip messages per user choice — would flood the feed.
  const activity = [];
  profiles.forEach(p => activity.push({
    ts:   p.created_at,
    text: `New ${p.role || "user"} signed up: ${((p.first_name || "") + " " + (p.last_name || "")).trim() || "Anonymous"}`
  }));
  submissions.forEach(s => {
    const a = profileById[s.athlete_id];
    const aName = ((a?.first_name || "") + " " + (a?.last_name || "")).trim() || "Athlete";
    if (s.video_url) {
      activity.push({ ts: s.created_at, text: `${aName} uploaded a video` });
    }
    if (s.status === "completed") {
      const c = profileById[s.coach_id];
      const cName = ((c?.first_name || "") + " " + (c?.last_name || "")).trim() || "Coach";
      activity.push({ ts: s.updated_at, text: `${cName} completed a review for ${aName}` });
    }
  });
  activity.sort((a, b) => b.ts.localeCompare(a.ts));
  const activityFeed = activity.slice(0, 20);

  // ── Platform health (Row 5) ───────────────────────────────────
  const failedSubmissions = submissions.filter(s => !s.video_url).length;
  const coachesAssignedSet  = new Set(athleteCoaches.map(ac => ac.coach_id));
  const athletesAssignedSet = new Set(athleteCoaches.map(ac => ac.athlete_id));
  const coachesNoAthletes   = coaches.filter(c => !coachesAssignedSet.has(c.id)).length;
  const athletesNoCoach     = athletes.filter(a => !athletesAssignedSet.has(a.id)).length;
  const unconfirmed         = authUsers.filter(u => !u.email_confirmed_at).length;

  // Storage usage — approximate. Lists each bucket's top-level files; doesn't
  // recurse into subfolders. Good enough as a "is storage usage trending up?"
  // signal; not a precise quota number.
  let storageBytes = 0;
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    for (const b of (buckets || [])) {
      const { data: files } = await admin.storage.from(b.name).list("", { limit: 1000 });
      for (const f of (files || [])) {
        if (f.metadata?.size) storageBytes += f.metadata.size;
      }
    }
  } catch (e) { /* swallow — show 0 with a tooltip on the UI side */ }

  return cors(json(200, {
    generated_at: now.toISOString(),
    kpis: {
      totalAthletes,
      totalCoaches,
      potentialMRR,
      estCommissionThisMonth,
      activeSubs: activeSubs.length,
      uploadsThisMonth,
      completedThisMonth,
      avgResponseHours,
      churnRate,
      conversionToPaid
    },
    charts: { weeks },
    topCoaches,
    activityFeed,
    health: {
      storageBytes,
      failedSubmissions,
      coachesNoAthletes,
      athletesNoCoach,
      unconfirmed
    }
  }));
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  };
}

function cors(resp) {
  return {
    ...resp,
    headers: {
      ...(resp.headers || {}),
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    }
  };
}
