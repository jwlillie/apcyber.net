// Diagnostic — visit /.netlify/functions/check-env
const { getStore } = require("@netlify/blobs");

function suggestionsStore() {
  return getStore({
    name: "suggestions",
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  });
}

exports.handler = async () => {
  const result = {
    VERSION: "v22-manual-blobs",  // <-- if you don't see this, the new code isn't deployed
    ANTHROPIC_API_KEY_set: !!process.env.ANTHROPIC_API_KEY,
    BLOBS_SITE_ID_set: !!process.env.BLOBS_SITE_ID,
    BLOBS_SITE_ID_length: (process.env.BLOBS_SITE_ID || "").length,
    BLOBS_TOKEN_set: !!process.env.BLOBS_TOKEN,
    BLOBS_TOKEN_length: (process.env.BLOBS_TOKEN || "").length,
    NODE_VERSION: process.version,
    blobs_test: "not run",
  };

  try {
    const store = suggestionsStore();
    const testKey = "diagnostic_test";
    await store.set(testKey, JSON.stringify({ test: true }));
    const back = await store.get(testKey);
    const { blobs } = await store.list();
    result.blobs_test = "WORKS";
    result.blobs_total_keys = blobs.length;
    result.blobs_keys = blobs.map(b => b.key);
    await store.delete(testKey);
  } catch (err) {
    result.blobs_test = "FAILED";
    result.blobs_error = err.message;
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result, null, 2),
  };
};
