# Alpha Electronic — Firebase setup

The website is already connected to the Firebase project **alphaelectronic-bed0b**.
Only these things are needed in the Firebase Console (one time):

1. Publish the database rules
2. Enable Email/Password, Google and Phone sign-in
3. Set the admin email
4. Add the hosting domain as an authorized domain

---

## Firebase settings used by the site

These values are already in `firebase-config.js`:

| Setting | Value |
| --- | --- |
| Project ID | `alphaelectronic-bed0b` |
| Auth domain | `alphaelectronic-bed0b.firebaseapp.com` |
| Realtime Database URL | `https://alphaelectronic-bed0b-default-rtdb.firebaseio.com` |
| Storage bucket | `alphaelectronic-bed0b.firebasestorage.app` |
| Messaging sender | `717370859631` |
| App ID | `1:717370859631:web:a97375168a1e3155d6ad9a` |

`firebase.json` and `.firebaserc` are included, so the CLI deploys the correct
project, hosting folder and database rules. Use `firebase login` once, then:

```bash
firebase deploy --only database      # publish the security rules
firebase deploy --only hosting       # put the website online
firebase deploy                      # both
```

## 1. Publish the database rules

1. Open <https://console.firebase.google.com/project/alphaelectronic-bed0b/database/alphaelectronic-bed0b-default-rtdb/rules>
2. If the database does not exist yet: **Create Database** → choose a location → start in **locked mode**.
3. Replace everything in the **Rules** editor with the contents of `database.rules.json`.
4. Click **Publish** (or run `firebase deploy --only database`).

The rules mean:

- Only the admin can read or write invoices.
- A customer can read only the invoices assigned to their own account.
- Anyone can send a service request (website form or chatbot), but nobody can read them except the admin.
- Only the admin can change prices.
- Customer accounts can edit their own profile; the admin can edit or delete any customer profile.
- Customers cannot promote themselves: the `role` field must stay `customer` unless an admin writes it.
- Public service requests are timestamp-checked and length-limited; internal `adminNote` text is admin-only.
- The admin can add or remove other admins under `admins/<uid>`.
- The admin can add internal notes to messages (`adminNote`).
- Rules are **not** editable from the website. The admin panel can copy and test the rules,
  but publishing always happens in Firebase Console or with `firebase deploy --only database`.

## 2. Enable the sign-in methods

Open <https://console.firebase.google.com/project/alphaelectronic-bed0b/authentication/providers>
and enable all three methods the website shows:

1. **Email/Password** → enable → Save.
2. **Google** → enable → choose a project support email → Save.
   Customers click **Continue with Google** on the login page and pick their Google account.
3. **Phone** → enable → Save.
   Customers click **Continue with phone number**, choose a country code, and receive a
   one-time SMS code. The code is verified by Firebase; the website never stores it.

Notes:

- The login page uses an invisible reCAPTCHA for phone sign-in. No reCAPTCHA key has to be
  configured in this project; Firebase handles it automatically.
- Phone sign-in only works on `localhost` or a domain listed under **Authentication →
  Settings → Authorized domains** (see step 4). Opening `login.html` from `file://` will not work.
- Google sign-in opens a popup. If a customer's browser blocks popups, the site falls back
  to a full-page redirect automatically.
- Phone-only accounts have no email address. Their profile is stored under `users/<uid>`
  with an empty email and their phone number; the admin can still assign invoices and add
  them as admins by UID.
- SMS has a free daily quota. If it runs out, Firebase returns `quota-exceeded` and the
  login page tells the customer to use email instead.

## 3. Set the admin email

The site already has a built-in owner administrator:

```text
sujithelectro@gmail.com
```

It is written into both `firebase-config.js` (`window.AE_ADMIN_EMAIL`) and every admin check in
`database.rules.json`, so this account is admin as soon as it signs in — no database entry needed.

1. Open the site → **Login** → **Create account** (or Continue with Google).
2. Register with **sujithelectro@gmail.com**.
3. Sign in with **Administrator** selected on the login page. The admin dashboard opens, and
   `config/adminEmail` is filled in automatically if it was empty.

Publish the latest `database.rules.json` first (section 2), otherwise the admin page shows a
“permission denied” setup panel.

Additional admins still choose ONE of these:

**Option A — admin email (single shared admin address)**

1. Open <https://console.firebase.google.com/project/alphaelectronic-bed0b/database/alphaelectronic-bed0b-default-rtdb/data>
2. Under the root, add a child `config` → child `adminEmail` → value = that admin email.
3. Log out and log in again. The Admin page will open.

**Option B — admin UID (more secure, recommended for staff)**

1. Open <https://console.firebase.google.com/project/alphaelectronic-bed0b/authentication/users>
2. Copy the **User UID** of the admin account.
3. In Realtime Database → Data, add `admins` → child = that UID → value = `true`.
4. Log out and log in again.

> The owner email in the rules always keeps admin access, even if `config/adminEmail` changes.
> After the first admin is working, use **Admin → Admins** to add other accounts by UID or
> change the owner email. No Console access is needed for those later changes, as long as the
> latest rules are published.

