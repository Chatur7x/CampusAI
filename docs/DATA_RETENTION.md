# Data Retention

A proposed retention schedule for CampusAI, the legal rationale for each
period, and an explicit statement of the tension between the right to erasure
and the duty to keep an audit trail — with a recommended resolution.

> **This is a starting position, not legal advice.** Periods marked `[…]` are
> placeholders you must set. Biometric retention in particular depends on your
> jurisdiction and your institution's risk appetite. Take this to your legal
> counsel and your data protection officer before you implement it.
>
> **Almost none of this is implemented.** See §6. Retention today is manual.

---

## 1. The tension: erasure versus audit

This is the central design problem, and getting it wrong in either direction
causes real harm.

### The erasure pressure

- **GDPR Art. 17** gives a data subject a right to erasure. **Art. 17(3)(b)**
  provides an exception where erasure would "render impossible or seriously
  impair the achievement of the purposes of processing". Academic attendance
  records plausibly fall here.
- **GDPR Art. 17(3)(e)** excepts processing necessary for "the establishment,
  exercise or defence of legal claims." A fraud investigation is a legal claim.
- **India, DPDP Act 2023, s.12(2)** provides that a Data Fiduciary may retain
  personal data after erasure where retention is "necessary for the
  establishment, exercise or defence of a legal claim" or for "compliance with
  any applicable law."
- **US FERPA** permits disclosure of education records without consent where
  there is a legitimate educational interest, and imposes record-retention
  obligations through other statutes rather than erasing them on request.
- **US state biometric statutes (BIPA, CUBI, Tex. Bus. & Com. Code §503.001)**
  impose their own retention rules — BIPA §15(b) requires a written retention
  schedule and prohibits retention beyond its expiry.

### The audit pressure

- **Integrity.** Attendance is hash-chained (`blockchain_hash` linked to
  `previous_hash`). Deleting a row in the middle of the chain breaks
  verifiability for everything after it. `docs/API.md` §5.9.
- **Accountability.** "Who changed this record, when, and on whose authority?"
  is only answerable if `audit_logs`, `login_history`, `security_events` and
  `api_request_log` survive.
- **Disciplinary fairness.** A student accused of proxy attendance cannot contest
  it if the geolocation and device evidence has been rotated away.
- **Detection.** Impossible-travel and brute-force detection need a window of
  history.

### Where they actually collide

Only in a few places, and the collision is narrower than it looks:

| Collision | Why it is not as bad as it seems |
| --- | --- |
| Erasure of the **face embedding** vs. keeping attendance proof | The *proof* is the similarity score and the timestamp, not the template. Erasing the embedding destroys biometric identity data while leaving the attendance record intact. This resolves cleanly. |
| Erasure of **geolocation** vs. keeping fraud evidence | Coordinates are precise location data. For a fraud investigation, "the student was `[DISTANCE]` metres from the faculty member's recorded position at 09:14" is sufficient. The raw coordinate pair is not strictly necessary. |
| Erasure of **audit logs** vs. demonstrating integrity | An audit log entry recording *that a deletion happened* can be retained in a pseudonymous form — record the actor, the action, the target type and the timestamp, without retaining the deleted content. Integrity proof survives. |
| Erasure of **the academic attendance record** itself | This is the genuine conflict, and it is resolved by Art. 17(3)(b) / s.12(2) exceptions rather than by compromise. |

### Recommended policy

> **Erase the data; retain the evidence that the data was erased.**

Concretely:

1. **Biometric templates are erased on withdrawal, without exception.** They are
   the most sensitive data, the least necessary after the fact, and the only
   category a departing student would reasonably expect to be destroyed. Keep
   them `[30]` days after withdrawal as a safety margin for accidental
   re-registration, then delete.
2. **Attendance records are retained** as part of the academic record, per
   `[INSTITUTION]`'s retention schedule, under the Art. 17(3)(b) / s.12(2)
   exception. Erasure requests do not remove them.
3. **Audit and security logs are retained** under the legal-claims exception,
   and are **pseudonymised** on erasure: the user reference is replaced with a
   stable non-identifying hash so integrity proofs still verify, while the entry
   no longer identifies a person directly.
4. **Precise location is reduced**, not kept, after the evidentiary window —
   except for an open investigation.
5. **Deletion itself is audited.** The fact of deletion is more important to
   record than the data.

This is the policy the rest of this document assumes. State it in your
`PRIVACY_POLICY.md` and give the user the manual procedure in §6.3.

---

## 2. Schedule

