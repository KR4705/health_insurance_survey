# Quote Journey · Survey flow v2 — final approval draft

**Status:** Awaiting product approval; no production backend or live respondent collection.  
**Date:** 6 November 2026  
**Repository:** `KR4705/health_insurance_survey`  
**Active demo data:** `docs/questions.json`; previous flow: `docs/questions-v1.json`.

## Product decisions incorporated

1. Landing is shorter. W1 (five minutes) appears **before** sign-in.
2. W1 = later asks for a one-time scheduled **email** reminder; date, time, time zone and email are required. No sign-in on this path. Sending is a production integration, not part of the mock.
3. H9 shows **grouped tiles**, not full-width rows. Up to three reasons still permitted.
4. Q7 uses plain emotional-certainty labels from **Very unsure** to **Very sure**.
5. For voice: show **I understood** (short AI paraphrase only); never show the raw transcript; no mandatory extra Yes/Not quite; move on automatically. The person may use Back to correct. Neutral, optional in-recording prompts; no pressure to keep talking.
6. P12c measures confidence that the purchased cover was understood.
7. X13 asks what else, if anything, was needed beyond the quote. Examples are gentle prompts, not forced assumptions.
8. X14 requests email-only preferences for a one-page guide, summary of aggregated research learnings, both or neither. X14c asks for email only if needed (use any available email to prefill, with an edit option).
9. No WhatsApp, referrals or generic thank-you email.

## Full route

```text
INTRO → W1
         ├─ no → DECLINED
         ├─ later → CB (date, time, time zone, email) → CALLBACK
         └─ yes → C00 (Google or contact alternative)
                   ├─ no thanks → DECLINED
                   └─ yes → W2 (consent)
                             ├─ no → DECLINED
                             └─ yes → S1
S1 → if maybe/no: S1b → S1bv (optional) → S2
      otherwise → S2
S2 → no → SCREENED_OUT
   → yes → Q3 → Q4 → Q5 → Q6 → Q7 → H8
H8 → yes → H9 (tiles, max 3) → H9v (optional) → H10 → P11
   → no → P11
P11 → paid → P12a → P12c → X13
    → deciding / dropped → P12b → X13
X13 → X14
X14 → guide / findings / both → X14c (email) → Q21 → THANKS
    → no → Q21 → THANKS
```

## Exact proposed screen copy and branching fields

