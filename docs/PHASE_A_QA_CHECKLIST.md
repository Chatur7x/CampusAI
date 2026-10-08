# CampusAI — Phase A QA checklist

Phase A verification is split in two:

- **Part A — automated.** Every item is backed by a repo test (or a documented
  live-only test that skips when its service is absent). These are pre-ticked;
  run the full suite with `npm test` (+ `pytest tests/ai`). If any Part A box
  regresses, Phase A is not green.
- **Part B — human-only.** Browser UX, console inspection, live multi-account
  state, and anything that needs networked machines or a real deployment.
  Tick these by hand; record failures in Findings.

---

## Part B prerequisites (do these first)

1. `cp .env.example .env` and fill in Supabase + service keys
2. `npm install && npm run dev` — frontend on :5173
3. `cd server--backend && npm run dev` — API on :5000
4. `cd ai-server && uvicorn main:app` — AI on :8000
5. `bash scripts/deploy-edge-functions.sh --all --verify` (requires
   `SUPABASE_ACCESS_TOKEN`; see `docs/PHASE_A_DEPLOY_VERIFICATION.md`)
6. Test accounts, one of each:
   `admin@`, `faculty@` (class A), `faculty2@` (class B), `student@`
   (enrolled in class A), `company@` — `faculty2` is required for the
   cross-class negative tests.
7. Browser console open with **Preserve log** enabled for the whole session.

---

## Part A — automated (pre-ticked)

### 0. Environment

- [x] 0.4 AI server `/docs` returns 404 — `tests/ai/test_live_http.py::test_interactive_docs_are_disabled` (live; skips when AI server absent)
- [x] 0.5 `npm test` passes (backend + integration + ai) — repo suites under `tests/`
- [x] 0.6 `npx tsc -b`, `npx eslint .`, backend `npx tsc --noEmit` all clean — `package.json` scripts

### 3. Student — negative tests

- [x] 3.3.3 Student cannot approve their own leave request — `tests/backend/ownership.test.mjs` (leave approval is faculty-scoped)
- [x] 3.3.4 Student cannot cancel another student's leave request — `tests/backend/ownership.test.mjs` (cancel is scoped to caller's own student id)

### 6. File upload — the stored-XSS fix

- [x] 6.2 Avatar upload rejects `evil.svg` with a clear message — `tests/backend/upload.test.mjs` (extension allowlist + markup rejection)
- [x] 6.3 Avatar upload rejects `evil.html` with a clear message — `tests/backend/upload.test.mjs` (`containsMarkup` test)
- [x] 6.4 A `.png` renamed to `.png.svg` is rejected — `tests/backend/upload.test.mjs` (extension checked against allowlist)
- [x] 6.5 An oversized file is rejected — `tests/backend/upload.test.mjs` (size limit from config)
- [x] 6.6 The stored avatar URL, opened directly, does **not** execute script — `tests/backend/upload.test.mjs` (attachment + nosniff + sandbox CSP assertions)
- [x] 6.8 Bulk CSV upload rejects `.html` containing markup — `tests/backend/upload.test.mjs`
- [x] 6.9 Bulk CSV upload rejects an `.xlsx` renamed to `.csv` (byte check) — `tests/backend/upload.test.mjs` (csv `rejectMagic` + behavioral `sniffFile` probe). **Fixed 2026-10-08:** csv rule now denies ZIP (`PK\x03\x04`) and OLE2 magic.

### 7. Leave request lifecycle

- [x] 7.2 Faculty of the right class approves → status APPROVED — `tests/backend/ownership.test.mjs` (approval verifies class ownership)
- [x] 7.3 Faculty of the wrong class is refused — `tests/backend/ownership.test.mjs` + `tests/backend/routes.test.mjs`
- [x] 7.4 Student cannot approve their own request — `tests/backend/ownership.test.mjs` + `routes.test.mjs` (`requireRole('STUDENT')` cannot approve; approve is faculty)
- [x] 7.5 An already-processed request cannot be actioned again — `tests/backend/ownership.test.mjs`
- [x] 7.7 A student cannot cancel someone else's request — `tests/backend/ownership.test.mjs` (cancel scoped to caller)

### 8. Rate limiting

