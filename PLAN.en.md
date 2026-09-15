# PLAN.md — GreenATM Evidence & Readiness Platform

AEROTHAI · Agentic AI Bootcamp

> Labels used throughout: **`[confirmed]`** = stated by the participant · **`[proposed]`** = a default
> awaiting confirmation · **`[open question]`** = unanswered · **`[not tested]`** = no real evidence yet
> 🇹🇭 Thai version: `PLAN.md` — ⚠️ **the Thai version is at rev 2.2 and is now behind this file.**
> This English file is the authoritative one for rev 2.3; the team chose not to back-port the change (§11.4 B3).

---

## Mentor review summary

| Area | Content |
|---|---|
| **Problem statement** | For **the central GreenATM team (~5 people) and the data owners in each division**, **answering "how ready are we, is the evidence sufficient, and how should the response be written"** is difficult because **evidence is scattered across divisions in different formats, sent by email, each document must be manually interpreted against the right criterion, and "work reported as complete" is not the same as "evidence an assessor will accept"** — by the time gaps surface, the cycle is nearly over. |
| **Workflow + AI role** | **Divisions talk to an assistant agent in chat** — they type an update or drop an evidence file → **the agent interprets it and renders a confirmation card the human taps** (the agent never writes the value) → **code** computes every level roll-up and decides every status → **a second agent** reads that item's evidence against its criteria, judges whether it is sufficient, **assigns tier A–D, states what is still missing, and replies in the chat immediately** → **a model** drafts the response from confirmed evidence → **a human reviews, confirms, or returns it with a reason** → an executive approves → **an executive dashboard plus a monthly Word/PDF document in which every statement carries a citation.** Alongside all of this, **code — not a model — raises deadline, milestone and repeated-slip alerts to the moderator and evidence alerts to the item owner**, drafting each into an Outbox that a human sends. The external assessor stays outside the system: it prepares evidence for them, it does not judge on their behalf. |
| **Data** | **available**: the organisation's own internal assessment form **วว.นบ209_2569-14** — **4 categories · 24 items · Level 1–5 per item** — populated with a synthetic sample set (13 evidence documents, 19 milestones across 6 items, slip histories, a target level per item), plus the **CANSO GreenATM public model** (3 categories · 20 topics · 100 points · 5 levels · the cliff rule) as the external target, plus the response form template · **missing**: real progress files from divisions, real target levels for FY2570, flight data / emission factors · **restricted**: SharePoint, AD/SSO, corporate SMTP · **available · tested 15 Sep 2026**: the model endpoint (DGX 10.0.63.215 · no auth) |
| **Prototype scope** | **In:** one complete path — **chat receives the update/evidence (confirmation card)** → compute → **agent evaluates evidence** → human confirms → draft response → approve → dashboard + monthly Word/PDF export · plus **alerting** (deadline / milestone / repeated slip → moderator · evidence gaps → owner, drafted into an Outbox a human sends), **a responsible person and a milestone timeline on every home-screen row with click-through to detail**, **an agent Suggestion column on "my work"**, and a **3-year / 5-year level projection with its assumptions printed on the page** · 3 roles on one machine with permissions enforced in the backend · **the manual form is kept as the fallback when the model is down**. **Out:** automated Excel import, real email/LINE/Teams delivery, real SSO, integration with existing systems, CO₂ calculation, kWh/vehicle metrics, OCR, cloud deployment. |
| **Success test** | **Normal:** attach a signed measurement report to item **2.7 (CDO)** → the agent reads it, assigns tier **A** with a reason → a human confirms → the readiness figure moves → a response is drafted citing that document → approved → the monthly document contains the citation `[E-014]`. **Failure:** item **3.2 (Renewable energy)** reports 20% progress toward Level 2 but its only evidence is two "(draft) action plan" documents → the agent assigns tier **C** → **the verified level must not move** → it replies *"a plan is not evidence of a result"* and **states what kind of evidence is needed instead** → and 3.2 must appear in the **remarks register** at the end of the document; it may not be silently omitted. |
| **Screens + design** | 8 screens, **6 of them already exist as a static mockup** · laptop-first (the executive view must be readable on a phone) · Thai UI with English technical terms · exported documents in English following the form template · **each row carries its own problem note; the honest headline is "19 of 24 items have not moved a level"** · status uses a symbol alongside colour, contrast ≥ 4.5:1 · no hero banners, no figures without a source · **any projected figure carries its assumptions and the words "a projection, not a commitment" beside it** `[proposed]` |

---

## 1. Project and review status

