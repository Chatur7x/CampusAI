# Legal documents

Compliance drafts for CampusAI. Every document here is a **draft requiring
legal review** — none is legal advice, and none should be published as-is.

| Document | Path | Purpose |
| --- | --- | --- |
| Privacy Policy | [`../PRIVACY_POLICY.md`](../PRIVACY_POLICY.md) | How personal data — including biometric data — is collected, used, shared and retained |
| Terms of Service | [`../TERMS_OF_SERVICE.md`](../TERMS_OF_SERVICE.md) | The agreement between the institution and the platform's users |
| Data Retention | [`../DATA_RETENTION.md`](../DATA_RETENTION.md) | The retention schedule, its legal rationale, and the erasure-versus-audit tension |

## Before you publish anything here

Each document carries a pre-publication checklist. Three things block
publication of all of them:

1. **Consent capture is not implemented.** There is no consent screen and no
   column recording consent. `docs/PRIVACY_POLICY.md` §4.3 promises recorded
   consent; the software cannot yet deliver it. See `docs/ONBOARDING.md` step 13.
2. **Retention is largely not implemented.** Nothing in the repository deletes
   face embeddings, face verification logs, geolocation records or sessions on a
   schedule. `docs/DATA_RETENTION.md` §6 lists exactly what does and does not run.
   A published schedule you do not enforce is a commitment you are not keeping.
3. **No self-service export or erasure exists.** There is no data-subject
   access or deletion endpoint. The manual procedure in `docs/DATA_RETENTION.md`
   §4 is what you would actually operate.

## Framework coverage

| Framework | Where addressed |
| --- | --- |
| GDPR (EU/UK) | Privacy Policy §4.2, §6, §9; Retention §1, §3 |
| FERPA (US) | Privacy Policy §4.2, §6 |
| US state biometric statutes (BIPA, CUBI, Texas) | Privacy Policy §4.2 |
| India DPDP Act 2023 | Privacy Policy §4.2, §6, §13; Retention §1 |

Biometric law varies more sharply by jurisdiction than any other area covered
here. US states in particular impose independent collection, consent,
retention and destruction duties that do not derive from FERPA. Determine which
regimes reach your cohort before you finalise a single retention period.

## Keeping these in sync

These documents describe what the code does. When behaviour changes, update
them in the same change:

- a new biometric-processing path → Privacy Policy §4, §5, §11
- a new data class or table → Data Retention §2
- a new endpoint that reads personal data → API reference (`../API.md`) and
  Privacy Policy §5/§6
- a new retention job → Data Retention §6.1

A policy document that describes an implementation that no longer exists is
worse than no policy document.