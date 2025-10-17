import { APP_URLS } from '@/constants/app'
import type { BlogPost } from '../blog-posts'

export const whatIsALead: BlogPost = {
  slug: 'what-is-a-lead',
  title: 'What Is a Lead at dripIq? Tokens, Leads, and Contacts Explained',
  excerpt:
    "At dripIq, 1 token = 1 lead. A lead is an organization you're selling to and can include up to 5 contacts. Here's how it works.",
  content: `
# What Is a Lead at dripIq?

At dripIq, our pricing and usage are simple and transparent:

**1 token = 1 lead.**

## Lead Definition

A lead is an organization (company or account) that you're selling to. Each lead can include **up to 5 contacts** (people) within that organization. Those contacts can be across roles (e.g., champion, decision maker, influencer) and departments.

This definition aligns with how modern B2B sales teams work—pursuing an account with multi-threaded outreach rather than a single person.

## Why Accounts (Leads) Instead of Individuals?

- Multi-threading increases win rates by engaging multiple stakeholders.
- Messaging can be tailored by role while keeping the account narrative consistent.
- Reporting and forecasting are cleaner at the account level.

## How Tokens Work

- **1 token = 1 lead** across our platform features
- Tokens are consumed when you engage a lead (e.g., generate, score, or activate a new account)
- Monthly plan tokens do not roll over; token bundles do roll over

## Examples

- You target Acme Corp. You include 3 contacts: a VP, a Director, and a Manager. This counts as **1 lead** and **1 token**.
- You later add 2 more contacts at Acme (total 5). Still **1 lead** and **1 token**.

## Pricing Clarification

All tiers include the same features. The only difference is the **token price**, which gets better with higher monthly volume. See our [pricing page](/pricing) or [start your free trial](${APP_URLS.SIGNUP}).

---

If you have questions about edge cases (multiple subsidiaries, holding companies, or very large buying committees), [contact our team](/contact) and we'll help you model it.
`,
  author: 'dripIq Team',
  publishedAt: '2025-09-17',
  readTime: '3 min read',
  tags: ['Pricing', 'Leads', 'Tokens'],
  seo: {
    title: 'What Is a Lead? 1 Token = 1 Lead | dripIq',
    description:
      "Understand dripIq's lead and token model: 1 token = 1 lead (one organization) with up to 5 contacts included.",
    keywords: ['what is a lead', 'token pricing', 'B2B lead definition'],
  },
}
