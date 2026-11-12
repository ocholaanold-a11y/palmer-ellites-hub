# Palmer Ellites Hub (PEH)

A responsive, emerald-green international learning-support website. This is a **development version**, not a fully deployed ecommerce platform.

## Pages and features included

- Home and searchable-looking service gallery with 13 service categories in the requested order: **Essay Writing, Research, Thesis & Dissertations, Business & Content Writing, Excel Related Analysis, PowerPoint & Canva Designs, Website Analysis, Data Visualization, SPSS Analysis, Proofreading & Editing, Tutoring & Study Support, Report Checking, Referencing & Formatting, Revisions**.
- **Meet Our Writers** with three clearly marked **sample profile templates**, including specialties, qualifications, achievements and portfolio sections. Replace these with **real, permissioned, verified** information before public launch. Never publish fabricated awards or testimonials.
- Quote request form includes an editable preferred currency selector, but accepts **no money**. Currency selection is not a price conversion or live payment authorization.
- Site owner can edit default currency and visible currency options in `config.js` (`defaultCurrency` and `currencyOptions`). The quote form stores the requested ISO currency code if the Supabase backend is correctly configured. Actual settlement currencies will depend on the payment provider.
- Student login, registration and basic project listing, **when a secure Supabase project and SQL policies are configured**.
- Mobile responsive design, accessible navigation, and custom emerald-green PEH logo assets (`assets/peh-logo.svg` full wordmark and `assets/peh-icon.svg` header emblem/favicon).

## Deploy for free on Cloudflare Pages

1. Log in to [Cloudflare](https://dash.cloudflare.com/) and open **Workers & Pages**.
2. Create a Pages project by connecting the GitHub repository **ocholaanold-a11y/palmer-ellites-hub**.
3. Choose **Framework preset: None** and enter **Build command: `mkdir -p dist && cp index.html styles.css app.js config.js _headers dist/ && cp -r assets dist/`** and **Build output directory: `dist`**. The build copies the published HTML, CSS, JavaScript, configuration, security headers, and PEH logo assets. No Node dependencies are required.
4. Deploy and verify HTTPS, menu, service cards, writer profiles and quote form. The form will correctly warn that backend setup is not complete.
5. Optionally attach a custom domain later (domain purchase is not free).

## Enable accounts and requests with Supabase

1. Create a Supabase project and run `supabase-schema.sql` using its SQL editor. If you previously ran an older version of the schema, also run `alter table public.orders add column if not exists requested_currency text not null default 'USD';` to add the field.
2. Copy the **project URL** and **publishable/anon** key into `config.js`. These are public configuration values. Do **NOT** put a service role key into a public file.
3. In Supabase authentication settings enable email/password and configure allowed redirect URLs and email confirmation.
4. Verify signup, email confirmation, login and per-user order access with separate test users.
5. Do not accept production requests or personally identifiable uploads before data retention, incident response and privacy workflows are reviewed.
6. File attachments are currently explicitly blocked until private Supabase Storage with suitable RLS and a virus-scanning/retention policy are added.

## Payments and full production system

Stripe / other payment providers, checkout, webhooks, invoices, writer/admin dashboards, private file delivery, chat and notifications are **not yet implemented**. An editable currency dropdown is now present, but it is for quote preference only, not payment processing. Never mark an order as paid solely from a browser response: payment confirmation must come from a server-side verified webhook. Choose a provider based on your business location and supported settlement countries. Never collect raw card details on the PEH site.

### Important implementation limits

- The initial Supabase client loads from a pinned esm.sh module URL (external dependency). Confirm availability and security policy before production.
- The temporary under-18 policy disallows account registration by minors. High-school students may browse public pages, but a legally appropriate guardian-consent and child protection flow is required before enabling their registration or payments.
- The academic integrity policy permits editing, data explanation, tutoring and legitimate professional content; not ghostwriting assessed student work for submission as their own.
- This standalone static project is independent of the earlier Lovable TanStack Start prototype; **it is not a completed migration of that backend**.

## Visual identity

Business name: **Palmer Ellites Hub (PEH)** (retain the provided spelling). Color palette: emerald green and white, with dark green text. Source is editable directly in GitHub.
