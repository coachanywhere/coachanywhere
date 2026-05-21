// netlify/functions/contact-submit.js
// Handles the public Contact Us form (contact.html). On a valid POST it:
//   1. drops obvious bots via a honeypot field,
//   2. rate-limits to one submission per email per RATE_WINDOW_MIN,
//   3. inserts a row into contact_submissions (service role), and
//   4. emails the owner via Resend with reply-to set to the submitter.
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY  — service role for the insert
//   RESEND_API_KEY                      — from resend.com → API Keys
//   WAITLIST_FROM_EMAIL                 — verified Resend sender (reused)
//   CONTACT_DESTINATION_EMAIL           — inbox that receives submissions
//                                         (the private owner address)

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.WAITLIST_FROM_EMAIL || "CoachAnywhere <onboarding@resend.dev>";
const TO   = process.env.CONTACT_DESTINATION_EMAIL;

const RATE_WINDOW_MIN = 2;   // one message per email per 2 minutes
const MAX_MESSAGE_LEN = 2000;

const ROLES  = ["Athlete", "Coach", "Mentor", "Parent", "Other"];
const TOPICS = ["General question", "Becoming a coach", "Becoming a mentor", "Pricing", "Technical issue", "Partnership", "Other"];

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors({ statusCode: 204 });
  if (event.httpMethod !== "POST")    return cors(json(405, { error: "method_not_allowed" }));

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) {}

  // 1. Honeypot — real users never fill this. Pretend success, do nothing.
  if ((body.company || "").trim() !== "") {
    console.warn("[contact-submit] honeypot tripped — dropping silently");
    return cors(json(200, { ok: true }));
  }

  const name    = (body.name || "").trim();
  const email   = (body.email || "").trim();
  const role    = (body.role || "").trim();
  const topic   = (body.topic || "").trim();
  const message = (body.message || "").trim();

  // 2. Validation
  if (!name)    return cors(json(400, { error: "Please tell us your name." }));
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return cors(json(400, { error: "Please enter a valid email." }));
  if (!ROLES.includes(role))   return cors(json(400, { error: "Please choose a role." }));
  if (!TOPICS.includes(topic)) return cors(json(400, { error: "Please choose a topic." }));
  if (!message) return cors(json(400, { error: "Please include a message." }));
  if (message.length > MAX_MESSAGE_LEN) return cors(json(400, { error: "Message is too long (2000 characters max)." }));

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[contact-submit] Supabase not configured");
    return cors(json(500, { error: "server_misconfigured" }));
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // 3. Rate limit — reject a second message from the same email too soon.
  try {
    const since = new Date(Date.now() - RATE_WINDOW_MIN * 60 * 1000).toISOString();
    const { data: recent } = await sb
      .from("contact_submissions")
      .select("id")
      .ilike("email", email)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length) {
      return cors(json(429, { error: "You've just sent us a message — give us a moment to read it before sending another." }));
    }
  } catch (e) {
    console.error("[contact-submit] rate-limit check failed:", e?.message || e);
    // Non-fatal — continue rather than block a genuine message.
  }

  const ip = event.headers["x-nf-client-connection-ip"]
    || (event.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || null;
  const userAgent = event.headers["user-agent"] || null;

  // 4. Insert
  try {
    const { error } = await sb.from("contact_submissions").insert({
      name, email, role, topic, message,
      ip_address: ip,
      user_agent: userAgent
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[contact-submit] insert failed:", e?.message || e);
    return cors(json(500, { error: "Couldn't save your message — please try again shortly." }));
  }

  // 5. Notify the owner via Resend (non-fatal if it fails — the row is saved).
  if (RESEND_API_KEY && TO) {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + RESEND_API_KEY,
          "Content-Type":  "application/json"
        },
        body: JSON.stringify({
          from: FROM,
          to: [TO],
          reply_to: email,
          subject: `[CoachAnywhere contact] ${topic} — ${name}`,
          html: emailHTML({ name, email, role, topic, message })
        })
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "(no body)");
        console.error("[contact-submit] Resend error", resp.status, errText);
      }
    } catch (e) {
      console.error("[contact-submit] send failed:", e?.message || e);
    }
  } else {
    console.warn("[contact-submit] RESEND_API_KEY or CONTACT_DESTINATION_EMAIL unset — saved row but sent no email");
  }

  return cors(json(200, { ok: true }));
};

function emailHTML({ name, email, role, topic, message }) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0b1224;border:1px solid rgba(148,163,184,.18);border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px 28px 4px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;">New contact form submission</div>
          <div style="font-size:20px;font-weight:800;color:#f9fafb;margin-top:6px;">${escapeHTML(topic)}</div>
        </td></tr>
        <tr><td style="padding:14px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#e5e7eb;">
            <tr><td style="padding:4px 0;color:#94a3b8;width:90px;">Name</td><td style="padding:4px 0;font-weight:600;">${escapeHTML(name)}</td></tr>
            <tr><td style="padding:4px 0;color:#94a3b8;">Email</td><td style="padding:4px 0;"><a href="mailto:${escapeHTML(email)}" style="color:#60a5fa;text-decoration:none;">${escapeHTML(email)}</a></td></tr>
            <tr><td style="padding:4px 0;color:#94a3b8;">Role</td><td style="padding:4px 0;">${escapeHTML(role)}</td></tr>
            <tr><td style="padding:4px 0;color:#94a3b8;">Topic</td><td style="padding:4px 0;">${escapeHTML(topic)}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:8px 28px 24px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;">Message</div>
          <div style="font-size:14px;line-height:1.7;color:#e5e7eb;white-space:pre-wrap;background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.18);border-radius:12px;padding:16px 18px;">${escapeHTML(message)}</div>
          <p style="font-size:12px;color:#64748b;margin:14px 0 0;">Reply directly to this email to respond to ${escapeHTML(name)}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHTML(s) {
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  };
}
