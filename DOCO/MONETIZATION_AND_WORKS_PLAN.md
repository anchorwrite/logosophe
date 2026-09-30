# Monetization, International Sales and the Works Model

**Status:** planning only, on hold (27 September 2026). Nothing here is built yet.

**Scope:**
- selling access to published works, per work or as an all-access subscription;
- running Logosophe as a **global, multi-author marketplace**;
- a new **Works** data model that groups every kind of file belonging to a novel, poem, essay or other work.

**Caveat:** tax and consumer-law details below are summaries for planning, not legal or tax advice. Thresholds and rules change often; the figures are approximate as of 2024–2025 and must be checked before anything goes live.

---

## 1. Goals and constraints

- **Practice first.** Logosophe is mainly a full-stack learning project. Prefer designs that teach real patterns (webhooks, entitlements, multi-party payments, i18n) over turnkey shortcuts.
- **Global from the start.** Readers anywhere; prices, taxes, payment methods and legal notices must work outside the US and EU.
- **Multi-author.** Other authors will publish and sell, which makes Logosophe a **marketplace**: it takes payments on behalf of several sellers and pays them their share.
- **Existing stack:**
  - Next.js 15 via OpenNext on Cloudflare Workers;
  - D1 (SQLite) and R2;
  - Better Auth;
  - five UI languages (EN, DE, ES, FR, NL);
  - a `content` tenant that holds published files.

---

## 2. What is sold

| Offer | Suits | Notes |
|---|---|---|
| **Per-work purchase** (one-time) | finished novels, collections | what readers expect for a book; lifetime access to that edition |
| **Per-work subscription** | serials, a novel plus its growing lab, a poet's ongoing series | recurring; access lapses at period end |
| **All-access subscription** (monthly / annual) | readers of several authors | needs a rule for sharing revenue among authors (§3.4) |
| **Bundles** | a series, an author's backlist | an offer that grants several works |
| **Free** | previews, blog posts, announcements | first chapters, excerpts, a poem or two; the main driver of sales |

Keep **works** (what exists) separate from **offers** (what is sold, at what price, where). One work can have several offers, and one offer (a bundle, all-access) can cover many works. §5 models this.

---

## 3. Marketplace model and payment provider

### 3.1 Who is the seller?

Three ways to structure it:

1. **Stripe Connect.**
   - Logosophe is the platform and authors are *connected accounts* (Express accounts are the simplest).
   - Stripe runs author onboarding and identity checks (KYC), pays authors out in their own currencies, and handles much of the US 1099 reporting for connected accounts.
   - Logosophe takes an application fee on each sale.
   - Charge types: *destination charges* (simplest: one charge, automatic transfer to the author) or *separate charges and transfers* (needed when one payment covers several authors, such as all-access or a multi-author anthology).
2. **Logosophe as publisher, paying royalties.**
   - Logosophe licenses each work from its author and sells it as the sole seller.
   - Authors earn royalties, paid by Connect transfers or bank payout.
   - This is how traditional and e-book publishers work.
   - It fits a **Merchant of Record** provider for the reader-facing side, because there's only one seller.
3. **Merchant of Record that supports marketplaces.**
   - Most MoR providers (Paddle, Lemon Squeezy and similar) are built for a *single* seller, and their terms often forbid reselling other people's products. Confirm with each provider before relying on one.

**Likely choice: Stripe Connect plus Stripe Tax** (option 1), or option 2 if the tax burden of being a marketplace proves too heavy. Stripe's test mode makes all of this buildable and testable without real money, which suits the practice goal.

### 3.2 Marketplaces are usually liable for the tax

Many jurisdictions make the **platform**, not the author, responsible for tax on digital sales made through it:

- **EU:** when electronically supplied services are sold through an electronic interface, the platform is *presumed* to be the supplier for VAT (Article 9a of Implementing Regulation 282/2011).
- **US:** most states with sales tax have *marketplace facilitator* laws, which make the platform collect and remit.
- The UK, Australia, New Zealand, Canada, Norway, Singapore, India and others have similar platform rules for digital services.

