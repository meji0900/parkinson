"use server";

export type RequestState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const REQUEST_TYPES = new Set(["Book a demo", "Product question", "Support request"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Handles the demo / support request form.
 * Set CONTACT_WEBHOOK_URL (e.g. a Slack, Zapier or CRM webhook) to forward requests;
 * without it the request is only logged on the server.
 */
export async function submitRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const field = (name: string) => String(formData.get(name) ?? "").trim();

  // Honeypot: real visitors never fill this hidden field.
  if (field("website")) return { status: "success" };

  const request = {
    name: field("name"),
    email: field("email"),
    company: field("company"),
    type: field("type"),
    message: field("message"),
    consent: formData.get("consent") === "on",
  };

  if (!request.name || !EMAIL.test(request.email) || !REQUEST_TYPES.has(request.type) || !request.message || !request.consent) {
    return { status: "error", message: "Please complete the required fields and accept the privacy terms." };
  }
  if (request.name.length > 200 || request.company.length > 200 || request.message.length > 5000) {
    return { status: "error", message: "Your request is a little long. Please shorten it and try again." };
  }

  const webhook = process.env.CONTACT_WEBHOOK_URL;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, submittedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Webhook responded with ${res.status}`);
    } catch (error) {
      console.error("[support] could not forward request", error);
      return { status: "error", message: "We couldn’t send your request right now. Please try again in a moment." };
    }
  } else {
    console.info("[support] new request (set CONTACT_WEBHOOK_URL to forward it)", { ...request, message: `${request.message.slice(0, 80)}…` });
  }

  return { status: "success" };
}
