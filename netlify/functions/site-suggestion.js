// netlify/functions/site-suggestion.js
// Emails site edit/resource suggestions from the home-page "Suggest an edit" widget.
// Email-only (uses Resend). Completely separate from suggest.js (the EdTech privacy tool).

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  var data;
  try { data = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  // Honeypot: silently accept bot submissions without emailing.
  if (data['bot-field'] || data.hp) {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  var type = String(data.type || 'Suggestion').slice(0, 200);
  var suggestion = String(data.suggestion || data.content || '').trim();
  var page = String(data.page || data.where || '').slice(0, 500);
  var name = String(data.name || '').slice(0, 200);
  var email = String(data.email || '').slice(0, 200);

  if (!suggestion) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Suggestion text is required.' }) };
  }

  var resendKey = process.env.RESEND_API_KEY;
  var adminEmail = process.env.ADMIN_EMAIL;
  if (!resendKey || !adminEmail) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Email not configured (RESEND_API_KEY or ADMIN_EMAIL missing).' }) };
  }

  var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var NL = String.fromCharCode(10);

  var html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e2530;line-height:1.55">' +
    '<h2 style="margin:0 0 14px;color:#0b1628">New site suggestion</h2>' +
    '<p><strong>Type:</strong> ' + esc(type) + '</p>' +
    '<p><strong>Page / unit:</strong> ' + esc(page || '(not specified)') + '</p>' +
    '<p style="margin:14px 0 4px"><strong>Suggestion:</strong></p>' +
    '<p style="white-space:pre-wrap;background:#f4f6fa;border:1px solid #e3e8f0;border-radius:8px;padding:12px 14px;margin:0">' + esc(suggestion) + '</p>' +
    '<p style="margin-top:16px;color:#54607a"><strong>From:</strong> ' + esc(name || 'Anonymous') + (email ? ' (' + esc(email) + ')' : ' (no email provided)') + '</p>' +
    '</div>';

  var text = 'New site suggestion' + NL + NL +
    'Type: ' + type + NL +
    'Page/unit: ' + (page || '(not specified)') + NL + NL +
    suggestion + NL + NL +
    'From: ' + (name || 'Anonymous') + (email ? ' (' + email + ')' : ' (no email provided)');

  var payload = {
    from: 'AP Cyber Suggestions <onboarding@resend.dev>',
    to: [adminEmail],
    subject: 'New site suggestion: ' + type,
    html: html,
    text: text
  };
  var atOk = email.indexOf('@') > 0 && email.lastIndexOf('.') > email.indexOf('@') + 1;
  if (email && atOk) { payload.reply_to = email; }

  try {
    var resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + resendKey },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      var detail = (await resp.text()).slice(0, 300);
      return { statusCode: 502, body: JSON.stringify({ error: 'Email send failed', detail: detail }) };
    }
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Email send failed: ' + e.message }) };
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
};
