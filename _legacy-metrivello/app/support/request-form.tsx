"use client";

import clsx from "clsx";
import Link from "next/link";
import { useActionState, useRef, useState, type ReactNode } from "react";
import { ArrowRightIcon, CheckIcon } from "@/components/ui/icons";
import { submitRequest, type RequestState } from "./actions";

const field =
  "w-full rounded-xl bg-[#f8fbf9] px-4 py-3.5 text-[16px] leading-6 text-ink shadow-[inset_0_0_0_1px_#dbe7df] outline-none transition-shadow placeholder:text-[#7b8b82] focus:shadow-[inset_0_0_0_2px_#087443]";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-small text-ink">{label}</span>
      {children}
    </label>
  );
}

const initialState: RequestState = { status: "idle" };

export function RequestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [complete, setComplete] = useState(false);
  const [state, formAction, pending] = useActionState(submitRequest, initialState);

  if (state.status === "success") {
    return (
      <div id="request" className="flex w-full flex-col items-start gap-4 rounded-[24px] bg-white p-9 lg:flex-1">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-[#193c2b] text-[#bef397]">
          <CheckIcon size={20} />
        </span>
        <h3 className="text-h3 text-ink">Request sent.</h3>
        <p className="text-body text-[#64776a]">
          Thanks for reaching out. Your details are used only to respond to this request.
        </p>
        <Link href="/" className="text-button text-ink underline underline-offset-4">
          Back to the homepage
        </Link>
      </div>
    );
  }

  const label = pending ? "Sending…" : complete ? "Send request" : "Check required fields";

  return (
    <form
      id="request"
      ref={formRef}
      action={formAction}
      onInput={() => setComplete(formRef.current?.checkValidity() ?? false)}
      className="flex w-full scroll-mt-28 flex-col gap-[22px] rounded-[24px] bg-white p-9 lg:flex-1"
    >
      <h3 className="text-h3 text-ink">Let’s talk.</h3>

      <Field label="Name *">
        <input name="name" required autoComplete="name" placeholder="Alex Morgan" className={field} />
      </Field>
      <Field label="Email *">
        <input name="email" type="email" required autoComplete="email" placeholder="you@company.com" className={field} />
      </Field>
      <Field label="Company">
        <input name="company" autoComplete="organization" placeholder="Your company or team" className={field} />
      </Field>
      <Field label="How can we help? *">
        <span className="relative block">
          <select name="type" required defaultValue="Book a demo" className={clsx(field, "appearance-none pr-12")}>
            <option>Book a demo</option>
            <option>Product question</option>
            <option>Support request</option>
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-[#999]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </Field>
      <Field label="Message *">
        <textarea name="message" required rows={5} placeholder="What would you like to explore?" className={clsx(field, "h-[140px] resize-none")} />
      </Field>

      {/* Honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      <p className="text-center text-small text-[#64776a]">No newsletter subscription. Your details are used to respond to this request.</p>

      <button
        type="submit"
        disabled={pending}
        className={clsx(
          "group relative isolate flex h-[52px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-full px-6 text-button text-white transition-colors duration-300",
          complete ? "bg-ink" : "bg-[#64776a]",
        )}
      >
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-0 rounded-full bg-accent-bright transition-[height] duration-500 ease-framer group-hover:h-full" />
        <span>{label}</span>
        <span aria-hidden="true" className="relative block size-[18px] overflow-hidden">
          <ArrowRightIcon className="absolute top-px left-px transition-transform duration-500 ease-framer group-hover:translate-x-6" />
          <ArrowRightIcon className="absolute top-px -left-[23px] transition-transform duration-500 ease-framer group-hover:translate-x-6" />
        </span>
      </button>

      {state.status === "error" ? (
        <p role="alert" className="text-center text-small text-[#9a342d]">
          {state.message}
        </p>
      ) : null}

      <label className="flex gap-3">
        <span className="relative mt-px flex size-5 shrink-0">
          <input
            type="checkbox"
            name="consent"
            required
            className="peer size-5 cursor-pointer appearance-none rounded bg-white shadow-[inset_0_0_0_1px_#a8bdb0] transition-colors checked:bg-accent checked:shadow-none"
          />
          <CheckIcon size={14} className="pointer-events-none absolute top-[3px] left-[3px] text-white opacity-0 peer-checked:opacity-100" />
        </span>
        <span className="text-small text-muted">
          I consent to processing my information to respond to my request, as described in the{" "}
          <Link href="/legal/privacy-policy" className="text-[#526259] underline underline-offset-2">
            Privacy Policy
          </Link>
          , and agree to the{" "}
          <Link href="/legal/terms-of-use" className="text-[#526259] underline underline-offset-2">
            Terms of Use
          </Link>
          .
        </span>
      </label>
    </form>
  );
}