In practice, plan for **Logosophe to calculate, collect and remit tax on every sale**, whichever structure is chosen.

### 3.3 Hosted checkout and billing

- Use hosted **Checkout** and the **Customer Portal**. Card data never touches Logosophe, keeping PCI scope minimal (SAQ A).
- Checkout also handles the strong customer authentication rules (3-D Secure, PSD2) required in the EEA and UK, local payment methods, and wallets.
- The provider sends receipts, retries failed renewals and runs dunning emails.

### 3.4 Sharing all-access revenue among authors

Choose a rule and publish it to authors:

- **Pro-rata pool.** Pool all subscription revenue for a period (after tax, fees and the platform share) and split it by each work's share of total reading. Simple, but heavy readers' tastes dominate. Kindle Unlimited works roughly like this, paying by pages read.
- **User-centric.** Split each subscriber's own payment among the works *that subscriber* read. Fairer to niche authors, but needs more computation.
- **What counts as reading:** pages or percent of text viewed, time spent, lab notebooks opened. `ContentUsage` already logs usage and could feed this. Guard against self-dealing, such as an author reading their own work in a loop.

---

## 4. Selling internationally

### 4.1 Currencies and prices

- **Store prices per currency**, not converted on the fly. Charm prices (€4.99, ¥800, ₹299) look deliberate; converted ones look odd.
- **Regional pricing.** Consider purchasing-power tiers (for example lower prices in India, Brazil, Indonesia). Offers need a price per currency and optionally per country.
- **Tax-inclusive vs. tax-exclusive display.** EU, UK, Australia, New Zealand, Japan and most of the world expect prices *including* VAT/GST. The US and Canada show prices *before* sales tax. Store which convention each price follows, and have Checkout compute accordingly.
- **Money in minor units.** Store `INTEGER` amounts in the currency's smallest unit plus an ISO 4217 code. Some currencies have no minor unit (JPY, KRW, VND), and a few have three decimals (BHD, KWD). Never use floating point for money.
- **Formatting.** Use `Intl.NumberFormat(locale, { style: 'currency', currency })` on the site. It already handles symbols, separators and placement for every locale.

### 4.2 Indirect tax on digital sales, worldwide

The main thing to know: **many countries tax foreign sellers of digital products from the first sale**, with no threshold. A global marketplace should assume it must register in many places as it grows. Stripe Tax monitors thresholds and calculates, but registering and filing are separate tasks; Stripe offers registration help in some countries.

| Region | Regime (for foreign sellers to consumers) | Threshold (approx.; verify) |
|---|---|---|
| European Union | VAT at the *buyer's* country rate; one registration via the **non-Union OSS** scheme covers all 27 | none for non-EU sellers (the €10,000 threshold applies only to EU-established sellers) |
| United Kingdom | VAT | none for non-UK sellers |
| Norway | VAT via **VOEC** | NOK 50,000 |
| Switzerland | VAT | CHF 100,000 worldwide turnover |
| Australia | GST | A$75,000 |
| New Zealand | GST | NZ$60,000 |
| Canada | GST/HST federally; Québec (QST), BC, Saskatchewan and Manitoba have their own digital-services rules | C$30,000 |
| Japan | Consumption tax (JCT) | ¥10 million, but the invoice rules push many sellers to register earlier |
| South Korea | VAT on foreign e-services | none |
| India | GST on online information services (OIDAR) | none for sales to consumers |
| Singapore | GST (overseas vendor regime) | S$1m global and S$100k to Singapore |
| South Africa | VAT on electronic services | R1 million |
| United States | state sales tax; taxability of e-books and digital subscriptions varies by state; *economic nexus* thresholds | typically US$100,000 per state (some also count transactions) |
| Latin America, Gulf, others | Mexico, Chile, Colombia, Argentina, Saudi Arabia, UAE, Turkey and others have their own digital-services taxes; Brazil's rules are especially complex | varies |

Further points:

