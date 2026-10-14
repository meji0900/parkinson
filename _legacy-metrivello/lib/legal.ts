// Legal pages (template copy from the Metrivello reference site).
import type { Block } from "./articles";

export type LegalDoc = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  body: Block[];
};

export const legalMeta = {
  eyebrow: "CLEAR TERMS. CONSIDERED PRIVACY.",
  updated: "Template updated September 23, 2026",
  note: "TEMPLATE NOTICE · Adapt these documents to your business before commercial use.",
};

export const legalDocs: LegalDoc[] = [
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    summary: "How information shared through this website is handled.",
    description: "Read how information shared through the Metrivello website and contact form is handled, why it is collected, and how to contact the site owner.",
    body: [
      { type: "h2", text: "About this notice" },
      { type: "p", text: "Metrivello is a fictional product presented as a website template. This notice is a starting point for the site owner, not a statement about an operating SaaS service. Before using this template for a live business, replace this notice with information that accurately describes your organisation and its data practices." },
      { type: "h2", text: "Information you provide" },
      { type: "p", text: "The contact form asks for your name, work email, company, request type and message. When submitted, these details are sent to the website owner through the configured form service so they can respond to your enquiry. Please do not include passwords, payment details or sensitive personal information." },
      { type: "h2", text: "Purpose and consent" },
      { type: "p", text: "Information from an enquiry is used to review and respond to that request. The form asks you to consent to processing for this purpose. This does not subscribe you to marketing. If consent is the applicable legal basis, you may withdraw it by contacting the site owner; this does not affect processing already performed lawfully." },
      { type: "h2", text: "Service providers, storage and retention" },
      { type: "p", text: "The website owner must identify the controller, hosting and form providers, any other recipients, applicable safeguards for international transfers, and a specific retention period before launch. Keep enquiry information only as long as needed for its stated purpose and any applicable legal obligations." },
      { type: "h2", text: "Cookies and analytics" },
      { type: "p", text: "This template does not describe an active analytics or advertising setup. If the site owner enables analytics, tracking or non-essential cookies, this notice and any required consent controls must be updated to reflect the actual configuration." },
      { type: "h2", text: "Your choices and contact" },
      { type: "p", text: "Depending on the law that applies, you may have rights to access, correct, delete or restrict use of your information, object to processing, request portability, or complain to the relevant regulator. Use the Support page to contact the website owner. Before launch, the owner must add their legal identity, contact address and the applicable supervisory authority." },
    ],
  },
  {
    slug: "terms-of-use",
    title: "Terms of Use",
    summary: "A clear starting point for using this demonstration website.",
    description: "Read the terms for using the Metrivello demonstration website, including its illustrative content, acceptable use and ways to contact the site owner.",
    body: [
      { type: "h2", text: "About Metrivello" },
      { type: "p", text: "Metrivello is a fictional SaaS brand used to demonstrate this Framer template. Dashboard metrics, customer stories, product capabilities and prices are illustrative. A demo request is an enquiry only; it does not create an account, purchase a subscription or enter you into a service contract." },
      { type: "h2", text: "Using the website" },
      { type: "p", text: "You may browse the content and send a genuine enquiry through the Support page. Do not use the website to distribute unlawful content, impersonate another person, submit harmful code, interfere with the site or access systems without permission." },
      { type: "h2", text: "Content and intellectual property" },
      { type: "p", text: "The website owner must ensure they have the necessary rights to all text, imagery, fonts and other materials they publish. Purchasing or using the template is subject to the licence supplied by its marketplace or seller. This page does not replace that licence or grant additional rights." },
      { type: "h2", text: "Illustrative information" },
      { type: "p", text: "Articles and AI-related examples are provided for general informational and demonstration purposes. They are not a promise of results or professional advice. Verify information independently before making business decisions. The operating business must replace sample claims with accurate, supported statements." },
      { type: "h2", text: "Enquiries and privacy" },
      { type: "p", text: "Use accurate contact information when sending an enquiry. Personal information submitted through the form is handled as described in the Privacy Policy. The consent checkbox does not opt you into a newsletter or marketing campaign." },
      { type: "h2", text: "Before commercial launch" },
      { type: "p", text: "The website owner must adapt these terms to the actual service, legal entity and applicable jurisdiction, including any subscription, cancellation, warranty and liability provisions. Nothing in this template is intended to exclude rights that cannot lawfully be excluded. Questions can be sent through the Support page." },
    ],
  },
];

export function getLegalDoc(slug: string) {
  return legalDocs.find((doc) => doc.slug === slug);
}
