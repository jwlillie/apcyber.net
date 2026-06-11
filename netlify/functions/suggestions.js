const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  try {
    const store = getStore('suggestions');
    const { blobs } = await store.list();
    const suggestions = (await Promise.all(
      blobs.map(async b => { try { return JSON.parse(await store.get(b.key)); } catch { return null; } })
    )).filter(s => s && s.status === 'pending')
     .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestions }) };
  } catch (err) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestions: [], error: err.message }) };
  }
};
