// netlify/functions/suggestions.js
// Returns pending suggestions. Storage not yet configured —
// suggestions are currently session-only (returned directly to the browser).
exports.handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ suggestions: [] }),
});