Periods marked `[…]` need your decision. The "Basis" column names the rationale.

### 2.1 Biometric — the highest-sensitivity class

| Data | Where | Retention | Basis |
| --- | --- | --- | --- |
| Face embedding (primary) | `students.face_data` | Until consent withdrawn + `[30]` days | Purpose limitation: needed only for verification. Delete on withdrawal |
| Face embeddings (adaptive history) | `face_embeddings` | Until consent withdrawn + `[30]` days | Same. Note the set **grows** with each successful verify — see §5.1 |
| Face registration photographs | not stored | n/a | Processed in memory to produce an embedding; the images are not persisted. `[VERIFY against your deployment]` |
| Face verification logs | `face_verification_logs` | `[12]` months | Contain a similarity score, device id and timestamp. Evidentiary for a fraud challenge; not identity data once the template is gone. Reduce to an aggregate after the window |
| Liveness frames submitted | transmitted, not stored | n/a | Processed in memory by the AI server |

> **⚠ Verify `students.face_data` is not selectable by `authenticated`.**
> `students_admin_all` is `FOR ALL USING (is_admin(auth.uid()))`, so an admin
> using the anon key *could* select `face_data`. No frontend page does. Apply
> `REVOKE SELECT (face_data) ON public.students FROM authenticated;` after
> testing your admin screens, so the column is reachable only by the service
> role.

### 2.2 Academic records

| Data | Where | Retention | Basis |
| --- | --- | --- | --- |
| Attendance rows | `attendance` | `[ACADEMIC RECORD PERIOD]`, e.g. `[6]` years after graduation | Legal obligation to maintain an accurate academic record. **Not erased on request** — Art. 17(3)(b) / s.12(2) |
| Attendance corrections | `attendance.verified_by`, `justification` | Same as the record | Accountability |
| Leave requests | `leave_requests` | `[ACADEMIC RECORD PERIOD]` | Same |
| Grades, assignments | `grades` | `[ACADEMIC RECORD PERIOD]` | Same |
| Profile (name, enrolment ID, department) | `profiles`, `students` | Account life + `[2]` years | Business and legal purpose |
| Guardian contacts | `students` | Same as the academic record | `[CONFIRM — in some jurisdictions guardian data has a shorter life than the academic record]` |

> **⚠** `students` cascades: deleting a student row cascades to `attendance`,
> `grades`, `leave_requests`, `face_embeddings`, `face_verification_logs`
> (Prisma `onDelete: Cascade`). So **deleting the student destroys the academic
> record** and breaks the hash chain. Never hard-delete a student to satisfy an
> erasure request — deactivate instead (`profiles.is_active = false`), which is
> what `DELETE /api/admin/users/:id` already does.

### 2.3 Security and technical data

| Data | Where | Retention | Basis |
| --- | --- | --- | --- |
| Login history | `login_history` | `[90]` days — **already enforced** | Detecting brute force needs a rolling window; beyond it, low value and personal |
| API request log | `api_request_log` | `[30]` days — **already enforced** | Threat detection and incident scoping |
| Security events | `security_events` | `[24]` months minimum | Defence of legal claims; serious incidents take time to surface |
| Security alerts | `security_alerts` | `[24]` months minimum | Same |
| Audit logs | `audit_logs` | `[7]` years | Accountability and demonstrable integrity over the life of an academic record |
| Geolocation records | `geo_verifications` | `[12]` months | Fraud evidence window; precise location, short life |
| Active sessions | `sessions` | Until logout or expiry (default `[30]` days) | Functional necessity |
| Trusted devices | `trusted_devices` | Until untrusted, plus `[90]` days | Functional |
| Blacklisted tokens | `token_blacklist` | Until the token's own expiry — **already enforced** | A revocation is meaningless after the token would have expired |
| Password reset tokens | `password_resets` | `[1]` hour, single use | Security |
| MFA backup codes | `mfa_backup_codes` | Until used or regenerated | Security |
| Organisation audit logs | `organization_audit_logs` | `[24]` months | Tenant accountability |

The three "already enforced" prunes live in the `security-monitor` edge
function's `cleanup` action and in `POST /api/security/cleanup-tokens`.

> **⚠** `security-monitor` has **no caller authentication** — see
> `docs/API.md` §7. Do not schedule it from a public URL until that is fixed.

### 2.4 Communications and derived data

