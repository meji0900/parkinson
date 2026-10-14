// All copy for the landing page lives here so sections stay focused on layout.
import { articles } from "./articles";

export const DEMO_HREF = "/support#request";

export const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Reporting", href: "/#reporting" },
  { label: "Workflow", href: "/#how-it-works" },
  { label: "Teams", href: "/#teams" },
  { label: "Stories", href: "/#stories" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Journal", href: "/#journal" },
  { label: "AI insights", href: "/#ai" },
  { label: "FAQ", href: "/#faq" },
  { label: "Blog", href: "/blog" },
];

export const hero = {
  eyebrow: "AI MARKETING ANALYTICS",
  heading: "Know what works. Know what to do next.",
  description:
    "Bring your marketing tools into one clear view. AI that explains performance, flags changes, and helps you plan your next move.",
  primaryCta: "Get a demo",
  secondaryCta: { label: "See how it works", href: "/#how-it-works" },
  note: "Your channels. Your numbers. A clearer picture.",
};

export const dashboard = {
  workspace: "NORTHSTAR STUDIO",
  sidebar: ["Overview", "Channels", "AI insights", "Reports", "Source health"] as const,
  title: "Marketing overview",
  compactTitle: "Your marketing overview",
  period: "September 1–21, 2026 · USD · Last-click attribution",
  metrics: [
    { label: "Ad spend", value: "$24,800", compactValue: "$24.8K", delta: "+8.2% vs. previous period", compactDelta: "+8.2%" },
    { label: "Attributed revenue", value: "$104,160", compactValue: "$104.2K", delta: "+14.6% vs. previous period", compactDelta: "+14.6%" },
    { label: "Paid-media ROAS", value: "4.20×", delta: "+0.23× vs. previous period" },
    { label: "Cost per lead", value: "$38.75", delta: "−6.4% vs. previous period" },
  ],
  chartTitle: "Attributed revenue trend",
  // Bar heights in px, measured from the reference (last bar is highlighted)
  bars: [30, 45, 40, 62, 52, 72, 67, 88, 78, 82, 91, 72, 98, 110, 103, 130],
  chartStart: "SEP 01",
  chartEnd: "SEP 21",
  signal: {
    eyebrow: "WEEKLY SIGNAL",
    heading: "Revenue grew faster than spend.",
    description:
      "Revenue rose 14.6%, while spend increased 8.2%. Review the channel breakdown before changing your budget.",
    source: "Based on 3 paid channels",
  },
  caption: "Illustrative product preview · Sample data",
  compactCaption: "Product preview · Sample data",
};

export const tools = {
  heading: "A clearer view of the tools you already use.",
  items: [
    { name: "Google Ads", logo: "google-ads", w: 22, h: 22 },
    { name: "Meta Ads", logo: "meta-ads", w: 30, h: 22 },
    { name: "Analytics", logo: "analytics", w: 22, h: 22 },
    { name: "HubSpot", logo: "hubspot", w: 22, h: 22 },
    { name: "Klaviyo", logo: null, w: 0, h: 0 },
    { name: "Shopify", logo: "shopify", w: 26, h: 26 },
    { name: "Salesforce", logo: "salesforce", w: 26, h: 26 },
    { name: "Mailchimp", logo: "mailchimp", w: 26, h: 26 },
    { name: "Linkedin", logo: "linkedin", w: 26, h: 26 },
    { name: "Tiktok", logo: "tiktok", w: 26, h: 26 },
    { name: "Mixpanel", logo: "mixpanel", w: 26, h: 26 },
    { name: "Zapier", logo: "zapier", w: 26, h: 26 },
  ],
};

export const features = {
  eyebrow: "BUILT FOR BETTER DECISIONS",
  heading: "Less noise. More useful signals.",
  description:
    "See how your channels perform, where your reporting has gaps, and what deserves your attention next.",
  items: [
    {
      image: "/images/feature-roas.svg",
      metric: "4.20×",
      context: "PAID-MEDIA ROAS",
      heading: "See the whole marketing picture.",
      description: "Bring spend, leads, and attributed revenue into one shared view.",
    },
    {
      image: "/images/feature-cost-per-lead.svg",
      metric: "+20.6%",
      context: "META ADS CPL",
      heading: "Catch changes worth a closer look.",
      description: "Spot unusual movement and decide what to investigate.",
    },
    {
      image: "/images/feature-weekly-brief.svg",
      metric: "03 / 02",
      context: "CHANGES / FOLLOW-UPS",
      heading: "Share the story behind the numbers.",
      description: "Keep charts, notes, and next steps in one weekly brief.",
    },
    {
      image: "/images/feature-stack.svg",
      metric: "5 + 1",
      context: "CONNECTED / NEEDS ATTENTION",
      heading: "See where your stack falls short.",
      description: "Review connected tools, reporting overlap, and missing data.",
    },
  ],
};

