# ADR-105 — Single Platform Policy Kernel

Authorization, privacy, consent, retention, recording, AI/OCR/translation, export and capability decisions are centralized in `@ppt/platform-policy`. New direct role checks are prohibited. Existing checks are a measured ratchet debt and may only decrease. Policy version mismatch, untrusted device, missing purpose/consent or unavailable writable quorum fails closed.
