# Palmer Ellites Hub (PEH)

A responsive, emerald-green international learning-support website. This is a **development version**, not a fully deployed ecommerce platform.

## Pages and features included

- Home and searchable-looking service gallery with 13 service categories in the requested order: **Essay Writing, Research, Thesis & Dissertations, Business & Content Writing, Excel Related Analysis, PowerPoint & Canva Designs, Website Analysis, Data Visualization, SPSS Analysis, Proofreading & Editing, Tutoring & Study Support, Report Checking, Referencing & Formatting, Revisions**.
- **Meet Our Writers** with three clearly marked **sample profile templates**, including specialties, qualifications, achievements and portfolio sections. Replace these with **real, permissioned, verified** information before public launch. Never publish fabricated awards or testimonials.
- Quote request form includes an editable preferred currency selector, but accepts **no money**. Currency selection is not a price conversion or live payment authorization.
- Site owner can edit default currency and visible currency options in `config.js` (`defaultCurrency` and `currencyOptions`). The quote form stores the requested ISO currency code if the Supabase backend is correctly configured. Actual settlement currencies will depend on the payment provider.
- Student login, registration and basic project listing, **when a secure Supabase project and SQL policies are configured**.
- Mobile responsive design, accessible navigation, and custom emerald-green PEH logo assets (`assets/peh-logo.svg` full wordmark and `assets/peh-icon.svg` header emblem/favicon).

## Phase 2: student orders and authorized admin workspace

**Implemented in the repository (requires configuration before usable):**

- Student signup/signin UI connected through the Supabase publishable client key.
- Student order listing with status, selected currency and quoted amount.
- An admin-only order workspace that lists the latest 100 requests, filters by status, permits non-negative quote entry and updates permitted non-paid project statuses.
- Revised database setup with row-level policies restricting students to their own records and administrators to verified memberships.
- A dedicated logout button when authenticated.

**Activation steps (business owner):**

1. Create a Supabase project at https://supabase.com/dashboard. Do not post passwords or secret keys into chat.
2. In Supabase **SQL Editor**, run `supabase-schema.sql` from this repository. The script is intended for an initial setup; review it before applying to a production database.
3. In Supabase **Authentication → Providers**, enable Email and email confirmation. Under URL configuration set the site URL to your actual Cloudflare Pages domain and add its login redirect URL.
4. In Supabase project settings, copy the **Project URL** and **publishable/anon key** (never the service role/secret key). Update the two public settings in `config.js`, commit to GitHub and let Cloudflare redeploy.
5. On the deployed website, create an account for the PEH administrator, verify email, and find the user ID in **Supabase Authentication → Users**.
6. In Supabase SQL Editor only, authorize that specific user by running:
   `insert into public.peh_admins (user_id) values ('YOUR_VERIFIED_ADMIN_AUTH_USER_UUID');`
7. Sign out and back in to verify the **Administrator workspace** appears only for that account. Test with a separate ordinary student account and confirm it cannot view or edit any other student's orders.
8. Test an order with **no attachment**. Then as admin set a quote amount and status `quoted`; verify the student can see the quote.

**Safety and operations:** Do not treat this version as production-ready for children. New accounts are restricted by an 18+ confirmation; robust age-appropriate guardian-consent compliance still needs to be developed. Do not accept real order files because private upload and malware scanning aren't implemented. Checkout, verified payments, private delivery and communications are still pending. Admin status updates must not be treated as payment confirmation.

## Phase 3: Verified professional profiles and assignments

The public **Our Writers** section now loads only **published profiles** from Supabase after setup. The admin workspace includes a specialist editor with display name, specialty, biography, skills, verified qualifications, achievements, HTTPS portfolio links, and a publication consent checkbox. Admin orders also have an **Assigned specialist** dropdown. The writer profiles are professional listings, NOT separate staff login accounts.

**To activate this safely:**

