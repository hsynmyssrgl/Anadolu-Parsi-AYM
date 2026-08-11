# DEC-117 — PR-172 platform-actual context HARD_STOP

- Build: 225
- Status: Accepted

PR-172 corrects the earlier estimated-context policy. Only a context-use percentage actually supplied by the platform can produce `WARNING` or `HARD_STOP`. When the platform supplies no actual percentage, the state is `UNMEASURED`; an assistant estimate, prior-build estimate, or inferred token count cannot trigger mandatory handoff. Actual usage below 90% never requires a handoff. At actual usage of 90% or above, the current response must include the full copyable handoff, `handoff/NEW_CHAT_HANDOFF_BUILDxxx.md` must be created, and another build cannot begin in that chat. ADR-100 and Constitution V6 are binding.