| Data | Where | Retention | Basis |
| --- | --- | --- | --- |
| Notifications | `notifications` | `[12]` months | Functional |
| Notice read receipts | `notice_reads` | Life of the notice | Functional |
| Chat messages | `messages` | `[24]` months | `[CONFIRM institutional policy]` |
| Blockchain blocks | `blockchain_hashes` | Same as attendance | Integrity |
| AI audit JSONL files | AI server `${AUDIT_LOG_DIR}/audit_<date>.jsonl` | `[24]` months | Same as `audit_logs` |
| MLflow runs | `${MLFLOW_TRACKING_URI}` | `[6]` months | Model monitoring; not personal data in itself |
| Backups | `db-backups` bucket | `[35]` days | Disaster recovery. Expired backups must actually be deleted — see §5.2 |

### 2.5 What is never retained

State these positively in your privacy policy:

- Face photographs or live attendance images.
- Raw camera video.
- Audio.
- Data on individuals who never enrolled.

---

## 3. Rationale by period

**Biometric: short.** Biometric data is irreversibly identifying and cannot be
rotated like a password. The longer it lives, the larger the breach blast radius
and the more data an attacker acquires. It is also the category users most
strongly expect to be destroyed on request. Deleting it costs the Institution
nothing, because the similarity scores in `face_verification_logs` preserve the
evidentiary value.

**Attendance: long, and not erasable.** This is the institutional record.
`calculate_attendance_percentage` and every downstream report depend on it, and
an attendance deficiency can carry a legal consequence years later. The
exception in Art. 17(3)(b) / DPDP s.12(2) is squarely designed for this. Erasing
it would be the worse outcome for the student as well as the Institution.

**Login and API logs: short.** Useful for a rolling window of threat detection
and nothing more. After `[90]` days a login record rarely helps and still
identifies a person. Short retention is both a security control and a privacy
win.

**Security events and alerts: medium-long.** These are the evidence base for an
investigation. Investigations surface late — a disputed attendance record may
surface a year later, by which point the geo and login context is gone. Keep
them long enough to be useful, and treat any open investigation as a legal hold.

**Audit logs: longest.** They are the only way to demonstrate to a regulator, a
court or an accused student that a record was not altered. Their whole purpose
is to outlive the dispute.

**Geolocation: medium.** Precise location is personal data with low ongoing
value once the fraud window closes. Retain it for a year, then drop it.

**Backups: shortest practical.** A backup containing biometric data inherits the
biometric retention period in practice, because nobody deletes individual rows
from a backup. Thirty-five days — one month of nightly backups plus a little
slack — is the shortest window consistent with a recoverable incident.

---

## 4. Applying this: the deletion procedure

Until the automated jobs exist (§6), this is the manual procedure. Run it under
two-person control and record each run.

### 4.1 Withdrawal of biometric consent

```sql
-- 1. Identify. Confirm the request and the student.
SELECT s.id, s.enrollment_id, s.face_registered, s.user_id
FROM students s
JOIN profiles p ON p.user_id = s.user_id
WHERE p.email = '<student email>';

-- 2. Capture the evidentiary record FIRST (see §1, policy point 3).
--    similarity scores, timestamps, device ids — no embedding needed.
\copy (SELECT similarity_score, device_id, timestamp
       FROM face_verification_logs WHERE student_id = '<student id>'
       ORDER BY timestamp DESC) TO '/evidence/<id>_face_verification.csv' CSV HEADER

-- 3. Delete the biometric data. ON DELETE CASCADE handles face_embeddings.
UPDATE students SET face_data = NULL, face_registered = false
WHERE id = '<student id>';
DELETE FROM face_embeddings      WHERE student_id = '<student id>';
DELETE FROM face_verification_logs WHERE student_id = '<student id>';

-- 4. Record the deletion. Integrity survives; identity does not.
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
VALUES (NULL, 'ERASE_BIOMETRIC', 'student', '<student id>',
        jsonb_build_object(
          'deleted_embeddings',  (SELECT count(*) FROM face_embeddings WHERE student_id='<student id>'),
          'deleted_verifications',(SELECT count(*) FROM face_verification_logs WHERE student_id='<student id>'),
          'operator', '<admin id>', 'reason', 'consent withdrawn'));

-- 5. Revoke sessions so the student cannot keep verifying.
DELETE FROM sessions WHERE user_id = '<student user id>';

-- 6. Notify the student and record the request in your DSR log.
```

**Do not delete the `attendance` rows.** They are the academic record.

> Order matters. Step 2 before step 3, because step 3 destroys the evidence you
> are preserving.

### 4.2 Account deletion on exit