| | |
|---|---|
| Project | **GreenATM Evidence & Readiness Platform** |
| Organisation | AEROTHAI — Agentic AI Bootcamp, 14–16 September 2026 |
| Revision | **2.4** (from 2.3 — M1 · M2 · M5.5 built and passing in `greenatm-app/`; §8.2 records what the running application proves) · rev 2.3 note: (from 2.2 — tracking moves onto the organisation's own form วว.นบ209_2569-14 · alerting returns to Required · responsible person + timeline, Suggestion column and level projection added · §11.2.1 D11–D15) |
| Date | 15 September 2026 |
| Status | **`Implementation under way — M1, M2 and M5.5 done`** · B1 cleared (§8) · **B4 cleared (§8.2)** · B2 (scope) and B3 (document sync) remain · M3 (agent loop) still unproven — see §8.2 |
| Process | `PLANNING.md` Stage 5 |
| Time remaining | Afternoon/evening 15 Sep + morning 16 Sep · **feature freeze at noon on 16 Sep** |

---

## 2. Problem and outcome

### 2.1 Users and trigger

| User | What they do today | What gets in the way |
|---|---|---|
| **Division data owners** (~10) | Keep their data in their own format; submit when chased | Don't know what is due when · duplicate reporting effort |
| **Central team** (~5) | Collect from every division, interpret which document satisfies which criterion, then compose responses by hand | Don't know who hasn't submitted · can't tell whether evidence is sufficient until every document has been read |
| **Executives** (3–5) | Ask owners one by one | No portfolio view; no sight of what is at risk |
| **External assessor** | Reviews the documents the central team submits | **Deliberately outside the system** — the platform prepares evidence for them; it does not judge on their behalf |

**Trigger:** the annual assessment cycle · monthly reporting · ad-hoc executive requests.

### 2.2 Why it is hard

1. Evidence is scattered across divisions in different formats, exchanged by email.
2. Someone must read and interpret which document satisfies which criterion, and whether it is enough.
3. **"Reported complete" ≠ "has evidence an assessor will accept"** — nobody sees the gap until asked.
4. Nobody knows which division has not submitted; each must be chased individually.
5. The numbers say *late*, but not *what is actually stuck*.

### 2.3 Baseline

| | |
|---|---|
| Time to collect and compose one full round of responses | **5 people, full-time, ~2 months per annual cycle** `[confirmed]` |
| Error / omission rate | **Unknown** — never measured |
| Time spent on monthly progress tracking | **Unknown** |

> **Do not claim any time-saving or accuracy figure** until it has been measured after real use.

### 2.4 Intended outcomes (observable)

1. One screen answers **what is ready, what is not, and what is blocking it** without asking anyone.
2. **Every statement in the monthly document links back to its source evidence.**
3. Items that are "complete but unsupported" **become visible within a single cycle**, not when the assessor arrives.
4. It is immediately visible **which division has not submitted**, and the people who can act are
   told **before** the deadline rather than after it.
5. Every item names **a responsible person** and shows **how far its milestone plan has actually got** —
   no item is owned by "the division" in the abstract.
6. Leadership can see **where the current rate of progress leads in 3 and 5 years**, with the
   assumptions visible, so the conversation is about the rate rather than about this month's number.

---

## 3. Scope

### 3.1 Required — must be finished and demonstrable `[confirmed]`

| # | Capability | Real / simulated |
|:---:|---|---|
| R1 | Database + seed of the organisation's own internal form **วว.นบ209_2569-14** — **4 categories · 24 items · achieved level, frontier level and % progress within it, last year's level, this year's target level, a named responsible person** — plus milestone plans, slip histories and ~10 evidence documents (deliberate mix of tiers A/B/C/D, one stale, one undated) | **Real** (synthetic data, labelled in-app) |
| R2 | 3 roles + role switcher · **permissions enforced in the backend, not by hiding buttons** | **Real** (mock users) |
| R3 ⭐ | **Chat that receives updates from divisions** — the owner types or drops a file → the agent interprets it → **a confirmation card the human taps** (§5.4.1) · the manual form remains as the fallback when the model is down | **Real** |
| R4 | **Evidence document upload** (PDF/Word/images — no OCR), linked to an item | **Real** |
| R5 | Roll-up (milestone → item → category → organisation) + planned vs actual + status. **Levels are not averaged into a score** — the organisation figure is the mean achieved level, shown next to last year's, and the **CANSO accreditation figure is computed with the cliff rule** (awarded points stop at the lowest level not fully achieved) | **Real — plain code** |
| R6 ⭐ | **Agent evaluates evidence** — reads an item's documents against its criteria, **assigns tier A–D and states what is missing** (as proposals) | **Real** (§5.4) |
| R7 | **Two separate figures** — work progress vs. evidence-verified — always shown side by side | **Real** |
| R8 | Draft the response from **confirmed** evidence, flag insufficient evidence | **Real** (model call) |
| R9 | Human review → confirm / **return with a reason → revise → resubmit** → executive approval | **Real** |
| R10 | **Executive dashboard** — summary strip + per-category grid · **each row states its own problem inline** rather than a separate "needs a decision" panel (§11.2.1 D20) | **Real** |
| R11 | **Monthly Word + PDF document** per the form template + **remarks register** + a citation on every statement | **Real** |
| R12 | Data survives a backend restart | **Real** |
| R13 | Thresholds live in an `app_setting` table — **no hardcoding** | **Real** |
| R15 ⭐ | **Alerting** — code raises: near-deadline (lead time from `app_setting`) · overdue · **milestone past its planned date** · **repeated slip, escalating on the 3rd** → **to the moderator**; missing evidence · undated document · stale document → **to the item owner**. Every alert cites the item it came from. **Moved back up from Optional O1** (§11.2.1 D11) | **Real — plain code** (§5.4.2) |
| R16 | **Responsible person + milestone timeline on every home-screen row**, clickable through to that item's full timeline, actual dates and slip history | **Real** |
| R17 ⭐ | **Suggestion column on "my work"** — one recommendation per item: complete / nearly there / on plan / needs fixing / information requested / escalate, each with the reason it fired | **Real** (§5.1 — see the honesty note there) |
| R18 | **3-year / 5-year level projection** under three scenarios, **with the formula, the assumptions and what is not modelled printed on the page** (§5.7) | **Real — plain code** |
| R14 | `verify.py` — cases AC-01 … AC-26 | **Real** |

### 3.2 Optional — if time remains

~~O1~~ · ~~Non-submitting-division detection + Outbox drafts~~ — **promoted back to Required as R15**
on 15 Sep, once the alert engine was built and logic-tested (§8.1 · §11.2.1 D11)
O2 · Q&A chatbot for executives (read-only, answers with citations)
O3 · Historical planned-vs-actual chart
O4 · Agent check for inconsistencies across items
O5 · Per-category projection charts rather than the single organisation-level line
O6 · Real notification delivery — **only after a channel is approved**, and never from a workshop build

### 3.3 Out of scope — with reasons `[confirmed]`

| Not doing | Because |
|---|---|
| **Automated Excel/CSV import** | Replaced by manual entry — the parsing/validation time goes into the agent instead, which is the point of the brief |
| **Environmental metrics (kWh, vehicle counts)** | Deferred to a later round — this round focuses on evidence and responses |
| Real email / LINE / Teams delivery | The system can draft; sending requires a human — a workshop must not fire real messages at real people |
| Real SSO / AD | Restricted · replaced by a role switcher with permissions genuinely enforced in the backend |
| Integration with existing systems (SharePoint, HR) | No access within this timeframe |
| **CO₂ / fuel-saving calculation per the GHG Protocol** | **No defensible emission factor available** — an environmental figure with no source is riskier than showing none |
| OCR of scanned documents / photos | Outside the available time — recorded explicitly as a known limitation |
| Cloud deployment | The model endpoint is an internal IP; **the backend must run on the same network** |
| RAG / vector database | This volume of data fits directly in context — added complexity that solves nothing here |
| **Declaring "we passed the assessment"** | **Nobody in the system holds that authority** — it belongs to the assessor. The system only reports whether the evidence is ready |

---

## 4. Workflow, screens and visual design

### 4.1 One complete cycle

| # | Actor | Input | Action | Output | Exception |
|:---:|---|---|---|---|---|
| 1 | **Assistant agent** | Role + current cycle | Open chat → show the **"due this cycle" card** with deadlines | Task list in chat | Nothing outstanding → say so plainly, not a blank page · model down → fall back to the form |
| 2a | Data owner | A message such as *"update 3.1 to 60%"* | Type it in chat | — | — |
| 2b | **Assistant agent** ⭐ | The message + that division's items | Interpret into `draft_progress(...)` → **render a confirmation card** showing old → new | A **pending** row only | **Ambiguous (e.g. "nearly done") → ask back; never guess, never render a card** · refers to another division's item → refuse |
| 2c | Data owner | The confirmation card | **Tap confirm** (or edit the value first) | Real value committed + `audit_log` with **actor = the user** | Value outside 0–100 / invalid date → flag it on the card, **nothing saved** · never tapped → nothing changes (AC-17) |
| 3 | Data owner | Evidence file | Drop a file into chat, linked to an item | `evidence` row, status "awaiting evaluation" | Unsupported type / oversized → reject with a reason · **no date inside the document → show the date card; never infer from the upload date** |
| 4 | **Code** | Committed data | Roll up milestone → item → category → organisation, compute planned vs actual, status, and the CANSO accreditation figure with the cliff rule | `progress` · `level` · `status` | Achieved level above the frontier level, or % progress outside 0–100 → refuse to save |
| 5 | **Agent** ⭐ | The item + its criteria + all of its documents | Read them one by one against the criteria, **assign tier A–D with a reason, and list what is still missing** | Proposals, status **pending** | Tool-call ceiling hit → report the evaluation as incomplete · malformed JSON twice → "evaluation failed", a human tiers it manually |
| 6 | Central team | Proposals + documents | Confirm the tier, or override it with a reason | `confirmed_at` → **counts toward the Verified figure** | No action → stays "awaiting review" |
| 7 | **Model** | **Confirmed** evidence + criteria | Draft a response citing the evidence · flag "insufficient" and state what is missing | `response`, status **draft** | No tier A/B evidence at all → **do not draft**; report that evidence must be collected first |
| 8 | Central team | Draft response | Review, edit, submit for approval | Status "awaiting approval" | — |
| 9 | Executive | Response + evidence | Approve **or return with a reason** | Approved / back to step 8 | — |
| 10 | **Code** | Everything approved | Assemble the monthly Word/PDF **plus the remarks register** | Exported file | **A statement with no citation → export fails, raise an error** |
| 11 | **Code** ⭐ | Due dates, milestone plans, slip history, evidence state | **Raise alerts and route them** — deadline / milestone / repeated slip → **moderator** · evidence gaps → **item owner** — then draft each into the Outbox | `alert` rows + Outbox drafts | Nothing to raise → say so, do not manufacture an alert · **an alert that cannot name its source item is a bug, not a warning** |
| 12 | Central team | Outbox | Review each draft and **send it themselves** | Sent, recorded against the alert | **The prototype never sends anything by itself** (§3.3) |
| 13 | **Code** | Levels this year vs last year per item | Project 3 and 5 years ahead under three scenarios, **and print the assumptions next to the result** | Projection table | Velocity ≤ 0 → **project no growth**; never round a stalled item upward (§5.7) |

> **Steps 2a–2c are where the rule lives** — the agent stops at the card; **the write is the human's tap.**
> `audit_log.actor` must always be a user id, **never `ai`** (§5.5 · AC-18)
>
> **Steps 11–13 contain no model call at all.** Alerts and projections are arithmetic over dates and
> levels; putting a model anywhere near them would make them unauditable for no gain (§5.1).

### 4.2 The core rule — three columns that must never merge

```
   Work progress          Evidence              Verification
   (owner enters)         (agent tiers)         (human confirms)
   ─────────────          ─────────────         ─────────────
   item 4.1               0 documents           not confirmed
   Level 1 → 2, 100%          nothing countable      verified level 1

   ▲ this number can never push the right-hand one up ──────┘
```

> **The system never converts % complete into a level** — this is acceptance case **AC-01**.
> In the current sample set **six items report 100% of their next level's work done** (2.9, 2.11, 2.12,
> 4.1, 4.3, 4.4) and **every one of them has zero evidence attached.** That is not a flaw in the sample
> data; it is the exact condition the three columns exist to keep visible.

### 4.3 Screens `[proposed — 6 of the 8 exist as a static mockup: `dashboard.html`]`

```text
Shared layout
  Header : product name | role switcher [Data owner ▾ / Central team / Executive]
           | 🔔 alerts | a persistent "Synthetic sample data (mockup)" banner that cannot be dismissed
  Sidebar: Home / Chat with the assistant / My work / Item detail / Alerts & Outbox
           / Review centre / Trend & projection / Monthly document

1) Home — overview by category (landing screen)
   Row 1: Summary strip — items · mean level (vs last year) · not moved · not submitted ·
            alerts to you · Level (1–5) distribution bar
   Row 2: Items grouped by the 4 categories of วว.นบ209_2569-14, one grid row each:
            code | name | RESPONSIBLE PERSON | milestone strip | current level | last year | TARGET | projection
          ⭐ the item code is a link → screen 4, preselected to that item
          ⭐ the target cell is five clickable level buttons (central team + executive)
          · a note line appears under a row only when that row has a problem
            (3rd slip · target met with no evidence · not submitted)
   Row 3: <details> "how to read this table" — collapsed by default

2) Chat with the assistant (data owner)  ← the primary screen for this role
   Top    : division · current cycle · small link "use the form instead" (fallback when the model is down)
   Middle : conversation + four card types
              (1) Due this cycle       — items + deadlines + anything returned, with its reason
              (2) Confirm progress     — 3.1 · M2 · 40% → 60% · date  [Confirm] [Edit]
              (3) Evidence result      — proposed tier + reason + "what is still missing"  [Attach more]
              (4) Ask for document date — when document_date cannot be extracted (AC-03)
   Bottom : message box + attach button (drag and drop)
   ⚠ Card (2) is where the agent stops — the real value changes only when a human taps

3) My work (data owner)
   Items for this division only · code | name | level now → target | due | milestones
   ⭐ SUGGESTION column — one recommendation per item, with the reason it fired:
        ✓ complete · ◗ nearly there · — on plan · ⚠ needs fixing · ? information requested · ⛔ escalate
      A legend under the table states the rule behind each verdict — the column is never a bare label.
      An item that has slipped ≥ 3 times shows the escalation line even when another problem
      also applies, so a harder diagnosis cannot bury it.

4) Item detail  ← the most important screen
   Top    : ⭐ ITEM DROPDOWN, grouped by category — any of the 24 items can be opened here.
            (The team's earlier standalone dashboard was hardcoded to a single item; this replaces it.)
   Left   : achieved level, frontier level, % within it · milestones (editable) + actual dates
   Centre : attached evidence + the agent's proposed tier A/B/C/D + reason + confirm/override
   Right  : ✅ "what is still missing" as a checklist
   Bottom : FULL TIMELINE — every milestone with planned date, actual date, % and a late flag
            + SLIP HISTORY — each reschedule with its stated reason, so a repeated reason is obvious

5) Alerts & Outbox
   Left   : the alert list, most severe first · each one names its item and why it fired
            routing is visible: ⛔/⚠ to owner+moderator · ? to owner only
   Right  : Outbox — the drafted message for each alert + a send button
   ⚠️ Nothing is sent by the system. A human presses send. There is no send-all.

6) Review centre (central team)
   Tab A "Evidence awaiting confirmation" : agent proposals → confirm / override with a reason
   Tab B "Draft responses"                : "insufficient" badge where relevant → edit → submit
   Tab C "Not submitted"                  : by division + days to/past due → [draft a message]

7) Trend & projection
   Three scenarios × 0 / 1 / 3 / 5 years — same rate · 50% faster · stalled
   Per-item projection table + a callout listing the items whose level has not moved since last year
   ⚠️ Banner: "a projection, not a commitment" · an assumptions block states the formula
      and names what is NOT modelled (§5.7)

8) Monthly document
   Response list + status (draft / awaiting approval / approved / returned)
   Buttons [Export Word] [Export PDF]
   ⚠️ End of document: remarks register — items with no supporting evidence. Never hidden.
```

> The static mockup `dashboard.html` shows 6 of these 8 — screens 1, 3, 4, 5, 6 and 7 — with the synthetic sample set
> and a working alert engine and projection. **It is a mockup, not the application** — no backend,
> no database, no permissions, and its Suggestion text comes from code rules, not a model (§5.1).

