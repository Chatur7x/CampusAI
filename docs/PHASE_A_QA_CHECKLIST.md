# =============================================================
# CampusAI — Phase A manual QA checklist
# =============================================================
# Tick every box. Anything that cannot be ticked is a blocker for Phase B —
# record it at the bottom rather than skipping it silently.
#
# Setup
#   1. cp .env.example .env  and fill in Supabase + service keys
#   2. npm install && npm run dev                (frontend, :5173)
#   3. cd server--backend && npm run dev         (API, :5000)
#   4. cd ai-server && uvicorn main:app          (AI, :8000)
#   5. bash scripts/deploy-edge-functions.sh --verify
#
# Test accounts — you need one of each:
#   admin@    <your-domain>   password: <…>
#   faculty@  <your-domain>   password: <…>     (in charge of class A)
#   faculty2@ <your-domain>   password: <…>     (in charge of class B)
#   student@  <your-domain>   password: <…>     (enrolled in class A)
#   company@  <your-domain>   password: <…>
#
# faculty2 exists specifically for the cross-class negative tests. If you only
# have one faculty account, create a second one in a different class first.
# =============================================================


## 0. Environment

- [ ] Dev server up on :5173, page loads with no console errors
- [ ] Backend up on :5000, `GET /api/health` returns `{"status":"ok"}`
- [ ] AI server up, `GET http://localhost:8000/health` returns ok
- [ ] AI server `/docs` returns 404 (interactive docs must stay off)
- [ ] `npm test` passes (backend + integration + ai)
- [ ] `npx tsc -b`, `npx eslint .`, backend `npx tsc --noEmit` all clean
- [ ] `bash scripts/deploy-edge-functions.sh --verify` reports all probes green
- [ ] Browser console open with **Preserve log** enabled for the whole session


## 1. Admin

### 1.1 Login
- [ ] Email + password login succeeds and lands on the admin dashboard
- [ ] A wrong password shows a friendly message, not a stack trace
- [ ] The role shown after login matches the account (no role picker hijack)
- [ ] Sign out returns to `/login` and the back button does not re-enter the app

### 1.2 Pages reachable from the nav
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

### 1.3 Admin-only pages behave
- [ ] Settings save persists across a reload
- [ ] Resolving a security event changes its state
- [ ] Deleting a department with students is refused (not a 500)


## 2. Faculty

### 2.1 Login
- [ ] Email + password login lands on the faculty dashboard
- [ ] Faculty nav does not show admin-only entries

### 2.2 Pages
- [ ] Dashboard — own classes only, no other faculty's students
- [ ] Overview — leave requests visible are only for own students
- [ ] Attendance Session — can start a session for **own** class
- [ ] Timetable — shows own schedule
- [ ] Analytics — own students only

### 2.3 Cross-class negative test (needs faculty2)
- [ ] Faculty (class A) cannot start a session for a class in class B → refused
- [ ] Faculty (class A) cannot mark attendance for a student in class B → refused
- [ ] Faculty (class A) cannot approve a leave request from a class B student → refused
- [ ] Faculty (class A) cannot amend an attendance record belonging to class B → refused


## 3. Student

### 3.1 Login
- [ ] Email + password login lands on the student dashboard
- [ ] A newly registered account is a STUDENT even if the signup form offered
      another role — self-registration must not mint an admin
- [ ] Google/GitHub OAuth sign-in lands as STUDENT

### 3.2 Pages
- [ ] Dashboard — own attendance percentage and today's classes
- [ ] My Attendance — own records only; no other student's data anywhere
- [ ] Timetable — own schedule
- [ ] Notices — shows notices targeted at students
- [ ] Settings — profile fields save
- [ ] Leave Requests — submit a request, see it listed as PENDING

### 3.3 Negative tests
- [ ] Student navigating manually to `/admin` is redirected or shown a 403
- [ ] Student navigating manually to `/faculty` is redirected or shown a 403
- [ ] Student cannot approve their own leave request
- [ ] Student cannot cancel another student's leave request
- [ ] Student cannot change their own role by editing the profile payload
      (DevTools → Network → replay the `profiles` update with `"role":"ADMIN"`) → rejected


## 4. Company

### 4.1 Login and pages
- [ ] Login lands on the company dashboard
- [ ] Student directory loads (aggregated fields only — no face embeddings)
- [ ] Attendance summary loads
- [ ] Leave management loads only what a company should see
- [ ] Live tracking shows location state without leaking raw coordinates in the DOM


## 5. Attendance flow, end to end