```sql
-- Soft-delete. This is what DELETE /api/admin/users/:id already does.
UPDATE profiles SET is_active = false WHERE email = '<email>';

-- Terminate access.
DELETE FROM sessions           WHERE user_id = '<uid>';
DELETE FROM token_blacklist    WHERE user_id = '<uid>';
DELETE FROM password_resets    WHERE user_id = '<uid>';
DELETE FROM trusted_devices    WHERE user_id = '<uid>';

-- Erase biometrics at the same time as the account.
-- (see §4.1 steps 2–4)
```

Never hard-delete the `students` row: it cascades to attendance, grades and
leaves, and it breaks the attendance hash chain.

### 4.3 Ageing out at graduation

At `[GRADUATION + N]` years, per institutional policy:

```sql
-- Keep the academic record; remove the operational and biometric data.
UPDATE students SET face_data = NULL, face_registered = false WHERE id = '<id>';
DELETE FROM face_embeddings        WHERE student_id = '<id>';
DELETE FROM geo_verifications      WHERE user_id = '<uid>';
DELETE FROM notifications          WHERE user_id = '<uid>';
DELETE FROM login_history          WHERE user_id = '<uid>';
DELETE FROM sessions               WHERE user_id = '<uid>';
-- Pseudonymise, do not delete:
UPDATE audit_logs SET user_id = NULL WHERE user_id = '<uid>';
UPDATE security_events SET user_id = NULL WHERE user_id = '<uid>';
UPDATE api_request_log SET user_id = NULL WHERE user_id = '<uid>';
```

Purging geo, login and notification data at this point is where the biggest
privacy gain is available — and it does not affect the academic record at all.

---

## 5. Traps to avoid

### 5.1 The adaptive embedding set grows on its own

`ai-server/routes/face.py` writes a **new** embedding into `face_embeddings`
every time a verification succeeds with similarity ≥ 0.90. A student who marks
attendance daily for three years accumulates a large reference set.

Consequences you must plan for:

- **Storage** grows per active student, not per enrolled student.
- **Erasure must cover the whole set.** Deleting `students.face_data` alone is
  not erasure — the `face_embeddings` rows are the live biometric data. That is
  why §4.1 deletes both.
- **Retention cannot be enforced per-row** by age without losing the adaptive
  benefit. Purge on account closure and on consent withdrawal, not on a rolling
  age window — unless your institution decides the accuracy gain is not worth the
  accumulation, in which case cap the set at `[N]` most recent embeddings.
- **⚠ VERIFY** whether a size cap exists. Nothing in the code I read caps the
  set.

### 5.2 Backups contain biometric data

`supabase/functions/backup/index.ts` exports `students`, and `students` has
`face_data`. So every application backup contains biometric templates.

- Backups inherit the **biometric** retention period in practice, not the
  attendance one, because individual rows cannot be deleted from a backup.
- With `[35]`-day retention and a nightly backup, an erased embedding still
  exists in up to 35 backups. Say so in the privacy policy — "erased within
  `[35]` days including backups" is honest and defensible; "erased immediately"
  is not.
- Deleting the `db-backups` bucket objects is what actually removes them. A
  retention job that only deletes `backups` **rows** leaves the objects in
  storage.

> **⚠ VERIFY** — `cleanup_old_backups()` deletes from the `backups` table. It
> does **not** call the Storage API. Bucket objects will survive row deletion
> indefinitely unless you write the object deletion yourself. This is a live gap.

### 5.3 The AI audit log is in-memory

`models/audit_logger.py` keeps recent decisions in process memory and mirrors
them to `${AUDIT_LOG_DIR}/audit_<date>.jsonl` when `AUDIT_LOG_ENABLED=true`.

- After a restart, `/api/analytics/audit/*` returns nothing.
- The JSONL files are the durable record. In `docker-compose.yml` that
  directory is a named volume (`audit-logs`). **On Railway, a redeploy may lose
  it** — verify the volume is a persistent mount, or set
  `AUDIT_LOG_ENABLED` and ship the directory somewhere durable.

### 5.4 The hash chain constrains deletion

`GET /api/blockchain/status` verifies the chain. Deleting attendance rows breaks
it. This is a feature: it makes silent deletion impossible. Plan for it rather
than working around it. If you must delete an attendance row for legal reasons,
record the deletion in `audit_logs` and expect `/api/blockchain/status` to
report `TAMPERED` — which is the correct, visible outcome.

### 5.5 `DELETE /api/admin/users/:id` is a soft delete