- [x] 8.3 AI face verify: 11 requests in a minute → 11th returns 429 with `Retry-After` — `tests/ai/test_ratelimit.py`
- [x] 8.5 Analytics endpoints tolerate their higher budget — `tests/ai/test_ratelimit.py` (separate analytics gate)
- [x] 8.6 Two different users behind one IP do not share a budget — `tests/ai/test_ratelimit.py` (per-key isolation)
- [x] 8.7 Waiting out `Retry-After` restores access — `tests/ai/test_ratelimit.py` (window arithmetic)

### 9. Error handling and information disclosure

- [x] 9.1 Forcing a 500 yields `Internal server error` only — `tests/backend/auth.test.mjs` (global error handler test)
- [x] 9.2 No response body leaks stack traces/paths — `tests/backend/auth.test.mjs` (`doesNotMatch err.stack`)
- [x] 9.4 Validation errors name the offending field without echoing the submitted value — `tests/backend/behavior.test.mjs`
- [x] 9.5 `GET /api/auth/role` without a token → 401 — `tests/ai/test_auth.py` (fail-closed role lookup) + backend auth tests
- [x] 9.6 Another user's email reports "not found", not their role — `tests/ai/test_auth.py::TestRoleLookup`

**Part A: 26 items, all covered by repo tests.**

---

## Part B — human-only

### 0. Environment

- [ ] 0.1 Dev server up on :5173, page loads with no console errors
- [ ] 0.2 Backend up on :5000, `GET /api/health` returns `{"status":"ok"}`
- [ ] 0.3 AI server up, `GET http://localhost:8000/health` returns ok
- [ ] 0.7 `bash scripts/deploy-edge-functions.sh --all --verify` reports all probes green _(currently blocked: no `SUPABASE_ACCESS_TOKEN` in this environment)_
- [ ] 0.8 Browser console open with **Preserve log** enabled

### 1. Admin

#### 1.1 Login
- [ ] Email + password login succeeds and lands on the admin dashboard
- [ ] A wrong password shows a friendly message, not a stack trace
- [ ] The role shown after login matches the account (no role picker hijack)
- [ ] Sign out returns to `/login` and the back button does not re-enter the app

#### 1.2 Pages reachable from the nav
For each: loads, shows plausible data, no console errors.

- [ ] Dashboard — counts and recent activity present
- [ ] User Management — list loads; create, edit, deactivate, delete all work
- [ ] Departments — list, create, edit, delete work
- [ ] Courses — list, create work
- [ ] Classes — list, create work
- [ ] Analytics — charts render; scroll cinematics reveal on scroll
- [ ] Security — events list loads; an event can be resolved
- [ ] Blockchain — hash chain renders; "verify integrity" reports valid
- [ ] Timetable — entries render for a class
- [ ] Settings — values load and save

#### 1.3 Admin-only pages behave
- [ ] Settings save persists across a reload
- [ ] Resolving a security event changes its state
- [ ] Deleting a department with students is refused (not a 500)

### 2. Faculty

#### 2.1 Login
- [ ] Email + password login lands on the faculty dashboard
- [ ] Faculty nav does not show admin-only entries

#### 2.2 Pages
- [ ] Dashboard — own classes only, no other faculty's students
- [ ] Overview — leave requests visible are only for own students
- [ ] Attendance Session — can start a session for **own** class
- [ ] Timetable — shows own schedule
- [ ] Analytics — own students only

#### 2.3 Cross-class negative test (needs faculty2)
- [ ] Faculty (class A) cannot start a session for a class in class B → refused
- [ ] Faculty (class A) cannot mark attendance for a student in class B → refused
- [ ] Faculty (class A) cannot approve a leave request from a class B student → refused
- [ ] Faculty (class A) cannot amend an attendance record belonging to class B → refused

### 3. Student

#### 3.1 Login
- [ ] Email + password login lands on the student dashboard
- [ ] A newly registered account is a STUDENT even if the signup form offered another role — self-registration must not mint an admin
- [ ] Google/GitHub OAuth sign-in lands as STUDENT

