// Diagnostic endpoint — visit /.netlify/functions/check-env to verify setup
// Safe: only confirms whether the key exists, never reveals its value
exports.handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ANTHROPIC_API_KEY_set: !!process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_API_KEY_length: (process.env.ANTHROPIC_API_KEY || "").length,
    NODE_VERSION: process.version,
    all_env_keys: Object.keys(process.env).filter(k => k.includes("ANTHROPIC") || k.includes("API"))
  })
});