### 4.3.1 Users and what each role's screens contain `[confirmed — built in the mockup]`

Three roles, **five demo users**. The role switcher is a *user* switcher: switching identity changes
the data in view, not only the buttons. Users are **position titles only — no invented personal names.**

| User | Role | Sees | Alerts received | Screens |
|---|---|---|:---:|---|
| Head of Environmental Policy · **Policy & Planning Bureau** | data owner | **4 items** (category 1) | 2 | home · my work · item · alerts |
| Head of Airspace Management · **ATC Operations Division** | data owner | **12 items** (category 2) | 14 | home · my work · item · alerts |
| Head of Energy & Utilities · **Engineering & Maintenance Division** | data owner | **4 items** (category 3) | 6 | home · my work · item · alerts |
| **GreenATM system moderator** (central team) | moderator | all 24 | **8** | home · item · alerts · review centre · trend |
| **Senior executive** accountable for GreenATM | management | all 24 | **0** | home · item · trend |

**What each role can and cannot do — shown in the sidebar, not just enforced**

| | data owner | moderator | management |
|---|---|---|---|
| **Can** | enter progress and attach evidence **for their own division only** · see the agent Suggestion for their items · receive evidence alerts for their items | confirm or override an evidence tier with a reason — **the Verified figure moves from here and nowhere else** · see every item and who has not submitted · receive deadline, milestone and repeat-slip alerts · review Outbox drafts and press send | see the organisation overview, levels vs last year, and the 3–5 year projection · open any item's detail and timeline · set the year's target levels · approve or return the monthly response |
| **Cannot** | confirm an evidence tier · edit another division's item (**403**) · set target levels · send messages to other divisions | set On Track / At Risk (**code computes it**) · approve the monthly response · declare the assessment passed | edit any division's progress or evidence · confirm a tier · **receive per-item alerts** |

**Three deliberate choices in this split**

1. **A data owner sees the whole organisation but can only edit their own slice.** Hiding other
   divisions would make the dashboard useless for context; the boundary belongs on *write*, not read.
   Opening another division's item shows a **403 panel** stating that the backend rejects a direct
   request too — **permission is not a hidden button** (AC-13, AC-20, AC-27).
2. **Management receives no per-item alerts at all.** A channel that forwards everything to everyone
   is ignored within a week. Executives read the overview and the trend; they are not paged (AC-28).
3. **Category 4 (Corporate Communications) has no data-owner user in the demo, on purpose.**
   Its 4 items are visible to the moderator only, and **5 owner-directed alerts about them reach
   nobody.** An item with no owner in the system is an item nobody will update — better to show that
   gap on screen than to paper over it with a placeholder user. **Q8 asks who those 4 items belong to.**

### 4.4 Visual design `[proposed — awaiting confirmation]`

- **Device / language:** laptop-first (1440×900, down to 1024) · executive view readable on a phone · Thai UI with English technical terms · **exported documents in English per the form template**
- **Evidence tiers use symbols, not colour alone:** A ◆ / B ◇ / C ○ / D ✕ · Suggestion verdicts likewise carry a glyph (✓ ◗ — ⚠ ? ⛔), never colour alone
- **Status colours are reserved** (good / warning / serious / critical) and are never reused as chart series colours · the ordinal level ramp is a single hue, light → dark, never a rainbow
- **Contrast ≥ 4.5:1** · table text no smaller than 14px · tabular figures in table columns
- **Every state must be designed:** empty · loading · **agent evaluating (with a cancel button)** · success · missing/invalid input · **model failure** · awaiting review · returned with a reason · approved
- **Never:** hero banners · heavy gradients · **any figure not drawn from the database** · a chat box with no role in the workflow · **a dual-axis chart** · **a projected figure shown without its assumptions beside it**
- **No external CDN.** Every asset is local so the build opens on a closed network — verified by test (§8.1)
- ⚠️ **No organisational palette or logo has been supplied** `[open question]` — using a plain green/grey theme meanwhile

---

## 5. AI behavior and boundaries

### 5.1 What is code, what is a model call, what is an agent

| Task | What it actually is |
|---|---|
| Level roll-ups · planned vs actual · overdue days · the CANSO cliff rule · permissions · form validation · audit log · document assembly | ❌ **Plain code** — more accurate and auditable |
| **Alerting** — which deadline is near, which milestone is late, which item has slipped three times, who each alert goes to | ❌ **Plain code** (§5.4.2) — these are date comparisons and counts. A model here would be slower, unauditable, and occasionally wrong about arithmetic |
| **The 3- and 5-year projection** | ❌ **Plain code** (§5.7) — one published formula over two known numbers. **A model must never produce a forecast figure** |
| Draft a response from confirmed evidence, following the form's structure | 🔶 **A fixed workflow with AI steps** — code controls the sequence |
| **Judging whether an item's evidence is sufficient** — requires reading several documents, comparing them against criteria, deciding sufficient/insufficient, and choosing what to read next | ✅ **A real agent** (§5.4) |
| **Receiving updates from divisions via chat** — working out which item, which milestone and what value the user means · must look up that division's items first · must ask back when unclear | ✅ **A second real agent** (§5.4.1) |

| **The Suggestion column** (R17) | 🔶 **Today: plain code.** In the mockup, the verdict and its text come from an ordered rule set over evidence tiers, slip count, % progress and target — **not from a model.** In the application the *wording* is drafted by the agent in §5.4 from the gaps it found, while **which verdict fires stays in code** |

> **The spine of this system:** *every number comes from code, never from the model, and every number
> traces back to its source.* The agent decides **whether the evidence is sufficient** — never **what the score is**.
>
> ⚠️ **Do not call the Suggestion column "AI" on a slide while it is still rule-based.** It is a good
> column either way; describing it as something it is not is the one thing a reviewer will catch.

### 5.2 What the model must not do — enforced by tool absence

```
These functions do not exist anywhere in the codebase:
   confirm_tier · confirm_completion · set_status
   send_notification · approve_response · export_final · edit_plan · delete_*
   write_progress · commit_update          ← added when the chat was introduced (§5.4.1)
   set_level · set_target · raise_alert · send_alert · set_forecast · override_projection
                                           ← added at rev 2.3 · alerts and projections are code (§5.4.2, §5.7)
```

> A prohibition in a prompt cannot be demonstrated to a reviewer. **Code that simply lacks the
> function can be shown by opening the file.**

### 5.3 Stopping conditions

- **No tier A or B evidence at all → no response is drafted** and readiness does not move (not a low score — no score).
- Insufficient information → **stop and list what would make it sufficient**, not a bare refusal.
- Unreadable document / no date inside it → **ask; never infer from the upload date**.
- Nothing in the system → say so. **Never invent a figure or a name.**
- **A chat instruction that cannot be read confidently → ask back; never guess a value** (e.g. "nearly done" → ask what percentage).
- Malformed JSON twice in a row → stop, record the failure, **show it on screen truthfully**.
- ⚠️ Small local models choose tools far worse than large ones → **keep the loop shallow, the tool list short, and the boundaries in code**
  · **the two agents in §5.4 and §5.4.1 must have separate tool sets; never merge them into one.**

### 5.4 Agent one — evidence evaluation ⭐

| Aspect | Value |
|---|---|
| **Goal** | Answer *"is this item's evidence sufficient for its criteria, and if not, what is missing?"* |
| **State** | The item under evaluation · its criteria · documents already read · interim conclusions |
| **Read-only tools** | `get_item(item_id)` → name, criteria, achieved/target level, status<br>`list_evidence(item_id)` → documents + metadata<br>`read_evidence(evidence_id)` → extracted text (truncated at N characters)<br>`get_previous_review(item_id)` → last cycle's outcome and reasoning |
| **Write tools** | `propose_tier(evidence_id, tier, reason)` → writes to a **pending** table<br>`propose_gap(item_id, missing[])` → writes to a **pending** table |
| **Must not exist** | Writing/editing real data · self-confirmation · sending messages · changing levels, targets or status · raising an alert · export |
| **Limits** | **No more than 10 tool calls per item · 60 seconds** · one item at a time; it may not roam across items |
| **Stopping** | A conclusion covering every criterion for that item, **or** the ceiling is hit — in which case it reports the evaluation as incomplete rather than guessing to finish |
| **Human checkpoint** | The central team confirms every proposal before it takes effect — `propose_*` changes no figure until confirmed |

**Implementation — two routes, decided by TF6** `[proposed]`

| | Condition | Method |
|---|---|---|
| **Primary** | TF6 passes — the endpoint returns real `tool_calls` | Native tool calling · validate arguments before every execution · feed results back to the model |
| **Fallback** | TF6 fails | **A JSON action-selection loop validated against a schema in code** — the model returns `{"action":"read_evidence","args":{...}}` → code validates → executes → feeds the result back into the loop |

> The fallback **is still an agent by definition** (the model chooses among permitted actions based on
> observed results, within enforced limits) — it simply does not depend on the native tool-calling API.
> **If the fallback is used, say so plainly on the slide; never claim native tool calling was used.**
>
> ✅ **TF6 passed (§8) → the primary route is in use.** The fallback stays documented in case the endpoint changes.

### 5.4.1 Agent two — the division's submission assistant ⭐

Lives on the data owner's screen (§4.3 screen 2) · **a separate tool set from §5.4**, per the warning in §5.3.

| Aspect | Value |
|---|---|
| **Goal** | Help a data owner submit progress and evidence completely, and **say immediately what is still missing** — shrinking the feedback loop from days to seconds |
| **State** | The user's division · current cycle · outstanding items · earlier turns in the conversation |
| **Read-only tools** | `list_my_items()` → the division's items, deadlines, status<br>`get_item(item_id)` → milestones and current values<br>`get_gaps(item_id)` → the "what is missing" list produced by §5.4<br>`list_evidence(item_id)` → attached documents and tiers |
| **Write tools (pending only)** | `draft_progress(item_id, milestone_seq, percent, actual_date)` → **renders a confirmation card**<br>`request_evidence_date(evidence_id)` → renders the date card (AC-03) |
| **Must not exist** | `write_progress` · `commit_update` · any real write · confirming an evidence tier · touching another division's items · sending messages · export |
| **Limits** | **No more than 6 tool calls per user message** · may share `app_setting.agent_max_tool_calls` |
| **Stopping** | Render a card **or** ask back when interpretation is uncertain — **never guess a value to finish** |
| **Human checkpoint** | **The data owner taps confirm** · `draft_progress` changes no real value until then (AC-17) |