- **Proving the buyer's location.** The EU requires two non-contradictory pieces of evidence of where the customer is: billing address, card-issuing country, IP address or phone country code. Hosted checkout collects most of this; store what was used with the order.
- **Business buyers.** Buyers who give a valid VAT/GST number are usually *reverse-charged*: no VAT is charged and the buyer accounts for it. That matters for libraries and schools.
- **E-books often have special rates.** Many EU states apply reduced rates to e-books since the 2022 VAT-rates directive. The UK zero-rates e-publications. An **interactive lab or software** may not count as an e-book and could be taxed at the standard rate. **Bundles** (novel plus lab) raise a classification question; tax each component by its own category if possible. This is one reason the Works model tracks asset types (§5).

### 4.3 Payment methods

Cards aren't universal. Hosted checkout can offer local methods per country. Examples:

- SEPA Direct Debit, iDEAL (Netherlands), Bancontact (Belgium), BLIK (Poland)
- Klarna and other pay-later services
- Pix (Brazil), OXXO (Mexico), Konbini (Japan)
- Alipay and WeChat Pay
- Apple Pay and Google Pay

**Recurring payments in some countries need special handling:**
- **India:** Reserve Bank rules for card mandates impose limits and pre-debit notifications on subscriptions.
- **Brazil:** subscriptions often use Pix Automático or boleto rather than cards.

Check which methods support subscriptions before offering all-access in a market.

### 4.4 Paying authors worldwide

- **Where authors can join.** Stripe Connect supports connected accounts in a fixed list of countries. Authors elsewhere can't be onboarded directly and would need cross-border payouts or another payout route. Find out an author's country before inviting them to sell.
- **Tax information.** Collect US W-9 or W-8BEN forms (Stripe does this for Express accounts). Issue US 1099 forms where required. Check whether platform-reporting rules apply to digital-content sales: the EU's **DAC7** and the OECD model rules.
- **Author terms.** Revenue share, payout schedule, minimum payout, currency, refund clawbacks, and who handles chargebacks.

### 4.5 Consumer law

- **EU/EEA and UK: 14-day right of withdrawal** for online purchases. For digital content, it ends at first access *only if* the buyer explicitly consents and acknowledges losing the right. That needs a checkbox at checkout, recorded with the order. The EU Digital Content Directive also sets conformity and update obligations.
- **Subscriptions and auto-renewal:**
  - The UK's Digital Markets, Competition and Consumers Act 2024 brings a subscription regime: reminders before renewal and easy cancellation.
  - Several EU states have their own renewal-notice rules.
  - In the US, many states (notably California) have automatic-renewal laws. A federal "click-to-cancel" rule was struck down in 2025, so check the current position.
  - The safe default everywhere: clear renewal terms, a reminder before each annual renewal, and cancellation in as few clicks as signing up took.
- **Australia, Brazil, India and others** have their own consumer guarantees and refund expectations. Publish a clear, generous refund policy.

### 4.6 Privacy and data

- Relevant laws include GDPR (EU), UK GDPR, CCPA/CPRA (California), LGPD (Brazil), PIPEDA (Canada), APPI (Japan), PIPA (South Korea) and India's DPDP Act.
- Keep payment data with the provider. Store only what's needed: customer and subscription IDs, country, tax evidence.
- A privacy notice in every UI language; a cookie-consent banner where analytics or marketing cookies are used.
- Data location: D1 and R2 have location and jurisdiction options (for example keeping data in the EU). Check the current Cloudflare options if a jurisdiction requires it.

### 4.7 Sanctions and restricted content

- Payment providers block sanctioned countries and people (for example under OFAC and EU sanctions lists), so some readers simply can't buy. The site should handle a checkout refusal gracefully.
- Some countries restrict certain content. Authors may want works withheld from a territory, which the rights model (§5.6) supports.

### 4.8 Localizing the site and the works

