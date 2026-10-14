// Journal articles (content from the Metrivello reference site).

export type Block = { type: "p" | "h2" | "h3"; text: string } | { type: "ul" | "ol"; items: string[] };

export type Article = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  cover: string;
  author: string;
  date: string;
  dateTime: string;
  body: Block[];
};

export const author = {
  name: "Mara Ellis",
  bio: "Editorial Lead, Metrivello. Mara writes about marketing measurement, practical AI, and the habits that make reporting useful.",
};

export const articles: Article[] = [
  {
    slug: "roas-beyond-the-headline",
    category: "Measurement",
    title: "ROAS is a starting point, not the whole story",
    excerpt: "Use return on ad spend alongside margin, customer quality, and attribution context.",
    cover: "/images/article-roas.svg",
    author: "Mara Ellis",
    date: "Sep 21, 2026",
    dateTime: "2026-09-21",
    body: [
      { type: "p", text: "ROAS is a useful place to begin a marketing conversation. It compares revenue attributed to advertising with the amount spent on those ads. If a campaign spends $1,000 and receives $4,000 in attributed revenue, its reported ROAS is 4×." },
      { type: "p", text: "The calculation is simple. The interpretation needs more context." },
      { type: "h2", text: "Revenue is not the same as profit" },
      { type: "p", text: "Two campaigns can report the same ROAS and contribute very different amounts to the business. Product costs, discounts, returns, shipping, and other expenses change what remains after the sale." },
      { type: "p", text: "A campaign selling a lower-margin product may need a higher ROAS to make economic sense. A campaign selling a higher-margin product may support a different target. Start with the economics of the offer before deciding whether a number looks strong." },
      { type: "h2", text: "Attribution changes the picture" },
      { type: "p", text: "An attributed sale is a sale assigned to a marketing touchpoint under a particular set of rules. Change the attribution window or model, and the reported result can change too." },
      { type: "p", text: "This is why platform totals should not automatically be added together. More than one platform may claim credit for the same purchase. When comparing results, keep the model, time period, and conversion definition visible." },
      { type: "h2", text: "Look beyond the immediate purchase" },
      { type: "p", text: "A campaign may attract first-time customers, returning customers, or a mix of both. Those groups can behave differently after the initial sale." },
      { type: "p", text: "Alongside ROAS, consider the share of new customers, average order value, refund rate, and repeat purchasing where reliable data is available. For a lead-based business, follow the path from lead to qualified opportunity and customer instead of treating every form submission as equal." },
      { type: "h2", text: "Turn the metric into a question" },
      { type: "p", text: "Before changing a budget, ask:" },
      { type: "ul", items: ["Are the compared periods and attribution settings aligned?", "Has product mix or discounting changed?", "Are we acquiring the customers we intended to reach?", "Does the result hold when we look beyond one unusually strong day?"] },
      { type: "p", text: "ROAS becomes more useful when it opens the discussion rather than ending it. The goal is to understand what the spending produced, what remains uncertain, and what evidence would justify the next decision." },
    ],
  },
  {
    slug: "useful-ai-marketing-insights",
    category: "AI & Analytics",
    title: "What a useful AI marketing insight should include",
    excerpt: "Look for a clear change, a visible source, and an explanation you can challenge.",
    cover: "/images/article-ai-insights.svg",
    author: "Mara Ellis",
    date: "Sep 18, 2026",
    dateTime: "2026-09-18",
    body: [
      { type: "p", text: "A fluent explanation can sound convincing before it has earned your confidence. In marketing analytics, the value of an AI insight depends on how easily your team can inspect the evidence and decide what to do with it." },
      { type: "p", text: "Use four questions to review an AI-generated summary." },
      { type: "h2", text: "What changed?" },
      { type: "p", text: "The insight should name the metric, the size of the movement, and the comparison period. “Performance improved” leaves too much open to interpretation. “Cost per lead fell from $50 to $44 compared with the previous week” gives the team something concrete to examine." },
      { type: "p", text: "Absolute values matter. A large percentage change from a very small starting point may deserve a different response from the same percentage change across a high-volume campaign." },
      { type: "h2", text: "Where did the evidence come from?" },
      { type: "p", text: "A useful answer identifies its sources. Look for the platform, account or campaign, reporting dates, and relevant metric definitions. Ideally, you can open the underlying view without reconstructing the query yourself." },
      { type: "p", text: "Also check freshness. An apparently quiet channel may simply have stopped syncing. Missing data and unchanged performance are different situations, and the summary should help you distinguish them." },
      { type: "h2", text: "Is this an observation or an explanation?" },
      { type: "p", text: "“Spend increased while lead volume stayed flat” is an observation. “The audience is fatigued” is a possible explanation that needs more evidence." },
      { type: "p", text: "Useful AI keeps that distinction visible. It can suggest checking creative frequency, audience overlap, landing-page behavior, or tracking changes. It should not present an untested hypothesis as a proven cause." },
      { type: "h2", text: "What should a person review next?" },
      { type: "p", text: "The next step should be specific and proportionate. “Optimize the campaign” is too vague. “Compare lead quality for the two audience groups before increasing spend” creates a manageable task." },
      { type: "p", text: "Keep important changes under human review. An AI summary can help a team prioritize its attention, but the team still understands the commercial context, current experiments, and constraints that may not appear in the data." },
      { type: "p", text: "The most useful insight is not the most confident sentence. It is the one that makes a better question easier to ask and a better decision easier to explain." },
    ],
  },
  {
    slug: "weekly-marketing-dashboard",
    category: "Reporting",
    title: "Build a weekly marketing dashboard people actually use",
    excerpt: "Organize the report around decisions, not the number of charts you can fit on a screen.",
    cover: "/images/article-weekly-dashboard.svg",
    author: "Mara Ellis",
    date: "Sep 15, 2026",
    dateTime: "2026-09-15",
    body: [
      { type: "p", text: "A weekly dashboard should help a team prepare for a conversation. If everyone spends the meeting searching for the right chart, the report is making the work harder." },
      { type: "p", text: "Start by deciding which questions the meeting needs to answer. Then build the dashboard around those questions." },
      { type: "h2", text: "Begin with the outcome" },
      { type: "p", text: "The first row should explain how marketing is progressing toward the current business goal. For one team, that may mean qualified opportunities. For another, it may mean first-time purchases or attributed revenue." },
      { type: "p", text: "Use a small set of headline metrics. Show the reporting period, the comparison period, and any target that has actually been agreed. Avoid mixing weekly figures with month-to-date numbers unless the distinction is explicit." },
      { type: "h2", text: "Add the drivers behind the result" },
      { type: "p", text: "The second layer should help explain movement in the outcome. This is where channel spend, conversion rate, lead quality, and campaign-level changes become useful." },
      { type: "p", text: "Keep the relationship between metrics visible. A lower cost per lead is less persuasive if the share of qualified leads also falls. A higher conversion rate may deserve a closer look if traffic volume has changed sharply." },
      { type: "p", text: "Do not add a chart simply because the data is available. Each chart should support a question that someone on the team needs to answer." },
      { type: "h2", text: "Make changes easy to find" },
      { type: "p", text: "Include a short section for notable movement and known context. A campaign launch, pricing change, tracking repair, or promotion can matter as much as the chart itself." },
      { type: "p", text: "Use plain language. “Meta spend increased after the new creative launch” is easier to discuss than a wall of unexplained percentage changes. Link observations to the underlying view so the report remains inspectable." },
      { type: "h2", text: "End with ownership" },
      { type: "p", text: "A useful weekly report closes with a small action list. Each action needs an owner, a question to investigate, and a time to review the result." },
      { type: "p", text: "For example: “Jordan will compare qualified-lead rates by audience before Friday’s budget review.” This is more actionable than “Improve acquisition efficiency.”" },
      { type: "p", text: "After a few meetings, ask which parts of the dashboard people actually use. Remove sections that never support a decision. The best report is often the one that has learned what to leave out." },
    ],
  },
  {
    slug: "marketing-stack-audit",
    category: "Marketing Operations",
    title: "Audit your marketing stack before adding another tool",
    excerpt: "Map the questions, owners, and data gaps in your current setup before expanding it.",
    cover: "/images/article-stack-audit.svg",
    author: "Mara Ellis",
    date: "Sep 11, 2026",
    dateTime: "2026-09-11",
    body: [
      { type: "p", text: "Adding a tool is easy to justify when a reporting problem feels urgent. It is harder to see whether the problem comes from missing capability, incomplete setup, or an unclear way of working." },
      { type: "p", text: "A short stack audit helps separate those possibilities." },
      { type: "h2", text: "Start with the questions" },
      { type: "p", text: "Write down the recurring questions your team needs to answer. Which campaigns create qualified demand? Where do visitors drop out? Which messages bring customers back? Which reports take the most manual effort?" },
      { type: "p", text: "For each question, identify the tool that should provide the answer and the person responsible for maintaining it. A platform with no clear owner is likely to create uncertainty even if its features are suitable." },
      { type: "h2", text: "Map the information flow" },
      { type: "p", text: "List where important data begins and where it needs to end up. An ad click may lead to a website session, a form submission, a CRM record, and eventually a sale." },
      { type: "p", text: "Look for breaks between those stages. Campaign naming may be inconsistent. A key field may not pass into the CRM. A report may use an outdated conversion definition. These are workflow problems that another dashboard will not automatically solve." },
      { type: "h2", text: "Separate useful overlap from waste" },
      { type: "p", text: "Two tools can report similar metrics for good reasons. One may support campaign execution while another supports a broader business view. The goal is not to remove every overlap." },
      { type: "p", text: "Instead, ask whether each tool has a clear role. Note its owner, recurring cost, main users, and the decisions it supports. Identify subscriptions that are rarely used, duplicated manual reports, and features the team has never configured." },
      { type: "h2", text: "Choose a small next step" },
      { type: "p", text: "End the audit with one of four actions for each issue: keep, configure, connect, or replace. “Configure the missing CRM field” is a more useful result than “Improve our data.”" },
      { type: "p", text: "Prioritize a change that resolves a frequent decision problem. Agree on how you will know the change worked, such as fewer manual corrections or a report the team can reproduce consistently." },
      { type: "p", text: "A stronger marketing stack is not necessarily a larger one. It is a set of tools with clear responsibilities, reliable connections, and a shared understanding of what their numbers mean." },
    ],
  },
  {
    slug: "investigate-performance-drops",
    category: "Measurement",
    title: "Investigate a performance drop before changing the budget",
    excerpt: "Check freshness, definitions, and the shape of the change before deciding how to respond.",
    cover: "/images/article-performance-drops.svg",
    author: "Mara Ellis",
    date: "Sep 8, 2026",
    dateTime: "2026-09-08",
    body: [
      { type: "p", text: "A sudden drop in performance can create pressure to act immediately. Sometimes the campaign needs attention. Sometimes the report is incomplete. The first job is to establish which situation you are looking at." },
      { type: "p", text: "Use a short investigation sequence before making a significant change." },
      { type: "h2", text: "Confirm that the data is ready" },
      { type: "p", text: "Check the latest successful sync and whether the reporting period is complete. Compare a full day with a full day, rather than a partial day with yesterday’s total." },
      { type: "p", text: "Review any known delays in conversions or CRM updates. If sales commonly arrive after the initial click, the most recent cohort may not yet be comparable with an older one." },
      { type: "p", text: "Also look for a tracking change. A broken event or missing field can resemble a commercial problem while requiring a very different fix." },
      { type: "h2", text: "Define the change precisely" },
      { type: "p", text: "Identify the metric that moved and the segment where it happened. Did conversion rate fall across the site or only on one landing page? Did cost per lead rise in every campaign or in a single audience?" },
      { type: "p", text: "Use a relevant comparison. Day-of-week patterns, promotions, and unusual traffic can affect the interpretation. A single weak day and a sustained decline should not automatically trigger the same response." },
      { type: "h2", text: "Check the chain of related metrics" },
      { type: "p", text: "Follow the path from spend to impressions, clicks, visits, leads, and business outcomes. The point where the pattern changes can help narrow the investigation." },
      { type: "p", text: "For example, stable click volume alongside fewer recorded leads could suggest a landing-page issue, a tracking problem, or a change in visitor quality. It does not establish which explanation is correct. Review the evidence for each possibility." },
      { type: "h2", text: "Make a controlled response" },
      { type: "p", text: "Write down what you believe changed, the evidence behind that view, and the action you want to test. Assign an owner and decide when the team will review the result." },
      { type: "p", text: "Avoid changing several variables at once unless the situation requires it. Otherwise, it becomes harder to understand what helped." },
      { type: "p", text: "An alert is the beginning of an investigation. A clear sequence makes it easier to respond with proportionate action and explain the decision to the rest of the team." },
    ],
  },
  {
    slug: "weekly-marketing-decision-brief",
    category: "Reporting",
    title: "Turn your weekly report into a decision brief",
    excerpt: "Give stakeholders the change, the context, and the decision that needs their attention.",
    cover: "/images/article-decision-brief.svg",
    author: "Mara Ellis",
    date: "Sep 4, 2026",
    dateTime: "2026-09-04",
    body: [
      { type: "p", text: "A report tells people what happened. A decision brief helps them understand what needs their attention next. The difference is often a matter of structure rather than more analysis." },
      { type: "p", text: "Use the same short format each week so stakeholders know where to look." },
      { type: "h2", text: "Lead with the change that matters" },
      { type: "p", text: "Open with one or two developments tied to the current business goal. Include the relevant period and comparison. Avoid beginning with a tour of every channel." },
      { type: "p", text: "For example: “Qualified leads were lower this week, while total lead volume stayed close to the previous week.” This gives the reader a reason to continue and directs attention toward quality rather than volume alone." },
      { type: "h2", text: "Add context and uncertainty" },
      { type: "p", text: "Explain the evidence that helps interpret the change. A new audience, revised offer, delayed CRM update, or tracking adjustment may affect the conclusion." },
      { type: "p", text: "Be explicit about what you know and what remains a hypothesis. If the data is incomplete, say which source is missing and how that limits the decision. A clear limitation is more useful than a confident explanation built on a gap." },
      { type: "h2", text: "Propose a decision or an investigation" },
      { type: "p", text: "Not every change requires an immediate action. Sometimes the right next step is to collect more information, wait for a reporting period to mature, or check a specific segment." },
      { type: "p", text: "State the proposed response, the reason for it, and the person responsible. If approval is needed, explain the trade-off the stakeholder is being asked to accept." },
      { type: "h2", text: "Keep a simple decision log" },
      { type: "p", text: "Close the brief with a small record of actions and review dates. At the next meeting, return to those decisions before introducing new ones." },
      { type: "p", text: "This creates continuity. The team can see whether an earlier assumption held up, whether a test answered its question, and whether a decision should be revised." },
      { type: "p", text: "AI can help draft the narrative or summarize the underlying data, but someone should review the brief before it is shared. Check the numbers, dates, causal language, and recommendations." },
      { type: "p", text: "The aim is a document that a stakeholder can read quickly and respond to clearly: here is what changed, here is why we think it matters, and here is the next step we recommend." },
    ],
  },
];

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug);
}

/** The reference links each article to the next one; the last article has none. */
export function getNextArticle(slug: string) {
  const index = articles.findIndex((article) => article.slug === slug);
  return index >= 0 && index < articles.length - 1 ? articles[index + 1] : undefined;
}
