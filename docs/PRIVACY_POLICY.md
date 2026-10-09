# Privacy Policy — CampusAI

> **DRAFT — requires legal review before publication.** This is a
> technically-grounded draft written from the code in this repository. It is not
> legal advice and has not been reviewed by a lawyer. Every `[INSTITUTION]`,
> `[CONTACT]`, `[JURISDICTION]` and date placeholder must be replaced. Bracketed
> notes are drafting guidance and must be removed before publication.
>
> It also describes what the software **currently does**, including places where
> it does not yet do what this policy promises. Those are called out explicitly
> in §11 — do not publish until you have either implemented the gap or removed
> the promise.

---

## 1. Who we are

`[INSTITUTION NAME]` ("we", "the University") operates CampusAI, an attendance
and analytics platform used by our students, faculty and staff.

- Data protection contact: `[NAME]`, `[EMAIL]`
- Registered address: `[ADDRESS]`
- Data protection officer (if appointed): `[DPO NAME / NOT APPLICABLE]`

This policy describes how we handle personal data through the CampusAI platform.
It supplements, and does not replace, any other notice we give you.

---

## 2. Scope

This policy applies to personal data processed by the CampusAI platform,
including:

- the web application;
- the AI/ML services that perform face matching, liveness detection and
  attendance analytics;
- server-side components that store attendance, notices, leave records and
  security logs.

It does **not** cover:

- our student records system, HR system or library system;
- third-party services we use for email delivery or hosting, which have their
  own policies (see §10);
- CCTV, physical access control, or any other system.

Where another policy covers the same data, that policy prevails.

---

## 3. Roles

Depending on your relationship with us you may be:

- a **data subject** (student, faculty member or staff member whose data we
  process);
- a **data processor** where an organisation we host processes its own
  employees' data through a tenant we operate on its behalf.

The remainder assumes the first. If you are a tenant organisation, your
controller obligations apply to us and §11 (what we do and do not expose to
tenants) describes what we make available to you.

---

## 4. Biometric data — the most important section

### 4.1 What we collect

When you register for face-based attendance we collect and store a **face
embedding**: a numeric vector mathematically derived from your facial geometry
by a face-recognition model. Where several reference embeddings exist, all of
them are used.

We also store whether you have registered (`face_registered`) and a
`confidence_score` for each verification attempt.

**We do not store photographs of your face taken for attendance purposes.**
Registration photos are processed in memory to produce the embedding and are not
written to storage. Live attendance images are likewise processed and discarded;
what persists is a similarity score and a liveness score.

> **⚠ Drafting note.** Verify this before publishing. The repository contains no
> code path that writes an attendance image to disk or to a storage bucket, and
> the client sends images to the AI server as base64 in the request body. But
> this is a negative claim about a system with several storage paths — confirm
> with whoever configured the storage buckets in your deployment.

### 4.2 Why we process it, and on what basis

Purpose: **to verify that the person marking attendance is the enrolled student
and that a live person is present** (liveness), thereby preventing proxy
attendance.

Legal bases we rely on, depending on your jurisdiction:

| Jurisdiction | Basis | Note |
| --- | --- | --- |
| EU/UK (GDPR) | **Explicit consent** (Art. 9(2)(a)) for the biometric data; **legitimate interests** (Art. 6(1)(f)) for the attendance record | Biometric data used to uniquely identify you is special-category and consent is the only basis available to us as a public authority or, for private institutions, the usual basis. You may withdraw at any time |
| India (DPDP Act 2023) | **Consent** under s.6, recorded in the specified form | Notice + consent is required to process any personal data, with additional requirements for children and for any data processed under a State/Government instrument |
| United States (FERPA) | **Legitimate educational interest** (34 CFR §99.31) | FERPA governs disclosure of education records rather than setting biometric consent rules; state law (BIPA in Illinois, CUBI in Texas, Washington's SB 149) may impose additional requirements. **Institutions in several US states must obtain written biometric consent before collecting a biometric identifier** |

> **⚠ You must determine which of these applies to you**, and if more than one
> applies, apply the strictest.

### 4.3 Consent

We will ask you to consent before your face is registered, and we will record
that consent with a timestamp and a reference to the version of this policy you
saw.

> **⚠ The software does not implement consent capture today.** There is no
> consent screen and no column storing consent. Before enabling face recognition
> for any real cohort you must build it — see `docs/ONBOARDING.md` step 13. This
> document cannot honestly be published as a promise of recorded consent until
> that exists.

You may withdraw consent at any time, without giving a reason and without
affecting your right to attend classes or any other service. Withdrawal stops
face-based marking; it does not affect attendance already recorded.

### 4.4 What we do **not** use your face data for

We do not use it for, and will not use it for:

- emotion, mood, health or demographic inference;
- age or gender estimation;
- identity documents, payments, or any purpose outside attendance verification;
- advertising, profiling for marketing, or sharing with advertisers;
- training third-party models or making it publicly available.

The derived analytics (risk scoring, trend forecasting, fraud signals) operate on
attendance records and similarity scores, not on the raw embedding.

### 4.5 Alternative

Face registration is **voluntary**. You can attend and have your attendance
marked manually by the faculty member responsible for your class. Declining has
no academic consequence. If manual marking is not available for a session,
contact `[CONTACT]` and we will arrange an alternative.

---

## 5. Categories of personal data we process

| Category | Examples | Source |
| --- | --- | --- |
| Identity and contact | name, email, phone, institutional address, date of birth | You; registrar; HR |
| Academic | enrolment/employee ID, department, class, course, semester, batch year, grades, assignments | Registrar; you; faculty |
| Biometric | face embedding, registration flag | You, at registration |
| Attendance | date, status (`PRESENT`/`ABSENT`/`LATE`/`EXCUSED`/`ON_LEAVE`), method, confidence score, optional location and device string | Generated by the platform |
| Location | coordinates at the moment of a verification, whether inside the geofence, any spoofing flag, derived from the faculty member's recorded position | Device, during verification |
| Leave | type, dates, reason, decision, decision-maker, comments | You; faculty |
| Security and technical | IP address, user agent, device hash, sign-in timestamp and result, trusted devices, active sessions, security events | Generated automatically |
| Communications | notices received, notifications, direct and class messages | Platform; you |
| Device | browser fingerprint used for shared-device detection | Generated automatically |

---

## 6. How we use it, and the lawful basis

| Purpose | Data | Basis (GDPR) | Basis (India) |
| --- | --- | --- | --- |
| Verify attendance | biometric, attendance, location | Explicit consent (biometric); legitimate interests (record) | Consent |
| Maintain the academic record | academic, attendance | Legal obligation / public task | Compliance with applicable law |
| Leave administration | leave records | Legitimate interests; legal obligation | Consent / legitimate use |
| Detect and prevent proxy attendance and impersonation | biometric, location, device, security logs | Legitimate interests | Legitimate use |
| Secure the service | security logs, sessions, IP | Legitimate interests | Legitimate use |
| Send notices | identity, contact | Legitimate interests | Consent, where required |
| Statistical and predictive analytics | attendance aggregates, similarity scores | Legitimate interests, after aggregation | Legitimate use |

We do not sell personal data, and we do not share it with advertisers.

---

## 7. Who we share it with

**Inside the institution:** authorised faculty of the classes you are enrolled
in, and academic and IT administrators, for the purposes above.

**Service providers acting as processors**, under written contracts limiting
them to our instructions:

- Supabase — database, authentication, edge functions, storage
- Railway — AI server and backend hosting
- Vercel — frontend hosting
- Our email delivery provider — password resets and notifications

**Not shared:** we do not disclose your face embedding to any other student, to
employers, or to tenants of a multi-organisation deployment. See §8.

**Legal disclosure:** we may disclose data where required by law or valid legal
process, and will notify you unless prohibited from doing so.

**Transfers:** providers may process data outside your jurisdiction. Where they
do, transfers are covered by the provider's standard contractual clauses or an
equivalent mechanism. `[CONFIRM WHICH, PER PROVIDER]`

---

## 8. What our organisation tenants can and cannot see

The platform supports multi-organisation deployments in which an employer uses a
tenant for its own staff.

**Tenants cannot access face embeddings.** Face embeddings are readable only by
the platform's service role, plus a student for their own record. No
tenant-facing screen requests them, and no row-level-security policy grants a
tenant read access.

**Tenants cannot access individual student attendance.** The attendance tables are
scoped to academic roles, and tenant-facing screens do not surface student
attendance.

> **⚠ VERIFY before publishing this promise.** This is the correct design intent
> and it is enforced for `face_embeddings`, but the attendance tables are
> governed by row-level-security policies written against academic roles, and the
> company-role model has an unresolved mismatch (the role enum cannot hold
> company roles). Confirm end-to-end against a live database with a real
> tenant-role account before you put this in a published policy.

**Tenants may see** headcount, department lists, and aggregates. Do not rely on
company dashboards for anything employee-specific: several of them display
placeholder data rather than real records. See `docs/COMPANY_GUIDE.md` §1.

---

## 9. Your rights

Depending on your jurisdiction, you may have the right to:

- **access** — get a copy of your personal data;
- **rectification** — correct inaccurate data (self-service for name, phone and
  address in Settings);
- **erasure** — have data deleted;
- **restriction / objection** — object to certain processing;
- **withdraw consent** — for biometric processing at any time;
- **portability** — receive your data in a machine-readable format;
- **complain** to your supervisory authority.

### How to exercise a right

Email `[DATA PROTECTION CONTACT]` with the subject "Data subject request". You do
not need to use a form. We will respond within `[30]` days.

Include enough for us to identify you — your institutional email is sufficient.
We will verify your identity before disclosing anything.

### What we will do, and what we may not do

- We will provide your data in a readable format.
- We will correct inaccurate data.
- We will delete your **face embeddings** and stop face-based attendance on
  request.
- **We will not delete attendance records that have formed part of your
  academic record**, and we will not delete security audit logs, where we are
  required to retain them. See §11 and `docs/DATA_RETENTION.md`.

If we refuse a request, we will tell you why and how to complain.

---

## 10. Sub-processors and international transfers

| Provider | Service | Data |
| --- | --- | --- |
| Supabase | Database, Auth, Edge Functions, Storage | All categories |
| Railway | AI server, backend | All categories served |
| Vercel | Frontend CDN/build | Public asset metadata |
| `[MAIL PROVIDER]` | Transactional email | Name, email |

`[COMPLETE THE LIST FROM YOUR ACTUAL CONFIGURATION]`

Transfers outside your jurisdiction rely on standard contractual clauses or an
equivalent safeguard.

---

## 11. Retention

Summary. Full schedule and its rationale — including the tension between the
right to erasure and the duty to keep an audit trail — is in
`docs/DATA_RETENTION.md`.

| Data | Retention |
| --- | --- |
| Face embeddings | Until you withdraw consent, plus `[30]` days |
| Face verification logs (similarity scores) | `[12]` months |
| Geolocation records | `[12]` months |
| Attendance records | Duration of the academic record, per institutional policy |
| Leave records | `[ACADEMIC RECORD PERIOD]` |
| Security and audit logs | `[24]` months minimum; longer where an investigation is open |
| Notifications | `[12]` months |
| Sessions | Until logout or expiry (`[30]` days) |
| Password reset tokens | `[1 HOUR]` |
| Blacklisted tokens | Until the underlying token would have expired |
| Backups | `[35]` days |

### ⚠ These are not yet implemented

Retention is currently **manual**. Nothing in the repository deletes face
embeddings, face verification logs, geolocation records, sessions or
notifications on a schedule. Only three prunes exist: expired blacklisted tokens,
API request logs older than 30 days, and login history older than 90 days — all
invoked manually or by the `security-monitor` function.

**Do not publish a retention schedule you do not enforce.** Implement the jobs in
`docs/ONBOARDING.md` step 29 first, or state plainly that retention is applied
by manual administrative process and name the frequency.

---

## 12. Security

- Access control is role-based and enforced on the server, with database-level
  row-level security as a second layer.
- Biometric data is stored separately and is accessible only to the platform's
  service layer.
- Data in transit is encrypted (TLS). Data at rest is encrypted by the hosting
  provider.
- Authentication events, security events and administrative actions are logged.
- Rate limiting is applied to authentication, API and biometric endpoints.
- Administrative access is restricted to named individuals and multi-factor
  authentication is available for them.

We will notify you and the relevant regulator of a personal data breach
affecting your rights and freedoms without undue delay, and in any event within
72 hours of becoming aware, where the GDPR or equivalent applies.

> **⚠** We describe these accurately but they describe what the code does, not
> an independent assurance claim. Do not describe the platform as certified to
> any standard; it is not.

---

## 13. Children

The platform is intended for users at or above the age of majority in their
jurisdiction. Where users are below that age, `[INSTITUTION]` acts as the
responsible party and obtains any consent required. In India, the DPDP Act 2023
imposes verifiable parental consent for users under 18.

---

## 14. Automated decision-making

Attendance verification and the associated scoring are automated: a face
embedding is compared against your stored embedding, liveness and geofence
signals are assessed, and a combined confidence score determines the outcome.

These outputs determine whether an attendance record is created. They are
**not** used to make decisions producing legal or similarly significant effects
about you — no admission, grading or disciplinary decision is made by the system.

Consequences are limited and reversible: the record can be corrected by the
faculty member responsible for your class or by an administrator, with a
justification recorded. If you believe an automated outcome is wrong, ask for
human review — see §9.

> **⚠ VERIFY** the second paragraph before publishing. Analytics endpoints do
> compute "risk" categories for students, and the product includes behaviour
> profiling and fraud-detection outputs. Confirm that nothing in your
> configuration feeds those into an adverse academic decision. If it does, this
> section must be rewritten and human review made a formal right.

---

## 15. Changes to this policy

Material changes will be notified `[30]` days in advance through the platform
and by email. Where a change affects biometric processing, we will ask for
fresh consent.

---

## 16. Contact and complaints

**Data protection contact:** `[NAME]` — `[EMAIL]`

**Supervisory authority:** `[IDENTIFY THE AUTHORITY FOR YOUR JURISDICTION —
e.g. the Information Commissioner's Office (UK), a national Data Protection
Authority / State Data Protection Officer (India), or the relevant US state
Attorney General]`

You also have the right to complain to your institution's grievance process
first, if one exists.

---

## Appendix — pre-publication checklist

- [ ] Every `[INSTITUTION]`, `[CONTACT]`, `[JURISDICTION]` and date replaced
- [ ] Legal review completed
- [ ] **Consent capture built and tested** (§4.3)
- [ ] **Retention implemented** (§11) — or the section rewritten to describe
        manual process honestly
- [ ] **"We do not store photographs" verified** against the deployed storage
      configuration (§4.1)
- [ ] **Tenant isolation verified** end-to-end with a real tenant-role account
      (§8)
- [ ] **Automated decision-making reviewed** — no adverse academic decisions
      from model output (§14)
- [ ] Sub-processor list completed from the real configuration (§10)
- [ ] Regulatory notification obligations confirmed for your jurisdiction
      (BIPA/CUBI/other US state laws; DPDP Act 2023)
- [ ] DPIA completed and retained, where required
- [ ] Withdrawal path tested — confirm deleting the consent row actually deletes
      the embeddings
- [ ] `docs/DATA_RETENTION.md` agreed with legal
- [ ] `docs/TERMS_OF_SERVICE.md` published alongside this policy