- **UI:** the five UI languages already exist through i18next. Add languages by locale file. Plan for **right-to-left** scripts (Arabic, Persian, Hebrew) by using CSS logical properties (`margin-inline-start`, not `margin-left`) and `dir="rtl"` per locale.
- **Formatting:** dates, numbers and currency through `Intl`. Store timestamps in UTC; show them in the reader's time zone.
- **Works in several languages:** a translation is an **edition** of the same work, with a translator credited as a contributor (§5.3). Readers can browse by work and pick a language.
- **Territorial rights:** authors often hold rights only in some regions or languages (for example world English but not German translation). Offers must respect those rights (§5.6).
- **Localized metadata:** a title, blurb and keywords per language, and emails and receipts in the buyer's language. Receipts from the payment provider can be localized too.

---

## 5. The Works model

### 5.1 How things are stored today

- **`MediaFiles`:** one row per uploaded file.
  - Columns: `R2Key`, `MimeType`, `TenantId`, `UploadedBy`.
  - `UploadedBy` holds an email and references `Subscribers(Email)`.
- **`PublishedContent`:** one row per *published file*.
  - Columns: `MediaId`, `PublisherId` (an email), `FormId`, `GenreId`, `Language`, `PublishingSettings` (JSON protection settings), `AccessToken`.
  - Published files are copied into the `content` tenant.
- **`Form`** (poetry, novel, short-story, essay, article, review, blog-post) and **`Genre`** (literary, science-fiction, fantasy, romance, mystery, thriller, young-adult, historical, contemporary, non-fiction) exist in the database. **Their `CREATE TABLE` statements aren't in `packages/database/migrations/`**; they appear only in database backups. Fix that schema drift first (§7, stage 0), so a fresh database can be built from migrations alone.
- **Identity is split.** Older tables key people by **email**; Better Auth uses `user.id`. New tables should reference **`user.id`**. Changing an email then breaks nothing, and emails stay out of foreign keys.

The limitation: everything is one file at a time. A novel's chapters, cover, EPUB, audiobook and lab notebooks are unrelated rows. Nothing says "these belong together," so nothing can be sold, gated or displayed together.

### 5.2 Concepts

```
Series ─┐
        ▼
      Work ──────── WorkContributors ── user  (author, translator, editor, illustrator, narrator…)
        │  └─ WorkRelations (contains, sequel-of, companion-to, translation-of, excerpt-of)
        ▼
     Edition   (language, version: "English, 2nd edition", "Deutsch")
        │
        ├── WorkParts   (tree: part → chapter → scene; collection → poem; serial → installment)
        │       │
        └───────┴── WorkAssets ── MediaFiles (in the content tenant, in R2)
                        (role: chapter-text, epub, pdf, audio, cover, lab-notebook, dataset…)

Offer ── OfferItems ─▶ Work / Edition / Series / author backlist / "all"
  │
  └── Prices (currency, country or region, amount, tax behaviour)

Entitlements (user × offer, or user × work)   ← written only by payment webhooks
```

- **Work:** the abstract creative work: *Drift*, a single poem, an essay.
- **Edition:** a concrete published version: a language or translation, a revised text, an illustrated edition.
- **WorkPart:** the internal structure of an edition, as a tree, so any form fits without a table per form.
- **WorkAsset:** a file attached to an edition or a part, with a **role**.
- **Offer / Price:** what is sold and for how much, separate from the works themselves.

### 5.3 How each form maps onto it

| Form | Work | Parts | Typical assets |
|---|---|---|---|
| **Novel** (*Drift*, *Redundant*) | one work; optional series | parts → chapters (→ scenes) | chapter text (HTML or Markdown), full EPUB and PDF, cover, audiobook chapters, **lab notebooks, lab book (HTML/PDF), datasets, timelines, maps**, author's note |
| **Novella / short story** | one work | none, or sections | text, EPUB, PDF, cover, audio |
| **Short-story collection / anthology** | one work that *contains* story works (`WorkRelations: contains`) | stories in order | per-story text; collection EPUB and PDF; cover. Each story can also be sold alone |
| **Poem** | one work | none, or stanzas (usually not needed) | text; optional **recording**; optional image, since layout matters for poetry (a PDF preserves line breaks and spacing) |
| **Poetry collection** | one work containing poem works | sections → poems | collection PDF and EPUB, per-poem text, audio readings |
| **Essay / article / review** | one work | sections (optional) | text, PDF, images, footnotes/bibliography, datasets for data essays |
| **Serial** | one work, `Status = 'in-progress'` | installments with release dates | installment text; pairs with a per-work subscription |
| **Blog post** | not a work; stays in `SubscriberBlogPosts` | — | never sold, so it doesn't need this model |