## 4. Authorized domains (needed for Google and phone sign-in)

Firebase → Authentication → Settings → **Authorized domains** → **Add domain** → add your
hosting domain (for example `alpha-electronic.web.app`). `localhost` already works for testing.
Google sign-in and phone sign-in both reject domains that are not on this list.

## 5. Put the site online (needed for customer logins and shared links)

The invoice maker works offline by double-clicking `invoice.html`, but Firebase needs a real web address.
Any static host works:

- **Firebase Hosting**: `firebase login`, `firebase init hosting`, `firebase deploy`
- **Netlify Drop**: drag this folder to <https://app.netlify.com/drop>
- **GitHub Pages**: upload the folder to a repository and enable Pages
- **Local test**: run `python -m http.server 8000` in this folder and open <http://localhost:8000>

After hosting, add the domain in step 4.

## How the data is stored

| Path | Contents |
| --- | --- |
| `invoices/<key>` | Every invoice: customer, items, totals, status, signature settings |
| `customerInvoices/<uid>/<key>` | Which invoices a customer may see |
| `users/<uid>` | Customer name, email (empty for phone-only accounts), phone, sign-in provider |
| `admins/<uid>` | `true` for every account with full admin access |
| `serviceRequests/<id>` | Website form / chatbot messages, status and admin notes |
| `config/adminEmail` | The owner admin email |
| `config/prices` | Price overrides managed from Admin → Prices |

## Website forms & chatbot

All public forms write to the same Firebase path:

- Contact form → `serviceRequests`
- Package order buttons / quote modal → `serviceRequests`
- Website assistant (chatbot) lead form → `serviceRequests` with `type: "chatbot"`

The admin sees every message in **Admin → Requests**, can open WhatsApp, mark it done
or delete it. Because requests are anonymous creates, the rules allow anyone to **add**
a request but only the admin to **read** them.

The chatbot (`chat.js`) answers questions about solar, CCTV and wiring package prices,
site visits, invoices, warranties and contact details. It has no external AI bill —
answers are built into the file and can be edited there.

## Online invoice sharing

- **Invoice maker → Share** copies a `view.html#v=…` link. It opens a read-only online
  invoice with Print / Save PDF and needs no sign-in (the data is inside the link).
- **Customer portal → Open / PDF** opens `view.html?id=<invoice key>`. The customer must
  be signed in and the invoice must be assigned to their account; database rules enforce this.
- The admin can assign an invoice to a customer from **Admin → Invoices → Assign**.

## Admins, customers and messages

- **Admins tab** — lists every `admins/<uid>` entry and the owner email.
  Add a new admin by pasting their Firebase UID (copy it from Customers).
  Remove admin access with one click. Your own access cannot be removed.
- **Owner email** — saved to `config/adminEmail`. Add your UID as an admin first
  before changing it, so you never lock yourself out.
- **Customers tab** — edit name/phone, give a customer admin access, or delete their
  profile. Deleting also unassigns all their invoices. The Firebase Authentication
  login itself is deleted from Firebase Console → Authentication → Users.
- **Messages tab** — every website form, chatbot lead and portal enquiry, with status,
  WhatsApp link, internal admin note (saved under `adminNote`) and delete.
- **Rules & access check** — the Setup tab tests the published rules for every path
  and copies the latest `database.rules.json`. It cannot publish rules from the browser.

## Admin features

- **Overview** — revenue, outstanding balances, customers, new messages
- **Invoices** — search, open, share link, print, assign to customer, delete
- **Customers** — edit, promote to admin, delete, view assigned invoices
- **Admins** — owner email and admin access by UID
- **Messages** — website/chatbot/portal messages, notes, done status, delete
- **Prices** — change any catalog price; the invoice maker uses the new price
- **Setup** — admin identity, rules access check, cloud counts and go-live checklist
- **Sync device invoices** — upload invoices saved offline in this browser to Firebase
- **Export all data** — invoices, customers, admins, messages and prices as one JSON backup

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Public website with services, solar/CCTV/wiring packages, gallery, quote form and chatbot |
| `login.html` | Admin and customer sign-in / account creation |
| `portal.html` | Customer portal — assigned invoices, service requests, profile |
| `admin.html` | Admin dashboard — invoices, customers, requests, prices, setup |
| `invoice.html` | Invoice / quotation maker with A4 PDF, share link and cloud sync |
| `view.html` | Public read-only invoice preview — `view.html#v=…` share links and `view.html?id=…` customer invoices |
| `privacy.html` | Public privacy policy — what is collected, how it is stored, and how to request deletion |

- Customers choose **Customer login** at `login.html` and land on `portal.html`.
- Administrators choose **Administrator** at `login.html` (or open `login.html?next=admin.html`)
  and land on `admin.html`. A non-admin signing in through the Administrator option is signed out
  with a clear message instead of being sent to the dashboard.
- `sujithelectro@gmail.com` is the built-in owner admin (in `firebase-config.js` and the rules).
- Other staff accounts must be added as `admins/<uid> = true`. If an account is not admin yet,
  `admin.html` shows a setup panel with the account UID, email and rules text to copy.
