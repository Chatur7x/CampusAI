# Terms of Service — CampusAI

> **DRAFT — requires legal review before publication.** Written from the code in
> this repository. Not legal advice. Replace every `[INSTITUTION]`, `[DATE]`,
> `[JURISDICTION]` and `[LIMIT]` placeholder and remove the bracketed drafting
> notes.
>
> Read this together with `docs/PRIVACY_POLICY.md`, which governs how personal
> data is handled. Where the two conflict on personal data, the Privacy Policy
> wins.

---

## 1. Agreement

These Terms are between `[INSTITUTION NAME]` ("the Institution", "we") and the
person using the CampusAI platform ("you"). By using the platform you accept
these Terms.

**These Terms do not override the Institution's academic regulations, examination
rules, disciplinary procedures or any collective agreement.** Where an academic
rule and these Terms conflict, the academic rule governs the academic outcome and
these Terms govern the platform.

Effective date: `[DATE]`. Last updated: `[DATE]`.

---

## 2. What the platform is

CampusAI is an attendance and analytics platform. It provides:

- a student web portal (timetable, attendance records, leave requests, notices,
  face registration);
- a faculty portal (class rosters, attendance sessions, manual marking, leave
  approval, analytics);
- an administrative portal (departments, courses, classes, timetable, user
  management, notices, settings, security monitoring, bulk import/export);
- automated face matching with liveness detection, geofenced session
  validation, attendance analytics and fraud detection.

Attendance marking, correction and leave decisions are **institutional
functions**. The platform records and evidences them; it does not decide them.

---

## 3. Accounts

### 3.1 Provisioning

Accounts are created by the Institution. Self-registration, where offered,
creates a student account only — staff and administrator accounts are
provisioned separately. No one can self-assign an elevated role.

### 3.2 Your responsibilities

You agree to:

- use only your own account and not share your password or authentication code;
- keep your device itself reasonably secure;
- **not share your registered face template, session code, or authentication
  code with anyone**;
- report immediately any suspicion that your account or your biometric data has
  been compromised.

You must be `[MINIMUM AGE]` years old to hold an account.

### 3.3 Ending access

The Institution may suspend or deactivate an account, and the platform
deactivates accounts automatically in defined circumstances — including a
`CRITICAL` security event, which deactivates the account and terminates all
active sessions. You may request deletion of your account; academic records are
retained as described in §10 and in `docs/DATA_RETENTION.md`.

---

## 4. Prohibited use

You must not:

- mark attendance for another person, or allow another person to mark attendance
  for you;
- present a photograph, screen recording, mask, or other artefact in place of a
  live face;
- spoof, mock or otherwise falsify location information;
- publish, screen-share or transmit a session code to anyone outside the class;
- attempt to access another user's data, or to access data outside your role;
- upload or transmit malware, or probe, scan or test the vulnerability of the
  platform without written authorisation;
- reverse engineer, decompile, or create derivative works from the platform,
  except where that restriction is prohibited by law;
- scrape or harvest personal data;
- use the platform for any purpose other than the Institution's academic or
  employment purposes.

---

## 5. Face recognition and attendance

### 5.1 Voluntary participation

**Face registration is voluntary.** Where the platform offers face-based
attendance, declining has no academic consequence, and attendance can be marked
manually by the responsible faculty member. You are not required to register
your face, and you may withdraw consent at any time.

### 5.2 How it works

You register multi-angle photographs and complete a liveness challenge. A
numeric template (a face embedding) is derived from your face and stored for
comparison. During a session you submit a live image; the platform compares it
against your stored template and combines that result with liveness,
location and device signals into a confidence score.

### 5.3 What it cannot do

The platform does not and will not: infer emotion, mood, health, ethnicity or
gender; estimate age; use your face for any purpose other than attendance
verification; or make your face data available to employers, other students or
third parties.

### 5.4 Accuracy and false outcomes

