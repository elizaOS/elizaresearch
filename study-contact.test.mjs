/**
 * Exercises the study-contact Worker's real request contract: routing, body
 * limits, validation, honeypot behavior, missing-secret refusal, and the
 * Cloudflare email delivery payload. The Worker module is imported directly and the
 * email binding is represented by an in-memory delivery recorder — no network access.
 */

import { describe, expect, it } from "bun:test";
import worker, {
  FIELD_LIMITS,
  MAX_BODY_BYTES,
  looksLikeEmail,
  renderEmail,
  validateSubmission,
} from "./study-contact.mjs";

const ORIGIN = "https://elizaresearch.ai";
function contactRequest(body, init = {}) {
  return new Request(`${ORIGIN}/api/study-contact`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

const VALID = {
  name: "Dorothy Simmons",
  contact: "dorothy@example.com",
  role: "A senior",
  message: "I got your flyer and wanted to check this is real.",
  website: "",
};

const SECRETS = { CONTACT_TO: "inbox@example.com", CONTACT_FROM: "website@example.org", STUDY_EMAIL: { send: async () => ({messageId: "test"}) } };

describe("validateSubmission", () => {
  it("normalizes a complete submission", () => {
    const result = validateSubmission({ ...VALID, name: "  Dorothy Simmons  " });
    expect(result.ok).toBe(true);
    expect(result.submission.name).toBe("Dorothy Simmons");
    expect(result.honeypot).toBe("");
  });

  it("rejects missing required fields with a visitor-facing message", () => {
    const result = validateSubmission({ ...VALID, message: "   " });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("a message");
  });

  it("rejects oversized fields instead of truncating them", () => {
    const result = validateSubmission({ ...VALID, message: "x".repeat(FIELD_LIMITS.message + 1) });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("too long");
  });

  it("coerces an unknown role to the catch-all instead of trusting client text", () => {
    const result = validateSubmission({ ...VALID, role: "<script>alert(1)</script>" });
    expect(result.ok).toBe(true);
    expect(result.submission.role).toBe("Something else");
  });

  it("rejects non-object payloads", () => {
    expect(validateSubmission("hello").ok).toBe(false);
    expect(validateSubmission(null).ok).toBe(false);
  });
});

describe("renderEmail", () => {
  it("carries every field the recipient needs to reply", () => {
    const { subject, text } = renderEmail(validateSubmission(VALID).submission);
    expect(subject).toContain("Dorothy Simmons");
    expect(subject).toContain("A senior");
    expect(text).toContain("dorothy@example.com");
    expect(text).toContain(VALID.message);
  });
});

describe("looksLikeEmail", () => {
  it("accepts addresses and rejects phone numbers", () => {
    expect(looksLikeEmail("dorothy@example.com")).toBe(true);
    expect(looksLikeEmail("(347) 391-7236")).toBe(false);
  });
});

describe("worker.fetch routing", () => {
  it("falls through to the assets binding for page requests", async () => {
    let served = null;
    const env = { ASSETS: { fetch: (request) => { served = request.url; return new Response("page"); } } };
    const response = await worker.fetch(new Request(`${ORIGIN}/company/`), env);
    expect(await response.text()).toBe("page");
    expect(served).toBe(`${ORIGIN}/company/`);
  });

  it("serves the study at the seniorstudy root and preserves the company root", async () => {
    const requests = [];
    const env = { ASSETS: { fetch: async (request) => {
      requests.push(request.url);
      return new Response(new URL(request.url).pathname === "/study/" ? "study" : "company");
    } } };
    const company = await worker.fetch(new Request(`${ORIGIN}/`), env);
    const direct = await worker.fetch(new Request(`${ORIGIN}/study`), env);
    const study = await worker.fetch(new Request(`${ORIGIN}/study/`), env);
    const alias = await worker.fetch(new Request("https://seniorstudy.org/?ref=flyer"), env);
    expect(await company.text()).toBe("company");
    expect(await direct.text()).toBe("study");
    expect(direct.status).toBe(200);
    expect(direct.headers.get("location")).toBeNull();
    expect(direct.headers.get("cache-control")).toBe("no-store");
    expect(await study.text()).toBe("study");
    expect(await alias.text()).toBe("study");
    expect(requests).toEqual([`${ORIGIN}/`, `${ORIGIN}/study/`, `${ORIGIN}/study/`, "https://seniorstudy.org/study/?ref=flyer"]);
  });

  it("allows an explicit cache-only recovery without clearing login data", async () => {
    const env = { ASSETS: { fetch: async () => new Response("study") } };
    const normal = await worker.fetch(new Request(`${ORIGIN}/study`), env);
    const recovery = await worker.fetch(new Request(`${ORIGIN}/study?reset-cache=1`), env);
    expect(normal.headers.get("clear-site-data")).toBeNull();
    expect(recovery.headers.get("clear-site-data")).toBe('"cache"');
    expect(recovery.headers.get("cache-control")).toBe("no-store");
    expect(await recovery.text()).toBe("study");
  });

  it("counts multibyte input toward the request size limit", async () => {
    const response = await worker.fetch(contactRequest({message: "🧡".repeat(9000)}), SECRETS);
    expect(response.status).toBe(413);
  });

  it("refuses non-POST methods on the contact endpoint", async () => {
    const response = await worker.fetch(new Request(`${ORIGIN}/api/study-contact`), {});
    expect(response.status).toBe(405);
  });

  it("rejects unparsable bodies", async () => {
    const response = await worker.fetch(contactRequest("{not json"), SECRETS);
    expect(response.status).toBe(400);
    expect((await response.json()).ok).toBe(false);
  });

  it("rejects oversized bodies before parsing", async () => {
    const response = await worker.fetch(
      contactRequest(JSON.stringify({ message: "x".repeat(MAX_BODY_BYTES) })),
      SECRETS,
    );
    expect(response.status).toBe(413);
  });

  it("returns a fake success for honeypot submissions without delivering", async () => {
    let delivered = false;
    const env = { ...SECRETS, STUDY_EMAIL: { send: async () => { delivered = true; } } };
    const response = await worker.fetch(contactRequest({ ...VALID, website: "spam.example" }), env);
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(delivered).toBe(false);
  });

  it("refuses with 503 when delivery secrets are not configured", async () => {
    const response = await worker.fetch(contactRequest(VALID), {});
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("(347) 391-7236");
  });

  it("delivers a valid submission through the Cloudflare binding with reply-to", async () => {
    let captured;
    const env = { ...SECRETS, STUDY_EMAIL: { send: async (message) => { captured = message; } } };
    const response = await worker.fetch(contactRequest(VALID), env);
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(captured.to).toBe(SECRETS.CONTACT_TO);
    expect(captured.from).toBe(SECRETS.CONTACT_FROM);
    expect(captured.replyTo).toBe(VALID.contact);
    expect(captured.text).toContain(VALID.message);
  });

  it("translates provider rejection into a visitor-facing 502", async () => {
    const env = { ...SECRETS, STUDY_EMAIL: { send: async () => { throw new Error("unavailable"); } } };
    const response = await worker.fetch(contactRequest(VALID), env);
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("(347) 391-7236");
  });

  it("omits reply-to when the visitor left a phone number", async () => {
    let captured;
    const env = { ...SECRETS, STUDY_EMAIL: { send: async (message) => { captured = message; } } };
    await worker.fetch(contactRequest({ ...VALID, contact: "(347) 391-7236" }), env);
    expect(captured.replyTo).toBeUndefined();
    expect(captured.text).toContain("(347) 391-7236");
  });
});