#### 3.2 Pages
- [ ] Dashboard — own attendance percentage and today's classes
- [ ] My Attendance — own records only; no other student's data anywhere
- [ ] Timetable — own schedule
- [ ] Notices — shows notices targeted at students
- [ ] Settings — profile fields save
- [ ] Leave Requests — submit a request, see it listed as PENDING

#### 3.3 Negative tests
- [ ] 3.3.1 Student navigating manually to `/admin` is redirected or shown a 403
- [ ] 3.3.2 Student navigating manually to `/faculty` is redirected or shown a 403
- [ ] 3.3.5 Student cannot change their own role by editing the profile payload (DevTools → Network → replay the `profiles` update with `"role":"ADMIN"`) → rejected

### 4. Company

- [ ] Login lands on the company dashboard
- [ ] Student directory loads (aggregated fields only — no face embeddings)
- [ ] Attendance summary loads
- [ ] Leave management loads only what a company should see
- [ ] Live tracking shows location state without leaking raw coordinates in the DOM

### 5. Attendance flow, end to end

- [ ] Faculty starts a session: a 6-digit code is displayed
- [ ] Student joins with the correct code → session is active
- [ ] Student joins with a wrong code → rejected
- [ ] Session expired → student is refused
- [ ] Face verify with a clear, well-lit photo → verified
- [ ] Face verify in poor light / with a hat → refused, message is actionable ("Try again in better lighting"), not "500 Internal Server Error"
- [ ] Face verify while outside the geofence → refused, reason mentions distance
- [ ] Face verify while spoofing (a photo of a photo) → refused
- [ ] Attendance row is written with the correct status and method
- [ ] Low-confidence result is flagged for manual review rather than silently passed
- [ ] Faculty sees the marked attendance in the live attendance view
- [ ] Student sees it in My Attendance

### 6. File upload — the stored-XSS fix

Create these files before starting: `evil.svg` and `evil.html`, each containing
`<script>alert(document.domain)</script>`.

- [ ] 6.1 Avatar upload accepts a valid `.png` → renders as an image
- [ ] 6.7 Admin bulk CSV upload accepts a valid `.csv`
- [ ] 6.10 Repeat uploads rapidly (11 in an hour) → the 11th returns 429

### 7. Leave request lifecycle

- [ ] 7.1 Student submits a leave request → status PENDING
- [ ] 7.6 Student cancels a PENDING request → status CANCELLED
- [ ] 7.8 Approving writes attendance rows as ON_LEAVE for the date range
- [ ] 7.9 A rejection reason is stored and shown to the student

### 8. Rate limiting

- [ ] 8.1 Login: 6 wrong passwords in 15 min → 6th returns 429
- [ ] 8.2 Signup: repeated submissions are throttled
- [ ] 8.4 The 429 is a clean JSON error, not a stack trace

### 9. Error handling and information disclosure

- [ ] 9.3 No response leaks another user's data on a failed lookup (compare the 404 body for "exists" vs "does not exist" resources — they must be identical)
- [ ] 9.7 Browser console shows no Supabase key, JWT, or service-role key

### 10. Cross-role negative matrix

Each cell: try the action as the row role against the column role's data.

| From \ Target | Admin data | Faculty A data | Faculty B data | Student own | Student other |
| --- | --- | --- | --- | --- | --- |
| Student      | refuse | refuse | refuse | allow | refuse |
| Faculty A    | refuse | allow   | refuse | n/a    | refuse |
| Faculty B    | refuse | refuse  | allow   | n/a    | refuse |
| Company      | refuse | refuse  | refuse  | refuse | refuse |

- [ ] Every cell behaves as shown. Record any deviation below.

### 11. Regression sweep

- [ ] No dead buttons: every visible control does something or is disabled
- [ ] No broken links: sidebar, in-page anchors, back/forward all work
- [ ] Browser back after a state change does not show stale data
- [ ] Reduced-motion preference is respected (animations stop, content still shows)
- [ ] Layout holds at 1280px, 1440px and 1920px wide
- [ ] Keyboard-only navigation reaches the primary actions on each page

**Part B: 81 items (26 Part A + 81 Part B = 107 total).**

---

# Findings

Anything you could not tick, with the exact reproduction:

| # | Item | Expected | Actual | Severity |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

**Blocker for Phase B?** yes / no

**Notes:**
