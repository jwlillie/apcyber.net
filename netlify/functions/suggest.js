// netlify/functions/suggest.js
// Fetches privacy policy, runs Claude analysis, emails the result to the admin.
// No storage needed — uses Resend email API.

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
    "GENQ1":"Meets" or "Partially" or "Not Met",
    "DCQ1":"Meets" or "Partially" or "Not Met","DCQ2":"Meets" or "Partially" or "Not Met",
    "DCQ3":"Meets" or "Partially" or "Not Met","DCQ4":"Meets" or "Partially" or "Not Met",
    "DCQ5":"Meets" or "Partially" or "Not Met","SECQ1":"Meets" or "Partially" or "Not Met",
    "SECQ2":"Meets" or "Partially" or "Not Met","SECQ3":"Meets" or "Partially" or "Not Met",
    "SECQ4":"Meets" or "Partially" or "Not Met","SECQ5":"Meets" or "Partially" or "Not Met",
    "SHRQ1":"Meets" or "Partially" or "Not Met","SHRQ2":"Meets" or "Partially" or "Not Met",
    "SHRQ3":"Meets" or "Partially" or "Not Met","SHRQ4":"Meets" or "Partially" or "Not Met",
    "SHRQ5":"Meets" or "Partially" or "Not Met","ADVQ1":"Meets" or "Partially" or "Not Met",
    "ADVQ2":"Meets" or "Partially" or "Not Met","ADVQ3":"Meets" or "Partially" or "Not Met",
    "ADVQ4":"Meets" or "Partially" or "Not Met","ADVQ5":"Meets" or "Partially" or "Not Met"
  },
  "complianceNotes": {
    "GENQ1":"one sentence","DCQ1":"one sentence","DCQ2":"one sentence","DCQ3":"one sentence",
    "DCQ4":"one sentence","DCQ5":"one sentence","SECQ1":"one sentence","SECQ2":"one sentence",
    "SECQ3":"one sentence","SECQ4":"one sentence","SECQ5":"one sentence","SHRQ1":"one sentence",
    "SHRQ2":"one sentence","SHRQ3":"one sentence","SHRQ4":"one sentence","SHRQ5":"one sentence",
    "ADVQ1":"one sentence","ADVQ2":"one sentence","ADVQ3":"one sentence","ADVQ4":"one sentence",
    "ADVQ5":"one sentence"
  },
  "done": true
}`;

function extractText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function findPolicyLinks(html, baseUrl) {
  const links = [];
  const regex = /href=["']([^"'#?]*)["'][^>]*>[^<]*(?:privacy|terms|legal|tos|eula|data)[^<]*/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    let href = m[1].trim();
    if (!href) continue;
    if (href.startsWith('/')) { try { href = new URL(href, baseUrl).href; } catch { continue; } }
    if (href.startsWith('http')) links.push(href);
  }
  return [...new Set(links)].slice(0, 3);
}
async function fetchText(url, timeoutMs = 6000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, { signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PrivacyChecker/1.0)' } });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return await resp.text();
  } catch { return null; }
}

// Build a readable HTML email from the analysis
function buildEmailHtml(name, url, note, analysis) {
  const c = analysis.compliance || {};
  const n = analysis.complianceNotes || {};
  const QLABELS = {
    GENQ1:"Policy Change Mgmt", DCQ1:"Lists Data Collected", DCQ2:"How Data Collected",
    DCQ3:"Data Ownership", DCQ4:"Data Deletion", DCQ5:"Data Retention",
    SECQ1:"Data Protection", SECQ2:"Encryption", SECQ3:"Password Enforcement",
    SECQ4:"Multi-Factor Auth", SECQ5:"Cookie Policy", SHRQ1:"3rd Party Disclosure",
    SHRQ2:"Data Shared Per 3rd Party", SHRQ3:"Opt Out 3rd Party", SHRQ4:"3rd Party Bound",
    SHRQ5:"Notify 3rd Party Changes", ADVQ1:"Ads Displayed", ADVQ2:"Targeted Ads",
    ADVQ3:"3rd Party Ad Tracking", ADVQ4:"Web Beacons", ADVQ5:"Opt Out Ad Sharing"
  };
  const color = analysis.riskLevel === "High" ? "#dc2626" : analysis.riskLevel === "Medium" ? "#d97706" : "#059669";
  const rows = Object.keys(QLABELS).map(q => {
    const v = c[q] || "—";
    const vc = v === "Meets" ? "#059669" : v === "Partially" ? "#d97706" : v === "Not Met" ? "#dc2626" : "#6b7280";
    return `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:13px;">${QLABELS[q]}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;font-weight:bold;color:${vc};font-size:13px;">${v}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;color:#666;font-size:12px;">${n[q] || ''}</td></tr>`;
  }).join('');

  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:20px 28px;border-radius:12px 12px 0 0;">
      <div style="color:#c4b5fd;font-size:12px;font-weight:bold;text-transform:uppercase;">New Tool Suggestion</div>
      <h1 style="color:white;margin:6px 0 0;font-size:22px;">${name}</h1>
      <a href="${url}" style="color:#ddd6fe;font-size:13px;">${url}</a>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 12px 12px;">
      ${note ? `<p style="background:#f3f4f6;padding:10px 14px;border-radius:8px;font-size:14px;color:#374151;"><strong>Teacher's note:</strong> ${note}</p>` : ''}
      <div style="display:inline-block;padding:6px 16px;border-radius:20px;background:${color};color:white;font-weight:bold;font-size:14px;margin-bottom:16px;">
        ${analysis.riskLevel || 'Unknown'} Risk
      </div>
      <p style="font-size:14px;color:#374151;">${analysis.riskReason || ''}</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
        <tr><td style="padding:4px 8px;color:#666;">Category</td><td style="padding:4px 8px;font-weight:bold;">${analysis.category || '—'}</td></tr>
        <tr><td style="padding:4px 8px;color:#666;">COPPA Compliant</td><td style="padding:4px 8px;font-weight:bold;">${analysis.coppaCompliant}</td></tr>
        <tr><td style="padding:4px 8px;color:#666;">FERPA Compliant</td><td style="padding:4px 8px;font-weight:bold;">${analysis.ferpaCompliant}</td></tr>
        <tr><td style="padding:4px 8px;color:#666;">Student Data Sold</td><td style="padding:4px 8px;font-weight:bold;">${analysis.studentDataSold}</td></tr>
        <tr><td style="padding:4px 8px;color:#666;">Account Required</td><td style="padding:4px 8px;font-weight:bold;">${analysis.accountRequired}</td></tr>
        <tr><td style="padding:4px 8px;color:#666;">Min Age</td><td style="padding:4px 8px;font-weight:bold;">${analysis.minAge || '—'}</td></tr>
      </table>
      <h3 style="font-size:15px;color:#1c3557;margin-top:20px;">Compliance Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="margin-top:20px;font-size:12px;color:#9ca3af;">
        To add this tool, open the EdTech Privacy Tool admin panel and add it manually with the details above.
      </p>
    </div>
  </div>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'ANTHROPIC_API_KEY environment variable is not set in Netlify.' }) };

  let name, url, note;
  try {
    ({ name, url, note } = JSON.parse(event.body));
    if (!name || !url) throw new Error('Missing name or url');
    if (!url.startsWith('http')) url = 'https://' + url;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request: ' + e.message }) };
  }

  // Fetch policy content
  let policyContent = '';
  try {
    const homepageHtml = await fetchText(url);
    if (homepageHtml) {
      const policyLinks = findPolicyLinks(homepageHtml, url);
      const policyTexts = [];
      for (const link of policyLinks.slice(0, 2)) {
        const html = await fetchText(link, 5000);
        if (html) policyTexts.push(`--- From: ${link} ---\n${extractText(html).slice(0, 15000)}`);
      }
      policyContent = policyTexts.length > 0 ? policyTexts.join('\n\n').slice(0, 25000)
        : extractText(homepageHtml).slice(0, 10000);
    }
  } catch { /* non-fatal */ }

  // Claude analysis
  let analysisText = '';
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildPrompt(name, url, policyContent) }] }),
    });
    if (!resp.ok) throw new Error(`Claude API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    const data = await resp.json();
    analysisText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  } catch (err) {
    return { statusCode: 502, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Analysis failed: ' + err.message }) };
  }

  // Parse JSON
  let analysis;
  try {
    const clean = analysisText.replace(/```json|```/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    analysis = JSON.parse(match ? match[0] : clean);
  } catch {
    return { statusCode: 422, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Could not parse analysis.', raw: analysisText.slice(0, 300) }) };
  }

  // Email the result via Resend
  const resendKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (resendKey && adminEmail) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: 'EdTech Tool <onboarding@resend.dev>',
          to: [adminEmail],
          subject: `🔔 New Tool Suggestion: ${name} (${analysis.riskLevel || '?'} Risk)`,
          html: buildEmailHtml(name, url, note, analysis),
        }),
      });
    } catch (e) { console.error('Email send failed:', e.message); }
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, analysis }) };
};
