// Diagnostic — visit /.netlify/functions/check-env
// Reports the deploy version and WHICH integrations are configured.
// Intentionally does NOT echo any secret values (no email, no keys).
exports.handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    VERSION: "v25-email",
    ANTHROPIC_API_KEY_set: !!process.env.ANTHROPIC_API_KEY,
    RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
    ADMIN_EMAIL_set: !!process.env.ADMIN_EMAIL,
    NODE_VERSION: process.version,
  }, null, 2),
});