Form-specific details go in a JSON column (`FormDetails`) validated by a **per-form schema** in the app (for example a Zod schema keyed by `FormId`). Examples: word count and content warnings for a novel; meter or form for a poem (sonnet, villanelle); a citation list for an essay. New forms need no migration.

### 5.4 Asset roles

A fixed list, kept in a lookup table so it's translatable and extensible:

| Group | Roles |
|---|---|
| Reading text | `chapter-text`, `full-text`, `epub`, `pdf`, `print-pdf` |
| Audio | `audio-chapter`, `audiobook`, `recording` (poem reading) |
| Images | `cover`, `illustration`, `map`, `author-photo` |
| Companion material | `lab-notebook` (`.ipynb`), `lab-book` (HTML/PDF), `lab-bundle` (zip for JupyterLite), `dataset`, `timeline`, `glossary`, `author-note`, `reading-guide` |
| Marketing | `excerpt`, `sample`, `trailer` |

Each asset also records:
- **language** (for bilingual editions or subtitles);
- **access level:** `public` (anyone), `preview` (signed-in readers), or `entitled` (paid);
- an optional **unlock rule** (§5.5);
- a **tax category** (`ebook`, `audio`, `software/interactive`) for the classification question in §4.2.

### 5.5 Previews and spoiler gating

- **Previews:** mark the first chapters `public` or `preview`. A poem collection might make two poems public.
- **Spoilers in companion material:** the Drift and Redundant labs reveal plot. Each lab asset can carry an `UnlocksAfterPartId`, so notebook 120 of *Drift* unlocks once the reader has reached Chapter 7. Reader progress is already partly available from `ContentUsage`. Or use a simpler "contains spoilers through chapter N" warning.
- **Serials:** each installment has a `ReleaseAt`; assets are hidden before release.

### 5.6 Rights and territories

`EditionRights` records where each edition may be sold: world, or a list of included or excluded countries (ISO 3166-1 alpha-2). Checkout and catalog pages filter by the reader's country. Licensing is territorial, and this also covers content an author chooses to withhold somewhere.

### 5.7 Schema sketch (D1 / SQLite)

Conventions follow the existing tables: PascalCase names, `TEXT` UUID primary keys, `CreatedAt` and `UpdatedAt` columns, soft delete with `IsDeleted`. People are referenced by Better Auth `user.id`.

