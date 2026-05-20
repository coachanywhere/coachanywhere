// netlify/functions/waitlist-welcome.js
// Sends the "You're on the list" confirmation email via Resend after a
// waitlist signup. Called fire-and-forget from waitlist.html on a
// successful insert.
//
// Anti-abuse: this endpoint is public (the waitlist page isn't behind
// auth), so before sending we verify the address actually exists in the
// waitlist table using the service role. That stops the endpoint being
// used to fire emails at arbitrary addresses.
//
// Required env vars:
//   RESEND_API_KEY       — from resend.com → API Keys
//   WAITLIST_FROM_EMAIL  — e.g. "CoachAnywhere <hello@coachanywhere247.com>"
//                          (domain must be verified in Resend). If unset,
//                          falls back to Resend's test sender, which only
//                          delivers to the Resend account owner's address.

const { createClient } = require("@supabase/supabase-js");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.WAITLIST_FROM_EMAIL || "CoachAnywhere <onboarding@resend.dev>";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors({ statusCode: 204 });
  if (event.httpMethod !== "POST")    return cors({ statusCode: 405, body: "Method not allowed" });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) {}
  const email = (body.email || "").trim();
  const firstName = (body.first_name || "").trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return cors(json(400, { error: "invalid email" }));
  }

  // Graceful no-op if the provider isn't configured yet — the page already
  // showed its success state, so we just report that no email was sent.
  if (!RESEND_API_KEY) {
    console.warn("[waitlist-welcome] RESEND_API_KEY not set — skipping email");
    return cors(json(200, { sent: false, reason: "no_provider" }));
  }

  // Anti-abuse — only email people who are actually on the list.
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data } = await sb.from("waitlist").select("id").ilike("email", email).maybeSingle();
    if (!data) {
      console.warn("[waitlist-welcome] email not on waitlist — refusing to send:", email);
      return cors(json(200, { sent: false, reason: "not_on_list" }));
    }
  } catch (e) {
    console.error("[waitlist-welcome] waitlist lookup failed:", e?.message || e);
    return cors(json(200, { sent: false, reason: "lookup_failed" }));
  }

  // Send via Resend
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify({
        from:    FROM,
        to:      [email],
        subject: "You're on the list — CoachAnywhere",
        html:    emailHTML(firstName)
      })
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "(no body)");
      console.error("[waitlist-welcome] Resend error", resp.status, errText);
      return cors(json(200, { sent: false, reason: "resend_error", status: resp.status }));
    }
    console.log("[waitlist-welcome] sent to", email);
    return cors(json(200, { sent: true }));
  } catch (e) {
    console.error("[waitlist-welcome] send failed:", e?.message || e);
    return cors(json(200, { sent: false, reason: "exception" }));
  }
};

// Dark, brand-styled, email-client-safe (inline styles + table layout).
function emailHTML(firstName) {
  const hi = firstName ? `Hi ${escapeHTML(firstName)},` : "Hi there,";
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#0b1224;border:1px solid rgba(148,163,184,.18);border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 28px 8px;text-align:center;">
          <div style="font-size:17px;font-weight:800;letter-spacing:.05em;color:#ffffff;text-transform:uppercase;">COACH<span style="color:#60a5fa;">ANYWHERE</span></div>
        </td></tr>
        <tr><td style="padding:12px 28px 6px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#f9fafb;letter-spacing:-.02em;">You're on the list. 🎉</div>
        </td></tr>
        <tr><td style="padding:6px 28px 0;">
          <p style="font-size:15px;line-height:1.7;color:#cbd5e1;margin:0 0 14px;">${hi}</p>
          <p style="font-size:15px;line-height:1.7;color:#cbd5e1;margin:0 0 14px;">Thanks for joining the CoachAnywhere waitlist — elite coaching, anytime anywhere. You're now part of our founding cohort.</p>
        </td></tr>
        <tr><td style="padding:8px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.18);border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;">What happens next</div>
              <p style="font-size:14px;line-height:1.6;color:#e5e7eb;margin:0 0 10px;"><span style="color:#60a5fa;font-weight:700;">1.</span> We're onboarding founding coaches and pilot athletes in waves.</p>
              <p style="font-size:14px;line-height:1.6;color:#e5e7eb;margin:0 0 10px;"><span style="color:#60a5fa;font-weight:700;">2.</span> You'll get an early-access invite by email before we open to the public.</p>
              <p style="font-size:14px;line-height:1.6;color:#e5e7eb;margin:0;"><span style="color:#60a5fa;font-weight:700;">3.</span> Your founding-member pricing &amp; status are locked in when you join.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(180,83,9,.16),rgba(15,23,42,.5));border:1px solid rgba(251,191,36,.3);border-radius:12px;">
            <tr><td style="padding:16px 20px;">
              <p style="font-size:13px;line-height:1.6;color:#e5e7eb;margin:0;"><strong style="color:#fbbf24;">Founding members shape what we build.</strong> When we reach out, we'll be asking what you want from the platform — your input genuinely steers the roadmap.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 28px 28px;text-align:center;">
          <p style="font-size:12px;line-height:1.6;color:#64748b;margin:0;">Questions? Just reply to this email or reach us at <a href="mailto:kane@coachanywhere247.com" style="color:#60a5fa;text-decoration:none;">kane@coachanywhere247.com</a></p>
          <p style="font-size:11px;color:#475569;margin:14px 0 0;">CoachAnywhere · Elite coaching, anytime anywhere · Australia</p>
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
