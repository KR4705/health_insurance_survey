# Health Insurance Quote Journey Survey

A **review-first** survey project. This repository currently contains a **safe, static, non-collecting review prototype**. It is not the production survey.

## Preview and navigation

The review page is in `docs/index.html` and includes:
1. A visual seven-step build plan.
2. A branching survey demo driven by the original `questions.json`.
3. A full six-stage flow review with an approval checklist and copyable feedback.

The original question content came from `KR4705/voice_agent_sarvam` at `flow/quote-journey`; the active `docs/questions.json` now contains proposed v2 research changes. The old flow is archived as `docs/questions-v1.json`. The other repository's `main` branch has **not** been modified.

## Publish this review with GitHub Pages

1. Go to **Settings → Pages** in this repository.
2. Select **Deploy from a branch**, **main**, then **/docs**, and Save.
3. When GitHub reports the deployment, open the URL provided in the Pages section.
4. Note: the repository is currently **private**. Whether Pages can deploy from a private repo depends on the GitHub plan, and a published Pages site is generally publicly accessible. For a plan where this is unavailable, use a separate public demo-only repository or upgrade to an eligible plan; never publish secrets or production data.

The intended Pages URL *if Pages is successfully enabled* is `https://kr4705.github.io/health_insurance_survey/`. Do not treat it as live before checking deployment status.

## Security boundary

- This is a client-only mock. **No real Google sign-in, Sarvam request, Supabase write, audio recording, autosave or guide delivery**.
- There are **no API keys, tokens or passwords** in these files.
- `.gitignore` excludes `.env*`, credentials, private key files, `responses/`, and `node_modules/`.
- Never place `SARVAM_API_KEY`, `SUPABASE_SECRET_KEY` or `SESSION_SECRET` in `docs/` or any browser-delivered JavaScript.
- Reviewers should use imaginary contact details and avoid sensitive answers.
- No production data collection until flow, privacy and security are approved.

## Production architecture after flow approval

The full product uses:
- The existing, unchanged Node 22 API contract from the source branch in Vercel serverless functions.
- A **new** Supabase project in Mumbai, separate from the live survey, with RLS, restricted RPC grants, private audio bucket and secure audio deletion.
- Google Identity Services or contact alternative.
- Server-only Sarvam transcription and read-back.
- Local draft persistence, server-acknowledged autosaves, resume and robust final-save status.

Environment variables, configured **server-side in Vercel only**:
`SARVAM_API_KEY`, `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SECRET_KEY`, `NODEJS_HELPERS=0`.

Do not paste secret values into GitHub files, commits, screenshots, logs or PRs. Rotate any credential ever committed to Git.

## Approval checklist

Before implementing production, decide:
1. Email-only guide and findings follow-up X14: provide real content and a delivery method, or hold it until ready.
2. Callback CB: build one-time scheduled email reminder, including date, time, time zone and consent.
3. Confirm W1 before sign-in and retain the later reminder branch.
4. Referral and thank-you email (both disabled in prototype).
5. Approve exact question wording, branch conditions and privacy text.

The demo does not claim that a completed survey was saved to a server.

## Follow-on test gates

Full route through paid and dropped branches; no-consent/screen-out/callback; optional voice skipping; 29-second audio chunking; two-minute limit; iOS MP4 and Android WebM; microphone denial fallback; autosave retry and 422 final-save handling; resume; small-screen keyboard layout; Lighthouse accessibility >= 95; RLS and publishable-key read denial. The original spec warns older `npm test` cases need porting before handoff.

## Status

**Phase 01: design review template.** The active demo is explicitly not a launched research survey.


## Review revision 2 (awaiting final approval)

The active `docs/questions.json` now reflects the owner's requested changes. The previous reference remains available as `docs/questions-v1.json`.

- `INTRO → W1`, then **yes → C00 → W2**, **later → CB → CALLBACK**, **no → DECLINED**. A reminder can be scheduled before sign-in and uses a date, time, time zone and email.
- `H9` reasons are presented as themed tiles, with the original answer codes and max-three rule.
- `Q7` asks how sure the respondent was about buying the plan; `P12c` asks whether the paid-for cover was understood.
- Open answers use voice or typing; the **raw speech transcript is not shown**. After a brief, non-blocking “I understood” summary, the survey proceeds without an extra Yes/Not quite choice. Respondents can go Back to correct their answers. Summaries are a paraphrase, not a confirmation, and the original answer must be preserved securely for analysis.
- `X13` asks about information or help missing beyond the quote.
- `X14` is email-only, with choices of guide, aggregated study findings, both, or neither. The optional follow-up is distinct from the omitted generic thank-you email.

**Product changes requiring backend implementation after approval:** moving `W1` before sign-in and supporting unauthenticated reminder requests requires a new protected API path; changing the voice read-back and X14 option values requires updating API validation, answer versioning and storage; sending scheduled reminders needs server-side scheduling, explicit opt-in, correct time zones, retries and a cancellation method. No such production changes have been deployed yet.

**Launch blockers:** guide content + fulfillment, future findings email consent and delivery, reminder scheduler, privacy/retention review, live browser and device testing, and Supabase write access redesign (`SECURITY-REVIEW.md`).