```sql
-- ---------------------------------------------------------------- catalogue
CREATE TABLE Series (
  Id TEXT PRIMARY KEY,
  Title TEXT NOT NULL,
  Slug TEXT NOT NULL UNIQUE,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Works (
  Id TEXT PRIMARY KEY,
  Slug TEXT NOT NULL UNIQUE,
  FormId TEXT NOT NULL REFERENCES Form(Id),
  OriginalLanguage TEXT NOT NULL DEFAULT 'en',      -- BCP 47, e.g. 'en', 'pt-BR'
  SeriesId TEXT REFERENCES Series(Id),
  SeriesPosition REAL,                              -- 1, 2, 2.5 (a novella between books)
  Status TEXT NOT NULL DEFAULT 'draft'
    CHECK (Status IN ('draft','in-progress','complete','withdrawn')),
  FormDetails JSON,                                 -- validated per form in the app
  TenantId TEXT NOT NULL REFERENCES Tenants(Id),    -- where the work is managed
  CreatedBy TEXT NOT NULL REFERENCES "user"(id),
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  IsDeleted BOOLEAN DEFAULT 0
);

CREATE TABLE WorkGenres (                           -- a work can have several genres
  WorkId TEXT NOT NULL REFERENCES Works(Id) ON DELETE CASCADE,
  GenreId TEXT NOT NULL REFERENCES Genre(Id),
  PRIMARY KEY (WorkId, GenreId)
);

CREATE TABLE WorkContributors (
  WorkId TEXT NOT NULL REFERENCES Works(Id) ON DELETE CASCADE,
  UserId TEXT NOT NULL REFERENCES "user"(id),
  Role TEXT NOT NULL
    CHECK (Role IN ('author','co-author','translator','editor','illustrator','narrator','contributor')),
  DisplayName TEXT,                                 -- pen name, if different
  Position INTEGER NOT NULL DEFAULT 0,              -- credit order
  RevenueShareBps INTEGER NOT NULL DEFAULT 0,       -- basis points; the shares for a work sum to 10000
  PRIMARY KEY (WorkId, UserId, Role)
);

CREATE TABLE WorkRelations (
  FromWorkId TEXT NOT NULL REFERENCES Works(Id) ON DELETE CASCADE,
  ToWorkId TEXT NOT NULL REFERENCES Works(Id) ON DELETE CASCADE,
  Kind TEXT NOT NULL CHECK (Kind IN ('contains','sequel-of','companion-to','translation-of','excerpt-of')),
  Position INTEGER,                                 -- order within a collection
  PRIMARY KEY (FromWorkId, ToWorkId, Kind)
);

CREATE TABLE Editions (
  Id TEXT PRIMARY KEY,
  WorkId TEXT NOT NULL REFERENCES Works(Id) ON DELETE CASCADE,
  Language TEXT NOT NULL,                           -- BCP 47
  Label TEXT,                                       -- '2nd edition', 'illustrated'
  Isbn TEXT,                                        -- optional; one ISBN per format in practice
  PublishedAt DATETIME,
  Status TEXT NOT NULL DEFAULT 'draft' CHECK (Status IN ('draft','published','unpublished')),
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE EditionLocalizations (                 -- title and blurb per language
  EditionId TEXT NOT NULL REFERENCES Editions(Id) ON DELETE CASCADE,
  Locale TEXT NOT NULL,
  Title TEXT NOT NULL,
  Subtitle TEXT,
  Blurb TEXT,
  Keywords TEXT,
  PRIMARY KEY (EditionId, Locale)
);

CREATE TABLE WorkParts (                            -- a tree per edition
  Id TEXT PRIMARY KEY,
  EditionId TEXT NOT NULL REFERENCES Editions(Id) ON DELETE CASCADE,
  ParentId TEXT REFERENCES WorkParts(Id) ON DELETE CASCADE,
  Kind TEXT NOT NULL
    CHECK (Kind IN ('part','chapter','scene','section','poem','story','installment','appendix','front-matter','back-matter')),
  Position INTEGER NOT NULL,                        -- order among siblings
  Title TEXT,
  ReleaseAt DATETIME,                               -- serials: hidden before this
  LinkedWorkId TEXT REFERENCES Works(Id),           -- a poem or story that is also its own work
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_workparts_edition ON WorkParts(EditionId, ParentId, Position);

CREATE TABLE AssetRoles (                           -- lookup: chapter-text, epub, cover, lab-notebook…
  Id TEXT PRIMARY KEY,
  Name TEXT NOT NULL,
  TaxCategory TEXT NOT NULL CHECK (TaxCategory IN ('ebook','audio','image','interactive','other'))
);

CREATE TABLE WorkAssets (
  Id TEXT PRIMARY KEY,
  EditionId TEXT NOT NULL REFERENCES Editions(Id) ON DELETE CASCADE,
  PartId TEXT REFERENCES WorkParts(Id) ON DELETE CASCADE,   -- NULL = belongs to the whole edition
  MediaId INTEGER NOT NULL REFERENCES MediaFiles(Id),       -- the file in the content tenant
  RoleId TEXT NOT NULL REFERENCES AssetRoles(Id),
  Language TEXT,
  AccessLevel TEXT NOT NULL DEFAULT 'entitled' CHECK (AccessLevel IN ('public','preview','entitled')),
  UnlocksAfterPartId TEXT REFERENCES WorkParts(Id),         -- spoiler gating
  Position INTEGER NOT NULL DEFAULT 0,
  PublishingSettings JSON,                                  -- same protection settings as today
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_workassets_edition ON WorkAssets(EditionId, PartId, Position);

CREATE TABLE EditionRights (
  EditionId TEXT NOT NULL REFERENCES Editions(Id) ON DELETE CASCADE,
  Mode TEXT NOT NULL CHECK (Mode IN ('world','include','exclude')),
  Countries TEXT,                                   -- JSON array of ISO 3166-1 alpha-2 codes
  PRIMARY KEY (EditionId)
);

-- ---------------------------------------------------------------- commerce
CREATE TABLE Offers (
  Id TEXT PRIMARY KEY,
  Kind TEXT NOT NULL CHECK (Kind IN ('purchase','subscription')),
  Scope TEXT NOT NULL CHECK (Scope IN ('edition','work','series','author','bundle','all')),
  Interval TEXT CHECK (Interval IN ('month','year')),       -- subscriptions only
  SellerUserId TEXT REFERENCES "user"(id),                  -- NULL for platform offers (all-access)
  Active BOOLEAN NOT NULL DEFAULT 1,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE OfferItems (                           -- what an offer grants
  OfferId TEXT NOT NULL REFERENCES Offers(Id) ON DELETE CASCADE,
  ItemType TEXT NOT NULL CHECK (ItemType IN ('edition','work','series','author')),
  ItemId TEXT NOT NULL,
  PRIMARY KEY (OfferId, ItemType, ItemId)
);

CREATE TABLE Prices (
  Id TEXT PRIMARY KEY,
  OfferId TEXT NOT NULL REFERENCES Offers(Id) ON DELETE CASCADE,
  Currency TEXT NOT NULL,                           -- ISO 4217
  Country TEXT,                                     -- NULL = default for the currency
  AmountMinor INTEGER NOT NULL,                     -- smallest unit; JPY has none
  TaxBehavior TEXT NOT NULL CHECK (TaxBehavior IN ('inclusive','exclusive')),
  ProviderPriceId TEXT,                             -- e.g. Stripe price_…
  Active BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE Entitlements (                         -- written ONLY by payment webhooks
  Id TEXT PRIMARY KEY,
  UserId TEXT NOT NULL REFERENCES "user"(id),
  OfferId TEXT NOT NULL REFERENCES Offers(Id),
  Status TEXT NOT NULL CHECK (Status IN ('active','past_due','canceled','refunded','expired')),
  CurrentPeriodEnd DATETIME,                        -- NULL for lifetime purchases
  Provider TEXT NOT NULL,
  ProviderRef TEXT NOT NULL,                        -- subscription or payment id
  Country TEXT,                                     -- tax evidence, as used at checkout
  WithdrawalWaivedAt DATETIME,                      -- EU/UK digital-content consent
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (Provider, ProviderRef)
);
CREATE INDEX idx_entitlements_user ON Entitlements(UserId, Status);

CREATE TABLE WebhookEvents (                        -- makes webhook handling idempotent
  Provider TEXT NOT NULL,
  EventId TEXT NOT NULL,
  ReceivedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Provider, EventId)
);
```

