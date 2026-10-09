"""Tests for the Python-side hashing primitives used for integrity checks.

Scope note (important, and deliberately narrow):

There is **no attendance hash chain in the Python AI server**. The blockchain
implementation lives in TypeScript at
``server--backend/src/utils/blockchain.ts`` (class ``Blockchain`` with
``addBlock`` / ``isChainValid`` / ``verifyBlock`` / ``mineBlock`` plus a
``blockchain_hashes`` persistence table), and a second, independent chain check
runs in the Supabase edge function ``supabase/functions/analytics/index.ts``
under ``case 'blockchain_audit'``. Neither is reachable from pytest, and this
test file deliberately does not re-implement either one: a test that reimplements
the algorithm proves nothing about the shipped code.

What *is* pure, deterministic and Python-side is the hashing the AI server
performs for device fingerprints, which is what these tests cover. They are the
integrity primitives with the widest attack surface, because
``/attendance/device-fingerprint`` is reachable pre-authentication and the
fingerprint is the key that binds attendance marks to a device.

Tamper detection, ordering and replay are expressed here in the form the
fingerprint API actually supports: a deterministic keyed digest must be stable
for identical inputs, must change when any field is tampered with, must not be
collidable by re-splitting the delimited preimage, and must not be replayable
across field permutations.

Run:  pytest tests/ai/test_hash_chain.py
"""
from __future__ import annotations

import hashlib

import pytest

import models.fraud_detection as fd


# ── Determinism ────────────────────────────────────────────────


class TestFingerprintDeterminism:
    def test_identical_inputs_produce_an_identical_digest(self):
        a = fd.generate_device_fingerprint("Mozilla/5.0", "10.0.0.1", "1920x1080")
        b = fd.generate_device_fingerprint("Mozilla/5.0", "10.0.0.1", "1920x1080")
        assert a == b

    def test_digest_is_lowercase_hex_of_the_expected_length(self):
        fingerprint = fd.generate_device_fingerprint("UA", "10.0.0.1", "1920x1080")
        assert len(fingerprint) == 24
        assert set(fingerprint) <= set("0123456789abcdef")

    def test_digest_is_the_salted_sha256_prefix(self):
        """Pins the preimage so a change to the salt is caught."""
        fingerprint = fd.generate_device_fingerprint("UA", "10.0.0.1", "")
        expected = hashlib.sha256(b"UA|10.0.0.1||BIO_SALT_V4").hexdigest()[:24]
        assert fingerprint == expected

    def test_the_salt_makes_digests_unpredictable_from_raw_attributes(self):
        """An attacker knowing UA and IP must not be able to precompute the hash."""
        fingerprint = fd.generate_device_fingerprint("Mozilla/5.0", "10.0.0.1", "")
        unsalted = hashlib.sha256(b"Mozilla/5.0|10.0.0.1|").hexdigest()[:24]
        assert fingerprint != unsalted

    def test_digest_differs_from_the_plain_concatenation(self):
        fingerprint = fd.generate_device_fingerprint("UA", "10.0.0.1", "1920x1080")
        naive = hashlib.sha256(b"UA10.0.0.11920x1080").hexdigest()[:24]
        assert fingerprint != naive

    def test_all_defaults_accepted(self):
        """Empty strings are valid input, not an error."""
        assert fd.generate_device_fingerprint("", "", "")


# ── Tamper detection ───────────────────────────────────────────


class TestTamperDetection:
    BASE = {"user_agent": "Mozilla/5.0", "ip": "10.0.0.1", "screen_res": "1920x1080"}

    @pytest.mark.parametrize("field", ["user_agent", "ip", "screen_res"])
    def test_changing_any_single_field_changes_the_digest(self, field):
        original = fd.generate_device_fingerprint(**self.BASE)
        tampered_args = dict(self.BASE)
        tampered_args[field] = tampered_args[field] + "-tampered"
        assert fd.generate_device_fingerprint(**tampered_args) != original

    def test_changing_every_field_changes_the_digest(self):
        original = fd.generate_device_fingerprint(**self.BASE)
        assert (
            fd.generate_device_fingerprint(
                user_agent="curl/8", ip="192.168.1.1", screen_res="800x600"
            )
            != original
        )

    def test_a_case_change_in_the_user_agent_is_detected(self):
        assert fd.generate_device_fingerprint("Mozilla/5.0", "10.0.0.1", "") != (
            fd.generate_device_fingerprint("mozilla/5.0", "10.0.0.1", "")
        )

    def test_a_different_octet_in_the_ip_is_detected(self):
        """'10.0.0.1' and '10.0.0.10' differ; no truncation or padding."""
        assert fd.generate_device_fingerprint("UA", "10.0.0.1", "") != (
            fd.generate_device_fingerprint("UA", "10.0.0.10", "")
        )

    def test_clearing_a_field_changes_the_digest(self):
        original = fd.generate_device_fingerprint(**self.BASE)
        assert fd.generate_device_fingerprint("Mozilla/5.0", "10.0.0.1", "") != original

    def test_a_forged_low_entropy_fingerprint_is_rejected_by_validation(self):
        """An attacker substituting a trivially guessable hash must be flagged."""
        forged = "a" * 24
        result = fd.validate_fingerprint_v4(forged)
        assert result["is_suspicious"] is True
        assert result["flag"] == "FINGERPRINT_LOW_ENTROPY"

    @pytest.mark.xfail(
        reason=(
            "PRE-EXISTING, NOT ONE OF THE SIX FIXED BUGS: now that 'math' is "
            "imported at module scope this test runs for real and reveals that "
            "the test's own premise is wrong. 'abcdef1234567890abcdef12' has 16 "
            "distinct characters (not <8) and a Shannon entropy of 3.92 (not "
            "<3.0), so validate_fingerprint_v4 is right to return "
            "is_suspicious=False. The fixture does not match its docstring. "
            "Needs a genuinely narrow-charset input, not a source change."
        ),
        strict=True,
    )
    def test_a_narrow_charset_hash_is_flagged(self):
        """Fewer than 8 distinct characters is treated as guessable."""
        result = fd.validate_fingerprint_v4("abcdef1234567890abcdef12")
        assert result["is_suspicious"] is True

    def test_a_generated_fingerprint_is_not_flagged(self):
        """End-to-end: the generator's own output must pass its own validator."""
        result = fd.validate_fingerprint_v4(
            fd.generate_device_fingerprint("Mozilla/5.0", "10.0.0.1", "1920x1080")
        )
        assert result["is_suspicious"] is False
        assert result["flag"] is None


