# Security review · before production

**Status: not approved for live data collection.** This repository currently contains only a static, non-collecting review prototype.

## Scope checked for this first commit series

- The destination repository was empty at the start of this work.
- No runtime server code, credentials, respondent exports or production database identifiers were copied into this repo.
- The review JavaScript has no credential fields, real microphone capture, Google login, `/api/*` calls, or client storage.
- An automated static test scans published review assets for common credential signatures.
- The original production server and its live main branch remain untouched.

## Production security issue to resolve

The supplied SQL spec proposes granting anonymous (`anon`) users the ability to execute `SECURITY DEFINER` write functions such as `save_response`, `register_contact`, `register_identity_v2` and `log_event`. Because a direct caller of Supabase RPC does **not** pass through the Vercel session-token validator, table RLS alone cannot secure these functions. Their SQL definitions do not independently authenticate the respondent. The source design's insert-only anonymous audio policy likewise accepts direct, unauthenticated uploads to the bucket.

**Do not deploy those grants and policies unchanged for a live survey.** The production implementation must use a server-controlled credential/role and revoke anonymous direct write/insert access, or implement equivalent, thoroughly verified authorization inside every RPC and storage policy. This is a proposed departure from the original spec, requiring review before implementation. The browser must never receive the Supabase secret key.

Additional items to review:
1. Ensure write revisions reject lost updates and stale `baseRev` for all existing sessions, including repeated equal revisions.
2. The original Google identity schema retains `google_sub` and `resume_key` even when an email is replaced with an unsalted hash. Align storage and deletion with the published privacy promise.
3. Define an abandoned-recording retention/purge schedule; successful completion alone does not cover abandoned sessions.
4. Turn on protected logs and avoid logging tokens, raw contact information, recorded audio or full transcripts.
5. Do not ship the optional guide screen until a real guide and a trustworthy delivery mechanism exist.
6. Validate signed-in users and signed session passes against direct API calls and rate-limit bypasses.
7. Require Supabase dashboard Security Advisor checks and direct anonymous endpoint probes before launch.
8. Audit all production source files, version history and generated artifacts for credentials. Rotate any credential previously committed; deletion from latest files does not erase Git history.

## Production variables (server-only)

- `SARVAM_API_KEY`
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_KEY` (existing code configuration; reassess server-only role)
- `SUPABASE_SECRET_KEY`
- `GOOGLE_CLIENT_ID` (public OAuth client identifier by design)
- `NODEJS_HELPERS`

Real values belong in a trusted deployment environment, not in source code. Do **not** paste secret values into the public review page or a commit. Do not rely on moving plaintext keys to environment variables only at the last step; keep them out of code from the beginning.

## Source of truth

The original `docs/questions-v1.json` is copied from `KR4705/voice_agent_sarvam` branch `flow/quote-journey`. The active `docs/questions.json` is a revised v2 review proposal and **is not compatible with the unchanged production server without new backend validation and persistence work**. We will not reuse the original live survey database.

## Additional v2 privacy and messaging safeguards

- Scheduled callback emails must have a one-message consent, validation of future time and time zone, a signed unsubscribe/cancel link, TTL and minimal logs. Phone numbers are not a delivery route for these reminders.
- Guide and research findings mailings are separate, explicit email preferences; no automatic generic thank-you email is sent. Content and sending are blocked until fulfillment is real.
- Raw speech transcriptions may remain in secure server-side research answers for integrity, but are not sent back to the browser for display. The nonblocking interpretation must be marked **unconfirmed** in stored metadata, not falsely treated as respondent approval.
- Original API voice shapes and question ordering must be migrated and re-tested; no production launch on the old server contract.