Payout records (per-sale splits to contributors, all-access pool calculations, transfers) would come later. They can be derived from provider events plus `WorkContributors.RevenueShareBps`.

### 5.8 The access check

Serving any entitled asset runs one question on the server, in the route that streams from R2 (next to `lib/media-access.ts`):

> May this user see this asset now?

1. The asset is `public`, **or** `preview` and the user is signed in; **or**
2. The user has an `active` entitlement (or `past_due`, within a grace period) whose offer covers the asset's edition directly, or its work, its series, its author, or `all`;
3. **and**, if `UnlocksAfterPartId` is set, the user has reached that part;
4. **and**, for serials, `ReleaseAt` has passed;
5. **and** the edition's rights allow the user's country.

Cache the result briefly per user and edition, for example for a few minutes in the request context or KV. Hiding links in the interface is never the protection; the file route is. `watermark.ts` can stamp paid downloads with the buyer's identity.

### 5.9 R2 layout

Keep today's `MediaFiles.R2Key` as the source of truth, but give published assets predictable keys:

```
content/works/{workId}/{editionId}/{roleId}/{partId or "_"}/{filename}
```

This makes an edition easy to inspect, back up or delete as a unit.

### 5.10 Migrating from `PublishedContent`

1. Create the new tables alongside the existing ones. Don't change `PublishedContent` yet.
2. **Backfill:**
   - for each `PublishedContent` row, create one `Works` row (`FormId`, `GenreId` → `WorkGenres`, `Language` → the edition's language, `PublisherId` → a contributor, looking up `user.id` by email);
   - one `Editions` row;
   - one `WorkAssets` row (role guessed from the MIME type, with `PublishingSettings` copied across).

   Every existing item becomes a one-file work, so nothing is lost.
3. Build a "Work" editor in Harbor for grouping files into a work and arranging parts. Merge the one-file works that belong together.
4. Point the public content pages and the access check at `WorkAssets`. Keep `AccessToken` share links working by resolving them to assets.
5. Once nothing reads `PublishedContent`, retire it in a later migration, as was done with the Auth.js tables.

---

## 6. Webhooks and payment flow

1. The reader picks an offer. The server creates a Checkout session with the price for their currency and country, the Logosophe `user.id` in metadata, and, for Connect, the destination account and application fee.
2. The reader pays on the hosted page (tax, local payment methods, 3-D Secure, the withdrawal-waiver checkbox).
3. The provider calls **`POST /api/webhooks/payments`**:
   - verify the signature (Stripe's SDK on Workers: `Stripe.createFetchHttpClient()` and `constructEventAsync`);
   - skip the event if it's already in `WebhookEvents`;
   - insert or update the `Entitlements` row;
   - log through `NormalizedLogging`.
4. The success page only *shows* status. Access comes from the entitlement the webhook wrote, never from the redirect.
5. Renewals, failed payments, cancellations, refunds and chargebacks arrive as further events and update `Status` and `CurrentPeriodEnd`.
6. "My library" lists entitled works. "Manage subscription" opens the provider's Customer Portal.

---

## 7. Staged plan

| Stage | Work | Teaches |
|---|---|---|
| 0 | Add `Form` and `Genre` `CREATE TABLE` migrations to match production; decide the email → `user.id` mapping for new tables | schema hygiene |
| 1 | Works, Editions, WorkParts, WorkAssets, AssetRoles; backfill from `PublishedContent`; Harbor editor to group files | data modelling, migrations |
| 2 | Reader pages from the Works model: table of contents, previews, spoiler gating, localized titles | UI, i18n |
| 3 | Offers, Prices, Entitlements, access check; manual entitlements granted by admins (no payments yet) | authorization |
| 4 | Stripe test mode: Checkout, webhooks, Customer Portal, one currency, platform as the only seller | payments, webhooks, idempotency |
| 5 | Stripe Tax, multiple currencies and regional prices, tax-inclusive display, withdrawal consent | international commerce |
| 6 | Stripe Connect: author onboarding, revenue shares, application fees, payouts | multi-party payments |
| 7 | All-access pool and revenue-sharing report; author dashboards | analytics, finance |
| 8 | Legal pages per locale; live mode in one country, then expand | operations |

## 8. Open questions

- Per-work purchase, per-work subscription, or both?
- Platform fee: a percentage per sale, and a separate share for all-access?
- Pro-rata or user-centric split for all-access (§3.4), and what counts as reading?
- Stripe Connect as a marketplace, or Logosophe as publisher paying royalties (§3.1)?
- Which countries to launch in first? (That decides the first tax registrations.)
- Are companion labs sold separately, or always bundled with the novel? (That affects tax classification.)
- Refund policy and grace period for failed renewals.
