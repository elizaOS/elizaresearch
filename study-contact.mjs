/**
 * Serves the study website and delivers validated contact submissions through
 * Cloudflare Email Service. The binding restricts delivery to the study inbox;
 * mailbox forwarding is configured separately in Google Workspace.
 */

export const FIELD_LIMITS = {
  name: 200,
  contact: 300,
  role: 100,
  message: 5000,
};

export const MAX_BODY_BYTES = 32_000;

const ROLES = new Set([
  "A senior",
  "A family member",
  "A community representative",
  "Something else",
]);

export const PHONE_FALLBACK =
  "Please call or text (347) 391-7236 and we'll help you directly.";

export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

/**
 * Validates a parsed submission. Returns either the normalized submission or
 * a visitor-facing error message; it never fills in defaults for missing
 * required fields.
 */
export function validateSubmission(input) {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "The submission was not readable. " + PHONE_FALLBACK };
  }
  const honeypot = typeof input.website === "string" ? input.website.trim() : "";
  const fields = {};
  for (const key of ["name", "contact", "role", "message"]) {
    const raw = typeof input[key] === "string" ? input[key].trim() : "";
    if (raw.length > FIELD_LIMITS[key]) {
      return {
        ok: false,
        error: `That ${key} is too long — please keep it under ${FIELD_LIMITS[key]} characters.`,
      };
    }
    fields[key] = raw;
  }
  if (!fields.name || !fields.contact || !fields.message) {
    return {
      ok: false,
      error: "Please fill in your name, how to reach you, and a message.",
    };
  }
  if (!ROLES.has(fields.role)) fields.role = "Something else";
  return { ok: true, submission: fields, honeypot };
}

/** Renders the plain-text notification email for one valid submission. */
export function renderEmail(submission) {
  return {
    subject: `Website message from ${submission.name} (${submission.role})`,
    text: [
      "New message from the elizaresearch.ai study page",
      "",
      `Name: ${submission.name}`,
      `Reach them at: ${submission.contact}`,
      `Reaching out as: ${submission.role}`,
      "",
      "Message:",
      submission.message,
    ].join("\n"),
  };
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function handleContact(request, env) {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    // error-policy:J1 — a torn request body becomes a structured 400 at this
    // transport boundary instead of an uncaught worker exception.
    return json(400, { ok: false, error: "The submission was not readable. " + PHONE_FALLBACK });
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "That message is too large to send. " + PHONE_FALLBACK });
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // error-policy:J3 — untrusted input that fails to parse yields an explicit
    // invalid result, never a defaulted submission.
    return json(400, { ok: false, error: "The submission was not readable. " + PHONE_FALLBACK });
  }

  const result = validateSubmission(parsed);
  if (!result.ok) {
    return json(400, { ok: false, error: result.error });
  }
  if (result.honeypot) {
    // Deliberate deception at the bot boundary: a filled honeypot means an
    // automated submitter, and a fake success stops it from adapting. Nothing
    // is delivered and nothing is logged that a bot could observe.
    return json(200, { ok: true });
  }

  if (!env.STUDY_EMAIL || !env.CONTACT_TO || !env.CONTACT_FROM) {
    console.error("study-contact: Email binding or sender/recipient is not configured; refusing submission");
    return json(503, {
      ok: false,
      error: "The contact form isn't available right now. " + PHONE_FALLBACK,
    });
  }

  const { subject, text } = renderEmail(result.submission);
  const payload = {
    from: env.CONTACT_FROM,
    to: env.CONTACT_TO,
    subject,
    text,
  };
  if (looksLikeEmail(result.submission.contact)) {
    payload.replyTo = result.submission.contact;
  }

  try {
    await env.STUDY_EMAIL.send(payload);
  } catch (error) {
    // error-policy:J1 — delivery failures become an explicit retryable response.
    // Do not log submission content or provider messages containing addresses.
    console.error("study-contact: delivery failed", { code: error.code || "EMAIL_SEND_FAILED" });
    return json(502, {
      ok: false,
      error: "Your message could not be sent right now. " + PHONE_FALLBACK,
    });
  }
  return json(200, { ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "seniorstudy.org" && url.pathname === "/") {
      url.pathname = "/study/";
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (url.pathname === "/api/study-contact") {
      return handleContact(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
