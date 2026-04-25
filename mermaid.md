# DripIQ System Network Diagram

## Customer-facing overview (compliance / sharing)

Simplified network diagram: nodes and paths only (no product features). Suitable for sharing with prospects and customers.

```mermaid
flowchart LR
  Users["End users"]
  App["DripIQ\nweb app"]
  Servers["DripIQ\nservers"]
  Vendors["Third-party\nvendors"]

  Users <-->|HTTPS| App
  App -->|API| Servers
  Servers <-->|APIs, webhooks| Vendors
```

| Network path | Description |
|--------------|-------------|
| **End users ↔ DripIQ web app** | User traffic over HTTPS (browser to our application). |
| **DripIQ web app → DripIQ servers** | API requests from the app to our backend. |
| **DripIQ servers ↔ Third-party vendors** | Outbound calls from our servers to vendors (e.g. auth, email, AI); vendors may call back (e.g. webhooks). |

---

## Internal architecture (technical)

High-level architecture of the monorepo: client, landing, server (API + workers), data stores, and external services.

```mermaid
flowchart TB
  subgraph users["Users"]
    Browser["Browser"]
  end

  subgraph apps["Applications"]
    Client["Client (React + Vite)\nport 3000"]
    Landing["Landing (React + Vite)\nport 3001\nSEO / marketing"]
    Server["Server (Fastify)\nport 3001\nREST API"]
  end

  subgraph workers["Background Workers"]
    W1["lead-initial-processing\nworker"]
    W2["lead-analysis\nworker"]
    W3["campaign-creation\nworker"]
    W4["campaign-execution\nworker"]
  end

  subgraph queues["BullMQ Queues (Redis)"]
    Q1["lead_initial_processing"]
    Q2["lead_analysis"]
    Q3["campaign_creation"]
    Q4["campaign_execution"]
  end

  subgraph data["Data & Storage"]
    Postgres[("Postgres\n(Drizzle ORM)")]
    Redis[("Redis")]
  end

  subgraph auth["Auth & Identity"]
    Supabase["Supabase\n(Auth + Admin API)"]
  end

  subgraph external["External Services"]
    Firecrawl["Firecrawl\n(scrape + webhook)"]
    OpenAI["OpenAI / LangChain\n(embeddings, agents)"]
    Langfuse["Langfuse\n(tracing)"]
    EmailVerify["EmailListVerify\n(email validation)"]
    Gmail["Gmail API"]
    Outlook["Microsoft Graph\n(Outlook)"]
    Coresignal["Coresignal\n(web data)"]
  end

  Browser --> Client
  Browser --> Landing
  Client -->|"fetch /api/*\nJWT"| Server
  Client -->|"auth (session,\nsign in/out)"| Supabase

  Server -->|"read/write"| Postgres
  Server -->|"enqueue jobs"| Redis
  Server -->|"admin auth,\ninvite users"| Supabase
  Server -->|"webhook"| Firecrawl
  Server -->|"send mail"| Gmail
  Server -->|"send mail"| Outlook
  Server -->|"scrape, embed,\ncontact extraction"| OpenAI
  Server -->|"tracing"| Langfuse
  Server -->|"validate email"| EmailVerify
  Server -->|"company/employee data"| Coresignal

  Firecrawl -.->|"webhook POST"| Server

  W1 -->|"consume"| Q1
  W2 -->|"consume"| Q2
  W3 -->|"consume"| Q3
  W4 -->|"consume"| Q4
  Redis --> Q1 & Q2 & Q3 & Q4

  W1 -->|"read/write"| Postgres
  W2 -->|"read/write"| Postgres
  W3 -->|"read/write"| Postgres
  W4 -->|"read/write"| Postgres
  W1 -->|"enqueue"| Q2
  W1 -->|"Firecrawl scrape"| Firecrawl
  W2 -->|"LangChain / embeddings"| OpenAI
  W4 -->|"send mail"| Gmail
  W4 -->|"send mail"| Outlook

  W1 & W2 & W3 & W4 --> Redis
```

## Queue flow (worker pipeline)

```mermaid
flowchart LR
  subgraph ingress["API / triggers"]
    LeadCreate["Lead create/batch\nResync"]
    CampaignTrigger["Campaign run"]
  end

  subgraph q["Queues"]
    A[lead_initial_processing]
    B[lead_analysis]
    C[campaign_creation]
    D[campaign_execution]
  end

  LeadCreate --> A
  A -->|"on complete"| B
  CampaignTrigger --> C
  C --> D
  D -->|"timeout jobs"| D
```

## API surface (server routes)