It sets `profiles.is_active = false`. Nothing is removed. Anyone told "the
account was deleted" must be corrected: the record remains until an explicit
erasure procedure runs.

---

## 6. Implementation status — read this before relying on the schedule

### 6.1 What exists today

| Prune | Where | Retention |
| --- | --- | --- |
| Expired `token_blacklist` rows | `security-monitor` `cleanup`, or `POST /api/security/cleanup-tokens` | until token expiry |
| `api_request_log` | `security-monitor` `cleanup` | 30 days |
| `login_history` | `security-monitor` `cleanup` | 90 days |
| Completed `backups` rows | `cleanup_old_backups()` | `retention_days`, default 30 |
| Expired `password_resets` | overwritten on each request; no sweep | 1 hour |
| Sessions | on logout / password change / `revoke-all` | until revoked |

### 6.2 What does not exist — you must build it

- [ ] Face embeddings — no code path deletes them except `ON DELETE CASCADE`
      from a hard student delete, which we advise against.
- [ ] `face_verification_logs`
- [ ] `geo_verifications`
- [ ] `notifications`
- [ ] `sessions` (expiry sweep)
- [ ] `mfa_backup_codes`, `trusted_devices`
- [ ] `db-backups` **storage objects** (§5.2)
- [ ] AI audit JSONL rotation
- [ ] Pseudonymisation of `audit_logs` / `security_events` at the end of the
      retention period
- [ ] Self-service data export and erasure endpoints

### 6.3 Interim compensating measure

Until the jobs above exist:

1. Run the §4 procedure **on request**, under two-person control.
2. Schedule a **quarterly review** of `face_registered = false` students and
   departed accounts, and purge their biometrics and geo data.
3. Record every run in a DSR register with date, operator, scope and outcome.
4. State in the privacy policy that retention is applied by administrative
   procedure at `[FREQUENCY]`, and name the contact.

A manual process that is actually run and logged is defensible. A scheduled
policy that nothing enforces is not.

### 6.4 Suggested implementation shape

- **Trigger:** Supabase `pg_cron`, the same mechanism as
  `supabase/functions/backup/index.ts` documents.
- **Implementation:** a `SECURITY DEFINER` Postgres function per table, granted
  only to `service_role`, so the schedule never needs an application credential.
- **Rule:** the function must be idempotent and must log what it deleted to
  `audit_logs`.
- **Guard:** dry-run mode that reports counts without deleting, so you can
  observe a week of output before you let it run.

```sql
-- Sketch. Review with your DBA; do not run as-is.
CREATE OR REPLACE FUNCTION public.purge_expired_faces(p_days int)
RETURNS TABLE (students_purged bigint) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE n bigint;
BEGIN
  UPDATE students SET face_data = NULL, face_registered = false
   WHERE face_registered = true
     AND updated_at < now() - make_interval(days => p_days);
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM face_embeddings
   WHERE student_id IN (SELECT id FROM students WHERE NOT face_registered);
  DELETE FROM face_verification_logs
   WHERE timestamp < now() - make_interval(months => 12);
  INSERT INTO audit_logs (action, entity_type, new_value)
  VALUES ('RETENTION_PURGE', 'face_embeddings', jsonb_build_object('count', n, 'window_days', p_days));
  RETURN QUERY SELECT n;
END $$;
```

---

## 7. Implementation checklist

- [ ] Agree every `[…]` period with legal counsel and the DPO.
- [ ] Confirm which jurisdictions apply to your cohort — biometric statutes
      differ sharply across US states and India.
- [ ] Complete a DPIA for the biometric processing.
- [ ] Build consent capture with a versioned reference and a timestamp (§4 of
      `docs/PRIVACY_POLICY.md`).
- [ ] Build the withdrawal path **and verify it deletes the whole
      `face_embeddings` set**, not just `students.face_data`.
- [ ] Implement the purge functions in §6.4 with dry-run first.
- [ ] Schedule them and observe a week of dry-run output.
- [ ] **Write the storage-object deletion for the `db-backups` bucket** (§5.2).
- [ ] Confirm the AI server's `audit_logs` volume is persistent across
      deploys (§5.3).
- [ ] `REVOKE SELECT (face_data) ON public.students FROM authenticated;` after
      testing admin screens.
- [ ] Cap the adaptive embedding set, or document that it is uncapped (§5.1).
- [ ] Test the manual procedure (§4) end to end on a test account before you
      need it for real.
- [ ] Update `docs/PRIVACY_POLICY.md` §11 to state what is actually enforced.
- [ ] Publish the schedule and the DSR contact; start the register.