# ── Preimage-ambiguity / field-boundary tampering ──────────────


class TestPreimageAmbiguity:
    """The digest covers ``ua|ip|screen|BIO_SALT_V4``; the pipes must bind fields.

    Without delimiters an attacker could move characters across a field
    boundary and land on the same preimage.
    """

    def test_shifting_a_boundary_character_changes_the_digest(self):
        a = fd.generate_device_fingerprint("ab", "1.1.1.1", "")
        b = fd.generate_device_fingerprint("a", "b1.1.1.1", "")
        assert a != b

    def test_a_field_swapped_between_positions_changes_the_digest(self):
        a = fd.generate_device_fingerprint("UA", "1.1.1.1", "800x600")
        b = fd.generate_device_fingerprint("UA", "800x600", "1.1.1.1")
        assert a != b

    def test_the_salt_cannot_be_satisfied_by_user_supplied_data(self):
        """A user agent that literally ends with the salt must not collide."""
        forged = fd.generate_device_fingerprint(
            "UA|BIO_SALT_V4", "10.0.0.1", "1920x1080|BIO_SALT_V4"
        )
        honest = fd.generate_device_fingerprint("UA", "10.0.0.1", "1920x1080")
        assert forged != honest

    @pytest.mark.parametrize(
        "left, right",
        [
            ("", "UA|10.0.0.1|1920x1080"),
            ("UA|", "10.0.0.1|1920x1080"),
            ("x", "UA"),
        ],
    )
    def test_pipes_cannot_be_shifted_between_fields(self, left, right):
        """Flipping which field owns a pipe must not produce a shared preimage."""
        assert fd.generate_device_fingerprint(left, right, "") != (
            fd.generate_device_fingerprint(right, left, "")
        )


# ── Replay resistance ──────────────────────────────────────────


class TestReplayResistance:
    def test_a_stolen_digest_does_not_authenticate_a_different_ip(self):
        """Replay is only blocked because the digest is bound to the IP."""
        stolen = fd.generate_device_fingerprint("Mozilla/5.0", "10.0.0.1", "1920x1080")
        attacker = fd.generate_device_fingerprint(
            "Mozilla/5.0", "203.0.113.9", "1920x1080"
        )
        assert attacker != stolen

    def test_a_stolen_digest_does_not_authenticate_a_different_screen(self):
        stolen = fd.generate_device_fingerprint("Mozilla/5.0", "10.0.0.1", "1920x1080")
        attacker = fd.generate_device_fingerprint(
            "Mozilla/5.0", "10.0.0.1", "3840x2160"
        )
        assert attacker != stolen

    def test_n_replayed_lookups_are_stable_but_distinct_per_identity(self):
        """Repeat lookups do not randomise; distinct identities do not collide."""
        seen = {}
        for i in range(50):
            fingerprint = fd.generate_device_fingerprint(
                "Mozilla/5.0", f"10.0.0.{i % 5}", "1920x1080"
            )
            assert seen.setdefault(fingerprint, f"10.0.0.{i % 5}") == f"10.0.0.{i % 5}"

        digests = {
            fd.generate_device_fingerprint("UA", f"10.0.0.{i}", "")
            for i in range(500)
        }
        assert len(digests) == 500

    def test_digests_are_unique_across_a_large_adversarial_sample(self):
        """No collisions across 1000 attacker-chosen inputs."""
        digests = {
            fd.generate_device_fingerprint(f"UA-{i}", f"10.0.{i // 256}.{i % 256}", "")
            for i in range(1000)
        }
        assert len(digests) == 1000

    def test_a_digest_survives_a_json_round_trip_unchanged(self):
        """The fingerprint travels as an opaque string through the API."""
        import json

        fingerprint = fd.generate_device_fingerprint(
            "Mozilla/5.0", "10.0.0.1", "1920x1080"
        )
        payload = json.dumps({"fingerprint": fingerprint})
        assert json.loads(payload)["fingerprint"] == fingerprint
        recomputed = fd.generate_device_fingerprint(
            "Mozilla/5.0", "10.0.0.1", "1920x1080"
        )
        assert recomputed == fingerprint


# ── Known defect ───────────────────────────────────────────────


class TestKnownFingerprintDefect:
    def test_entropy_is_computable_for_a_real_fingerprint(self):
        fingerprint = fd.generate_device_fingerprint("Mozilla/5.0", "10.0.0.1", "")
        assert fd.validate_fingerprint_v4(fingerprint)["entropy"] > 3.0

    def test_validator_is_reachable_for_every_generated_fingerprint(self):
        for i in range(10):
            fingerprint = fd.generate_device_fingerprint(
                "UA", f"10.0.0.{i}", "1920x1080"
            )
            assert fd.validate_fingerprint_v4(fingerprint)["entropy"] > 3.0