
> **Site-structure note (apcyber.net):** labs are organized in `unit-1/` … `unit-4/` folders by AP unit. The `filename` field in `labs.json` is the basename; find it under its unit folder when doing the /exec URL find-replace.
# INSTRUCTOR_SETUP.md — Network+ (N10-009) / AP Networking Lab Library

One Apps Script web app serves the whole library and routes by `assignmentId`. Set it
up once; adding labs later is a two-line edit. **No student PII is collected** — labs
use a pseudonymous "Callsign" (`handle`); keep any real-name roster separately.

Files referenced here:
- `apps-script.gs` — the single canonical handler (do not fork per-lab).
- `labs.json` — the single manifest (45 labs).
- `ALLOWED_ASSIGNMENTS.txt` — the comma-separated slug list for Script Properties.

---

## One-time setup

### 1. Drive folder + gradebook
1. Create a Drive folder, e.g. **"NetPlus Lab Submissions"**. Open it; copy the ID from
   the URL (`/folders/<THIS_ID>`) → this is `ROOT_FOLDER_ID`. The script creates one
   subfolder per `assignmentId` underneath it automatically.
2. Create a Google Sheet, e.g. **"NetPlus Gradebook"**. Copy its ID from the URL
   (`/d/<THIS_ID>/edit`) → `GRADEBOOK_SHEET_ID`. The header row is written on first
   submission.

### 2. Apps Script project
3. <https://script.google.com> ▸ **New project**. Delete the stub; paste the entire
   contents of **`apps-script.gs`**. Save.

### 3. Script Properties
4. **Project Settings ▸ Script properties ▸ Add script property**, set these four:

   | Property | Value |
   |---|---|
   | `ROOT_FOLDER_ID` | the Drive folder ID from step 1 |
   | `GRADEBOOK_SHEET_ID` | the Sheet ID from step 2 |
   | `SUBMISSION_TOKEN` | a per-cohort secret you choose (must match each lab's `submissionToken`) |
   | `ALLOWED_ASSIGNMENTS` | paste the entire contents of `ALLOWED_ASSIGNMENTS.txt` |

   Optional caps already have safe defaults in the script (`MAX_HANDLE_LEN` 40,
   `MAX_PNG_BYTES` ~3 MB, `MAX_ITEMS` 40).

### 4. Deploy
5. **Deploy ▸ New deployment ▸ Web app.** Set **Execute as: Me**, **Who has access:
   Anyone**. Deploy, and authorize when prompted.
6. Copy the **`/exec` Web app URL**.

### 5. Wire the labs
7. In every lab's HTML, replace the placeholder
   `PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE` with that one `/exec` URL. (All labs ship with
   this exact placeholder, so it's a single find-and-replace across the library.)
8. Set each lab's `submissionToken` to the same value as `SUBMISSION_TOKEN`.

### 6. Smoke test
9. Open any lab, complete it with a test Callsign, submit. Confirm: a styled Doc lands
   in the matching `assignmentId` subfolder, a gradebook row appears (server timestamp,
   Callsign, assignment, both-blueprint objectives, score, Doc link), and the lab shows
   the returned Doc link.

---

## Why "Anyone" is safe here
"Who has access: Anyone" means anyone with the URL can POST — which is why the handler
**validates `SUBMISSION_TOKEN`, rejects unknown `assignmentId`s, and caps handle length
+ PNG size**. Rotate `SUBMISSION_TOKEN` per cohort. The browser sends a **simple
request** (no `Content-Type` header) so no CORS preflight is triggered; the script
replies with JSON the lab can read.

## Adding a lab later
1. Append its `assignmentId` to the `ALLOWED_ASSIGNMENTS` Script Property.
2. Add one row to `labs.json` (`assignmentId`, `title`, `file`, `version`,
   `objectives` with both `N10-009:` and `APNET:` tags).
That's it — no script edit, no redeploy needed for the allow-list to take effect.

## Optional: server-authoritative scoring
By default the quiz score is **self-reported** (the labs disclose this). To make a
lab's score authoritative, add its answer key to the `ANSWER_KEYS` map at the top of
`apps-script.gs` (`{ "assignmentId": { q1:"b", q2:"c", ... } }`). The server then
recomputes that lab's quiz score and records it as `server`-scored in the gradebook;
labs left out stay `self`-scored.

## Privacy / FERPA
Collect no real names, emails, or student IDs anywhere in the labs or payloads. The
Callsign is the only identifier in the system; map Callsigns to students in a separate
instructor roster that never touches this web app.

---
© Add the author's copyright/license line here.

---

## Submission folder hierarchy (AP Unit → Topic → lab)
The handler files each submission into a nested path under `ROOT_FOLDER_ID`:

```
<root>/
  Unit 1 — Managing My Connections/
    1.1 Fixing What's Slowing Me Down.../   <assignmentId>/  <Doc>
    1.2 Getting the Most Out of My Network.../
    ...
  Unit 2 — Managing My Shared Connections/
    2.1 Missed Connection.../ ...
  Unit 3 — Managing Many Connections/ ...
  Unit 4 — Managing Our Global Connections/ ...
```

- Each lab is routed by its **primary AP topic** (`apnet` in `labs.json`); the unit is
  derived from the topic number. The maps live at the top of `apps-script.gs`
  (`AP_UNITS`, `AP_TOPICS`, `ASSIGNMENT_TOPIC`) — adding a lab means adding one
  `ASSIGNMENT_TOPIC` line (or it falls back to the AP tag in the submission payload).
- Folders are created lazily on first submission, so empty topics simply don't appear
  until a lab there is submitted.
- **Ordering:** folder names carry the numeric prefix (`Unit 1…`, `2.3 …`), so set the
  Drive view to **Sort by Name (A→Z)** to see units and topics in first-to-last course
  order. (Drive's default sort is "Last modified" — switch it to Name.)
