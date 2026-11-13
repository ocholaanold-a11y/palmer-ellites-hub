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

## Phase 6: Customer delivery notifications (dashboard + email)

**Implemented in GitHub, requires activation in Supabase:** the private notification inbox is in `assets/peh-notifications.js`, the Postgres migration in `supabase-notifications-migration.sql`, and the optional server-side email function in `supabase/functions/peh-delivery-email/index.ts`.

### Step A — enable in-account notifications (no email provider needed)
1. In Supabase SQL Editor select **postgres** and run all of `supabase-notifications-migration.sql`.
2. In PEH as a test administrator, successfully upload all deliverable files to a test order. When its status changes **to delivered**, a private notification row is created by a database trigger.
3. In the customer account open **My Account → My Notifications** and choose **Refresh notifications**. The inbox also checks periodically while open. Test **Mark as read** and **View my files**. Only that customer can read their own notifications under RLS.
4. A notification is created only when order status transitions **to delivered**, not when an already-delivered order is resaved. Previously completed orders will not get retroactive notifications.

### Step B — activate automatic email (separate server setup)
1. Sign up for a transactional email service such as [Resend](https://resend.com/), **verify a sending domain you control**, and select a valid from-address such as `PEH <notifications@your-verified-domain.example>`. Never claim an unverified address is yours.
2. In your PEH Supabase project, open **Edge Functions → Deploy a new function → Via Editor**. Use name **`peh-delivery-email`** and paste the contents of `supabase/functions/peh-delivery-email/index.ts`. Deploy it.
3. Under **Edge Functions → Secrets**, add **`RESEND_API_KEY`**, **`PEH_EMAIL_FROM`** (your verified sending address), and **`PEH_WEBHOOK_SECRET`** (a newly generated long random secret). Do **not** paste these secrets in GitHub, this README or website JavaScript. The function also requires `SUPABASE_URL` and an admin server credential `SUPABASE_SERVICE_ROLE_KEY` available only inside Supabase Edge Function secrets; if that legacy variable is unavailable, configure an appropriate server-only key and adjust the function accordingly. Never use a public publishable key for privileged work.
4. Under the Edge Function details/settings **disable default JWT verification only for this webhook function**. The function itself checks `x-peh-webhook-secret` before any database operation. The repository includes `supabase/config.toml` for CLI deployments.
5. In **Supabase → Database → Webhooks**, create an enabled webhook named `peh-delivery-email`: table `public.peh_notifications`, event **INSERT only**, method **POST**, request URL `https://<your-project-ref>.supabase.co/functions/v1/peh-delivery-email`, request header `x-peh-webhook-secret` equal to the same secret from step 3. Include `Content-Type: application/json`. Never enable UPDATE here, since writing email delivery status updates the same row. Test with a harmless delivered order, then check **Edge Function logs** and your Resend email logs.
6. The function looks up the recipient from the verified **Supabase Auth** user, not a customer-entered address; it never emails documents or signed file URLs. It records **pending / sending / sent / failed** server-side. Resend may accept the email before it reaches the recipient. Inspect the provider's logs for final delivery.
7. Never share `RESEND_API_KEY`, `PEH_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or `sb_secret_...` in chat or screenshots. This is a server deployment, **not** automatically deployed when Cloudflare Pages deploys the frontend.

**Operational limitation:** The simple webhook handler makes one delivery attempt per event (plus provider idempotency). Failed events may need administrative retry with a separate server-side job; a full transactional outbox/queue, monitoring and bounce handling are production improvements. Sending domain registration and email provider quotas/costs are managed by the provider. Protect email content from sensitive personal details.

## Phase 7: Verified writer accounts and private draft review

Writer logins, assignment-based work access, and secure draft uploads can be activated **without purchasing a domain or enabling email notifications**. The website loads `assets/peh-writer-portal.js` and `assets/peh-draft-review.js`.

### Activate Supabase security

Run the full [`supabase-writer-portal-migration.sql`](./supabase-writer-portal-migration.sql) as **postgres** in the PEH Supabase SQL Editor, after the core order, writer, and storage migrations. It adds:
- `peh_writer_accounts`: admin-only linked Supabase Auth IDs for actual specialist profiles.
- `peh_get_my_writer_projects()`: a server-authorized, limited list of projects assigned to that writer, without the customer's email or quote.
- `peh_writer_can_access_file()`: a database authorization function used by private storage RLS.
- A separate private **`peh-writer-drafts`** bucket, 50 MB per file. Students cannot view unapproved files.
- Assigned writers can read private source files from **only their assigned orders** in `peh-order-files`. They upload draft deliverables only to `peh-writer-drafts`, not directly to customer-visible storage.

### Link and test a writer

1. Ensure there is an approved, accurate specialist profile under **Administrator Workspace → Manage professional profiles**.
2. Ask that specialist to create an adult PEH account and confirm their email, then verify their identity before providing any access.
3. In Supabase **Authentication → Users**, copy the correct user's UUID (not any password, token, or secret).
4. Sign in as the authorized PEH administrator. Under **Writer account access**, select their specialist profile, paste the verified UUID, and click **Authorize writer account**. One profile maps to one Auth user.
5. Assign that specialist to a **harmless test order** using the administrator order's **Assigned specialist** dropdown and **Save changes**.
6. Sign in as the linked writer account: **My assigned projects** will show only their assigned projects. Download dummy source documents, then upload 2–3 dummy deliverable files using **Send files to PEH**. Files are stored as private drafts, each up to 50 MB.
7. As the PEH administrator, use **Review writer draft submissions → Load writer drafts**, download and review the files, then click **Approve all drafts & deliver**. The approved files are copied into `peh-order-files`, the order status moves to **Delivered**, and the customer's in-site notification is generated by the existing delivery trigger.
8. Verify the customer can download only approved files via **My Private Files**, and another user/writer cannot read unassigned documents. The admin can **Revoke access** from a writer account.

**Operational limits:** Writer accounts cannot change payments, prices, clients, or order status. Website email sending remains on hold until you obtain and verify a domain. Client file upload protections still require production hardening (virus scanning, server-side file checks, retention, privacy safeguards, child-safety restrictions). Testing should use only dummy files. A writer's work is a draft until an administrator approves it. If copying any draft fails, previously successful copies remain stored, the order should stay at its prior status, and staff should inspect before retrying. This is not a malware-scanning or content moderation system.

## Account recovery and password changes (all roles)

PEH account form now includes **Forgot password?** for signed-out users and **Change password** for signed-in users. Both use **Supabase Auth** and do not alter the membership tables `peh_admins` or `peh_writer_accounts`. New passwords must contain at least 12 characters. The recovery link opens the PEH website, where Supabase verifies the link and offers a new-password form.

### Required Supabase Auth configuration
1. In Supabase go to **Authentication → URL Configuration**. Set the **Site URL** to `https://palmer-ellites-hub.pages.dev/` unless a custom domain is being used. Add the exact URL `https://palmer-ellites-hub.pages.dev/` under **Redirect URLs** (or use the official Supabase pattern for this site). Do not add unrelated domains.
2. In **Authentication → Email Templates → Reset Password**, keep Supabase's valid confirmation / recovery link variable. Avoid replacing a functional template with a plain link to PEH; the token-based Supabase link is needed to verify ownership.
3. For controlled testing, use an email address allowed by the project’s built-in Supabase email service. Built-in email is rate-limited and may restrict recipients; it is not a production bulk sending service. A verified sending domain and configured SMTP provider will be required for reliable real-user recovery.
4. On the PEH site sign out, click **Forgot password?**, submit the registered email, and open the message. The recovery link should open the website and show **Set your new password**. Save a 12+ character password; then sign out and sign back in with the new password.
5. While signed in, click **Change password**, enter and confirm the new password, and save. Depending on the Supabase project's reauthentication settings, an additional verification step may be required.
6. Test both flows with dummy accounts, including a linked writer account, and verify the roles and assigned order permissions remain unchanged. Do not share reset links or tokens with administrators.

**Security:** The frontend intentionally uses a generic confirmation message when requesting a reset to avoid user enumeration. Passwords are never sent to PEH database tables or administrators. Supabase handles token verification and password updates.

## Phase 9: Private order-based messaging (students, assigned writers, admins)

PEH includes **`assets/peh-messages.js`**, which creates three conversation sections: **Messages about my orders** in the customer portal, **Order conversations** in Administrator Workspace, and **Assigned project messages** in a verified writer's workspace. All participants on an order see one shared order thread. Messages are text-only (1–3,000 characters); senders' real names and email addresses are **not exposed** in message threads. Messages cannot be edited or deleted from client sessions. New messages load with **Refresh messages** and 30-second polling while an opened workspace is visible. Email alerts are **not** included and remain deferred until a verified sending domain is set up.

### Activate in Supabase (required)
1. Open [`supabase-messaging-migration.sql`](./supabase-messaging-migration.sql) in this repository, copy all SQL, and execute it in **Supabase SQL Editor** as the **postgres** role. This requires the prior writers/account migration and existing order data.
2. The migration creates `public.peh_order_messages`, restrictive row-level participant checks, a server-side sender validation trigger, and a definer helper `public.peh_message_role(order_id)`. Students can only message on orders they own. A specialist must be linked under `peh_writer_accounts` **and currently assigned** to that order to participate. PEH admins can participate on existing orders.
3. Wait for Cloudflare Pages to deploy the updated `main` branch; hard-refresh with **Ctrl + Shift + R**.

### Test safely with dummy accounts and orders
1. Sign in as **Student A**, open **Messages about my orders**, select a harmless test order and send “Can you clarify my test instructions?”
2. Sign out, sign in as the **assigned writer**, open **Assigned project messages** and click **Load my conversations**; choose the same order and reply. A non-assigned writer must **not** see or read it.
3. Sign out, sign in as the **PEH admin**, open **Order conversations → Load my conversations** and send a response to the same order.
4. Sign in as **Student A** again, refresh messages and verify the client/writer/admin messages are present.
5. Sign in as **Student B** with their *different* account. Their order dropdown must not list Student A's order; they must not be able to fetch or insert A's messages by manipulating a request. Also test a writer who is removed from an order: their messages should no longer be accessible.
6. Test on a mobile screen and account switching. No content should persist on screen after signing out.

### Phase 9 safeguarding: coercion, personal information and off-platform contact

The same Phase 9 SQL migration additionally adds server-side checks designed to reject direct email addresses, phone numbers, external links, off-platform messengers, private payment instructions and several common phrases used to solicit private identification or threaten clients. These controls run in PostgreSQL **before** a message is stored. A simple **five messages per minute per account per order** throttle reduces spam. The client and writer panels display a clear warning and **Report this message** on messages from other participants. Reports have reason codes for personal information, off-platform contact, payment requests, threats/extortion, harassment or other issues.

Under **Administrator Workspace → Safety reports & writer conduct**, authorized admins can review each reported message, record a private note, set its review status and suspend an offending writer. Suspension immediately blocks their assigned project listing, writer-specific file permissions and messaging; it does **not** delete retained reports or previously approved client files. To reinstate after investigation, an authorized administrator must deliberately set `peh_writer_accounts.suspended=false` using a privileged/authorized update. Keep records and follow your incident response policy; threats or extortion may require appropriate reporting to competent authorities.

**Limits:** No keyword/regex filter can reliably detect every coercive message, coded solicitation, phone-number variation, or malicious intent. False positives are also possible (for example, legitimate academic references containing web links); share reference documents using the private project file uploader instead. A private chat alone cannot prevent screenshots, external contact, or misconduct outside PEH. Require verified writer identities, written safeguarding rules, timely human review, reporting and escalation procedures, message preservation, rate limits at the API/network layer, and full security testing before accepting real sensitive customer data.

**Important before production:** Browser hiding is not authorization. Inspect Supabase RLS and GRANT permissions regularly, especially after future changes. This feature uses polling rather than a Supabase Realtime subscription. Implement more robust anti-abuse and moderation, retention/deletion requests, message notifications and incident logging before collecting sensitive customer data. Never place service-role or other server secrets in the website.

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