```
type / drop a file  →  agent interprets  →  card shows what will change  →  human taps  →  code writes
                                             ▲                              ▲
                          the agent stops here ┘        the write is the human's act ┘  audit_log.actor = user
```

> **Why a card instead of letting the agent write directly** — §5.5 states the AI cannot enter progress.
> The card also lets the user see what the model understood **before** it takes effect, which guards
> against misreading Thai phrasing. And if the model is down, the original form still works (AC-12).

### 5.4.2 The alert engine — deliberately not an agent ⭐

Required as **R15**. **No model is involved.** Each rule is a date comparison or a count, so every
alert can be re-derived from the database and explained without replaying a model call.

| Rule | Fires when | Verb | Goes to |
|---|---|:---:|---|
| `A-DUESOON` | Not submitted and the due date is within `alert_lead_days` | **NOTE** | owner **+ moderator** |
| `A-OVERDUE` | Not submitted and the due date has passed | **ESCALATE** | owner **+ moderator** |
| `A-MILESTONE` | A milestone's planned date has passed and it is below 100% | **ASK** | owner **+ moderator** |
| `A-SLIP` | The plan has been rescheduled · 1st = NOTE, 2nd = ASK, **3rd = ESCALATE** (`slip_escalate_after`) | NOTE → ASK → **ESCALATE** | owner · **+ moderator from the 2nd** |
| `A-NOEV` | The item has no evidence attached at all | **ASK** | owner only |
| `A-NODATE` | A document carries no internal date | **ASK** | owner only |
| `A-STALE` | A document is older than `evidence_stale_months` | **ASK** | owner only |

**Rules that hold regardless of the data**

1. **Escalation is by repeat count, not by severity guesswork** — NOTE → ASK → ESCALATE. A first slip
   does not reach the moderator; a third one always does.
2. **The moderator receives strictly less than the owner.** An alert channel that forwards everything
   to everyone is ignored within a week. Verified by test: 8 to the moderator, 27 to the owner (§8.1).
3. **Nothing routes directly to an executive.** Executives read the dashboard; they are not paged.
4. **Every alert names its item and states why it fired.** An alert that cannot cite its source is
   treated as a defect, not as a warning to tolerate.
5. **The system drafts; a human sends** (§3.3). There is no send-all button, and no real
   email/LINE/Teams delivery from this build.
6. **Thresholds live in `app_setting`** — `alert_lead_days`, `slip_escalate_after`,
   `evidence_stale_months` — and are changeable without a code change (AC-11).

> ⚠️ **A lead time that nobody reads is the same as no alert.** `alert_lead_days` was present in the
> settings table from rev 2.2 onward but **no code read it**, so the four unsubmitted items — all due
> in five days — produced no notification at all. The logic test in §8.1 is what caught it.

### 5.5 Authority table

| Action | AI | Data owner | Central team | Executive |
|---|:---:|:---:|:---:|:---:|
| Propose a tier / list gaps / draft a response | ✅ | 💬 may object | ✅ | ❌ |
| Enter progress / attach evidence for own division | ✏️ **drafts a card** | ✅ *(taps confirm)* | ✅ | ❌ |
| **Confirm an evidence tier → counts toward Verified** | ❌ | ❌ | ✅ | ❌ |
| Edit another division's data | ❌ | ❌ | ✅ *(logged + owner notified)* | ❌ |
| **Set thresholds (`app_setting`)** | ❌ | ❌ | ✅ *(always logged)* | ❌ |
| **Change status On Track / At Risk / Delayed** | ❌ | ❌ | ❌ | ❌ ← **computed by code; nobody sets it** |
| **Raise an alert / decide who it goes to** | ❌ | ❌ | ❌ | ❌ ← **code decides from the rules in §5.4.2** |
| **Produce a 3-/5-year projection figure** | ❌ | ❌ | ❌ | ❌ ← **code, from the published formula in §5.7** |
| **Set an item's achieved level** | ❌ | 💬 may propose | ✅ *(on confirmed evidence, logged)* | ❌ |
| **Set an item's target level for the year** | ❌ | 💬 may object | ✅ *(always logged)* | ✅ |
| Draft a notification | ✅ | ❌ | ✅ | ❌ |
| **Send a message** | ❌ | ❌ | ✅ | ❌ |
| Return something with a reason | ❌ | ❌ | ✅ | ✅ |
| **Approve a response / trigger the real document** | ❌ | ❌ | ❌ | ✅ |
| **Declare the assessment passed** | ❌ | ❌ | ❌ | ❌ ← **nobody in the system holds this authority** |

> **✏️ drafts a card ≠ may write** — the agent in §5.4.1 interprets the instruction and renders a card,
> but the real value changes only when a human taps. The `audit_log.actor` for that change must always
> be a **user id, never `ai`** (AC-18).

### 5.6 Citation rules for the monthly document

| Case | What the document must say |
|---|---|
| Tier A/B evidence exists | The statement + **a citation `[E-014 p.3]`** that opens the source |
| Only tier C (draft/plan) | Phrase it as *"in progress"* + citation + **a note that it is not yet counted** |
| **No evidence at all (tier D)** | 🔴 **Never silently skipped** — it must appear in the remarks register with its owner and last update date |
| A statement the AI composed itself | Tag it **`[synthesised from E-003, E-011]`** — never a free-floating sentence |
| **A statement with no citation** | **Export fails — raise an error**, not a warning that is then ignored (AC-10) |

> **Every document carries a "remarks register" at the end.** What has no evidence is the easiest
> thing to disappear from a report — **forcing it to appear is this system's core value.**

### 5.7 Projection rules — a projection, not a commitment ⭐

Required as **R18**. **Plain code, one published formula, no model call.**

```
projected_level(item, years) = min( 5,
      achieved_level
    + percent_within_next_level / 100
    + max(0, velocity) × years )

velocity = (achieved_level − last_year_level) + percent_within_next_level / 100
```

| Scenario shown | Multiplier on velocity |
|---|---|
| Same rate as the past year | × 1.0 |
| 50% faster | × 1.5 |
| Stalled | × 0 |

**Rules that hold regardless of the data**

1. **`max(0, velocity)`** — an item that went backwards is never projected to recover on its own.
2. **Capped at Level 5** — the scale has a ceiling and the projection must respect it.
3. **A stalled item projects to exactly where it is.** No rounding an item upward because the
   organisation average is rising.
4. **The assumptions block is not optional.** The formula, the scenarios, and **what is not modelled**
   appear on the same screen as the number.
5. **The words "a projection, not a commitment" appear on the screen**, not only in this document.

**What this projection does not model — stated on the page, not buried here**

- Budget and headcount changes, and whether the funding behind this year's rate continues
- **That higher levels are harder.** A straight line through Levels 1–2 will overstate Levels 4–5
- Changes to the CANSO criteria or to the internal form itself
- Dependencies between items, and the cliff rule's effect on the accreditation figure
- One year of history is **one** data point of velocity. It is the weakest part of the whole model

> ⚠️ **The honest headline from the current sample set is not the projection — it is that
> 19 of 24 items have not moved a level since last year.** The projection is the consequence;
> the stall is the finding. Lead with the stall.

---

## 6. Data and storage

### 6.1 Source inventory

| Source | Format | How it enters | Status | Agreed fallback |
|---|---|---|---|---|
| **Internal form วว.นบ209_2569-14** — 4 categories, 24 items, Level 1–5 per item | the organisation's own form | Seed script, loaded at startup | **available** — the form is real; **the levels, targets and owners in it are synthetic** | Already the fallback — labelled in-app on every screen |
| **CANSO GreenATM public model** — 3 categories, 20 topics, 100 points, 5 levels, the cliff rule | published PDFs in the project folder | Parsed by `tools/build_sample_data.py` (`pdftotext -layout -enc UTF-8`) | **available** (public document) | — |
| Responsible person per item | — | Seed | **available** — **position titles only, no invented personal names** | Real names are assigned by the organisation, not by this prototype |
| Milestone plans + slip histories | — | Seed + entry | **available** (synthetic) | Two items carry a deliberate third slip (§6.2) |
| 13 sample evidence documents | .md / .pdf | Seed + upload | **available** (synthetic) | Defects deliberately built in (§6.2) |
| **Target level per item for this year** | — | Set by the central team | **missing for real** | Synthetic targets in use · **Q5 must be answered before any real use** |
| Response form template | .docx | Imported as seed | **available** | — |
| Real monthly progress from divisions | — | Manual entry form | **missing** | Entered from the sample set |
| Level objectives behind each CANSO topic | published PDFs | Parsed at seed time | **available** | — |
| Flight data / emission factors | — | — | **missing** | **CO₂ calculation removed from scope** |
| SharePoint / AD / SSO / SMTP | — | — | **restricted** | Role switcher · Outbox in the database, nothing sent |
| Model endpoint | HTTP | Backend call | ✅ **available · tested** | DGX `10.0.63.215` · no auth · TF1–TF8 all passed (§8) |

> **Sending data to the model:** everything is synthetic and self-authored. **No real organisational
> data is involved**, so it may be sent to the workshop endpoint — which closes that risk entirely.

### 6.2 Sample data — build the defects before writing the code

Item codes follow **วว.นบ209_2569-14**. The rev-2.2 codes (A-02, A-05 …) are retired; the mapping is
given so the acceptance tests stay traceable.

| Item | Was | Level now → target | Intended tiers | Hidden issue | Test |
|---|---|---|---|---|---|
| **4.1** Sustainable procurement | A-02 | 1 → 2, **100% of the level reported done** | — | **The next level's work is reported 100% complete with zero evidence attached** | **AC-01** ⭐ |
| **2.7** Continuous descent operations | A-03 | 1 → 3 | A, A, C | Signed measurement reports — the successful path | AC-04 |
| **3.1** Energy management | A-08 | 1 → 3 | A, B | Tier-A evidence covers **only part of the scope** it is cited for | AC-08 |
| **3.2** Renewable energy | A-05 | 1 → 2, 20% | C, C | Only evidence is **two "(draft) action plans"** · **third slip, same reason each time** | **AC-02** ⭐, AC-22 |
| **2.10** Trajectory optimization | A-11 | 1 → 3, 57% | **ASK**, B | Document carries **no internal date** · **third slip** · so two problems apply at once | AC-03, **AC-21** ⭐ |
| **1.3** Environmental culture | A-09 | 1 → 2 | **STALE**, C | Document dated **more than 12 months ago** | AC-09 |
| **1.2** Environmental management system | — | 1 → 3, 67% | C | Four milestones planned, evidence is a plan only | AC-02 |
| **2.4** Airport collaborative decision making | A-07 | 3 → 4, **0%** | — | **Velocity zero** — nothing moved since last year, no plan, no evidence | **AC-25** |
| **2.11 · 2.12** ATFM · R&D | — | **5 → 5** | — | **Claim the top level with zero evidence** — see the warning below | **AC-26** ⭐ |
| **17 of 24 items** | — | various | — | **No evidence attached at all** | AC-05, AC-23 |

