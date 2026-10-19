# PawMatch Mobile — Beta Testing Guide

Part 1 is for the PawMatch team: setting up the backend, building the app and running the beta.
Part 2 is for the testers (dog owners and veterinarians in Davao City) and can be shared as is.

---

## *Part 1 — Team setup*

### *1. Create the Supabase project*

1. *Create a project at [supabase.com](https://supabase.com). The **Southeast Asia (Singapore)** region is closest
   to Davao.*
2. *In **SQL Editor**, open `supabase/migrations/20261012000000_pawmatch_init.sql`, paste the whole file and run it.
   This creates every table, the security rules, the triggers, the `dog-photos` and `documents` storage buckets,
   and the Realtime publication.
   (Or with the CLI: `npx supabase link --project-ref <ref>` and then `npm run db:push`.)*

### *2. Configure Auth (important for the beta)*

*Under **Authentication**:*

- ***Email provider and confirmation.** In **Sign In / Providers → Email**, keep **Enable Email provider** on,
  turn **Confirm email** on, and set **Email OTP Length** to 6. New users then get a 6-digit code by email and
  type it into the app's "Confirm your email" screen. Users who try to sign in before confirming are taken back
  to that screen, and a new code is sent.*
- ***Custom SMTP (required when Confirm email is on).** Supabase's built-in sender only delivers to members of
  your Supabase organisation and is heavily rate-limited, so testers would get a "couldn't send your
  confirmation email" error. Under **Authentication → Emails → SMTP Settings**, enable custom SMTP. For example,
  with a Gmail account that has 2-Step Verification on: host `smtp.gmail.com`, port `465`, username = the Gmail
  address, password = a Gmail **App password** (Google Account → Security → App passwords), sender = the same
  Gmail address. Gmail allows about 500 emails a day, which is enough for the beta. Brevo or Resend also work.*
- ***Email templates.** The app uses codes, not links, so both templates must include `{{ .Token }}`. In
  **Authentication → Emails → Templates**, paste:*
  - *`supabase/templates/confirm-signup.html` into **Confirm signup** (subject: `Your PawMatch confirmation code: {{ .Token }}`)*
  - *`supabase/templates/reset-password.html` into **Reset Password** (subject: `Your PawMatch password reset code: {{ .Token }}`)*
- ***Rate limits.** Under **Authentication → Rate Limits**, raise "emails sent per hour" (the default is low) so
  several testers can sign up in the same session.*
- ***No email server yet?** Turning **Confirm email** off makes sign-up work immediately without any email.*

  - ***Social login (optional).** The Google button is hidden unless
    `EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN=true`. To use it, enable the Google provider in Supabase and add
    `pawmatch://auth-callback` under **URL Configuration → Redirect URLs**.*

### *3. Deploy the compatibility Edge Function*

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run functions:deploy
```

*The function computes recommendations on the server and sends "new compatible match" alerts when someone adds a
dog. If it isn't deployed, the app still works: it runs the identical algorithm on the phone. Only the
new-match alerts are missing in that case.*

### *4. Configure the app*

```bash
cp .env.example .env
```

*Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API). Optionally set
`EXPO_PUBLIC_SUPPORT_EMAIL`, which receives "Report a problem" emails from testers.*

### *5. Seed demo data (optional but recommended)*

*Create `.env.seed`. It is git-ignored; never commit it and never put the service-role key in `.env`:*

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key from Project Settings → API>
DEMO_PASSWORD=<choose one>
```

*Then run `npm run seed:demo`. This creates:*

| *Account*                      | *Role*                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| *`demo.owner@pawmatch.app`*  | *Juan dela Cruz (Talomo): Max (Husky, Tier 2), Bruno (Labrador, Tier 1)*             |
| *`demo.owner2@pawmatch.app`* | *Maria Santos (Buhangin): Bella (Shih Tzu, Tier 3), Luna (Golden Retriever, Tier 1)* |
| *`demo.owner3@pawmatch.app`* | *Carlos Reyes (Toril): Kiko, Yuki, Rocky*                                            |
| *`demo.vet@pawmatch.app`*    | *Dr. Patricia Reyes, approved veterinarian*                                          |

*All use `DEMO_PASSWORD`. To show one-tap "Demo Access" buttons on the login screen, also set
`EXPO_PUBLIC_DEMO_PASSWORD` to the same value in `.env`. Running the seed again is safe; it skips what already
exists.*

### *6. Approve veterinarians and breeders*

*Vets and breeders register in the app by choosing **Vet / Breeder**. They see "Account pending approval" until an
admin checks their PRC license or certification. A dog owner who is also a vet or breeder signs up as **Vet / Breeder**
with the same email and password: the professional profile is added to their existing account, and they switch sides
from **Records → Switch to Vet / Breeder** or **Profile → Switch to Dog Owner**. They can't verify their own dogs.*

*Make your own account an admin once (sign out and back in afterwards):*

```bash
npm run admin:grant -- you@example.com
```

*Admins get an **Admin** tab and an alert for every new application. Open an application to approve it, or reject it
with remarks the applicant will see. A rejected applicant re-submits by correcting their license number, and an approved
verifier who changes their license number goes back to the queue. Admins can't review their own application.*

*The command-line route still works:*

```bash
npm run verifier:list                          # who is waiting, with license numbers and phones
npm run verifier:approve -- dr.cruz@example.com
```

*Only approved verifiers appear when owners choose a reviewer.*

### 7. Try it on your own phone

```bash
npm start
```

Scan the QR code with **Expo Go** (SDK 54). Phone and computer must be on the same Wi-Fi, or use
`npm start -- --tunnel`.

### 8. Build the APK for testers

```bash
npx eas-cli login
npx eas-cli init                                  # once; links the project to your Expo account
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext
npm run build:apk
```

EAS prints a link and QR code to the `.apk`. Share it with testers. Android will ask them to allow installing
from that source. Any other `EXPO_PUBLIC_*` values from `.env` (support email, demo password) must also be added
with `env:create`, because `.env` is not uploaded to EAS.

iPhone testers need TestFlight, which requires an Apple Developer account. Until then, they can use Expo Go
connected to a team member's dev server.

### 9. Before inviting testers

- [ ] `npm run check` passes.
- [ ] You registered a fresh owner account on a real phone, added a dog with a photo, and saw matches.
- [ ] You sent a request between two accounts, accepted it, chatted, and left a review.
- [ ] You uploaded a document (camera and PDF), approved it as the vet, and saw the Tier badge and audit trail.
- [ ] You rejected a document with remarks and saw it as the owner.
- [ ] Alerts appear while the app is open (Realtime), and in Notifications afterwards.
- [ ] A new sign-up receives the 6-digit confirmation code (check spam too), and entering it signs you in.
- [ ] Password reset codes arrive.

### Monitoring during the beta

- **Table Editor:** `notifications`, `match_requests` and `verifier_submissions` show activity.
- **Logs → API / Auth:** failed requests and sign-ins.
- Every verification decision is in `audit_logs`.

---

## Part 2 — Tester guide

Thank you for helping test **PawMatch**, a breeding-partner matching app for Davao City dog owners with
veterinarian-verified health records.

### Getting started

1. Install the app from the link the PawMatch team sends you. On Android, allow "install unknown apps" for your
   browser when asked.
2. Tap **Sign Up**. Choose **Dog Owner**, or **Vet / Breeder** if you are a licensed veterinarian or certified
   breeder. Vet/breeder accounts are checked by the team before they can review documents.

### Please try these as a dog owner

1. **Add your dog.** Go to **Dog** → Add Dog Profile. Enter the name, breed, age, sex, size, color, up to 3
   temperament traits and a photo.
2. **Get verified.** Go to **Verify** and upload your dog's vaccination card. Use **Take Photo**, **Gallery** or
   **File / PDF**. Choose a veterinarian and tap Send for Review. You'll get an alert when it's reviewed.
   - Tier 1 = vaccination card, Tier 2 = + health clearance, Tier 3 = + pedigree or DNA test.
3. **Find a match.** On **Home**, see your top 3 matches. Or open **Breeding Matcher** to filter by breed, color,
   size, temperament or verified dogs only. Tap **Choose** to see how the score was calculated.
4. **Send a request.** Write a message and send it. The other owner can accept or decline, and you can chat in the
   conversation.
5. **Rate the experience.** After a request is accepted, tap **Rate** in the conversation. Ratings appear on the
   owner's **Reputation** page.

### Please try these as a veterinarian or breeder

1. Open **Requests** to see documents sent to you.
2. Open a document, check it, and tap **Approve**, or **Reject** with remarks explaining what's wrong.
3. Check **Records** for everything you have reviewed. Toggle **Available** on your profile when you're busy.

### What to report

Use **Help & About → Report a problem** in the app, or message the team. Please include:

- what you were trying to do,
- what happened instead (a screenshot helps a lot),
- your phone model.

Also tell us if a match score seems wrong, if anything is confusing, or if you'd want a feature.

### Privacy

Your documents are visible only to you and the verifier you choose. Other owners see only the verification badge
and the audit trail (who verified what, and when). Please only upload documents for dogs you own.

### Known limitations in this beta

- Alerts arrive while the app is open, and are kept in **Notifications**. Push notifications while the app is
  closed are not included yet.
- Google sign-in may be turned off.
- Premium features from the business model (Featured Match, Kennel Partner Plan) are not part of this beta.
