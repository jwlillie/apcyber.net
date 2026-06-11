const { getStore } = require("@netlify/blobs");

// Manually configure Blobs (auto-config not available on this deploy type)
function suggestionsStore() {
  return getStore({
    name: "suggestions",
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  let id, action;
  try {
    ({ id, action } = JSON.parse(event.body));
    if (!id || !['approve','deny'].includes(action)) throw new Error('Invalid');
  } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) }; }

  try {
    const store = suggestionsStore();
    const raw = await store.get(id);
    if (!raw) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    const record = JSON.parse(raw);
    record.status = action === 'approve' ? 'approved' : 'denied';
    record.decidedAt = new Date().toISOString();
    await store.set(id, JSON.stringify(record));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, status: record.status }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