> **This is the golden set** — build the defects into the data first, then write code that catches
> them. Not tests written to pass whatever code already exists.

> 🔴 **A defect the current mockup does not catch — recorded here rather than hidden.**
> In `dashboard.html` the Suggestion rule set checks *"has this item reached its target level?"*
> **before** it checks *"is there any evidence?"*. Items **2.11** and **2.12** sit at Level 5 with the
> target met and **no evidence whatsoever**, so the column reports **"✓ complete"** on them.
> That is precisely the claims-versus-evidence confusion the whole project exists to prevent, appearing
> in our own code. **AC-26 exists to fail until the rule order is fixed** — evidence must be checked
> before completeness. The fix belongs in the application's rule set, not in the mockup.

**Fields that must never enter model context**

`expected_tier` · `expected_cases` · `_defect` in `sample-data/manifest.json` are the answer key for
`verify.py`. **Sending them to the model would invalidate every acceptance test at once.** The loader
strips them before any prompt is assembled, and `README.md` in that folder repeats the warning.

### 6.3 Entities

```
division(id, name)
app_user(id, name, division_id, role[submitter|central|executive])

assess_category(id, num, name_th, name_en, division_id, owner_user_id)   ← the 4 categories of วว.นบ209

tracked_item(id, code, name, category_id,
             division_id, owner_user_id, criteria_text,
             achieved_level, frontier_level, frontier_percent,     ← 1..5 · 1..5 · 0..100
             last_year_level, target_level,                        ← target set by the central team
             verified_level_cache, status_cache, due_date, updated_at)
             ▲ NO weight column — this form scores by level per item, not by weighted contribution

milestone(id, item_id, seq, name, planned_start, planned_end,
          actual_start, actual_end, percent_complete, status)
milestone_slip(id, item_id, milestone_id, from_date, to_date, reason, by_user, at)
             ▲ a separate row per reschedule — the repeat COUNT is what escalates (§5.4.2)

canso_topic(id, category, num, name, points)                       ← the public model, 20 topics / 100 points
canso_level_objective(topic_id, level, objective_text, points)
             ▲ the accreditation figure is computed from these with the cliff rule; it is NOT
               the mean of achieved_level, and the two must never be presented as the same number

evidence(id, item_id, file_name, stored_path, uploaded_by, upload_date,
         document_date)          ← the date inside the document · may be null → the system asks, never infers
evidence_tier(evidence_id, tier[A|B|C|D], reason, proposed_by[ai|user],
              confirmed_by, confirmed_at)   ← not confirmed = not counted toward Verified
item_gap(id, item_id, missing_text, proposed_by, resolved_at)

response(id, item_id, period, text, status[draft|pending|approved|rejected],
         insufficient_flag, updated_by, updated_at)
response_claim(response_id, seq, text, evidence_ids_json,
               kind[cited|synthesized|remark])   ← no row here means export is impossible
review_log(id, item_id, target[tier|response], action[approve|reject],
           reason, by_user, at)
agent_run(id, item_id, started_at, tool_calls_json, outcome, ended_at)  ← the audit trail

alert(id, rule_id, item_id, severity, verb[NOTE|ASK|ESCALATE],
      to_owner, to_moderator, head, body, fired_at, resolved_at)
      ▲ rule_id + item_id are mandatory — an alert that cannot cite its source item is a defect
outbox(id, alert_id, to_display, subject, body, kind, created_at, approved_by, sent_status)
      ▲ sent_status changes only through a human action; no code path sets it to 'sent'
audit_log(id, actor, action, entity_type, entity_id, before, after, at)  ← append-only
app_setting(key, value, description, updated_by, updated_at)             ← never hardcoded
```

