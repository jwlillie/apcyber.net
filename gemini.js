// Diagnostic — visit /.netlify/functions/check-env
exports.handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    VERSION: "v23-email",
    ANTHROPIC_API_KEY_set: !!process.env.ANTHROPIC_API_KEY,
    RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
    ADMIN_EMAIL_set: !!process.env.ADMIN_EMAIL,
    ADMIN_EMAIL_value: process.env.ADMIN_EMAIL || "(not set)",
    NODE_VERSION: process.version,
  }, null, 2),
});