- [ ] Faculty starts a session: a 6-digit code is displayed
- [ ] Student joins with the correct code → session is active
- [ ] Student joins with a wrong code → rejected
- [ ] Session expired → student is refused
- [ ] Face verify with a clear, well-lit photo → verified
- [ ] Face verify in poor light / with a hat → refused, message is actionable
      ("Try again in better lighting"), not "500 Internal Server Error"
- [ ] Face verify while outside the geofence → refused, reason mentions distance
- [ ] Face verify while spoofing (a photo of a photo) → refused
- [ ] Attendance row is written with the correct status and method
- [ ] Low-confidence result is flagged for manual review rather than silently passed
- [ ] Faculty sees the marked attendance in the live attendance view
- [ ] Student sees it in My Attendance


## 6. File upload — the stored-XSS fix

Create these files before starting: `evil.svg` and `evil.html`, each containing
`<script>alert(document.domain)</script>`.

- [ ] Avatar upload accepts a valid `.png` → renders as an image
- [ ] Avatar upload rejects `evil.svg` with a clear message
- [ ] Avatar upload rejects `evil.html` with a clear message
- [ ] A `.png` renamed to `.png.svg` is rejected
- [ ] A file over 5MB is rejected
- [ ] The stored avatar URL, opened directly in a new tab, does **not** execute
      script — it downloads or renders inert
- [ ] Admin bulk CSV upload accepts a valid `.csv`
- [ ] Bulk CSV upload rejects `.html` containing markup
- [ ] Bulk CSV upload rejects an `.xlsx` renamed to `.csv` (byte check)
- [ ] Repeat uploads rapidly (11 in an hour) → the 11th returns 429


## 7. Leave request lifecycle

- [ ] Student submits a leave request → status PENDING
- [ ] Faculty of the right class approves → status APPROVED
- [ ] Faculty of the wrong class is refused (see 2.3)
- [ ] Student cannot approve their own request
- [ ] An already-processed request cannot be actioned again
- [ ] Student cancels a PENDING request → status CANCELLED
- [ ] A student cannot cancel someone else's request (replay the PUT in DevTools)
- [ ] Approving writes attendance rows as ON_LEAVE for the date range
- [ ] A rejection reason is stored and shown to the student


## 8. Rate limiting

- [ ] Login: 6 wrong passwords in 15 min → 6th returns 429
- [ ] Signup: repeated submissions are throttled
- [ ] AI face verify: 11 requests in a minute → 11th returns 429 with `Retry-After`
- [ ] The 429 is a clean JSON error, not a stack trace
- [ ] Analytics endpoints tolerate their higher budget without spurious 429s
- [ ] Two different users behind one IP do not share a budget
- [ ] Waiting out `Retry-After` restores access


## 9. Error handling and information disclosure

- [ ] Force a 500 on any endpoint → response body is `Internal server error` only
- [ ] No response body contains a stack trace, file path, SQL fragment,
      connection string, or driver error
- [ ] No response leaks another user's data on a failed lookup (compare the 404
      body for "exists" vs "does not exist" resources — they must be identical)
- [ ] Validation errors name the offending field without echoing the submitted value
- [ ] `GET /api/auth/role` without a token → 401 (must not enumerate accounts)
- [ ] `GET /api/auth/role` for another user's email → reports "not found", not
      "this user exists and is an ADMIN"
- [ ] Browser console shows no Supabase key, JWT, or service-role key


## 10. Cross-role negative matrix

Each cell: try the action as the row role against the column role's data.

| From \ Target | Admin data | Faculty A data | Faculty B data | Student own | Student other |
| --- | --- | --- | --- | --- | --- |
| Student      | refuse | refuse | refuse | allow | refuse |
| Faculty A    | refuse | allow   | refuse | n/a    | refuse |
| Faculty B    | refuse | refuse  | allow   | n/a    | refuse |
| Company      | refuse | refuse  | refuse  | refuse | refuse |

- [ ] Every cell behaves as shown. Record any deviation below.


## 11. Regression sweep

- [ ] No dead buttons: every visible control does something or is disabled
- [ ] No broken links: sidebar, in-page anchors, back/forward all work
- [ ] Browser back after a state change does not show stale data
- [ ] Reduced-motion preference is respected (animations stop, content still shows)
- [ ] Layout holds at 1280px, 1440px and 1920px wide
- [ ] Keyboard-only navigation reaches the primary actions on each page


# Findings

Anything you could not tick, with the exact reproduction:

| # | Item | Expected | Actual | Severity |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

**Blocker for Phase B?** yes / no

**Notes:**
