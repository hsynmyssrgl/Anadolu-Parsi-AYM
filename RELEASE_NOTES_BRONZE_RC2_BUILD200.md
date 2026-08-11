# Bronze RC2 Build 200 Release Notes

Build 200 closes propagation-status substitution. A clean rewrite marked `success` can link only to a propagation run marked `success`; a clean rewrite marked `partial` can link only to a propagation run marked `partial`. Repository validation and SQLite migration 44 enforce the same fail-closed rule.