**Level rules** (they replace rev 2.2's weight rules, which no longer apply to this form):

- `achieved_level` ∈ 1…5 · `frontier_level` = the level being worked toward · `frontier_percent` ∈ 0…100.
  **`frontier_percent` reaching 100 does not raise `achieved_level`** — that requires confirmed
  evidence and a central-team action (§5.5 · AC-01).
- ⚠️ **A representation to clean up before M2.** The mockup encodes "the level's work is finished but
  the level is not awarded" as `frontier_level == achieved_level` with `frontier_percent = 100`
  (items 2.9, 2.11, 2.12, 4.1, 4.3, 4.4). Overloading one field with two meanings is how the
  claims-versus-evidence confusion gets back in. **The application should carry an explicit
  `pending_level` instead**, so "done" and "awarded" cannot be read off the same number.
- `target_level` ≥ `achieved_level`. A target below the achieved level cannot be saved.
- **`verified_level_cache` is derived only from confirmed tier A/B evidence** and is cached separately
  from `achieved_level`, so the two figures can never be accidentally merged into one (§4.2).
- The CANSO accreditation figure is computed with the **cliff rule** — awarded points stop at the
  lowest level not fully achieved — and requires ≥ 80/100 at that level **and every level below it**.
  It is never derived by averaging `achieved_level`.
- Every change writes to `audit_log` with before/after values.

**`app_setting` values:** `at_risk_threshold_points` = 30 · `alert_lead_days` = 15 ·
`slip_escalate_after` = 3 · `monthly_due_day` = 5 · `evidence_stale_months` = 12 ·
`agent_max_tool_calls` = 10 · `agent_timeout_seconds` = 60 · `forecast_years` = [1, 3, 5] ·
`forecast_scenarios` = [1.0, 1.5, 0.0] — **all editable from the UI without touching code (AC-11)**.

> ⚠️ **A setting with no reader is worse than a missing setting** — it reads as implemented. Every key
> in this table must be covered by a test that changes it and observes the behaviour change (AC-11,
> AC-24). `alert_lead_days` sat here unread from rev 2.2 until §8.1 caught it.

### 6.4 Storage

A single SQLite file on the backend machine plus a `sample-data/uploads/` folder `[proposed]`.
A handful of users on one machine; no database server to install. For production, move to PostgreSQL
with the same schema. **No vector database** — the data fits directly in context.

---

### 6.5 Where the A/B/C/D evidence tiers come from `[confirmed — must be stated on screen]`

**The four-tier scheme is this team's own screening aid. It is not part of the CANSO criteria.**
CANSO asks for "Point, Evidence, Explain" and states that the Secretariat disregards evidence lacking
page or section references; it does not publish a tier scale.

| Tier | Our working meaning |
|:---:|---|
| **A** | A signed or officially issued document showing a **measured result** |
| **B** | An official document showing a result, unsigned or partially scoped |
| **C** | A plan, a draft, or an intention — **"a plan is not evidence of a result"** |
| **D** | Referenced but not produced, or not relevant to the criterion |
| *STALE* | Otherwise acceptable, but older than `evidence_stale_months` |
| *ASK* | Cannot be tiered until a human supplies the document's date |

> **Say this on screen and on the slide:** the tiers are an internal triage device to decide what to
> collect next. **They are not a CANSO grade and must never be presented as one.** A reviewer who knows
> the CANSO documents will look for this, and claiming the scale is theirs would discredit the rest.
> The one CANSO requirement we adopt directly is the citation rule in §5.6 — page and section
> references on every statement.

---

## 7. Architecture and integrations

```text
  Browser (laptop)
        │  fetch JSON
        ▼
  Backend ── permissions · validation · level rules · all arithmetic · audit log · document assembly
        │                       │
        │ SQLite + uploads      │ Agent loop — code enforces scope, ceilings and argument validation
        │                       │ Alert engine + projection — plain code, no model call (§5.4.2, §5.7)
        │                       ▼
        │              OpenAI-compatible  POST /v1/chat/completions
        │              ENV: LLM_BASE_URL · LLM_MODEL · LLM_API_KEY · LLM_TIMEOUT_MS
        │                       ├─▶ DGX Spark  (primary)
        │                       └─▶ Qwen FPT   (fallback)
        ▼
  sample-data/ — 4 categories · 24 items (วว.นบ209_2569-14) · 20 CANSO topics · 13 documents
```

**Stack** `[proposed]` — chosen to complete one full path in the time available, with the key server-side

| Layer | Choice | Reason |
|---|---|---|
| Frontend + Backend | **Next.js (App Router) + TypeScript** | UI and API in one project · model called from a server route → the key never reaches the browser |
| UI | Tailwind + shadcn/ui | Tables, cards, status chips and forms ready to use |
| Database | SQLite + ORM (`better-sqlite3`) | One file, no server to install |
| Documents | `docx` + a PDF converter | Export following the form template |
| Model calls | `fetch` straight to the OpenAI-compatible endpoint | Both endpoints share one contract; switch via ENV |

**Shared requirements**

- **The API key lives on the backend only** — never in the page, never in logs, never in this document, never in chat or a screenshot.
- Commit only a placeholder `.env.example` · if `LLM_BASE_URL` is empty at startup, fail with a readable configuration error.
- **Must run on the same network as the endpoint — cloud deployment is impossible** (internal IPs).
- Never expose the endpoint's port externally, and never weaken network protection to make a demo work.
- **No external CDN in any page** — every asset is local, so the build opens on a closed network (§8.1).
- **No notification transport is configured in this build at all.** The Outbox writes to the database;
  there is no SMTP, LINE or Teams credential anywhere in the project, which is what makes "it cannot
  send by accident" a verifiable statement rather than a promise.
- **A no-model path is mandatory (AC-12):** with the LLM off, the system must still open, accept entry and uploads, compute, render the dashboard, and **let the central team tier evidence manually**; the agent panel shows its real state.

**Values in actual use** — confirmed by testing on 15 September 2026

| | DGX Spark (primary) | Qwen FPT (fallback) |
|---|---|---|
| Base URL | `http://10.0.63.215:8000/v1` or `…239` | `http://124.197.18.95:8000/v1` |
| Model | `nemotron-3.5-lightning` | `qwen3.8-27b` — **the guide itself states this was copied from notes and is not an official release name** |
| Caution | Thinking is on by default — must send `chat_template_kwargs: {"enable_thinking": false}` | Plain HTTP — **do not send a key or non-public data** until an HTTPS or approved internal route exists |
| Status | ✅ **assigned to the team · no auth · confirmed working** | ⬜ Not used — port · API path · model list · auth all unconfirmed |

---

## 8. Feasibility evidence

> ✅ **Tested for real on 15 September 2026 — all 8 checks passed** · raw output: `tools/endpoint-test-result.md`

| # | What must be proven | Status |
|:---:|---|---|
| TF1 | `GET /health` responds from the backend machine | ✅ **PASS** — `/v1/models` returned HTTP 200 |
| TF2 | `GET /v1/models` lists the alias named in the guide | ✅ **PASS** — found `nemotron-3.5-lightning` (plus alias `lightning`) |
| TF3 | `POST /v1/chat/completions` returns a relevant answer, not merely well-formed JSON | ✅ **PASS** — fed E-005, asked about measurement scope; answered VTBS and 42% correctly · 3.8 s |
| TF4 | The model handles Thai well enough for real use | ✅ **PASS** — answered fully in Thai |
| TF5 | **Given a "(draft) action plan", it returns tier C and refuses to upgrade it** | ✅ **PASS** — fed E-010, returned tier **C**, reason: *"a draft plan not yet approved with no actual implementation"* · 1.9 s |
| TF6 ⭐ | **Real `tool_calls`** — observable tool selection, argument validation, result returned to the model | ✅ **PASS** — returned real `tool_calls`, called `list_evidence({"item_id":"A-02"})`, arguments matched the schema · 0.5 s |
| TF7 | The agent completes one full loop (choose → call → observe → decide) within the 10-call ceiling | ✅ **PASS** — fed the tool result back; the second turn summarised correctly · 0.7 s |
| TF8 | Agent-loop latency is acceptable for a live demo | ✅ **PASS** — measured 0.5–3.8 s per call (measured, not estimated) |

**Consequences** — tested **15 September 2026** · assigned machine: **DGX 10.0.63.215** · **no auth required**

| | |
|---|---|
| **Use the primary route in §5.4** | `tool_calls` works → **the fallback is not needed** |
| **The tier-C ceiling still belongs in the backend** | TF5 passed, but it passed *via the prompt* — the ceiling must live in code per §5.3, not rest on the model behaving correctly every time |
| **Working `.env`** | `LLM_BASE_URL=http://10.0.63.215:8000/v1` · `LLM_MODEL=nemotron-3.5-lightning` · no key |

> ⚠️ **Scope of what was actually proven — do not over-read it**
> TF6/TF7 used **one tool over a two-turn loop**. The real agent in §5.4 has **six tools and a 10-call
> ceiling**. Passing this check **does not guarantee the full loop behaves**, particularly tool *selection*
> when several are offered — that must be proven again in M3 via **AC-06**.
>
> Raw output is in `tools/endpoint-test-result.md` · re-run with `python tools/check_endpoint.py`

> 📌 **The item codes in this section are the rev-2.2 codes** (A-02, A-03, A-05, A-11). The endpoint
> test genuinely ran with those, so the record is left exactly as measured rather than rewritten to
> match rev 2.3. The mapping to the current codes is in §6.2.

**The steps that were run (reproducible)**

1. Ask the facilitator two questions: **which machine is assigned** · **is auth required**.
2. Run TF1 → TF2 → TF3 using a real document from the sample set.
3. **TF5** — feed A-05's "(draft) action plan" → it must return tier C and refuse to upgrade.
4. Feed the undated document (A-11) → it must **ask**, not guess.
5. **Test TF6 separately** — a prompt that mentions a tool is **not** a tool call; real `tool_calls` must be observed.
6. **TF7** — run the full loop against A-03 (should pass) and A-02 (should stop).
7. **Record the real result including the steps that fail** — never present a pre-written answer as a working integration.

> ⚠️ Both integration guides state the same thing: **"do not assume streaming, tool calling or
> JSON-schema output work merely because ordinary chat works."**
>
> **If TF5 fails** (the model upgrades a draft plan) → **move the rule into code, not the prompt**:
> enforce the tier-C ceiling in the backend regardless of what the model proposes.
> **If TF6 fails** → use the fallback route in §5.4 and **state it plainly on the slide**.

### 8.1 Alerting, Suggestion and projection — logic test `dashboard.html`

> ✅ **Run on 15 September 2026 — 30 assertions, all passed.** The test extracts the `alerts()`
> function **out of the built page** and runs it against the seeded data, rather than re-implementing
> the rules in the test file. A test that re-implements the logic it is checking proves only that the
> author was consistent twice.

| Group | Asserted |
|---|---|
| **Deadline → moderator** | Near-deadline fires for all 4 unsubmitted items · reaches the moderator, not only the owner · is a NOTE, not an escalation · **no overdue alert fires while the date has not yet passed** |
| **Milestone / slip → moderator** | Late milestones reach the moderator · a 3rd slip escalates on both affected items · **a 1st slip does not disturb the moderator** |
| **Evidence → owner** | Missing evidence goes to the owner **only** · an undated document asks rather than infers · a stale document is caught |
| **Routing** | Moderator 8 alerts vs owner 27 — **filtering demonstrably works** · **nothing routes to an executive** · every alert cites a real item, head and body |
| **Suggestion** | Every item has one · target met ⇒ complete · no evidence ⇒ needs fixing · **a 3rd slip stays visible even when another diagnosis also applies** |
| **Projection** | Capped at Level 5 · 5-year never below 3-year · **zero velocity grows nothing** · stalled items are highlighted (19 of 24) |
| **Owner / timeline** | Every item names a responsible person and a category owner · every milestone has a planned date · **the late flag is derived from today's date, not hardcoded** |
| **Built page** | Assumptions block present · "a projection, not a commitment" present · SYNTHETIC label present · **no external CDN** · **no API key anywhere in the page** |

**Two real defects the test found, both fixed**

| | Defect | Fix |
|:---:|---|---|
| 1 | **`alert_lead_days` was never read.** The 4 unsubmitted items are due in 5 days, so `overdue > 0` was false and **zero deadline alerts fired** — the "notify deadline" requirement silently did nothing | Added the `A-DUESOON` rule (§5.4.2) |
| 2 | **Item 2.10 has slipped 3 times but its Suggestion read "information requested"**, because the undated-document rule is checked first and the escalation was lost | The escalation line is now appended whenever the slip count reaches the threshold, regardless of which diagnosis fired |

> ⚠️ **What this test does and does not establish.** It proves the **rules** behave as specified over
> the seeded data. It does **not** establish that the application works: there is no backend, no
> database, no permission enforcement and no real delivery in `dashboard.html`. The Suggestion text
> is rule-based code, not a model output (§5.1). Reproduce with `python tools/build_dashboard.py`.

**One defect deliberately left open:** items 2.11 and 2.12 report "✓ complete" at Level 5 with no
evidence at all, because the target check precedes the evidence check. **AC-26 is written to fail
until that rule order is reversed.** See §6.2.

### 8.2 The running application — what it proves, and what it does not

> **Built and tested on 15 September 2026 in `greenatm-app/`** · Next.js 15.5.25 + SQLite
> (`node:sqlite`, no native build) · `npm run typecheck` clean · `npm run build` clean ·
> **`verify:seed` 35/35 · `verify:app` 82/82 · restart test 6/6**

**What now exists**

| Milestone | Delivered |
|---|---|
| **M1** | SQLite schema per §6.3 · seeded from `sample-data/seed.json` · 5 demo users across 3 roles · **permissions enforced in route handlers, not by hiding buttons** |
| **M2** | 6 screens (home · my work · item detail · alerts/Outbox · review centre · trend) · progress entry · evidence upload · paired figures side by side |
| **M5.5** | Alert engine (7 rules, routed) · Outbox drafts a human sends · Suggestion column · 3-/5-year projection with its assumptions on screen · settings editable from the UI |

**Rules now enforced by the database, not only by code**

| Rule | Where |
|---|---|
| `audit_log.actor` can never be `ai` | `CHECK (actor <> 'ai')` **in the schema**, plus a guard in `queries.ts` |
| A confirmed tier must name the human who confirmed it | `CHECK ((confirmed_tier IS NULL) = (confirmed_by IS NULL))` |
| A target below the achieved level cannot be stored | `CHECK (target_level >= achieved_level)` |
| The agent can write to `pending_progress` and nowhere else | No code path lets `ai` write `tracked_item` |
| The real progress value changes in exactly one function | `confirmPending()`, reachable only via `POST /api/pending/[id]` |

**The 82 HTTP tests hit the running server as each user in turn.** They do not import the functions —
an import skips the route's permission check entirely, and the test would then prove nothing about
the thing it claims to test. Coverage: **AC-01 · AC-03 · AC-04 · AC-11 · AC-13 · AC-16 · AC-17 ·
AC-18 · AC-20 · AC-24 · AC-26 · AC-27 · AC-28.**

> **AC-26 now passes** — `rules.ts` checks evidence *before* target, so items 2.11/2.12 (level 5 met,
> zero evidence) report "needs fixing", not "complete". **B4 is cleared.** The defect recorded in §6.2
> was real and is fixed in the application; the static mockup still has it.

**AC-16 was verified by actually restarting the process**, not by asserting it: 16 evidence documents,
a confirmed milestone at 95%, a confirmed tier, 2 sent Outbox rows and an edited setting all survived.

**Two defects found while building this**

| | Defect | Fix |
|:---:|---|---|
| 1 | The schema required `achieved_level BETWEEN 1 AND 5`, but **level 0 is a real state** — item 1.2 was at 0 last year and reached 1 this year. The constraint made genuine progress unrecordable | Range widened to 0-5 with the reason in a comment. **The data was right and the schema was wrong** |
| 2 | A failed seed left the database singleton assigned, so every later request read empty tables and failed with an error pointing at the wrong file — one clear error became six misleading ones | `db()` now closes and rethrows instead of caching a broken connection |

> **What this does NOT prove — state it before someone finds it on stage**
>
> · **`agentLoop.ts` has never run against a live endpoint.** DGX `10.0.63.215` was unreachable from
>   the development machine (different subnet), so **M3 and AC-06 remain unproven**. TF6 was passed
>   earlier from a machine that could reach it, with **one tool over two turns** (§8).
> · **The Suggestion column is rule-based code, not a model** (§5.1). Do not call it AI on a slide.
> · **Nothing is ever delivered.** The Outbox records that a human pressed send; there is no SMTP,
>   LINE or Teams credential anywhere in the project, which is what makes "it cannot send by accident"
>   verifiable rather than a promise.
> · **M5 (monthly Word/PDF + remarks register) and M6' (the submission chat) are not built.**
> · Next.js was upgraded 15.1.6 to 15.5.25 to clear **four CRITICAL advisories**, one of which is
>   *"Unauthenticated Remote Code Execution on windows-hosted servers"* — and the deployment target
>   is Windows. One moderate and one high remain in Next's own pinned `postcss@8.4.31`
>   (build-time, our own CSS); clearing them needs Next 16.

---

## 9. Acceptance tests

| ID | Precondition / input | Expected behaviour | Verification |
|---|---|---|---|
| **AC-01** ⭐ | **4.1**: the next level's work reported 100% done, no tier A/B evidence | **The verified level must not move at all** · both figures shown side by side · the row carries a note stating the problem · **no response drafted** | `verify.py` + on screen |
| **AC-02** ⭐ | **3.2**: only evidence is two "(draft) action plans" | The agent assigns tier **C** · readiness **does not move** · message *"a plan is not evidence of a result"* · **states what evidence is needed instead** | `verify.py` |
| **AC-03** | **2.10**: document carries no internal date | The system **asks for the date** · **never infers it from the upload date** | `verify.py` |
| **AC-04** | **2.7**: attach a signed measurement report | The agent assigns tier **A** with a reason → human confirms → Verified figure moves → response drafted citing that document | On screen across all 3 steps |
| **AC-05** | Ask about an item with no data in the system | Answers that nothing in the system supports it · **invents no figure or name** | Read the answer + check the log |
| **AC-06** ⭐ | Run the agent once over **2.7** | `agent_run` records the real tool-call sequence · **only permitted tools called** · no more than 10 calls · proposals land as **pending** and change no figure | Inspect `agent_run` + compare figures before/after |
| **AC-07** | Set `agent_max_tool_calls` = 2, then evaluate **2.7**, which has 3 documents | The agent **stops at the ceiling** and **reports the evaluation as incomplete** rather than guessing to finish | On screen + `agent_run` |
| **AC-08** | An item claims full coverage while **3.1**'s tier-A evidence covers only part of that scope | Reports the inconsistency **citing evidence on both sides** | `verify.py` |
| **AC-09** | **1.3**: document older than 12 months | Automatically downgraded to **"stale"** and flagged | `verify.py` |
| **AC-10** | A draft response contains a statement with no citation | **Export fails — raises an error**, not a warning that is ignored | `verify.py` |
| **AC-11** | Change `at_risk_threshold_points` from 30 to 10 in settings | Items previously On Track become At Risk immediately, **with no code change and no restart** | Edit, then watch the dashboard |
| **AC-12** | Point `LLM_BASE_URL` at an unreachable endpoint | The system still opens, accepts entry and uploads, computes, renders the dashboard, and **the central team can tier evidence manually** · the agent panel shows a recoverable error · **no fabricated answer** | Cut the endpoint and use it |
| **AC-13** | A Division A user issues a direct request to edit Division B data | Backend returns **403** · no data leaks · logged | Issue the request, inspect the response |
| **AC-14** | An executive returns a response with a reason | Status goes back to the central team · the reason is visible · revise and resubmit completes the loop | Walk the return–revise–resubmit cycle |
| **AC-15** | Everything approved, then generate the monthly document | Word + PDF matching the template · every statement carries a citation · **4.1 and the other 16 evidence-less items appear in the remarks register** | Open the file and compare with the template |
| **AC-16** | Stop and restart the backend | Data, evidence, confirmations, `agent_run` and `audit_log` all intact | Restart for real and compare |
| **AC-17** ⭐ | Type "update 3.1 to 60%" in chat, then **do not tap confirm** | The stored value **does not change** · a pending row only · **no `audit_log` entry yet** | Compare the DB before/after |
| **AC-18** | Tap confirm on the card | The value changes as shown · `audit_log.actor` is a **user id, not `ai`** · before/after recorded | Inspect `audit_log` |
| **AC-19** | Type "nearly done" (no number) | The agent **asks what percentage** · **guesses nothing, renders no card** | Read the reply |
| **AC-20** | An Environment-division user types "update 3.2 to 80%" (an Engineering item) | The agent refuses because it is not their division's item · a direct request returns **403** | Test both via chat and by issuing the request directly |

| **AC-21** ⭐ | **2.10** has both an undated document **and** a 3rd slip | **Both** are surfaced: the Suggestion shows the escalation line even though the date question fired first · two separate alerts exist, routed differently | `verify.py` + read the column |
| **AC-22** | An item is rescheduled a 1st, 2nd and 3rd time | Verb progresses **NOTE → ASK → ESCALATE** · the moderator is **not** notified on the 1st · is notified from the 2nd · `slip_escalate_after` drives the threshold | `verify.py` at each step |
| **AC-23** | Count alert recipients across the whole seeded set | The moderator receives **strictly fewer** alerts than owners do · **no alert routes to an executive** · every alert names its source item | `verify.py` |
| **AC-24** | Change `alert_lead_days` from 15 to 3 | The near-deadline alerts for items due in 5 days **disappear**, with no code change and no restart · changing it back restores them | Edit the setting, watch the alert list |
| **AC-25** | **2.4** has zero velocity and no plan | The 3- and 5-year projection returns **exactly its current level** · it appears in the stalled-items callout · **it is never rounded up toward the organisation trend** | `verify.py` |
| **AC-26** 🔴 | **2.11 / 2.12**: target level met, **zero evidence attached** | The Suggestion must **not** read "complete" · it must report that the level is unsupported by evidence · the verified figure stays below the achieved figure | `verify.py` — **currently FAILS in the mockup by design (§6.2); the rule order must be fixed in the application** |

| **AC-27** ⭐ | Sign in as each of the 3 data owners in turn | Each sees **only their own division's items** on "my work" · the three sets **do not overlap** and total 20 of 24 · opening another division's item shows a 403 panel and **no edit control** · a direct request returns **403** | `verify.py` + switch users |
| **AC-28** | Sign in as management | **Zero per-item alerts** · the alerts screen is not reachable from the menu · **no edit or tier-confirmation control exists on any screen** · the trend screen is reachable | Switch users and count |

> **AC-01, AC-02 and AC-06 are the heart of it** — the first two prove the system genuinely separates
> *claims* from *evidence*; the third proves the agent is a real agent, not a prompt that mentions tools.
> These cases show the system behaves as agreed; **they do not establish production accuracy.**
>
> **AC-26 is listed as failing on purpose.** A plan that only lists tests it passes is not a plan.

---

## 10. Implementation sequence

| M | Work | Done when | Covers |
|:---:|---|---|---|
| **M0** | **Run TF1–TF8** before touching the UI · choose the primary or fallback route in §5.4 | Every row recorded truthfully, including failures | — |
| **M1** ✅ | Project setup + schema §6.3 + seed §6.2 + 3 roles (backend-enforced) | **24 items in 4 categories visible, each with its responsible person** · switching role genuinely prevents editing another division | AC-13 |
| **M2** ✅ | Progress entry form + evidence upload + level engine + status + paired-figure home screen **with the responsible person and milestone strip per row, clickable through to item detail (item dropdown)** | Both figures on screen together · any of the 24 items reachable from the dropdown ⏸ **checkpoint 1** | AC-11 |
| **M3** ⭐ | **Agent loop** (§5.4) — code written, **never run against a live endpoint (B5)** · tools · ceilings · `agent_run` · proposals into pending + human confirmation | **AC-06 still unproven — run it from a machine that reaches the DGX** ⏸ **checkpoint 2** | AC-01 ⭐, AC-02 ⭐, AC-03, AC-04, AC-06 ⭐, AC-07 |
| **M4** | Response drafting + review/return/approve loop | The loop completes end to end | AC-05, AC-14 |
| **M5** | **Monthly Word/PDF + remarks register + citation enforcement** + inconsistency detection + stale documents | The exported file opens and is correct | AC-08, AC-09, AC-10, AC-15 |
| **M5.5** ⭐ | **Alert engine (§5.4.2) + Outbox + Suggestion column + projection (§5.7)** — wiring the rules to the database and the roles, **and fixing the AC-26 rule order** | **DONE (§8.2)** — 82/82 HTTP tests pass · AC-26 included · moderator provably receives fewer alerts than owners | AC-21 ⭐, AC-22, AC-23, AC-24, AC-25, AC-26 |
| **M6′** ⭐ | **The submission chat** (§5.4.1) — ChatShell + agent two + the four cards + the confirmation card | **AC-17, AC-18, AC-19, AC-20 pass** | AC-17 ⭐, AC-18, AC-19, AC-20 |
| ~~M6~~ | ~~Non-submitting divisions + Outbox~~ → **reinstated as part of M5.5** (§11.2.1 D11) once the alert engine was built and tested | — | — |
| **M7** | `verify.py` across all cases + restart test + endpoint-off test + demo rehearsal | ⏸ **checkpoint 3 — ready to pitch** | AC-12, AC-16 |

**Rule:** every milestone ends with something demonstrable · **stop adding features at noon on 16 Sep.**
If time runs short, cut the **projection** first (it is the least load-bearing), then **M6′**, then M4.
**Never cut M3.** Within M5.5, **the AC-26 fix is not cuttable** — shipping a column that says
"complete" about an item with no evidence would contradict the project's own argument on stage.

> **If M6′ does not land** → fall back to the form from M2, which stays in place.
> **Never put a half-working chat on stage** — a form that works beats a chat that breaks mid-demo.

### Three-minute demo outline

```
0:00  "Today this takes 5 people, full-time, 2 months for one assessment cycle.
       The problem isn't that we aren't working — it's that we only learn whether the
       evidence is sufficient at the very end."
0:15  Home screen, our own form วว.นบ209 — 4 categories, 24 items, each with a named
       responsible person and how far its milestone plan actually got
       ⭐ "Mean level 1.83 this year, 1.62 last year. But 19 of the 24 items
          have not moved a single level."                                      (the finding)
0:35  Start from the division's side — open chat → the agent shows the "due this cycle" card
0:50  ⭐ Drop item 3.2's "(draft) action plan" into the chat
       → the agent replies at once: tier C · "a plan is not evidence of a result"
       · and states what evidence it needs instead                             (AC-02, AC-06)
1:15  ⭐ Type "update 3.1 to 60%" → **the confirmation card appears; nothing has changed yet**
       → tap confirm → the left figure moves, **the right one does not**  (AC-17, AC-18, AC-01)
1:35  My work → ⭐ the Suggestion column. Item 2.10: "information requested — needs the document's
       date" AND "slipped 3 times — escalate". Two problems, neither one hiding the other.  (AC-21)
1:55  Alerts → the moderator has 8, the owners have 27, executives have none.
       Click one → the Outbox draft → **"a human presses send. There is no send-all."**  (AC-23)
2:15  Click an item row → its full timeline, actual dates, and the slip history with the
       same reason written three times                                             (AC-22)
2:30  Trend → 3 and 5 years, three scenarios, assumptions on screen
       "This is a projection, not a commitment — and at the current rate we do not get there."
2:45  Cut the endpoint live → chat reports its real state; the fallback form still accepts entry (AC-12)
2:52  Run verify.py → and show AC-26 in the list. "That one fails. We know why, it's written
       in the plan, and it's the next thing we fix."
2:58  Close: "This system never claims we passed the assessment — it says whether the evidence
       is ready to be assessed. And every number comes from code, not from the model."
```

> **Two things must not be said on stage:** that the Suggestion column is AI (it is rule-based code
> today — §5.1), and that the alerting is delivering messages (it drafts; nothing is sent — §5.4.2).

---

## 11. Assumptions, decisions and blockers

### 11.1 Accepted assumptions `[confirmed]`

1. All data is synthetic and self-authored, labelled in-app on every screen.
2. No real email/LINE delivery — drafted, sent by a human.
3. No real login — a role switcher, **but permissions genuinely enforced in the backend**, stated plainly on screen as not being authentication.
4. **Code computes and decides status; the model does not.**
5. Nothing in the system → say so. Never guess, never fabricate.
6. A human must confirm before any AI output takes effect.
7. SQLite locally · key on the backend · ENV configuration · runs on the same network as the endpoint.
8. **Never claim a working model integration before it has been tested** — if a mock is used, declare it on screen.
9. No CO₂ calculation · no OCR · no automated Excel import · no kWh/vehicle metrics.
10. ~20 users maximum · demo on a local machine.
11. **Responsible people are recorded as position titles, not personal names** — the prototype does
    not invent who is accountable for real work.
12. **Alerts are drafted, never delivered.** No notification transport is configured in this build.
13. **Projected figures are projections.** They are never presented as targets, plans or commitments,
    and never appear without their assumptions (§5.7).
14. **The A/B/C/D evidence tiers are ours, not CANSO's** (§6.5), and are labelled as such on screen.

### 11.2 Assistant decisions — confirmation required `[proposed]`

| # | Decision | Reason |
|:---:|---|---|
| D1 | A single `tracked_item` table covering both assessment items and projects | Dashboard, alerts and agent share one code path instead of two systems |
| D2 | **Two separate figures**, work progress and evidence-verified, never merged | The spine of AC-01 and what distinguishes this from an ordinary dashboard |
| ~~D3~~ | ~~The agent fallback is a JSON action-selection loop~~ | **Not used** — TF6 passed, native tool calling works (§8) · fallback retained in §5.4 in case the endpoint changes |
| D4 | Record every agent loop in `agent_run` | Evidence that the agent is real, not a prompt that mentions tools (AC-06) |
| D5 | Next.js + TypeScript + SQLite | Completes one full path in the remaining time, key stays server-side |
| D6 | Agent ceiling of 10 calls / 60 s, stored in `app_setting` | Tunable on the day if latency disappoints · and testable via AC-07 |
| D16 | **Track against the organisation's own form วว.นบ209_2569-14** (4 categories, 24 items, Level 1–5) rather than an invented 12-item weighted model | The team chose this direction on 15 Sep · it is the form people already fill in, so adoption does not depend on anyone learning a new structure · the CANSO model stays as the external target it actually is |
| D17 | **Keep the CANSO cliff-rule figure separate** from the mean achieved level | They answer different questions and averaging them would produce a number that is true of nothing |

### 11.2.1 Required-scope changes made on 15 Sep `[confirmed by the team]` ⚠️

**Flag all of these to the mentor when the plan is sent — not quietly after the review.**
D7–D10 came with the chat (rev 2.2); **D11–D15 came with rev 2.3** and are the larger change.

| # | Change | Reason |
|:---:|---|---|
| **D7** | **The data owner's screen becomes a chat with an agent instead of a form** (R3 · §5.4.1 · M6′) | The "what is missing" output previously sat in the central team's queue and never reached the person who could fix it · chat shrinks the feedback loop from days to seconds and gives the agentic part a real user |
| **D8** | **The chat agent renders a confirmation card; it never writes the value** | Preserves §5.5, which says the AI cannot enter progress · and guards against misread Thai phrasing, since the user sees the value before it takes effect (AC-17, AC-18) |
| ~~**D9**~~ | ~~"Non-submitting divisions + Outbox" moves from Required to Optional O1~~ | **Superseded by D11** — reinstated the same day once the rules proved cheap to build |
| **D10** | **The manual form from M2 stays** and is not replaced | A mandatory fallback when the model is down (AC-12) · and the retreat path if M6′ misses noon on 16 Sep |
| **D11** ⭐ | **"Non-submitting divisions + Outbox" returns from Optional O1 to Required as R15**, widened into a full alert engine: deadline / milestone / repeated slip → moderator · evidence gaps → owner | It was cut at rev 2.2 to fund the chat, but the rules turned out to be date arithmetic rather than agent work, so the cost was far lower than assumed · built and logic-tested the same day (§8.1) |
| **D12** ⭐ | **Item codes move from A-0x to the วว.นบ209 numbering (1.1 … 4.4)** and the `weight` column is removed; scoring is by level per item | This form has no weights · keeping a weights-sum-to-100 rule would have been a rule enforcing a constraint the real form does not have |
| **D13** | **Responsible person + milestone timeline on every home-screen row, with click-through to an item dropdown on the detail screen** | The earlier standalone dashboard was hardcoded to one item, so 23 of 24 items had no detail view at all |
| **D14** | **A Suggestion column on "my work"**, rule-based today, agent-worded later | It puts the "what is missing" output in front of the person who can act on it, which is the same argument that justified the chat in D7 |
| **D15** | **A 3-/5-year projection, printed with its assumptions and the words "a projection, not a commitment"** | Leadership asked where the current rate leads · the assumptions block is the condition on which this was accepted, not decoration — **if it is cut, the projection is cut with it** |
| **D18** ⭐ | **The role switcher becomes a user switcher — 3 data owners (one per division), 1 moderator, 1 management** (§4.3.1) | "Three roles" was not testable: one generic data owner could not show that scoping works. Three real divisions with different problems make the boundary visible, and each role's permissions are now **printed in the sidebar** rather than only enforced |
| **D19** | **Category 4 is left with no data-owner user** | A placeholder user would hide the fact that 4 items have nobody to update them · recorded as **Q8** |
| **D20** | **The home screen drops the "needs a decision" panel and the "items with no owner" banner** — the same facts appear as a note line under the affected row instead | The team's own dashboard has neither panel, and matching its look was the agreed direction · **cost of this:** the count "5 owner-directed alerts reach nobody" is no longer stated anywhere on screen — it is visible only by noticing the "ไม่มีเจ้าของ" tag on 4 rows. Q8 still records it |

### 11.3 Open questions `[open question]`

| # | Question | Default in use |
|:---:|---|---|
| Q1 | The organisation's standard palette / logo | Plain green-grey theme per §4.4 |
| Q2 | Is a 30-point At Risk threshold right for this work? | Using 30 · stored in `app_setting`, editable |
| Q3 | Is the document cycle fixed monthly, or configurable? | Monthly · `period` stored on `response` to allow extension |
| **Q4** | **Who is the "moderator" in the alert routing — the central team collectively, or a named coordinator?** Alerts addressed to a group tend to be read by nobody | Routing to the central-team role · **needs an answer before real use** |
| **Q5** | **What is each item's real target level for FY2570?** Every target in the sample set is synthetic, and the projection is meaningless against an invented target | Synthetic targets, labelled in-app |
| **Q6** | Is one year of history enough to quote a velocity at all? | Using it, with the limitation stated on the page (§5.7) · **two cycles would make it defensible; one does not** |
| **Q7** | Do the A/B/C/D tier names risk being mistaken for a CANSO grade even with the on-screen note? | Keeping the letters plus the note (§6.5) · rename to "screening level 1–4" if a reviewer reads them as CANSO |
| **Q8** | **Who owns the 4 items in category 4 (Corporate Communications)?** They currently have no data-owner user, so 5 alerts about them reach nobody | Left unassigned and **shown as unassigned on screen** (§4.3.1) · **needs a name before real use** |
| **Q9** | Is one moderator user right, or does each category need its own? The ATC owner alone carries 12 of the 24 items and 14 alerts | One moderator · revisit if the queue proves lopsided in use |

### 11.4 Blockers

| # | Blocker | Impact | What must happen |
|:---:|---|---|---|
| ~~**B1**~~ | ~~The endpoint has never been tested~~ | — | ✅ **Cleared 15 Sep 2026** — DGX 10.0.63.215 · no auth · TF1–TF8 all passed · primary route in §5.4 |
| **B2** | The scope may exceed the time remaining | No path finishes completely | Follow the cut order in §10 · **never cut M3** · freeze at noon on 16 Sep |
| **B3** | **`PLAN.md` (Thai) and `FRONTEND.md` are still at rev 2.2** and describe the retired model — 12 weighted items, weights summing to 100, alerting cut to Optional O1 | **A reader of those files will be given the wrong data model and the wrong scope.** `FRONTEND.md` in particular still specifies five screens and no alerting, so it cannot be used to build from | **The team decided on 15 Sep to update this English file only.** That is a deliberate choice, not an oversight — recorded here so it is visible. **Send the mentor this file, and say plainly that the other two are superseded**, or back-port before the review |
| ~~**B4**~~ | ~~AC-26 currently fails~~ | — | **Cleared 15 Sep 2026** — `rules.ts` checks evidence before target; AC-26 passes in the application (§8.2). The static mockup `dashboard.html` still has the defect and is superseded by the app |
| **B5** | **`agentLoop.ts` has never run against a live endpoint** — DGX was unreachable from the development machine | **M3 is the piece that makes this an agentic project, and it is the one piece with no evidence.** §8 TF6 pass used one tool over two turns; the real loop has six tools and a 10-call ceiling | Run `POST /api/llm/tf6` and AC-06 **from a machine that can reach the DGX**, before the pitch · if it fails, say so on the slide rather than describing the fallback as native tool calling |

---

## 12. Mentor review record

| Field | Value |
|---|---|
| Revision reviewed | — |
| Date | — |
| Reviewer | — |
| Feedback | — |
| Outcome | ⬜ Approved ⬜ Approved with conditions ⬜ Changes required |
| Conditions before implementation | — |

> ⏸ **Pause before writing application code** — send this plan to a mentor and return with the
> feedback. **The assistant having written this plan does not constitute approval**, and any
> pre-implementation conditions must be resolved before M1 begins.
