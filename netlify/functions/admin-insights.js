// netlify/functions/admin-insights.js
// Anthropic proxy for the admin dashboard's AI Insights panel.
// Admin UUID gate; the Anthropic API key never leaves the server.

const { createClient } = require("@supabase/supabase-js");

const ADMIN_UUID    = "405840be-8ce2-4c8c-acfa-cb27d7e15291";
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are a business analyst for an early-stage Australian athlete↔coach video-coaching marketplace called CoachAnywhere. Athletes upload training videos; coaches give feedback within 48 hours.

You will receive a JSON object containing current platform stats: signups (this week vs last), uploads, revenue proxy, churn rate, average coach response time, and how many coaches have zero activity. Return 4 to 6 plain-English business insights as STRICT JSON ONLY — no prose around it, no markdown code fences. The output must parse as a JSON array of objects, each with exactly two fields:
  - "type": one of "warning" | "opportunity" | "info"
  - "message": one concise sentence

Rules:
  - Tie every insight to a specific number from the input. Don't make claims without evidence.
  - Call out week-over-week deltas, anomalies, and zero-activity coaches.
  - When you flag a problem, suggest a concrete next action.
  - "warning" = something hurting the business right now.
  - "opportunity" = a lever to pull for growth.
  - "info" = a useful observation worth noticing.
  - Do not wrap the output in \`\`\`json fences. Output the bare JSON array.`;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors({ statusCode: 204 });

  // Auth
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return cors(json(401, { error: "missing token" }));

  const auth = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: userRes, error: authErr } = await auth.auth.getUser(token);
  if (authErr || !userRes?.user) return cors(json(401, { error: "invalid token" }));
  if (userRes.user.id !== ADMIN_UUID) return cors(json(403, { error: "not admin" }));

  // If the env var isn't set, return a single info insight so the panel
  // renders gracefully instead of erroring.
  if (!ANTHROPIC_KEY) {
    return cors(json(200, {
      insights: [{
        type: "info",
        message: "AI insights unavailable — set the ANTHROPIC_API_KEY env var in Netlify and redeploy to enable."
      }]
    }));
  }

  let stats = {};
  try { stats = JSON.parse(event.body || "{}"); } catch (e) { /* fall through with {} */ }

  try {
    const aResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json"
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system:     SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(stats) }]
      })
    });

    if (!aResp.ok) {
      const errText = await aResp.text().catch(() => "(no body)");
      console.error("[admin-insights] anthropic error", aResp.status, errText);
      return cors(json(200, {
        insights: [{
          type: "warning",
          message: `AI insights unavailable: Anthropic API returned ${aResp.status}. Check the function logs.`
        }]
      }));
    }

    const aJson = await aResp.json();
    const raw   = aJson.content?.[0]?.text || "[]";

    // Be defensive — strip code fences if the model adds them despite the prompt.
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let insights = [];
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        insights = parsed.filter(x =>
          x && typeof x === "object" &&
          typeof x.message === "string" &&
          ["warning", "opportunity", "info"].includes(x.type)
        );
      }
    } catch (e) {
      console.warn("[admin-insights] JSON parse failed:", cleaned.slice(0, 200));
    }

    if (!insights.length) {
      insights = [{
        type:    "info",
        message: "AI returned no usable insights this cycle. Will retry in 5 min."
      }];
    }

    return cors(json(200, { insights }));
  } catch (e) {
    console.error("[admin-insights] threw", e);
    return cors(json(200, {
      insights: [{
        type:    "warning",
        message: "AI insights call failed: " + (e.message || "unknown error")
      }]
    }));
  }
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
