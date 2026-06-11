// Diagnostic — visit /.netlify/functions/check-env
const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  const result = {
    ANTHROPIC_API_KEY_set: !!process.env.ANTHROPIC_API_KEY,
    NODE_VERSION: process.version,
    blobs_test: "not run",
  };

  // Test Blobs read/write
  try {
    const store = getStore("suggestions");
    const testKey = "diagnostic_test";
    await store.set(testKey, JSON.stringify({ test: true, at: new Date().toISOString() }));
    const back = await store.get(testKey);
    const { blobs } = await store.list();
    result.blobs_test = "WORKS";
    result.blobs_write_read = back ? "ok" : "failed";
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
