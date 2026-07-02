// netlify/functions/claude.js
// Secure proxy for all Claude API calls.
// The API key lives in Netlify environment variables — never exposed to the browser.
//
// Hardening (v25): reject browser calls coming from OTHER websites via an
// Origin/Referer allowlist. NOTE: requests with no Origin/Referer (same-origin
// browser calls, or scripted/curl callers) still pass through, so this does NOT
// stop a determined scripted attacker. The real backstop against runaway spend
// is a hard usage cap set on the ANTHROPIC_API_KEY in the Anthropic console.

const ALLOWED_HOSTS = ["apcyber.net", "www.apcyber.net", "localhost", "127.0.0.1"];

function hostAllowed(host) {
  if (host.endsWith(".netlify.app")) return true; // Netlify deploy previews
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

function originAllowed(event) {
  const h = event.headers || {};
  const ref = h.origin || h.referer || h.Origin || h.Referer || "";
  if (!ref) return true; // no Origin/Referer present — same-origin or non-browser
  try {
    return hostAllowed(new URL(ref).hostname);
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!originAllowed(event)) {
    return { statusCode: 403, body: JSON.stringify({ error: "Forbidden origin" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured in Netlify environment variables." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Upstream API error: " + err.message }),
    };
  }
};