| Screen | Type | Proposed title | Helper | Choices, input, routing |
|---|---|---|---|---|
| `INTRO` | message | Your health insurance quote, in your words 👋 | — |  |
| `W1` | single | Do you have about 5 minutes now? | If now isn't convenient, you can ask for one email reminder. | Yes, let's do it now [yes]; Later works better [later]; No, thanks [no] → DECLINED |
| `CB` | text | When should we email you a reminder? | Choose a date and time. We'll send one survey link by email at that time, and no other messages. | Date (date, date); Time (time, time); Time zone (timezone, text); Email for this one reminder (email, email) \| shown if W1 = later \| then → CALLBACK |
| `C00` | welcome | First, a quick sign-in | Sign in to avoid answering twice and to pick up where you stopped. |  |
| `W2` | message | Before we start | — | shown if W1 = yes |
| `S1` | single | Would you be comfortable buying health insurance online, on your own? | Without speaking to an agent or anyone at the company. | Yes [yes]; Maybe [maybe]; No [no] \| shown if W1 = yes |
| `S1b` | single | What would you want a person for? | Pick the main one. | To check what's really covered [cover]; To be sure a claim will be paid [claims]; To ask about my health conditions [health]; To help me compare plans [compare]; I just trust a person more [trust]; Something else [other] \| shown if W1 = yes, S1 = maybe / no |
| `S1bv` | voice | Tell me a bit more about that. | Optional. A sentence is enough. | shown if W1 = yes, S1 = maybe / no \| optional / Skip |
| `S2` | single | In the last 6 months, did you get a price (a quote) for a health insurance plan? | — | Yes [yes]; No [no] → SCREENED_OUT \| shown if W1 = yes |
| `Q3` | single | How did you get the quote? | If you got more than one, think of the one you looked at most closely. | On an insurance company's website or app [insurer]; On a comparison site (like Policybazaar) [aggregator]; From an agent or advisor [agent]; Through my bank [bank]; Through my employer [employer]; A friend or family member sent it [family]; Somewhere else [other] \| shown if W1 = yes |
| `Q4` | scale | How easy was it to get the quote? | — | shown if W1 = yes |
| `Q5` | voice | When you first saw the price, what went through your mind? | Your first reaction, in your own words. | shown if W1 = yes |
| `Q6` | single | Did you understand what the plan would pay for? | — | Yes, clearly [yes]; Partly [partly]; Not really [no] \| shown if W1 = yes |
| `Q7` | scale | When you saw the quote, how sure were you about buying that plan? | — | 1: Very unsure; 2: A little unsure; 3: Not sure; 4: Fairly sure; 5: Very sure \| shown if W1 = yes |
| `H8` | single | Did anything make you hesitate? | — | Yes [yes]; No [no] \| shown if W1 = yes |
| `H9` | multi (tiles) | What held you back? | Choose up to 3 reasons. Pick what mattered most to you. | The price [price]; Waiting periods [waiting]; Limits like room rent or co-pay [limits]; It didn't feel urgent [urgent]; Not sure what was covered or left out [cover]; Worried a claim wouldn't be paid [claims]; Questions about my health conditions [health]; Needed to check with family [family]; Wanted to compare other plans [compare]; Wasn't sure I could trust the company [trust]; Something else [other] \| shown if W1 = yes, H8 = yes |
| `H9v` | voice | Tell me more about what held you back. | Optional, but it helps a lot. | shown if W1 = yes, H8 = yes \| optional / Skip |
| `H10` | single | What did you do about it? | Pick the main thing. | Read more online or in the policy [read]; Asked family or friends [asked]; Called or chatted with the insurer [insurer]; Spoke to an agent [agent]; Compared other plans [compared]; Nothing, I just waited [nothing]; Something else [other] \| shown if W1 = yes, H8 = yes |
| `P11` | single | Where did you end up? | — | I paid and bought the plan [paid]; I'm still deciding [deciding]; I decided not to buy, for now [dropped] \| shown if W1 = yes |
| `P12a` | voice | What finally made you go ahead? | What tipped it for you? | shown if W1 = yes, P11 = paid |
| `P12c` | scale | When you paid, how sure were you that you understood what the plan would cover? | Think about what the plan would pay for, and what it would not. | 1: Not sure at all; 2: A little unsure; 3: Not sure; 4: Fairly sure; 5: Very sure \| shown if W1 = yes, P11 = paid |
| `P12b` | voice | What would have made you pay? | Think about that quote. What was missing? | shown if W1 = yes, P11 = deciding / dropped |
| `X13` | voice | What else, if anything, would have helped you understand or decide about that quote? | For example, simpler explanations of insurance words, examples of what's covered, or a better way to compare plans. 'Nothing else' is fine. | shown if W1 = yes |
| `X14` | single | Would you like us to email you something after the study? | Choose what you would like to receive. We will only email you about what you choose, when it's ready. | A 1-page guide to reading a health insurance quote [guide]; A short summary of what this study finds [findings]; Both the guide and the study summary [both]; No thanks [no] \| shown if W1 = yes |
| `X14c` | text | Which email should we use? | We'll only use this address to send the item or items you selected. | Email address (email, email) \| shown if W1 = yes, X14 = guide / findings / both |
| `Q21` | finish | Thank you, {first}. That really helps. | — | final completed save |
| `THANKS` | message | All done. Thanks again, {first}! | — |  |
| `CALLBACK` | message | Your reminder has been requested | — |  |
| `SCREENED_OUT` | message | Thank you | — |  |
| `DECLINED` | message | No problem | — |  |
| `ALREADY_DONE` | message | You've already taken part | — |  |

## Voice interaction — proposed acceptance

- Record starts from a real microphone tap on production, up to **2 minutes**, automatically chunked into clips of at most **29 seconds**.
- Show recording state, stop, time left, and only neutral optional encouragement such as “Take your time”, “You can add anything else that stood out”, or “That's enough whenever you're ready”.
- Never display raw transcribed voice text back to the respondent. Securely preserve the exact words for analysis and mark the short AI “I understood” interpretation as **unconfirmed**.
- Once recording/transcription/interpretation succeeds, display the short interpretation briefly and move forward **without another confirmation tap**. Keep a Back route for corrections and a typing alternative.
- If recording fails or the mic is blocked, focus a text answer field with a specific reason, preserve progress and allow completion.
- Do not let an interpretation invent facts or advice; a failed interpretation must not be presented as successful.

## Email and consent — proposed acceptance

- Callback requests are one-time, date/time/time-zone specific and explicitly requested by the user. No WhatsApp. Never send before a secure scheduler and sender exist.
- Guide and findings are distinct explicit opt-ins. A study findings email shares **aggregated research learnings**, not another respondent's information or health advice.
- Email is reused or prefilled when available; otherwise request it explicitly. Let people edit a prefilled address.
- No generic thank-you email, no referrals.
- **Do not launch X14 until the guide is written, findings expectation is explained honestly, fulfillment is configured, and privacy/retention terms are approved.**

## Backend differences from the old prototype (mandatory)

These flow changes require production code changes; `flow/quote-journey` endpoints cannot be copied unchanged and assumed valid:
- W1 before sign-in and CB before auth require a protected pre-auth reminder endpoint and revised save/routing validation.
- Voice answer shape/versioning must support a non-confirmed AI read-back, automatic continuation and privacy-preserving transcript handling.
- X14 values and X14c field names changed. Update validation, stored response shapes, delivery jobs and analysis queries.
- Secure Supabase operations by redesigning anonymous write-function and audio grants before production.
- Real sending, resume, completion and iOS/Android mic tests remain required.

## Product sign-off

**Awaiting one confirmation of this v2 flow.** Approval authorizes the *next implementation phase*, not immediate public launch. A production release still requires secure infrastructure, automated reminder delivery, privacy and phone tests, Sarvam environment configuration and a real guide/sending solution.

**Approval status: PENDING.**
