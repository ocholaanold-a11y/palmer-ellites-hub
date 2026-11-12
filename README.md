# Palmer Ellites Hub (PEH)

A responsive, emerald-green international learning-support website. This is a **development version**, not a fully deployed ecommerce platform.

## Pages and features included

- Home and searchable-looking service gallery with 12 service categories, including **SPSS Analysis, Report Checking, Excel Related Analysis, Website Analysis, PowerPoint and Canva Designs**.
- **Meet Our Writers** with three clearly marked **sample profile templates**, including specialties, qualifications, achievements and portfolio sections. Replace these with **real, permissioned, verified** information before public launch. Never publish fabricated awards or testimonials.
- Quote request form; accepts **no money**, and does **not** silently transmit submitted details.
- Student login, registration and basic project listing, **when a secure Supabase project and SQL policies are configured**.
- Mobile responsive design and accessible navigation.

## Deploy for free on Cloudflare Pages

1. Log in to [Cloudflare](https://dash.cloudflare.com/) and open **Workers & Pages**.
2. Create a Pages project by connecting the GitHub repository **ocholaanold-a11y/palmer-ellites-hub**.
3. Choose a static site deployment, **Framework preset: None**; **Build command: (leave blank)**; **Output directory: /** (repository root). If your Cloudflare dashboard does not support repository-root output, use a build command `mkdir -p dist && cp index.html styles.css app.js config.js _headers dist/` and output directory `dist`.
4. Deploy and verify HTTPS, menu, service cards, writer profiles and quote form. The form will correctly warn that backend setup is not complete.
5. Optionally attach a custom domain later (domain purchase is not free).

## Enable accounts and requests with Supabase

1. Create a Supabase project and run `supabase-schema.sql` using its SQL editor.
2. Copy the **project URL** and **publishable/anon** key into `config.js`. These are public configuration values. Do **NOT** put a service role key into a public file.
3. In Supabase authentication settings enable email/password and configure allowed redirect URLs and email confirmation.
4. Verify signup, email confirmation, login and per-user order access with separate test users.
5. Do not accept production requests or personally identifiable uploads before data retention, incident response and privacy workflows are reviewed.
6. File attachments are currently explicitly blocked until private Supabase Storage with suitable RLS and a virus-scanning/retention policy are added.

## Payments and full production system

Stripe / other payment providers, checkout, webhooks, invoices, writer/admin dashboards, private file delivery, chat and notifications are **not yet implemented**. Never mark an order as paid solely from a browser response: payment confirmation must come from a server-side verified webhook. Choose a provider based on your business location and supported settlement countries. Never collect raw card details on the PEH site.

### Important implementation limits

- The initial Supabase client loads from a pinned esm.sh module URL (external dependency). Confirm availability and security policy before production.
- The temporary under-18 policy disallows account registration by minors. High-school students may browse public pages, but a legally appropriate guardian-consent and child protection flow is required before enabling their registration or payments.
- The academic integrity policy permits editing, data explanation, tutoring and legitimate professional content; not ghostwriting assessed student work for submission as their own.
- This standalone static project is independent of the earlier Lovable TanStack Start prototype; **it is not a completed migration of that backend**.

## Visual identity

Business name: **Palmer Ellites Hub (PEH)** (retain the provided spelling). Color palette: emerald green and white, with dark green text. Source is editable directly in GitHub.
