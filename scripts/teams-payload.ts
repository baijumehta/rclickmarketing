/**
 * Print exactly what the app POSTs to the Teams webhook, plus the JSON Schema
 * to paste into a Power Automate "When an HTTP request is received" trigger.
 *
 *   npm run teams:payload            # the simple format (hand-built flows)
 *   npm run teams:payload -- card    # the Adaptive Card format (Workflows templates)
 *
 * Generated from the real buildPayload(), so it cannot drift from what gets sent.
 */
import { buildPayload } from "../src/lib/teams";

const SAMPLE_TITLE = "Marketing — Baiju Mehta, Monday, September 21";
const SAMPLE_BODY = [
  "**Monday, September 21** — 7h 30m logged of 8h",
  "",
  "**Done**",
  "- Review ad spend against budget — 45m _(Paid ads)_",
  "- Draft the October client newsletter — 3h 15m _(Email)_",
  "",
  "**In progress**",
  "- Check SEO rankings and flag pages that slipped — 1h 30m _(SEO)_",
  "",
  "**Tomorrow**",
  "- Schedule next week's social posts",
].join("\n");
const SAMPLE_LINK = "https://marketing.rclick.com";

/** Schema for the flat body. This is what Power Automate wants pasted in. */
const SIMPLE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    html: { type: "string" },
    text: { type: "string" },
    body: { type: "string" },
    link: { type: "string" },
  },
  required: ["title", "html", "text", "body"],
};

const which = (process.argv[2] ?? "simple").toLowerCase();
const format = which.startsWith("c") ? "adaptiveCard" : "simple";

const payload = buildPayload(format, SAMPLE_TITLE, SAMPLE_BODY, SAMPLE_LINK);

console.log(`\n=== Format: ${format} ===`);
console.log("\n--- Sample request body the app sends ---\n");
console.log(JSON.stringify(payload, null, 2));

if (format === "simple") {
  console.log("\n--- Request Body JSON Schema (paste into the trigger's schema box) ---\n");
  console.log(JSON.stringify(SIMPLE_SCHEMA, null, 2));

  console.log("\n--- Setting up the flow ---\n");
  console.log("1. Trigger: When an HTTP request is received.");
  console.log("   Paste the SCHEMA above into 'Request Body JSON Schema'.");
  console.log("   If you instead click 'Use sample payload to generate schema',");
  console.log("   paste the SAMPLE BODY, not the schema. Pasting the schema into");
  console.log("   that dialog makes Power Automate build a schema OF the schema,");
  console.log("   which is why the tokens come out named 'type' and 'Item'.");
  console.log("");
  console.log("2. Action: Post message in a chat or channel.");
  console.log("   Post in = Group chat, pick the chat.");
  console.log("   Map the 'html' field into Message — that box takes HTML, and");
  console.log("   Markdown would post with literal ** around every bold word.");
  console.log("   Use the </> code view if the token will not drop into the");
  console.log("   rich text editor cleanly.\n");
} else {
  console.log(
    "\nThe Workflows templates already know this shape — no schema to paste.\n",
  );
}
