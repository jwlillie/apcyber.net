// netlify/functions/suggest.js
// Fetches the privacy policy directly, then runs a single Claude API call.
// Avoids multi-turn web search loop that causes 504 timeouts on Netlify free plan.

const SYSTEM_PROMPT = `You are an expert in K-12 educational technology privacy compliance (COPPA, FERPA, SOPIPA, CIPA).
Analyze EdTech platforms based on their privacy policies and terms of service.
Return ONLY valid JSON — no markdown, no explanation outside the JSON object.`;

const buildPrompt = (name, url, policyContent) => `Analyze this EdTech platform for K-12 data privacy compliance.

Platform: ${name}
Website: ${url}

${policyContent
  ? `Here is the privacy policy / terms of service content we fetched:\n\n${policyContent}\n\nAnalyze the above content carefully.`
  : `We could not fetch the privacy policy directly. Analyze based on your knowledge of ${name} (${url}).`
}

Return a JSON object with this exact structure — no other text:
{
  "tosUrl": "URL of Terms of Service or empty string",
  "ppUrl": "URL of Privacy Policy or empty string",
  "accountRequired": true or false,
  "minAge": "minimum age requirement",
  "dataCollected": ["list","of","data","types"],
  "dataSharedWith": ["list","of","third","parties"],
  "studentDataSold": true or false or "Not specified",
  "coppaCompliant": true or false or "Not specified" or "Partially",
  "ferpaCompliant": true or false or "Not specified" or "Partially",
  "riskLevel": "Low" or "Medium" or "High",
  "riskReason": "one sentence explaining the risk level",
  "category": "one of: Assessment, Coding, Communication, Content Creation, Design, Game-Based Learning, Language Learning, LMS, Math, Music, Reading, Research, Science, SEL, Simulation, Storage, Utility, Video, Other",
  "compliance": {
    "GENQ1": "Meets" or "Partially" or "Not Met",
    "DCQ1": "Meets" or "Partially" or "Not Met",
    "DCQ2": "Meets" or "Partially" or "Not Met",
    "DCQ3": "Meets" or "Partially" or "Not Met",
    "DCQ4": "Meets" or "Partially" or "Not Met",
    "DCQ5": "Meets" or "Partially" or "Not Met",
    "SECQ1": "Meets" or "Partially" or "Not Met",
    "SECQ2": "Meets" or "Partially" or "Not Met",
    "SECQ3": "Meets" or "Partially" or "Not Met",
    "SECQ4": "Meets" or "Partially" or "Not Met",
    "SECQ5": "Meets" or "Partially" or "Not Met",
    "SHRQ1": "Meets" or "Partially" or "Not Met",
    "SHRQ2": "Meets" or "Partially" or "Not Met",
    "SHRQ3": "Meets" or "Partially" or "Not Met",
    "SHRQ4": "Meets" or "Partially" or "Not Met",
    "SHRQ5": "Meets" or "Partially" or "Not Met",
    "ADVQ1": "Meets" or "Partially" or "Not Met",
    "ADVQ2": "Meets" or "Partially" or "Not Met",
    "ADVQ3": "Meets" or "Partially" or "Not Met",
    "ADVQ4": "Meets" or "Partially" or "Not Met",
    "ADVQ5": "Meets" or "Partially" or "Not Met"
  },
  "complianceNotes": {
    "GENQ1": "one sentence explanation",
    "DCQ1": "one sentence", "DCQ2": "one sentence", "DCQ3": "one sentence",
    "DCQ4": "one sentence", "DCQ5": "one sentence",
    "SECQ1": "one sentence", "SECQ2": "one sentence", "SECQ3": "one sentence",
    "SECQ4": "one sentence", "SECQ5": "one sentence",
    "SHRQ1": "one sentence", "SHRQ2": "one sentence", "SHRQ3": "one sentence",
    "SHRQ4": "one sentence", "SHRQ5": "one sentence",
    "ADVQ1": "one sentence", "ADVQ2": "one sentence", "ADVQ3": "one sentence",
    "ADVQ4": "one sentence", "ADVQ5": "one sentence"
  },
  "done": true
}`;

// Strip HTML tags and collapse whitespace
function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Find privacy/terms links in HTML
function findPolicyLinks(html, baseUrl) {
  const links = [];
  const regex = /href=["']([^"'#?]*)["'][^>]*>[^<]*(?:privacy|terms|legal|tos|eula|data)[^<]*/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    let href = m[1].trim();
    if (!href) continue;
    if (href.startsWith('/')) {
      try { href = new URL(href, baseUrl).href; } catch { continue; }
    }
    if (href.startsWith('http')) links.push(href);
  }
  return [...new Set(links)].slice(0, 3);
}

// Fetch a URL with a short timeout, return text or null
async function fetchText(url, timeoutMs = 6000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PrivacyChecker/1.0)' }
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const html = await resp.text();
    return html;
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY environment variable is not set in Netlify.' })
    };
  }

  let name, url, note;
  try {
    ({ name, url, note } = JSON.parse(event.body));
    if (!name || !url) throw new Error('Missing name or url');
    if (!url.startsWith('http')) url = 'https://' + url;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request: ' + e.message }) };
  }

  // ── Step 1: Fetch homepage and find privacy policy links ─────────────────
  let policyContent = '';
  try {
    const homepageHtml = await fetchText(url);
    if (homepageHtml) {
      const policyLinks = findPolicyLinks(homepageHtml, url);

      // Fetch up to 2 policy pages and combine content
      const policyTexts = [];
      for (const link of policyLinks.slice(0, 2)) {
        const html = await fetchText(link, 5000);
        if (html) {
          const text = extractText(html).slice(0, 15000);
          policyTexts.push(`--- From: ${link} ---\n${text}`);
        }
      }

      if (policyTexts.length > 0) {
        policyContent = policyTexts.join('\n\n').slice(0, 25000);
      } else {
        // No policy links found — use homepage text itself
        policyContent = extractText(homepageHtml).slice(0, 10000);
      }
    }
  } catch {
    // Non-fatal — Claude will analyze from its training knowledge
  }

  // ── Step 2: Single Claude API call (no web search loop) ──────────────────
  let analysisText = '';
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildPrompt(name, url, policyContent) }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Claude API ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    analysisText = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Analysis failed: ' + err.message })
    };
  }

  // ── Step 3: Parse JSON from Claude's response ────────────────────────────
  let analysis;
  try {
    const clean = analysisText.replace(/```json|```/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    analysis = JSON.parse(match ? match[0] : clean);
  } catch {
    return {
      statusCode: 422,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Could not parse analysis result.', raw: analysisText.slice(0, 300) })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, analysis }),
  };
};
