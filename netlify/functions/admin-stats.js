// netlify/functions/admin-stats.js
// Admin-only aggregator. Caller must present a Supabase auth JWT whose
// user_id matches ADMIN_UUID. Uses the service role to bypass RLS for the
// platform-wide reads admin.html needs.
//
// Phase 1 — real data only. Every metric is computed from a column that
// actually exists on the live schema. If a metric can't be backed honestly,
// it's not in this payload.

const { createClient } = require("@supabase/supabase-js");

const ADMIN_UUID = "405840be-8ce2-4c8c-acfa-cb27d7e15291";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

// Tier monthly price (mirrors coach-profile-setup.html TIERS const, Foundation pricing)
const TIER_PRICE = {
  "Level 1 — Development Coach":      39,
  "Level 2 — Performance Coach":      79,
  "Level 3 — Elite Coach":           159,
  "Level 4 — Verified Elite Coach":  319
};

// Spotlight add-on monthly price (mirrors create-spotlight-checkout)
const SPOTLIGHT_PRICE = {
  "Level 1 — Development Coach":     29,
  "Level 2 — Performance Coach":     49,
  "Level 3 — Elite Coach":           79,
  "Level 4 — Verified Elite Coach":   0  // free for L4
};

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
  const dayStart   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  // ISO week start (Monday)
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = today.getUTCDay() || 7;
  today.setUTCDate(today.getUTCDate() - (dow - 1));
  const weekStart = today.toISOString();

  // ── 12-week window for charts ─────────────────────────────────
  const mondayUTC = (offset = 0) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const wd = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - (wd - 1) - 7 * offset);
    return d;
  };
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const start = mondayUTC(i);
    const end   = new Date(start.getTime() + 7 * 86400000);
    weeks.push({
      label:        `${start.getUTCMonth() + 1}/${start.getUTCDate()}`,
      startISO:     start.toISOString(),
      endISO:       end.toISOString(),
      athleteSignups: 0,
      coachSignups:   0,
      uploads:        0,
      mentorSessions: 0
    });
  }

  // ── Fetch all needed tables in parallel ───────────────────────
  const [
    profilesRes,
    submissionsRes,
    subscriptionsRes,
    athleteCoachesRes,
    feedbackRes,
    mentorRelRes,
    mentorSessRes,
    authUsersRes
  ] = await Promise.all([
    admin.from("profiles").select("id, role, first_name, last_name, created_at, avatar_url, selected_tier, profile_status, spotlight_active, spotlight_activated_at, tier_status, tier_activated_at"),
    admin.from("submissions").select("id, athlete_id, coach_id, video_url, status, created_at, updated_at"),
    admin.from("subscriptions").select("id, athlete_id, coach_id, status, package_name, created_at, updated_at"),
    admin.from("athlete_coaches").select("id, athlete_id, coach_id, created_at"),
    admin.from("feedback").select("id, coach_id, athlete_id, created_at"),
    admin.from("mentor_relationships").select("id, mentee_id, mentor_id, mentee_name, mentor_name, status, created_at, updated_at"),
    admin.from("mentor_sessions").select("id, mentee_id, mentor_id, topic, status, scheduled_at, duration_minutes, created_at, updated_at"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  ]);

  const profiles       = profilesRes.data       || [];
  const submissions    = submissionsRes.data    || [];
  const subscriptions  = subscriptionsRes.data  || [];
  const athleteCoaches = athleteCoachesRes.data || [];
  const feedback       = feedbackRes.data       || [];
  const mentorRels     = mentorRelRes.data      || [];
  const mentorSess     = mentorSessRes.data     || [];
  const authUsers      = authUsersRes.data?.users || [];

  const athletes    = profiles.filter(p => p.role === "athlete");
  const coaches     = profiles.filter(p => p.role === "coach");
  const profileById = Object.fromEntries(profiles.map(p => [p.id, p]));

  // ── HEADLINE KPIs (real data) ─────────────────────────────────
  const totalUsers      = profiles.length;
  const totalAthletes   = athletes.length;
  const totalCoaches    = coaches.length;

  // Signups today / this week (split by role)
  const isAtLeast = (iso, ref) => iso && iso >= ref;
  const signupsTodayAthletes = athletes.filter(p => isAtLeast(p.created_at, dayStart)).length;
  const signupsTodayCoaches  = coaches.filter(p  => isAtLeast(p.created_at, dayStart)).length;
  const signupsWeekAthletes  = athletes.filter(p => isAtLeast(p.created_at, weekStart)).length;
  const signupsWeekCoaches   = coaches.filter(p  => isAtLeast(p.created_at, weekStart)).length;

  // ── COACH STATE ───────────────────────────────────────────────
  const coachesLive  = coaches.filter(c => c.profile_status === "Live").length;
  const coachesByTier = {
    "L1": coaches.filter(c => (c.selected_tier || "").startsWith("Level 1")).length,
    "L2": coaches.filter(c => (c.selected_tier || "").startsWith("Level 2")).length,
    "L3": coaches.filter(c => (c.selected_tier || "").startsWith("Level 3")).length,
    "L4": coaches.filter(c => (c.selected_tier || "").startsWith("Level 4")).length
  };

  // ── REVENUE (real subscriptions) ──────────────────────────────
  const tierActiveCoaches = coaches.filter(c => c.tier_status === "active");
  const tierActiveCount = tierActiveCoaches.length;
  const tierMonthlyRevenue = tierActiveCoaches.reduce(
    (sum, c) => sum + (TIER_PRICE[c.selected_tier] || 0), 0
  );
  const tierRevenueByTier = {
    "L1": tierActiveCoaches.filter(c => (c.selected_tier||"").startsWith("Level 1"))
            .reduce((s,c) => s + (TIER_PRICE[c.selected_tier]||0), 0),
    "L2": tierActiveCoaches.filter(c => (c.selected_tier||"").startsWith("Level 2"))
            .reduce((s,c) => s + (TIER_PRICE[c.selected_tier]||0), 0),
    "L3": tierActiveCoaches.filter(c => (c.selected_tier||"").startsWith("Level 3"))
            .reduce((s,c) => s + (TIER_PRICE[c.selected_tier]||0), 0),
    "L4": tierActiveCoaches.filter(c => (c.selected_tier||"").startsWith("Level 4"))
            .reduce((s,c) => s + (TIER_PRICE[c.selected_tier]||0), 0)
  };

  const spotlightActiveCoaches = coaches.filter(c => c.spotlight_active === true);
  const spotlightActiveCount = spotlightActiveCoaches.length;
  const spotlightMonthlyRevenue = spotlightActiveCoaches.reduce(
    (sum, c) => sum + (SPOTLIGHT_PRICE[c.selected_tier] || 0), 0
  );

  // ── ACTIVITY METRICS ──────────────────────────────────────────
  const activeSubs = subscriptions.filter(s => s.status === "active");
  const uploadsThisMonth   = submissions.filter(s => s.created_at >= monthStart).length;
  const completedThisMonth = submissions.filter(
    s => s.status === "completed" && s.updated_at >= monthStart
  ).length;

  const completedSubs = submissions.filter(s => s.status === "completed");
  const avgResponseHours = completedSubs.length
    ? (completedSubs.reduce((sum, s) =>
        sum + (new Date(s.updated_at) - new Date(s.created_at)), 0
      ) / completedSubs.length) / 3600000
    : null;

  const athletesWithSub = new Set(activeSubs.map(s => s.athlete_id));
  const conversionToPaid = totalAthletes > 0
    ? (athletesWithSub.size / totalAthletes)
    : 0;

  // ── MENTOR FUNNEL ─────────────────────────────────────────────
  const mentorRel = {
    total:    mentorRels.length,
    pending:  mentorRels.filter(r => r.status === "pending").length,
    active:   mentorRels.filter(r => r.status === "active").length,
    inactive: mentorRels.filter(r => r.status === "inactive").length
  };
  const mentorSessions = {
    total:     mentorSess.length,
    pending:   mentorSess.filter(s => s.status === "pending").length,
    scheduled: mentorSess.filter(s => s.status === "scheduled").length,
    completed: mentorSess.filter(s => s.status === "completed").length,
    cancelled: mentorSess.filter(s => s.status === "cancelled").length
  };

  // ── CHARTS (12 weeks) ─────────────────────────────────────────
  function bucket(ts, key, value = 1) {
    if (!ts) return;
    for (const w of weeks) {
      if (ts >= w.startISO && ts < w.endISO) { w[key] += value; return; }
    }
  }
  athletes.forEach(a    => bucket(a.created_at,  "athleteSignups"));
  coaches.forEach(c     => bucket(c.created_at,  "coachSignups"));
  submissions.forEach(s => bucket(s.created_at,  "uploads"));
  mentorSess.forEach(s  => bucket(s.created_at,  "mentorSessions"));

  // ── TOP 5 COACHES (by athletes assigned + reviews) ────────────
  const topCoaches = coaches.map(c => {
    const assigned = athleteCoaches.filter(ac => ac.coach_id === c.id).length;
    const reviews  = feedback.filter(f => f.coach_id === c.id).length;
    return {
      id:       c.id,
      name:     ((c.first_name || "") + " " + (c.last_name || "")).trim() || "Coach",
      tier:     c.selected_tier || "—",
      assigned, reviews,
      _score:   assigned + reviews * 2
    };
  })
    .filter(c => c._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)
    .map(({ _score, ...rest }) => rest);

  // ── ACTIVITY FEED — real events only ──────────────────────────
  const activity = [];
  profiles.forEach(p => activity.push({
    ts:   p.created_at,
    text: `New ${p.role || "user"} signed up: ${((p.first_name || "") + " " + (p.last_name || "")).trim() || "Anonymous"}`,
    kind: "signup"
  }));
  submissions.forEach(s => {
    const a = profileById[s.athlete_id];
    const aName = ((a?.first_name || "") + " " + (a?.last_name || "")).trim() || "Athlete";
    if (s.video_url) {
      activity.push({ ts: s.created_at, text: `${aName} uploaded a video`, kind: "upload" });
    }
    if (s.status === "completed") {
      const c = profileById[s.coach_id];
      const cName = ((c?.first_name || "") + " " + (c?.last_name || "")).trim() || "Coach";
      activity.push({ ts: s.updated_at, text: `${cName} completed a review for ${aName}`, kind: "review" });
    }
  });
  // Spotlight activations (real timestamp from webhook)
  coaches.forEach(c => {
    if (c.spotlight_activated_at) {
      const name = ((c.first_name || "") + " " + (c.last_name || "")).trim() || "Coach";
      activity.push({
        ts:   c.spotlight_activated_at,
        text: `${name} activated Spotlight`,
        kind: "spotlight"
      });
    }
  });
  // Tier activations (real timestamp from webhook)
  coaches.forEach(c => {
    if (c.tier_activated_at) {
      const name = ((c.first_name || "") + " " + (c.last_name || "")).trim() || "Coach";
      activity.push({
        ts:   c.tier_activated_at,
        text: `${name} activated ${c.selected_tier || "their tier"} subscription`,
        kind: "tier"
      });
    }
  });
  // Mentor relationships — use updated_at as the moment the status changed.
  // For 'active' rows that's the acceptance moment.
  mentorRels.forEach(r => {
    if (r.status === "active" && r.updated_at) {
      activity.push({
        ts:   r.updated_at,
        text: `${r.mentor_name || "Coach"} accepted ${r.mentee_name || "a coach"} as a mentee`,
        kind: "mentor"
      });
    }
  });
  // Mentor sessions — scheduled/completed milestones
  mentorSess.forEach(s => {
    if (s.status === "scheduled" && s.updated_at) {
      const mentee = profileById[s.mentee_id];
      const mentor = profileById[s.mentor_id];
      const menteeName = ((mentee?.first_name || "") + " " + (mentee?.last_name || "")).trim() || "Coach";
      const mentorName = ((mentor?.first_name || "") + " " + (mentor?.last_name || "")).trim() || "Coach";
      activity.push({
        ts:   s.updated_at,
        text: `Mentor session confirmed: ${mentorName} ↔ ${menteeName}`,
        kind: "session"
      });
    }
  });

  activity.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  const activityFeed = activity.slice(0, 25);

  // ── PLATFORM HEALTH ───────────────────────────────────────────
  const failedSubmissions  = submissions.filter(s => !s.video_url).length;
  const coachesAssignedSet  = new Set(athleteCoaches.map(ac => ac.coach_id));
  const athletesAssignedSet = new Set(athleteCoaches.map(ac => ac.athlete_id));
  const coachesNoAthletes   = coaches.filter(c => !coachesAssignedSet.has(c.id)).length;
  const athletesNoCoach     = athletes.filter(a => !athletesAssignedSet.has(a.id)).length;
  const unconfirmed         = authUsers.filter(u => !u.email_confirmed_at).length;

  // Storage — sums top-level files per bucket
  let storageBytes = 0;
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    for (const b of (buckets || [])) {
      const { data: files } = await admin.storage.from(b.name).list("", { limit: 1000 });
      for (const f of (files || [])) {
        if (f.metadata?.size) storageBytes += f.metadata.size;
      }
    }
  } catch (e) { /* swallow; UI shows 0 */ }

  return cors(json(200, {
    generated_at: now.toISOString(),
    kpis: {
      totalUsers, totalAthletes, totalCoaches,
      signupsTodayAthletes, signupsTodayCoaches,
      signupsWeekAthletes,  signupsWeekCoaches,

      coachesLive,
      coachesByTier,

      tierActiveCount, tierMonthlyRevenue, tierRevenueByTier,
      spotlightActiveCount, spotlightMonthlyRevenue,

      activeSubs: activeSubs.length,
      uploadsThisMonth, completedThisMonth, avgResponseHours,
      conversionToPaid,

      mentorRel, mentorSessions
    },
    charts: { weeks },
    topCoaches,
    activityFeed,
    health: {
      storageBytes, failedSubmissions,
      coachesNoAthletes, athletesNoCoach, unconfirmed
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