| Area | Routes prefix / purpose |
|------|-------------------------|
| Auth | `/api/auth/*` (register, login, me, verify-otp, logout) |
| Users & invites | `/api/users/*`, `/api/invites`, `/api/me/*` |
| Leads | `/api/leads/*` (CRUD, batch, assign-owner, contacts, analyze, products) |
| Contacts | `/api/contacts/*`, `/api/bulk-contacts` |
| Organization | `/api/organizations/*` |
| Products | `/api/products/*` |
| Dashboard | `/api/dashboard` |
| Roles | `/api/roles/*` |
| Calendar | `/api/calendar/*` |
| Logo | `/api/logo/upload` |
| Webhooks | `/api/firecrawl/*` |
| Third-party auth | `/api/third-party-auth/*` (Google, Microsoft) |
| Email validation | `/api/email-validation/*` |
| Unsubscribe | `/api/unsubscribe/*` |
| Debug / admin | `/api/debug/*`, Bull Board (queues UI) |

## Package dependency summary

| Package | Deps (conceptual) |
|---------|-------------------|
| **client** | Server API (fetch), Supabase Auth, TanStack Router/Query |
| **landing** | Standalone; TanStack Router |
| **server** | Postgres, Redis, Supabase, Firecrawl, LangChain/OpenAI, Langfuse, EmailListVerify, Gmail, Microsoft Graph, Coresignal |

---

## Third-party vendors: description and interactions

This section describes each integrated vendor and how they interact with DripIQ and with each other.

### Auth and identity

**Supabase**  
Provides authentication (sessions, sign-in/sign-out), the primary Postgres database, and object storage. The client talks to Supabase for login/logout and session handling; the server uses the Supabase Admin API for invite flows, user management, and storage (e.g. logos, site assets). All app and worker flows that need “who is this user?” or “where do we store this?” ultimately depend on Supabase.

**Google (OAuth + Gmail API)**  
Users can sign in with Google and connect Gmail for sending/receiving. The server initiates the OAuth flow and stores tokens; it then uses the Gmail API to send campaign emails and (where used) read calendar/email. Interaction is server → Google only; no webhooks from Google into DripIQ.

**Microsoft (OAuth + Microsoft Graph)**  
Same pattern as Google: sign-in with Microsoft and connect Outlook/calendar. The server uses Microsoft Graph to send mail and access calendar. Again, server → Microsoft only.

*How they interact:* Supabase is the single source of auth and identity. Google and Microsoft are optional “connect your inbox” providers; the server chooses Gmail or Microsoft Graph per tenant/campaign when sending email.

---

### Email delivery and validation

**EmailListVerify**  
Dedicated email validation API. The server calls it to verify that an address is deliverable and not risky. Used in contact/lead flows before adding contacts or sending; no callback into DripIQ.

*How they interact:* EmailListVerify is used for "is this email valid?" Email is sent via Gmail or Microsoft Graph when the user has connected their own inbox.

---

### AI and observability

**OpenAI (via LangChain)**  
Used for embeddings, agents, contact extraction from scraped content, lead and organization analysis, and related AI features. The server and workers (especially lead-initial-processing and lead-analysis) call the OpenAI API through LangChain. No webhooks from OpenAI.

**Langfuse**  
LLM observability and tracing. The server sends traces (prompts, responses, token usage) to Langfuse so you can debug and tune prompts and monitor cost/quality. All OpenAI/LangChain usage can be traced there. One-way: server → Langfuse.

*How they interact:* Every meaningful call to OpenAI is wrapped so that Langfuse receives the same request/response and metadata. No direct OpenAI ↔ Langfuse link; DripIQ is the bridge.

---

### Web scraping and web data

**Firecrawl**  
Web scraping and job orchestration. The server (or lead-initial-processing worker) requests a scrape; Firecrawl fetches and optionally processes the page, then POSTs results back to the server via webhook. That content is then used for embeddings, contact extraction, and lead analysis (which in turn use OpenAI).

**CoreSignal**  
Company and employee data (e.g. firmographics, org structure, contact info). The server calls CoreSignal when it needs enriched B2B data for leads or accounts. One-way: server → CoreSignal.

*How they interact:* Firecrawl supplies raw or processed page content; CoreSignal supplies structured company/people data. Both feed into the same lead/contact model and can be used together in analysis and campaign logic. Firecrawl is the only one that calls back into DripIQ (webhook).

---

### Observability and deployment

**Highlight**  
Error and log observability. The server sends errors and structured logs (e.g. via Pino) to Highlight. Used for debugging and monitoring; one-way, and does not drive other vendors.

**Render**  
Hosting for the app and workers. CI triggers deploys via Render’s deploy URLs. Render runs the server and workers; it does not integrate with other vendors except insofar as the code it runs calls them.

---

### End-to-end flow example

1. User signs in (Supabase) and creates a lead; client calls server API.
2. Server enqueues **lead-initial-processing**. Worker asks **Firecrawl** to scrape the lead’s site; Firecrawl later POSTs back to the server (webhook).
3. Server enqueues **lead-analysis**. Worker sends scraped content and optional **CoreSignal** data to **OpenAI** (LangChain) for embeddings and analysis; **Langfuse** records the trace.
4. Contacts may be validated with **EmailListVerify** before saving.
5. When a campaign runs, **campaign-execution** worker sends email via (**Gmail** / **Microsoft Graph** if the user connected an inbox).

Throughout, **Supabase** backs auth and persistence, **Highlight** captures errors and logs, and **Render** runs the deployed app and workers.