Automated verification can produce a false negative — a genuine student failing
to mark attendance — because of lighting, obstruction, poor GPS accuracy,
network conditions or an unfamiliar device. Such an outcome is **not** evidence
of wrongdoing and carries no presumption of any kind.

Every attendance record is reversible. The responsible faculty member or an
administrator may correct a record with a recorded justification. Corrections
are attributed and logged.

### 5.5 Anti-proxy features

Sessions are anchored to the position recorded when a faculty member starts
them, and attendance is verified only within a radius of that position.
The platform may also detect shared devices, impossible travel and other
signals.

**These are deterrents and error-prone heuristics, not proof.** They can
misidentify legitimate situations. Do not treat a flag as evidence, and do not
act on one without reviewing the underlying signals and speaking to the student.

---

## 6. Attendance, leave and academic records

- Attendance is marked per session by the responsible faculty member, either
  automatically (subject to §5) or manually.
- A leave request is submitted by you and decided by the faculty member
  responsible for your class, or by an administrator. You may cancel a request
  while it is still pending.
- Approved leave is recorded as leave, not as absence, for the days in question.
- Your attendance percentage is **computed from session records** and is
  indicative. Weighting between class types is set by the Institution.
- The platform may display figures that differ between screens because
  different views apply different weighting. Where that occurs, ask the
  responsible faculty member to reconcile the record.

The platform does not grant, withhold or determine eligibility for any academic
consequence. `[INSTITUTION]`'s regulations govern that.

---

## 7. Integrity of records

Attendance records are hash-chained: each record incorporates the hash of the
record before it. A `TAMPERED` status indicates that the chain could not be
verified.

**You must not attempt to alter, delete or suppress any record.** Altering an
institutional record is a disciplinary matter under `[INSTITUTION]`'s
regulations and may also be unlawful.

Where you believe a record is wrong, use the correction process. The correction
is recorded with who made it and why — that is the intended design, not an
inconvenience.

---

## 8. Your content

You retain rights in content you submit (leave reasons, messages, notice text).
You grant `[INSTITUTION]` a **non-exclusive, worldwide, royalty-free licence** to
host, process, transmit and display that content to the extent necessary to
operate the platform and to discharge the Institution's academic and legal
obligations.

You must not submit content that is unlawful, infringing, or that contains
another person's personal data without authority.

For photographs and images submitted for face registration and liveness
verification, see §5 and the Privacy Policy §4 — the platform's position is that
these are processed into a template and not retained as images. `[VERIFY against
your deployment before relying on this]`

---

## 9. Confidentiality and other users' data

You must keep confidential:

- other students' attendance, results and personal data;
- face templates and photographs of others;
- session codes while a session is live;
- credentials and administrative functionality.

Access to student data is limited by role and enforced on the server. Do not
attempt to access data outside your role even where a screen appears to expose
it.

---

## 10. Retention

Retention periods for attendance, biometric, location, security and
communication data are set out in the Privacy Policy §11 and in
`docs/DATA_RETENTION.md`.

Two points in particular:

- **Academic records are retained** in accordance with the Institution's record
  retention schedule. Deletion of your account does not delete the academic
  record.
- **Security audit logs are retained** even where other data is erased, so that
  the integrity of institutional records can be demonstrated. A request to
  erase biometric data does not erase the audit trail showing that it was
  erased.

---

## 11. Intellectual property

The platform, its models, its algorithms and its software are owned by
`[INSTITUTION]` or its licensors. Database rights in the underlying data
collection may vest in the Institution depending on your jurisdiction and the
terms of any research use.

These Terms grant you a limited, revocable, non-transferable right to use the
platform for its intended purpose. No other rights are granted.

**Research use.** `[INSTITUTION POLICY]` governs the use of platform data for
research, including any requirement for ethical approval, data minimisation and
agreement not to attempt re-identification of individuals from anonymised
outputs. Note that attendance patterns combined with timetable and cohort data
can permit re-identification of individuals even after removing direct
identifiers.

---

## 12. Suspension and termination