1. Open the [PEH Supabase SQL Editor](https://supabase.com/dashboard) and run the entire **`supabase-writers-migration.sql`** file from GitHub. This adds the protected `peh_writers` table and `assigned_writer_id` column on existing orders.
2. Open the deployed [PEH website](https://palmer-ellites-hub.pages.dev/#dashboard), sign in with your previously authorized PEH admin login, then scroll to **Administrator workspace → Manage professional profiles**.
3. Enter actual approved specialist names and credentials. Add only achievements you have verified, and get explicit permission for names, bios, qualifications, public portfolio links and images. Leave **Publish** unchecked until authorized.
4. After publishing at least one real profile, refresh the website. The public **Our Writers** area will show the verified profiles instead of sample templates.
5. Under any administrator order, select a specialist and click **Save changes**. The assignment stays on the order record; it does **not** give that person access to private customer information.
6. Verify with a non-admin login that unpublished profiles and other users' orders are inaccessible.

**Not implemented yet:** Staff login and writer-only dashboard, private file delivery, encrypted client messaging, customer notifications, or live checkout. These require additional backend development and testing. Do not share student files via public portfolio links.

## Phase 4: Private student order attachments (test release)

For 50 MB uploads, make sure both the project-wide storage upload limit and bucket file size limit are set to **50 MB** under Supabase Storage Settings / bucket Settings. Re-run `supabase-storage-migration.sql` using the `postgres` SQL role to update the existing bucket. The website uses resumable TUS for files over 6 MB, with on-page progress feedback. Supabase Free maximum per-file size is 50 MB. Test with harmless sample files before collecting customer documents.

Supabase Storage bucket **`peh-order-files`** has a documented private access migration in **`supabase-storage-migration.sql`**. The website now loads **`assets/peh-files.js`**, which supports up to 10 optional files (up to 50 MB each) on a new order, and an authenticated private file browser for students and PEH administrators. It first saves the order record, then attempts a private upload to `user_uuid/order_uuid/random-safe-filename`. If the upload fails, the order still exists and the site explains that the attachment failed; students should NOT resubmit the entire request.

**Setup and test**
1. Make sure the bucket exists, is **Private** and has the three policies from `supabase-storage-migration.sql`. The Supabase Storage page should display **3** policies and 50 MB maximum.
2. Wait for Cloudflare to deploy the updated main branch. The existing Pages build command copies the entire `assets` directory automatically.
3. Use a harmless fake document under 50 MB; sign in as a normal adult test student and submit one new quote request with two or three harmless attachments. Verify that the order reference appears and says the file uploaded successfully.
4. Visit **My Account → My Private Files** and press **Refresh my files**. Download the test document and verify its content.
5. Sign into PEH as the administrator; visit **Administrator workspace → Private Customer Documents** and use **Refresh order files**.
6. Use another student account and verify that the first user's order and files cannot be accessed. Do not set the bucket to Public.

**Limitations / before real student data:** Client-side extension checking is not sufficient protection against malicious uploads or deceptive MIME metadata. Production use requires server-side file signature checking, malware scanning/quarantine, data minimization, retention and deletion policies, and legal safeguards for under-18 users. The current feature is suitable for controlled testing, not unrestricted sensitive customer intake. No writer-role file permissions are granted yet. Secure delivery uploads, revision files, notifications and payments remain unfinished.

## Multiple supporting documents and deliverables

Students can select **up to 10 supporting files per new order** using the multiple-file picker. Administrators can select **up to 10 deliverable files per existing order**. The limit is **50 MB per individual file**, not 50 MB combined, and Supabase Free project storage capacity and upload limits still apply. Uploads run sequentially (resumable for larger files) and display file-by-file progress.

A customer order is created once, then its files are uploaded. If one file fails, the order and earlier successful files remain saved and the confirmation reports the unsuccessful filenames; **do not submit the entire order again**. Administrators only mark an order `delivered` automatically after **all selected deliverables** have uploaded successfully. If any fail, the successful uploads remain saved, the status is unchanged, and the failures are displayed. To retry, select only failed files after checking the private file list.

The same private `peh-order-files` bucket and row-level policies apply to all files. No SQL update is needed just to select multiple files. Professional writer profiles are **not** writer accounts: a secure, separate writer-login portal and file permissions still must be built before writers themselves can upload. Until then, PEH administrators handle deliverable uploads. Before accepting real documents, implement malware scanning and a retention policy.

## Phase 5: administrator document delivery and client revisions (requires SQL activation)

PEH now includes `assets/peh-phase5.js` (loaded on the website). It adds:

- **PEH admin:** a protected delivery-management panel. An authorized admin can select an existing order, privately upload a completed file up to 50 MB and then mark the order **delivered**. Students can download it using their existing **My Private Files** panel. Successful file upload is confirmed before the status update is attempted.
- **Student:** a **Revisions & Feedback** panel that lists their own orders and existing revision requests. For orders with status **review** or **delivered**, a signed-in student can submit detailed revision instructions.
- **PEH admin:** view incoming revision requests, change status (requested / in review / accepted / completed / declined) and send a brief admin response. No payment status is automatically marked paid.

**Activate Phase 5:** In Supabase SQL Editor, select the `postgres` role and run the [`supabase-revisions-migration.sql`](./supabase-revisions-migration.sql) script. It creates a private RLS-protected `peh_revisions` table; student order ownership is enforced in the database. The existing private `peh-order-files` bucket and 50 MB limit remain unchanged.

**Test before use:** Sign in as admin, open **Administrator Workspace → Open delivery management**, upload a harmless test file to an existing test order, and verify it appears in the test student's **My Private Files**. Marked-delivered orders permit the customer to open **Revisions & Feedback** and submit a revision request. Confirm the administrator can read the request and the other student accounts cannot. No real customer documents should be used until server-side malware scanning, retention/deletion, and minor-account protections have been reviewed.

**Limitations:** This release does not provide a separate writer-login portal, file virus scanning, secure messaging, automatic notifications or live payment processing. Admin delivery of a file and an order status change are separate operations; if the status change fails, the file may still have uploaded and should be checked before retrying. Revision functionality requires the SQL migration; without it, the portal shows a setup error rather than saving a request.

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

Stripe / other payment providers, checkout, webhooks, invoices, writer assignment dashboard, private file delivery, chat and notifications are **not yet implemented**. An initial administrator order and quote dashboard has been added but is only functional after verified Supabase setup. An editable currency dropdown is now present, but it is for quote preference only, not payment processing. Never mark an order as paid solely from a browser response: payment confirmation must come from a server-side verified webhook. Choose a provider based on your business location and supported settlement countries. Never collect raw card details on the PEH site.

### Important implementation limits

- The initial Supabase client loads from a pinned esm.sh module URL (external dependency). Confirm availability and security policy before production.
- The temporary under-18 policy disallows account registration by minors. High-school students may browse public pages, but a legally appropriate guardian-consent and child protection flow is required before enabling their registration or payments.
- The academic integrity policy permits editing, data explanation, tutoring and legitimate professional content; not ghostwriting assessed student work for submission as their own.
- This standalone static project is independent of the earlier Lovable TanStack Start prototype; **it is not a completed migration of that backend**.

## Visual identity

Business name: **Palmer Ellites Hub (PEH)** (retain the provided spelling). Color palette: emerald green and white, with dark green text. Source is editable directly in GitHub.
