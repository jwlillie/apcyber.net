# CHANGELOG — apcyber.net Lab Site Reorganization

## Summary

Reorganized the static lab site of **81 single-file simulation labs** for AP Cybersecurity / CompTIA Security+ SY0-701. Rebuilt the hub index, added cross-lab navigation, added first-time-teacher materials, and ran a consistency pass. **No lab's interactive, scoring, or submission logic was touched**, and every `lab-meta` block was preserved byte-for-byte.

## Task 1 — Index reorder & regroup

- Rebuilt `index.html` so labs read top-to-bottom in pedagogical order: **Unit (1→5) → Topic (ascending numeric) → lab**.
- Topic is derived from each lab's `lab-meta` `ap.topics[0]` (the authoritative source), **not** the old visible link text.
- Each topic now has its own visible subheading with a lab count, so the page is scannable.
- **Sort rule within a topic:** lowest Security+ objective first (e.g. a lab whose lowest `splus.objectives` value is `1.1` sorts before one starting at `2.5`), then **alphabetical by title** as the tiebreak. This rule is applied consistently on both the index and the teacher guide.
- **Empty topics shown as placeholders:** `2.1`, `2.2`, `4.1`, `5.6` render as greyed-out "coming soon · 0 labs" rows so the coverage gap is visible. No labs were invented to fill them.
- Preserved the original CSS, visual design, footer, and `<meta name="robots" content="noindex">`.
- Added a link to the new `teacher-guide.html` at the top of the hub.

### Dual-topic edge case

- `unit-2/splus-physical-access-vestibule.html` is tagged with **both 2.3 and 2.4**. It is listed **once** under its lowest topic (**2.3 Protecting Physical Spaces**) with a small **"(also covers 2.4)"** note on its row. It is **not** duplicated under 2.4.

## Task 2 — Cross-page navigation

- Added a uniform navigation bar to **all 81 labs**, injected as a self-contained `<script>` just before `</body>`.
- The bar is `position:fixed` at the top and added via `appendChild`, so it **never becomes a flex/grid item** and cannot disrupt any lab's internal layout (29 labs use `display:flex`/`grid` directly on `<body>`). The script also adds `padding-top` to `<body>` (all 81 labs use `box-sizing:border-box`, so this adds no overflow) to keep lab content from hiding behind the bar.
- Each bar contains: **"← All Labs"** → `../index.html`; a **breadcrumb** `All Labs › Unit N — <unitTitle> › <topic>`; and **‹ Prev / Next ›** within the same unit, following the same order as the index. First lab in a unit has no Prev; last has no Next (rendered as greyed, non-clickable text).
- Styling matches the index palette (accent `#0b6b70`, system font). Relative links only — works from any subfolder or local disk.

## Task 3 — Consistency / escaping pass

- **HTML-escaping fix:** the old index showed double-encoded `&amp;amp;` in 5 Unit 4/5 link titles (e.g. *Harden Default `&amp;amp;` Local Accounts*). The rebuilt index pulls titles fresh from `lab-meta` and renders them correctly with a single `&`. The lab files' own `<title>`/headings already used correct single-`&amp;` encoding and were left unchanged.
- **assignmentId vs filename:** checked all 81 — **every `assignmentId` matches its filename** (no mismatches).
- **Index text vs real title:** after entity normalization, **no semantic mismatches** were found; the only difference was the cosmetic double-encoding above, now fixed by rebuilding from `lab-meta`.
- No lab content was silently rewritten.

## Task 4 — First-time-teacher materials

- Created **`teacher-guide.html`** (linked from the hub) containing: an overview of how submission works (students use a **hacker name — never their real name**); a **setup checklist** (create the Apps Script web app, paste the `/exec` URL into each lab, host the static files or drop them in an LMS, confirm submissions land); a note that labs are **self-contained and offline-capable**; a **coverage map** table flagging the empty topics (2.1, 2.2, 4.1, 5.6); a **pacing guide** calling out high-density topics (4.2 = 22 labs, 4.3 = 16, 3.2 = 10) with demo-vs-homework suggestions; and a **sortable/filterable/printable per-lab reference table** (title, unit, topic, Sec+ objectives, AP skills) for all 81 labs.
- No answer keys are exposed on any student-facing page (the labs self-grade in-browser; no separate key files were bundled).