export const reportingGap = {
  eyebrow: "THE REPORTING GAP",
  heading: "More tools. Less clarity.",
  description:
    "Your ad platforms count clicks. Your CRM tracks pipeline. Your email tool reports engagement. When every tool tells a different story, deciding what to do next becomes another task.",
  support: "Spend less time matching reports. Spend more time understanding the result.",
  reports: [
    { label: "Ads report", value: "$104,160", tone: "blue" as const },
    { label: "CRM report", value: "$91,420", tone: "peach" as const },
  ],
  panel: {
    label: "Channel performance",
    value: "$104,160",
    description: "Attributed revenue · 3 paid channels",
    bars: [
      { h: 70, tone: "orange" as const },
      { h: 100, tone: "green" as const },
      { h: 83, tone: "green" as const },
      { h: 115, tone: "orange" as const },
      { h: 88, tone: "green" as const },
      { h: 100, tone: "green" as const },
      { h: 120, tone: "orange" as const },
      { h: 108, tone: "green" as const },
    ],
  },
  sources: ["Ad performance", "Website activity", "CRM outcomes"],
  warning: "Different attribution. Different answers.",
};

export const workflow = {
  eyebrow: "FROM DATA TO DIRECTION",
  heading: "A clearer week starts here.",
  description:
    "Bring the right sources together, agree on what matters, and give your team a shared starting point.",
  steps: [
    {
      number: "01",
      image: "/images/step-connect.svg",
      heading: "Connect your tools.",
      description: "Bring your ad, analytics, CRM, and email sources into one workspace.",
    },
    {
      number: "02",
      image: "/images/step-context.svg",
      heading: "Set the context.",
      description: "Define your goals, reporting period, and attribution view.",
    },
    {
      number: "03",
      image: "/images/step-review.svg",
      heading: "Review your next move.",
      description: "Use AI summaries and source metrics to decide what to test next.",
    },
  ],
  note: "AI suggests. Your team decides.",
};

export const audience = {
  eyebrow: "ONE VIEW, DIFFERENT PERSPECTIVES",
  heading: "Built for the people behind the growth.",
  description: "Give each role a useful view of the same marketing story.",
  photoCaption: "A shared view. A stronger conversation.",
  roles: [
    { number: "01", role: "Growth leaders", description: "Bring a clearer set of priorities to your next planning meeting." },
    { number: "02", role: "Performance marketers", description: "Compare campaigns, investigate changes, and plan your next experiment." },
    { number: "03", role: "Founders", description: "Connect marketing spend with business outcomes in one useful view." },
    { number: "04", role: "Agencies", description: "Turn weekly client reporting into a more useful conversation." },
  ],
};

export const stories = {
  eyebrow: "SAMPLE CUSTOMER STORIES",
  heading: "A clearer view changes the conversation.",
  description: "Illustrative stories showing how different teams could use Metrivello.",
  items: [
    {
      name: "Lena Brooks",
      role: "Head of Growth, Alder & Finch",
      avatar: "/images/avatar-lena-brooks.png",
      quote:
        "Our Monday meeting used to start with three conflicting reports. Now we start with the same picture and spend the time deciding what to do.",
    },
    {
      name: "Marcus Hale",
      role: "Performance Lead, Fieldnote Studio",
      avatar: "/images/avatar-marcus-hale.png",
      quote:
        "I can open the numbers behind an AI summary. It gives us a useful starting point without asking us to take the answer on faith.",
    },
    {
      name: "Priya Ellis",
      role: "Strategy Director, Northline Collective",
      avatar: "/images/avatar-priya-ellis.png",
      quote:
        "The weekly brief helps us explain the story to clients. We can talk about the trade-offs instead of every dashboard.",
    },
  ],
};

export type Billing = "monthly" | "yearly";

export const pricing = {
  eyebrow: "SIMPLE PLANS, CLEAR SCOPE",
  heading: "Choose the view your team needs.",
  description:
    "Start with a focused workspace or bring several teams and clients together. Every plan includes the core dashboard and AI summaries.",
  discount: "Save 20%+ yearly",
  terms:
    "All prices in USD. Monthly billing, with no annual commitment. A source account is one connected ad, analytics, CRM, or email account.",
  plans: [
    {
      id: "essential",
      badge: "YOUR STARTING POINT",
      name: "Essential",
      featured: false,
      monthly: { price: "$79", cadence: "per workspace / month", note: "Flexible monthly billing" },
      yearly: { price: "$63", cadence: "per month · $756 billed yearly", note: "Save $192 every year" },
      description: "For a focused marketing team.",
      features: [
        "1 workspace · 3 team members",
        "Up to 5 connected source accounts",
        "100 AI questions per month",
        "Core marketing dashboard",
        "Weekly AI summary",
      ],
    },
    {
      id: "growth",
      badge: "RECOMMENDED FOR GROWTH",
      name: "Growth",
      featured: true,
      monthly: { price: "$199", cadence: "per workspace / month", note: "Flexible monthly billing" },
      yearly: { price: "$159", cadence: "per month · $1,908 billed yearly", note: "Save $480 every year" },
      description: "For teams managing more channels.",
      features: [
        "1 workspace · 10 team members",
        "Up to 15 connected source accounts",
        "500 AI questions per month",
        "Custom views and metric alerts",
        "Weekly summaries and scheduled reports",
      ],
    },
    {
      id: "scale",
      badge: "YOUR STARTING POINT",
      name: "Scale",
      featured: false,
      monthly: { price: "Custom", cadence: "built around your team", note: "Let’s shape your workspace" },
      yearly: { price: "Custom", cadence: "annual terms tailored to your team", note: "Let’s shape your workspace" },
      description: "For agencies and larger organizations.",
      features: [
        "Multiple client workspaces",
        "Agreed source and team limits",
        "Tailored AI usage allowance",
        "Custom reporting setup",
        "Guided onboarding",
      ],
    },
  ],
};

