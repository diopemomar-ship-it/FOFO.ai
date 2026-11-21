# FOFO AI — Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Ownership & PII Isolation**: `/users/{userId}` stores creator PII (`email`, `name`) and account state. Only the authenticated verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`) or a verified admin (`diopemomar@gmail.com` with `email_verified == true`) can `get`, `create`, or `update` that document.
2. **No Blanket Listing**: `allow list` on `/users` is restricted to verified admins (`isAdmin()`), preventing any user from scraping other creators' email addresses or accounts.
3. **Strict Key Allowlisting & Anti-Shadow Fields**: `create` enforces `hasAll(['uid', 'name', 'email', 'plan', 'creditsRemaining', 'maxCredits', 'createdAt', 'updatedAt'])` and `hasOnly([...])` so no shadow fields (e.g., `isAdmin`, `role`) can be injected.
4. **Immutable Ownership & Creation Timestamp**: On `update`, `uid` and `createdAt` must remain unchanged (`incoming().uid == existing().uid && incoming().createdAt == existing().createdAt`) and `updatedAt == request.time`.
5. **Privilege Escalation Prevention**: Non-admin users cannot elevate their own `plan` from `'free'` to `'pro'`/`'business'` or inflate `creditsRemaining`/`maxCredits` on `create` (initial account creation must start on `'free'` with `creditsRemaining <= 3` and `maxCredits == 3`).
6. **Temporal Integrity & Path Hardening**: `isValidId(userId)` validates `^[a-zA-Z0-9_\-]+$` with `<= 128` chars, and `createdAt`/`updatedAt` must equal `request.time`.

## 2. The "Dirty Dozen" Payloads (Adversarial Tests)
1. **Unauthenticated Create**: Write to `/users/u1` with `auth = null` -> `PERMISSION_DENIED`.
2. **Unverified Email Create**: Write to `/users/u1` with `auth.uid = 'u1'`, `email_verified = false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing**: User `u1` creates `/users/u2` with `uid: 'u2'` -> `PERMISSION_DENIED`.
4. **UID Mismatch**: User `u1` creates `/users/u1` with `uid: 'u2'` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection**: User `u1` creates `/users/u1` including `isAdmin: true` -> `PERMISSION_DENIED`.
6. **Self-Assigned Pro Plan on Signup**: User `u1` creates `/users/u1` with `plan: 'business'`, `creditsRemaining: 9999` -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: User `u1` creates `/users/u1` with client-forged `createdAt` != `request.time` -> `PERMISSION_DENIED`.
8. **Cross-User PII Read**: User `u1` attempts `get(/users/u2)` -> `PERMISSION_DENIED`.
9. **Collection Scraping**: User `u1` attempts `list(/users)` -> `PERMISSION_DENIED`.
10. **Immutable Field Tampering**: User `u1` updates `/users/u1` changing `createdAt` or `uid` -> `PERMISSION_DENIED`.
11. **Oversized String / Resource Exhaustion**: User `u1` updates `/users/u1` with 2,000-char `name` -> `PERMISSION_DENIED`.
12. **Path ID Poisoning**: Request to `/users/invalid$id!@#` -> `PERMISSION_DENIED`.