## Outstanding placeholders (for you to finish)

You did not supply real values, so the placeholders were **left as-is**. There are **252 occurrences** across **82 files**: **162× `appsScriptUrl`** (`PASTE_SHARED_/exec_URL_HERE`) and **90× `license`** (`© 2026 [AUTHOR / INSTITUTION]`).

Replace these before going live (the Apps Script URL is what makes submissions work). Full list by file and line:

- `index.html` — license → line(s) 2, 114
- `unit-1/splus-identify-social-engineering.html` — appsScriptUrl → line(s) 28, 443; license → line(s) 29
- `unit-1/splus-mail-safelist-filters.html` — appsScriptUrl → line(s) 57, 599; license → line(s) 58
- `unit-2/splus-physical-access-vestibule.html` — appsScriptUrl → line(s) 49, 319; license → line(s) 15, 50, 244
- `unit-2/splus-physical-security-plan.html` — appsScriptUrl → line(s) 28, 388; license → line(s) 29
- `unit-3/splus-appliance-access.html` — appsScriptUrl → line(s) 29, 297; license → line(s) 30
- `unit-3/splus-arp-wireshark.html` — appsScriptUrl → line(s) 56, 461; license → line(s) 57
- `unit-3/splus-cleartext-scan.html` — appsScriptUrl → line(s) 30, 400; license → line(s) 31
- `unit-3/splus-dc-vuln-scan.html` — appsScriptUrl → line(s) 27, 560; license → line(s) 28
- `unit-3/splus-edge-appliance-setup.html` — appsScriptUrl → line(s) 27, 346; license → line(s) 28
- `unit-3/splus-ftp-vuln-scan.html` — appsScriptUrl → line(s) 30, 379; license → line(s) 31
- `unit-3/splus-guest-byod-wlan.html` — appsScriptUrl → line(s) 28, 623; license → line(s) 29
- `unit-3/splus-ipsec-vpn-ipados.html` — appsScriptUrl → line(s) 27, 640; license → line(s) 28
- `unit-3/splus-linux-vuln-scan.html` — appsScriptUrl → line(s) 44, 507; license → line(s) 45
- `unit-3/splus-mac-acl-switch.html` — appsScriptUrl → line(s) 53, 461; license → line(s) 54
- `unit-3/splus-onpath-dns-spoof.html` — appsScriptUrl → line(s) 27, 377; license → line(s) 28, 40, 362
- `unit-3/splus-perimeter-firewall.html` — appsScriptUrl → line(s) 28, 452; license → line(s) 29
- `unit-3/splus-ra-vpn-pfsense.html` — appsScriptUrl → line(s) 27, 635; license → line(s) 28
- `unit-3/splus-rogue-ap-hardening.html` — appsScriptUrl → line(s) 29, 488; license → line(s) 30
- `unit-3/splus-router-acl-permit.html` — appsScriptUrl → line(s) 39, 470; license → line(s) 40
- `unit-3/splus-router-vty-acl.html` — appsScriptUrl → line(s) 43, 412; license → line(s) 44
- `unit-3/splus-screened-subnet.html` — appsScriptUrl → line(s) 28, 478; license → line(s) 29
- `unit-3/splus-snort-ips-edge.html` — appsScriptUrl → line(s) 28, 467; license → line(s) 29
- `unit-3/splus-std-acl-block-hosts.html` — appsScriptUrl → line(s) 38, 317; license → line(s) 39
- `unit-3/splus-switch-hardening.html` — appsScriptUrl → line(s) 30, 345; license → line(s) 31
- `unit-3/splus-switch-log-severity.html` — appsScriptUrl → line(s) 28, 411; license → line(s) 29
- `unit-3/splus-switch-port-hardening.html` — appsScriptUrl → line(s) 49, 403; license → line(s) 50
- `unit-3/splus-switch-secure-access.html` — appsScriptUrl → line(s) 26, 474; license → line(s) 27
- `unit-3/splus-syn-flood-analysis.html` — appsScriptUrl → line(s) 41, 394; license → line(s) 42
- `unit-3/splus-tls-vuln-scan.html` — appsScriptUrl → line(s) 28, 521; license → line(s) 29
- `unit-3/splus-wifi-controller-hardening.html` — appsScriptUrl → line(s) 29, 515; license → line(s) 30
- `unit-3/splus-win-vuln-scan.html` — appsScriptUrl → line(s) 28, 754; license → line(s) 29
- `unit-3/splus-wips-controller.html` — appsScriptUrl → line(s) 43, 543; license → line(s) 44
- `unit-3/splus-wlan-wpa2-personal.html` — appsScriptUrl → line(s) 24, 365; license → line(s) 25
- `unit-4/splus-account-rename.html` — appsScriptUrl → line(s) 44, 375; license → line(s) 45
- `unit-4/splus-ad-account-lifecycle.html` — appsScriptUrl → line(s) 27, 328; license → line(s) 28
- `unit-4/splus-ad-create-group.html` — appsScriptUrl → line(s) 28, 513; license → line(s) 29
- `unit-4/splus-ad-delete-ous.html` — appsScriptUrl → line(s) 28, 479; license → line(s) 29
- `unit-4/splus-ad-ou-structure.html` — appsScriptUrl → line(s) 28, 578; license → line(s) 29
- `unit-4/splus-ad-user-provisioning.html` — appsScriptUrl → line(s) 29, 405; license → line(s) 30
- `unit-4/splus-advanced-audit-policy.html` — appsScriptUrl → line(s) 28, 451; license → line(s) 29
- `unit-4/splus-applocker-allowlist.html` — appsScriptUrl → line(s) 28, 569; license → line(s) 29
- `unit-4/splus-clear-browser-cache.html` — appsScriptUrl → line(s) 28, 656; license → line(s) 29
- `unit-4/splus-configure-microsoft-defender.html` — appsScriptUrl → line(s) 30, 309; license → line(s) 31
- `unit-4/splus-create-virtual-machines.html` — appsScriptUrl → line(s) 28, 506; license → line(s) 29
- `unit-4/splus-dc-system-state-backup.html` — appsScriptUrl → line(s) 45, 398; license → line(s) 46
- `unit-4/splus-dep-config.html` — appsScriptUrl → line(s) 25, 465; license → line(s) 26
- `unit-4/splus-filehistory-backup.html` — appsScriptUrl → line(s) 40, 453; license → line(s) 41
- `unit-4/splus-filehistory-recovery.html` — appsScriptUrl → line(s) 24, 387; license → line(s) 25
- `unit-4/splus-gpo-create-link.html` — appsScriptUrl → line(s) 55, 348; license → line(s) 56
- `unit-4/splus-harden-default-accounts.html` — appsScriptUrl → line(s) 28, 438; license → line(s) 29, 45, 396, 449
- `unit-4/splus-harden-tablet.html` — appsScriptUrl → line(s) 27, 435; license → line(s) 28
- `unit-4/splus-host-firewall-public-profile.html` — appsScriptUrl → line(s) 51, 318; license → line(s) 52
- `unit-4/splus-host-firewall-public.html` — appsScriptUrl → line(s) 28, 474; license → line(s) 29
- `unit-4/splus-linux-account-lockunlock.html` — appsScriptUrl → line(s) 28, 310; license → line(s) 29
- `unit-4/splus-linux-delete-user.html` — appsScriptUrl → line(s) 27, 300; license → line(s) 28
- `unit-4/splus-linux-deprovision-user.html` — appsScriptUrl → line(s) 40, 354; license → line(s) 41
- `unit-4/splus-linux-group-removal.html` — appsScriptUrl → line(s) 43, 287; license → line(s) 44
- `unit-4/splus-linux-group-split.html` — appsScriptUrl → line(s) 27, 310; license → line(s) 28
- `unit-4/splus-linux-passwd-reset.html` — appsScriptUrl → line(s) 28, 472; license → line(s) 29
- `unit-4/splus-linux-passwd-rotate.html` — appsScriptUrl → line(s) 28, 240; license → line(s) 29
- `unit-4/splus-linux-secondary-group.html` — appsScriptUrl → line(s) 27, 282; license → line(s) 28
- `unit-4/splus-linux-user-provisioning.html` — appsScriptUrl → line(s) 27, 350; license → line(s) 28
- `unit-4/splus-local-password-lockout.html` — appsScriptUrl → line(s) 59, 426; license → line(s) 60
- `unit-4/splus-mobile-mail-browser-harden.html` — appsScriptUrl → line(s) 28, 481; license → line(s) 29
- `unit-4/splus-password-audit-jtr.html` — appsScriptUrl → line(s) 28, 389; license → line(s) 29
- `unit-4/splus-rainbow-tables.html` — appsScriptUrl → line(s) 28, 375; license → line(s) 29
- `unit-4/splus-restrict-local-admins.html` — appsScriptUrl → line(s) 28, 481; license → line(s) 29
- `unit-4/splus-shadow-groups.html` — appsScriptUrl → line(s) 27, 540; license → line(s) 28
- `unit-4/splus-smartcard-logon-gpo.html` — appsScriptUrl → line(s) 27, 418; license → line(s) 28
- `unit-4/splus-uac-hardening.html` — appsScriptUrl → line(s) 52, 389; license → line(s) 53
- `unit-4/splus-update-policy-config.html` — appsScriptUrl → line(s) 28, 459; license → line(s) 29
- `unit-4/splus-virtual-switches.html` — appsScriptUrl → line(s) 27, 460; license → line(s) 28
- `unit-5/splus-bitlocker-tpm.html` — appsScriptUrl → line(s) 28, 398; license → line(s) 29
- `unit-5/splus-efs-folder-encryption.html` — appsScriptUrl → line(s) 28, 393; license → line(s) 29
- `unit-5/splus-https-binding.html` — appsScriptUrl → line(s) 28, 499; license → line(s) 29
- `unit-5/splus-md5-integrity-check.html` — appsScriptUrl → line(s) 49, 369; license → line(s) 50
- `unit-5/splus-ntfs-acl-hardening.html` — appsScriptUrl → line(s) 25, 492; license → line(s) 26
- `unit-5/splus-ntfs-disable-inheritance.html` — appsScriptUrl → line(s) 28, 398; license → line(s) 29
- `unit-5/splus-pki-ca-lifecycle.html` — appsScriptUrl → line(s) 27, 393; license → line(s) 28
- `unit-5/splus-sqli-account-lookup.html` — appsScriptUrl → line(s) 46, 291; license → line(s) 47
- `unit-5/splus-stego-recipient-marker.html` — appsScriptUrl → line(s) 28, 462; license → line(s) 29

## Mismatches found but NOT auto-fixed

- None. All `assignmentId`↔filename pairs matched, and all index link text matched the real `lab-meta` titles after normalizing the `&amp;amp;` double-encoding (which was fixed by rebuilding the index from metadata).

## Acceptance check

- [x] Every index link resolves to a real file; every file on disk is linked exactly once (the dual-topic lab appears once with an "also covers 2.4" note).
- [x] Within each unit, topics appear in ascending numeric order with headings.
- [x] Empty topics (2.1, 2.2, 4.1, 5.6) are shown as placeholders, not omitted.
- [x] Every lab has a working "← All Labs" link (`../index.html`) and correct prev/next within its unit.
- [x] No lab's simulation/submit behavior changed; all 81 `lab-meta` blocks preserved exactly.
- [x] CHANGELOG lists all remaining placeholders (file + line).
