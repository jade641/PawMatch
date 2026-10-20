# PawMatch Mobile

Compatibility scoring and multi-tier verified dog breeding partner matching for Davao City
(University of Mindanao, BSIT capstone).

- **Compatibility Scoring Algorithm**: a Weighted Sum Model, breed 35% + age 25% + sex 15% + temperament 25%
  (paper §2.3.2, Tables 7–11), ranked top-3 recommendations.
- **Multi-tier verification**: owners upload vaccination, health, pedigree and DNA documents. A licensed
  veterinarian or certified breeder approves or rejects them with remarks. Badges (Tier 1–3) and an audit trail
  are recorded.
- **Trust and reputation**: breeding requests, in-app chat, ratings and reviews, badges, history, and real-time
  alerts.

Stack: React Native (Expo SDK 54, expo-router) · Supabase Auth, Storage, Realtime and Edge Functions ·
PostgreSQL.

To set up the backend, build the app and run the beta, see **[BETA-TESTING.md](BETA-TESTING.md)**.

## Quick start (development)

```bash
npm install
cp .env.example .env        # fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm start                   # scan the QR code with Expo Go (SDK 54)



TO RUN IN ANDROID (NOT EXPO)
$env:JAVA_HOME = [Environment]::GetEnvironmentVariable("JAVA_HOME", "User")
>> $env:ANDROID_HOME = [Environment]::GetEnvironmentVariable("ANDROID_HOME", "User")
>> $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
>> npx expo run:android
```

Without a `.env`, the app opens a "Setup required" screen instead of crashing.

## Project layout

| Path                                            | What it is                                                                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/`                        | Database schema: tables from the ERD, row-level security, triggers, storage buckets, realtime                                    |
| `supabase/functions/_shared/compatibility.ts` | The compatibility algorithm, shared by the app and the Edge Function                                                             |
| `supabase/functions/compatibility/`           | Edge Function: server-side recommendations and "new compatible match" alerts                                                     |
| `services/api.ts`                             | All Supabase access (auth, dogs, matching, requests, chat, verification, reviews, notifications)                                 |
| `contexts/AppContext.tsx`                     | Navigation stack, session, the user's dogs, real-time notifications, toasts                                                      |
| `components/`                                 | Screens (`Auth`, `Home`, `Profile`, `Verify`, `Conversation`, `Community`, `Veterinarian`) and UI kit (`ui.tsx`) |
| `scripts/seed-demo.mjs`                       | Admin script: demo accounts and dogs, approving verifiers                                                                        |
| `tests/`                                      | Algorithm unit tests and database scenario tests                                                                                 |

## How the main rules are enforced

All business rules live in the database, so a modified client cannot bypass them:

- Owners can only create or edit their own dogs. Tier, trust score, verified status and ratings can't be written by
  clients; triggers compute them.
- Match requests go through `respond_match_request()`. Only the recipient can accept or decline, only the
  requester can cancel, and the partner dog must be the opposite sex.
- Documents are private (`documents` bucket). Only the owner and the verifier they chose can open them.
  Verifiers must be approved by an admin and cannot verify their own dogs. Rejections require remarks.
- Reviews are allowed only between the two owners of an accepted or completed request, once each.
- Notifications are created by triggers (requests, messages, verification results, reviews) and pushed live through
  Supabase Realtime.

## Scripts

| Command                                                              | Purpose                                                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm start`                                                        | Expo dev server                                                                           |
| `npm run check`                                                    | Type-check, lint, algorithm tests and database tests                                      |
| `npm test`                                                         | Compatibility algorithm unit tests (includes the paper's worked example)                  |
| `npm run test:db`                                                  | Applies the migration to an embedded Postgres and checks row-level security and workflows |
| `npm run seed:demo`                                                | Creates demo owners, dogs and an approved vet (needs `.env.seed`)                       |
| `npm run verifier:list` / `npm run verifier:approve -- email`    | Review and approve vet/breeder sign-ups                                                   |
| `npm run admin:grant -- email` / `npm run admin:revoke -- email` | Give an account the in-app Admin tab for reviewing vet/breeder applications               |
| `npm run functions:deploy`                                         | Deploy the `compatibility` Edge Function (Supabase CLI)                                 |
| `npm run build:apk`                                                | Build an installable Android APK with EAS                                                 |
