# LDM Project Portal

Project management portal for LDM Construction with three kinds of accounts:

| Account | Sees and does |
|---|---|
| **Owner** | Everything: dashboard, progress, clients, phases, capacity, monthly costs, collections, profit, weekly report approval, petty cash, team and access |
| **Employee** | Progress on assigned projects, running cost (expenses by category, paid from petty cash or out of pocket), petty cash received, weekly reports with photos. No contract amounts, budgets or profit. |
| **Client** | Their own project only: overall and phase progress, contract, amount paid, balance, payment history, and weekly reports you have approved |

What each account can see is enforced by the database (Supabase row level security), not just hidden on screen.

Setup takes about 20 minutes. You need a free **Supabase** account (database, logins, photos) and a free **GitHub** account (hosts the site).

---

## 1. Create the database (Supabase)

1. Go to [supabase.com](https://supabase.com), sign up, and click **New project**.
   * Name: `ldm-portal`
   * Database password: make a strong one and keep it somewhere safe
   * Region: **Southeast Asia (Singapore)**
2. When the project is ready, open **SQL Editor** in the left menu, click **New query**, paste the whole of `supabase/schema.sql`, and click **Run**. You should see "Success. No rows returned."
3. Click **New query** again, paste `supabase/seed.sql` (your four current projects), and click **Run**.

### Updates

When the portal gets new features, run the matching update file once in the SQL Editor, in order:

| File | Adds |
|---|---|
| `supabase/update-002.sql` | Terminated status, Paid by company and Paid by client on expenses, client reimbursements, progress billing |
| `supabase/update-004.sql` | Design cost proposals, client acceptance link, onboarding into a project, payment schedule on the client portal |
| `supabase/update-005.sql` | Construction cost proposals: onboarding sets the construction and services contracts and the full cost schedule |
| `supabase/update-006.sql` | Payment requests: clients see only the payments you request |
| `supabase/update-007.sql` | Construction proposals are ball park figures: one link for design plus construction ball park; onboarding creates design payments only |
| `supabase/update-008.sql` | Design fee computation saved with each proposal, visible to the owner only |

Update files are safe to run again if you're not sure whether you already ran one.

## 2. Create your owner account first

The first account ever created becomes the **owner**. Do this before sharing the link with anyone.

1. In Supabase, open **Authentication**, then **Users**, then **Add user**, then **Create new user**.
2. Enter your email and a password, tick **Auto Confirm User**, and click **Create user**.

## 3. Connect the site to the database

1. In Supabase, open **Project Settings**, then **API** (or **Data API**).
2. Copy the **Project URL** and the **anon public** key.
3. Open `config.js` in this folder and paste them in:

```js
window.LDM_CONFIG = {
  supabaseUrl: "https://abcdefgh.supabase.co",
  supabaseAnonKey: "eyJhbGciOi..."
};
```

The anon key is meant to be public. It can only do what the database rules allow for whoever is signed in.

## 4. Put the site online (GitHub Pages)

1. Sign in to [github.com](https://github.com) and click **New repository**.
   * Name: `ldm-portal`
   * Visibility: **Public** (GitHub Pages is free for public repositories; the code is visible but your data is not, because it lives in Supabase behind sign in)
2. On the new repository page, click **uploading an existing file**, drag in everything from this folder (including the `src` and `supabase` folders), and click **Commit changes**.
3. Open **Settings**, then **Pages**. Under **Branch**, choose `main` and `/ (root)`, then **Save**.
4. After a minute the page shows your site address, like `https://yourname.github.io/ldm-portal/`.

## 5. Tell Supabase your site address

So that email links (confirm account, reset password) come back to your site:

1. In Supabase, open **Authentication**, then **URL Configuration**.
2. Set **Site URL** to your GitHub Pages address.
3. Under **Redirect URLs**, add the same address and click **Save**.

## 6. Add your team and clients

1. Send people the site address and ask them to click **Create account**. (Or invite them from Supabase: Authentication, Users, Invite user.)
2. New accounts appear in **Team & Access** as **Pending** and see nothing yet.
3. Set each person's role (**Employee** or **Client**), tick the projects they can access, and click **Save**.

## Everyday use

* **Employees** log expenses in **Running Cost** (choose Petty cash or Out of pocket), record petty cash they receive, update phase progress, and submit **Weekly Reports** with photos.
* **You** review reports in **Weekly Reports**. Approve to share with the client, or return with a note. Give petty cash and mark out of pocket expenses reimbursed in **Petty Cash**.
* **Clients** see progress, payments and approved reports, and can print any report or save it as a PDF.

## Good to know

* **Email limits:** Supabase's built in email sender only sends a few emails per hour. Before inviting many people, add your own email sender under Authentication, Emails, SMTP Settings (for example a Gmail account with an app password, or Resend).
* **Free plan pausing:** a free Supabase project pauses after a week with no activity. Opening the site regularly keeps it awake. The Pro plan (about $25 a month) never pauses and has daily backups.
* **Photos:** resized to about 1600 pixels before upload, roughly 200 to 400 KB each. The free plan's 1 GB holds about 3,000 photos.
* **Custom domain later:** in GitHub, Settings, Pages, Custom domain. Then update the Site URL in Supabase step 5.

## Files

| File | What it is |
|---|---|
| `index.html` | The page |
| `config.js` | Your Supabase address and key |
| `styles.css` | LDM brand styling |
| `src/views.js` | Project screens (dashboard, progress, costs, collections, profit, map) |
| `src/portal.js` | Sign in, roles, employee and client screens, weekly reports |
| `ph-map.js` | Luzon map outlines for the project map |
| `logo.png` | LDM logo |
| `supabase/schema.sql` | Database tables and access rules (run once) |
| `supabase/seed.sql` | Your current projects (run once) |