- Customers only ever see invoices the admin assigns to them.

## Security notes

- The Firebase `apiKey` in `firebase-config.js` is a public web key; it is safe to publish.
  Data is protected by the database rules, not by the key.
- Never set the database to "test mode" (`".read": true`); anyone could read your invoices.
- The owner email is stored in `config/adminEmail` on first owner sign-in and is readable by
  signed-in users (needed so the site can detect the admin). It is never shown on the public
  login page.

### High-security features included

- **Password policy:** new accounts need 10+ characters with upper case, lower case and a
  number. The form shows a live strength meter and asks for the password twice.
- **Login attempt guard:** after 5 failed sign-ins the browser locks the form for 60 seconds,
  then doubles the wait up to 15 minutes. Firebase also rate-limits requests on the server.
- **Idle sign-out:** the admin panel and customer portal sign out after 30 minutes without
  activity and return to the login page with a notice.
- **Safe redirects:** `login.html?next=…` only accepts the site's own pages, so a crafted
  link cannot send a user to another website.
- **Reset privacy:** password reset always shows the same message, so it does not reveal
  whether an email address is registered.
- **Private pages:** `admin.html`, `portal.html`, `login.html` and `view.html` send
  `noindex, nofollow`; shared invoice links are marked as private.
- **Link hardening:** external and new-tab links get `rel="noopener noreferrer"`, and
  `javascript:` links are removed.
- **Hosting headers:** `firebase.json` adds Content-Security-Policy, HSTS,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a referrer policy and a
  permissions policy. Run `firebase deploy` to publish them; they are not active on a
  plain static server or when opening the files directly.
- **Clickjacking:** pages refuse to stay inside another site's frame.
- **Rules validation:** customer profiles cannot change their `role`, public requests must
  have a valid timestamp, and only admins can write internal `adminNote` text.
- **Third-party sign-in:** Google sign-in uses Firebase's secure popup/redirect flow, and
  phone sign-in verifies the SMS code on Firebase's servers. The website never receives or
  stores Google passwords or SMS codes. Both methods require an authorized domain, and the
  hosting CSP allows only Google's reCAPTCHA and Firebase auth endpoints.

## If Chrome shows "Dangerous site"

That warning comes from **Google Safe Browsing**, not from Chrome reading this code. It is a
reputation label attached to the live web address, so editing HTML or CSS cannot remove it.
Only Google can clear it after a review. A full audit of this project found no malicious
scripts, hidden frames, downloads, off-site form posts or obfuscated code — the only external
connections are Google Fonts, WhatsApp and your own Firebase project.

Do these steps in order:

1. **Note the exact address** shown in the warning. The flag belongs to that host
   (`something.web.app`, a custom domain, etc.), not to the folder on your PC.
2. **Check the public report:** open
   <https://transparencyreport.google.com/safe-browsing/search> and search the address.
   That page names the category (malware, social engineering/phishing, unwanted software).
3. **Verify ownership in Google Search Console:** <https://search.google.com/search-console>.
   Add a **URL-prefix** property for the exact address. For Firebase Hosting, download the
   verification HTML file, put it in this folder and run `firebase deploy --only hosting`.
4. **Open Security Issues:** in Search Console, go to **Security & Manual Actions →
   Security Issues**. It lists sample URLs and the reason. Do not ignore this step — it tells
   you whether the site is actually compromised or just mislabelled.
5. **If any malicious content is found:** take the site offline, delete the unknown files or
   pages, change the Firebase/Google/hosting account passwords, review `users`, `admins`,
   `invoices` and `serviceRequests` for unknown entries, redeploy the clean folder, then
   request a review. Also check the domain's DNS records and any old deployments or subdomains.
6. **If the site is clean:** click **Request a review** in Security Issues. In the explanation,
   state that this is a registered Sri Lankan electrical contractor (Reg. No 11/2622) at
   Ranthati Kanda, Panagamuwa, Kurunegala, phone 077 328 3588; that the login is only for the
   business's own invoice portal; and include the privacy policy link (`privacy.html`).
7. **Use a clean address if needed:** free `*.web.app`, `*.netlify.app` and `*.pages.dev`
   subdomains have weaker reputation because they are shared. A custom domain with a clear
   business identity, HTTPS and the privacy page usually clears review faster.
8. **Wait:** reviews can take a few hours to several days. The warning disappears
   automatically once Google updates the listing. Never pay a "warning removal" service —
   only Google can change Safe Browsing status.

If the warning appears on **only one computer or browser**, scan that device for malware and
remove unknown extensions before assuming the website is flagged. If it appears only on
mobile data but not Wi-Fi (or the reverse), the network may be injecting content.

## Privacy policy

`privacy.html` explains what the website collects (name, phone, email, invoices and service
messages), that data is stored in Google Firebase, that no card payments or advertising
trackers are used, and how customers can request correction or deletion. It is linked from the
homepage, login page, portal, invoice preview and invoice maker. Google reviews and the Google
sign-in consent screen expect a public privacy policy like this.
