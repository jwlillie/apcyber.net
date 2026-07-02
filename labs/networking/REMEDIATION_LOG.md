# Remediation Log — Merged Library (Network+ N10-009 / AP Networking)

Combines the first-half (86 labs) and second-half (45 labs) products into one
website-ready library. Both halves were processed to the same spec, so the merge is a
dedupe + union.

## Merge result
- **124 labs** (86 + 45 − 7 overlapping slugs).
- Single backbone: one `apps-script.gs` (identical across both halves), one `labs.json`,
  one `ALLOWED_ASSIGNMENTS.txt` (124 slugs).
- Every lab carries a parseable `#lab-meta` anchor and both blueprints (`N10-009:` + `APNET:`).

## Dedupe decisions
- **7 overlapping slugs** existed in both halves (same labs, processed separately). Kept
  the **first-half** version, dropped the second-half duplicate:
  `bench-bringup`, `dns-records`, `find-rogue-port`, `link-aggregation`,
  `nic-ups-fieldcheck`, `three-tier-build`, `wap-guest`.
- **DHCP-scope:** four distinct scenarios kept as separate labs (distinct slugs, distinct
  narratives): `netplus-dhcp-scope` (Fleet), `-harborview`, `-netforge`, `-warehouse`.
  They all teach N10-009:3.4 — **Advisory:** prune to taste if four DHCP-scope labs is more
  than the catalog needs.

## Validation (merged set)
- [x] 124 unique `assignmentId`s — no slug collisions
- [x] No invalid N10-009 sub-objective codes (all within 1.1–1.8 / 2.1–2.4 / 3.1–3.5 / 4.1–4.3 / 5.1–5.5)
- [x] Every `labs.json` filename resolves to a real file (124/124)
- [x] Pseudonym key `handle` / "Callsign" library-wide (no `hackerName`)
- [x] `#lab-meta` JSON anchor present in all 124
- [x] Coverage: all five N10-009 domains (D1:36 · D2:36 · D3:31 · D4:30 · D5:62 lab-tags)
      and all four AP units (U1:20 · U2:40 · U3:40 · U4:24)

## Phase 3 — still needs builder/human (unchanged from both halves)
- [ ] Hydrate each alignment PANEL from `#lab-meta` (E2); some panels still show old
      N10-007 tag text (cosmetic — `#lab-meta` + CONFIG are authoritative)
- [ ] Originality / clean-room sign-off (A1/A4); sim fidelity + realistic CLI error text (D1/D6)
- [ ] Wire the real `/exec` URL at deploy (replace `PASTE_APPS_SCRIPT_EXEC_URL_HERE`)

## Deploy
Follow `INSTRUCTOR_SETUP.md` (from the second-half bundle): create root folder + gradebook,
paste `apps-script.gs`, set the four Script Properties (paste `ALLOWED_ASSIGNMENTS.txt` into
`ALLOWED_ASSIGNMENTS`), deploy as web app, single find-replace the `/exec` URL across all
124 labs.

---
© Add the author's copyright/license line here.