export const journal = {
  eyebrow: "THE METRIVELLO JOURNAL",
  heading: "Make sense of modern marketing.",
  description:
    "Practical ideas for clearer reporting, more useful AI, and better conversations about performance.",
  cta: { label: "View all articles", href: "/blog" },
  // First four journal entries; the fourth only shows on tablet (2×2 grid).
  articles: articles.slice(0, 4),
};

export const clarity = {
  chips: ["3 sources checked", "Last 7 days", "Human reviewed"],
  question: "Why did our cost per lead increase this week?",
  answerHeading: "A change worth a closer look.",
  answer:
    "Meta Ads CPL rose from $34 to $41. Spend increased while lead volume stayed nearly flat. Start by checking creative fatigue and audience overlap.",
  evidence: ["Meta Ads", "Sep 15–21", "vs. Sep 8–14"],
  disclaimer: "Possible explanations to investigate, not confirmed causes.",
  nextStep: "Next: review audience and creative changes.",
  eyebrow: "CLARITY, WITH CONTEXT",
  heading: "Turn data into a useful next step.",
  description:
    "Ask a question in plain English. Metrivello brings the relevant metrics together, explains what changed, and points you to the data behind the answer.",
};

export const faq = {
  status: "A little context goes a long way.",
  eyebrow: "A FEW THINGS TO KNOW",
  heading: "Clear answers, before you get started.",
  description: "More context on the product, the data, and the way your team stays in control.",
  items: [
    {
      q: "What does Metrivello bring together?",
      a: "Metrivello is designed to combine advertising, website analytics, CRM, and email data in one marketing workspace. Your demo will focus on the sources and questions that matter to your team.",
    },
    {
      q: "What does the AI actually do?",
      a: "It summarizes changes, helps answer performance questions, and suggests areas to investigate. You can review the source metrics behind an answer before deciding what to do next.",
    },
    {
      q: "Will Metrivello change my campaigns automatically?",
      a: "No. The proposed workflow is for analysis and recommendations. Your team stays responsible for campaign changes, budget decisions, and approvals.",
    },
    {
      q: "Why might the numbers differ from an ad platform?",
      a: "Reporting periods, time zones, attribution windows, and conversion definitions can produce different totals. Keep those settings visible and compare like with like before drawing conclusions.",
    },
    {
      q: "How often does the data update?",
      a: "Refresh timing depends on the connected source. Each source should show its latest successful sync so your team can see how current the report is.",
    },
    {
      q: "Can agencies use it for multiple clients?",
      a: "The Scale plan is designed around multiple workspaces and client reporting. Share your setup in the request form so the demo can cover the right workflow.",
    },
    {
      q: "What counts as a connected source account?",
      a: "One connected ad, analytics, CRM, or email account counts as one source account. Essential includes up to five; Growth includes up to fifteen.",
    },
    {
      q: "How do I get started?",
      a: "Select Get a demo and send a short request. Include the tools you use and the question you want to answer. The team can then prepare a relevant walkthrough.",
    },
  ],
};

export const footer = {
  eyebrow: "MAKE YOUR NEXT MOVE CLEARER",
  heading: "Your marketing data has more to tell you.",
  description: "Bring your tools, metrics, and next steps into one useful view.",
  columns: {
    product: {
      title: "PRODUCT",
      links: [
        { label: "Overview", href: "/#overview" },
        { label: "Features", href: "/#features" },
        { label: "How it works", href: "/#how-it-works" },
        { label: "Pricing", href: "/#pricing" },
      ],
    },
    resources: {
      title: "RESOURCES",
      links: [
        { label: "Blog", href: "/blog" },
        { label: "Support", href: "/support" },
        { label: "FAQ", href: "/#faq" },
      ],
    },
    legal: {
      title: "LEGALS",
      links: [
        { label: "Privacy Policy", href: "/legal/privacy-policy" },
        { label: "Terms of Use", href: "/legal/terms-of-use" },
      ],
    },
    contact: {
      title: "LET’S TALK",
      links: [{ label: "Get a demo", href: "/support" }],
    },
    social: {
      title: "SOCIAL",
      links: [
        // The reference leaves social links unset; add real profile URLs here.
        { label: "Instagram", href: null },
        { label: "Pinterest", href: null },
        { label: "Twitter", href: null },
      ],
    },
  },
  credit: { prefix: "Designed by", name: "Gennady Muzych", href: "https://www.framer.com/@gennady/" },
  copyright: "© 2026 Metrivello",
  disclaimer: "Fictional product. Illustrative content and data.",
};