We may suspend or terminate access immediately and without notice where use
presents a risk to the integrity of academic records, to the safety or privacy
of another person, or where required by law.

Where we terminate your access, your academic record is retained as described in
§10. Reasonable efforts are made to notify you, except where doing so would
undermine an investigation or a legal obligation.

---

## 13. Disclaimers

To the extent permitted by law:

- the platform is provided **as is**. The attendance confidence score is an
  estimate and does not constitute a determination about any person.
- `INSTITUTION` does not warrant that the platform will be uninterrupted or
  error-free, nor that any automated output will be accurate.
- **Nothing in these Terms limits liability for fraud, wilful misconduct,
  death or personal injury caused by negligence, or for any liability that
  cannot lawfully be limited.**
- Liability for any other loss arising from your use of the platform is limited
  to `[£100 / INR 10,000 / AMOUNT]`.

Nothing in these Terms excludes or limits `[INSTITUTION]`'s obligations under
data protection law, or its duty to maintain accurate academic records.

---

## 14. Third-party components

The platform incorporates third-party open-source software and AI models,
including InsightFace, MediaPipe, scikit-learn, Supabase, React, FastAPI and
Express. Their licences apply to their respective components.

`[ATTACH THE THIRD-PARTY LICENCE SCHEDULE — required for open-source
distribution compliance]`

---

## 15. Changes

We may amend these Terms. Material changes affecting biometric processing
require fresh consent and `[30]` days' notice through the platform and by email.
Continued use after the effective date constitutes acceptance.

---

## 16. Governing law

These Terms are governed by the laws of `[JURISDICTION]`, and the courts of
`[JURISDICTION]` have exclusive jurisdiction, except where `[INSTITUTION]`'s
statutory or regulatory obligations take precedence.

Nothing in this clause limits your right to bring a complaint to a data
protection authority, or to enforce any non-waivable right.

---

## 17. General

- If a provision is found unenforceable, the rest continues in force.
- Failure to enforce a provision is not a waiver of it.
- You may not assign these Terms. `INSTITUTION` may vary these Terms as
  described in §15.
- Headings are for convenience only.
- `INSTITUTION`'s student grievance procedure and any staff grievance procedure
  apply alongside these Terms.

---

## Appendix A — summary of what you agree to

1. Attendance can be marked by your responsible faculty member, automatically or
   manually.
2. Face registration is **voluntary**, and declining has no academic
   consequence.
3. Face registration creates a biometric template used only to verify
   attendance.
4. Proxy attendance is prohibited, and attempting it is a disciplinary matter.
5. Do not share your login, your session code, or your face template with
   anyone.
6. Do not attempt to alter or suppress any record.
7. Errors happen. Ask for a correction rather than disputing the system — the
   correction is recorded.
8. You can ask what we hold about you, ask us to correct it, and withdraw
   consent for biometric processing.
9. Academic records and security logs are retained even after your account is
   closed.
10. These Terms are additional to, and do not replace, the Institution's
    academic regulations.

---

## Appendix B — pre-publication checklist

- [ ] Every `[INSTITUTION]`, `[DATE]`, `[JURISDICTION]`, `[LIMIT]` replaced
- [ ] Legal review completed
- [ ] Liability cap set to an amount your institution will accept
- [ ] Governing law and jurisdiction confirmed
- [ ] Research-use policy written or referenced (`[INSTITUTION POLICY]`)
- [ ] Third-party licence schedule attached (open-source compliance)
- [ ] Student and staff grievance routes confirmed
- [ ] **"No images retained" claim verified** against the deployed
      configuration (§8)
- [ ] **Withdrawal-of-consent flow confirmed to actually delete embeddings** —
      the software does not implement this today
- [ ] **Retention implemented** per `docs/DATA_RETENTION.md`, or §10 rewritten
- [ ] Announced alongside `docs/PRIVACY_POLICY.md`
- [ ] Reasonably accessible format provided, and support contacts published