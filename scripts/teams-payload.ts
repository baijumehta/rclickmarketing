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
    title: {
      type: "string",
      description: "One-line heading: who, and which day.",
    },
    text: {
      type: "string",
      description:
        "The whole message including the title, markdown formatted. Map this alone if the flow only posts one field.",
    },
    body: {
      type: "string",
      description: "The message without the title, for when the flow adds its own heading.",
    },
    link: {
      type: ["string", "null"],
      description: "Back to the Marketing Desk. Null when no public URL is configured.",
    },
  },
  required: ["title", "text", "body"],
};

const which = (process.argv[2] ?? "simple").toLowerCase();
const format = which.startsWith("c") ? "adaptiveCard" : "simple";

const payload = buildPayload(format, SAMPLE_TITLE, SAMPLE_BODY, SAMPLE_LINK);

console.log(`\n=== Format: ${format} ===`);
console.log("\n--- Sample request body the app sends ---\n");
console.log(JSON.stringify(payload, null, 2));

if (format === "simple") {
  console.log("\n--- Request Body JSON Schema for the Power Automate trigger ---\n");
  console.log(JSON.stringify(SIMPLE_SCHEMA, null, 2));
  console.log(
    "\nIn the flow: paste the schema into 'When an HTTP request is received',",
  );
  console.log(
    "then in 'Post message in a chat or channel' set Post as = Flow bot,",
  );
  console.log("Post in = Group chat, pick the chat, and set Message to the 'text' field.\n");
} else {
  console.log(
    "\nThe Workflows templates already know this shape — no schema to paste.\n",
  );
}
