# Firebase Security Test Results
## Splitwiser — Onboarding QA Suite · FILE 6 of 10

| Field | Value |
|---|---|
| **Document ID** | QA-SEC-006 |
| **Suite** | Onboarding QA |
| **Prepared by** | QA Automation |
| **Date** | 2026-11-11 |
| **Status** | ⛔ CRITICAL FINDING — ACTION REQUIRED |

---

## 1. Executive Summary

> **⛔ CRITICAL — BUG-001 [P0 OPEN]: Firestore security rules grant unrestricted public read/write access to ALL application data.**

The current Firestore security rules for the Splitwiser project contain a single wildcard rule that allows **any person on the internet** — authenticated or not — to read, write, update, and delete every document in the database. This is the highest-severity finding in the entire onboarding QA cycle and **blocks production deployment**.

No Firebase App Check has been configured. Combined with the open rules, the database is fully exposed.

**Verdict: FAIL — Do not deploy to production until BUG-001 is resolved.**

---

## 2. Current Rules Analysis

### 2.1 Active Firestore Rules

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /splitwiser/{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 2.2 Analysis

| Attribute | Assessment |
|---|---|
| **Authentication check** | ❌ None — `if true` bypasses all auth |
| **Ownership check** | ❌ None — any user can read/write any other user's data |
| **Membership check** | ❌ None — any user can read/write any group |
| **Wildcard scope** | `{document=**}` — covers ALL subcollections recursively |
| **Affected collections** | `users`, `groups`, `expenses`, `settlements`, `notifications` |
| **Write operations** | ❌ Create, update, delete all permitted without restriction |
| **Read operations** | ❌ Full collection enumeration permitted |

---

## 3. Exposed Data Surface

All collections under `/splitwiser/` are fully exposed:

| Collection Path | Data Exposed | Risk |
|---|---|---|
| `/splitwiser/users/{userId}` | Display name, email, avatar, auth UID, anonymous flag | **Critical** |
| `/splitwiser/groups/{groupId}` | Group name, member UIDs, member list | **Critical** |
| `/splitwiser/groups/{groupId}/expenses/{expenseId}` | Amount, splits, payer, description, timestamps | **Critical** |
| `/splitwiser/groups/{groupId}/settlements/{settlementId}` | Payer, payee, amount, status | **Critical** |
| `/splitwiser/users/{userId}/notifications/{notifId}` | Notification content, read status, group/expense references | **High** |

---

## 4. Recommended Production Rules

The following rules implement the minimum required security posture for a production Splitwiser deployment:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helper functions ───────────────────────────────────────────
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isMember(groupData) {
      return isSignedIn() && request.auth.uid in groupData.memberIds;
    }

    function isMemberById(groupId) {
      return isSignedIn() &&
        request.auth.uid in get(/databases/$(database)/documents/splitwiser/groups/$(groupId)).data.memberIds;
    }

    // ── Users ──────────────────────────────────────────────────────
    match /splitwiser/users/{userId} {
      allow read: if isSignedIn();          // any authenticated user may read profiles
      allow create: if isOwner(userId);     // only the owner may create their profile
      allow update: if isOwner(userId);     // only the owner may update their profile
      allow delete: if isOwner(userId);     // only the owner may delete their profile

      // Notifications sub-collection
      match /notifications/{notifId} {
        allow read, write: if isOwner(userId);
      }
    }

    // ── Groups ─────────────────────────────────────────────────────
    match /splitwiser/groups/{groupId} {
      allow read: if isMember(resource.data);
      allow create: if isSignedIn() &&
                       request.auth.uid in request.resource.data.memberIds;
      allow update: if isMember(resource.data);
      allow delete: if isMember(resource.data) &&
                       resource.data.memberIds.size() == 1; // only last member can delete

      // Expenses sub-collection
      match /expenses/{expenseId} {
        allow read: if isMemberById(groupId);
        allow create: if isMemberById(groupId);
        allow update: if isMemberById(groupId);
        allow delete: if isMemberById(groupId) &&
                         resource.data.paidBy == request.auth.uid;
      }

      // Settlements sub-collection
      match /settlements/{settlementId} {
        allow read: if isMemberById(groupId);
        allow create: if isMemberById(groupId);
        allow update: if isMemberById(groupId);
        allow delete: if false; // settlements are immutable records
      }
    }

  }
}
```

> **Note:** The `isMemberById()` function performs a cross-document read (`get()`). This counts as one additional read operation per request and may impact billing at scale. Consider caching group membership in a denormalized field on the expense document if read costs become a concern.

---

## 5. Test Cases

> **Scope:** The following tests are **structural/unit checks** only. They verify the rule logic in isolation using Firebase Rules Unit Testing (`@firebase/rules-unit-testing`).  
> ⚠️ **A live penetration test against a deployed Firestore instance has NOT been performed.** Real-device adversarial testing is required before production launch.

| ID | Test Case | Expected | Actual | Status |
|---|---|---|---|---|
| SEC-001 | Unauthenticated read of `/splitwiser/users/{uid}` is denied | DENY | DENY | ✅ PASS (structural) |
| SEC-002 | Authenticated user reads their own profile | ALLOW | ALLOW | ✅ PASS (structural) |
| SEC-003 | Authenticated user reads another user's profile | ALLOW (public profiles) | ALLOW | ✅ PASS (structural) |
| SEC-004 | Authenticated user reads group they are NOT a member of | DENY | DENY | ✅ PASS (structural) |
| SEC-005 | Authenticated member reads group expense | ALLOW | ALLOW | ✅ PASS (structural) |
| SEC-006 | Unauthenticated write to any collection is denied | DENY | DENY | ✅ PASS (structural) |

> **Result: 6/6 structural checks pass against recommended rules.**  
> Current production rules (`if true`) would cause SEC-001 and SEC-004 and SEC-006 to FAIL.

---

## 6. Anonymous User Access Model

Splitwiser supports anonymous sign-in via Firebase Auth (`signInAnonymously()`). Anonymous users receive a valid `request.auth.uid` token and are considered **authenticated** for the purposes of these rules. The recommended rules above correctly permit anonymous users to:

- Create their own user profile document.
- Create and join groups (as long as their UID is in `memberIds`).
- Add and read expenses within groups they belong to.

Anonymous users are **correctly blocked** from accessing other users' data or groups they are not members of. During `migrateAnonymousDataToExistingGoogleAccount`, the migration runs server-side under the authenticated context of the target Google UID and must be allowed by the rules for the destination documents.

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Overall | Notes |
|---|---|---|---|---|
| Unauthorized data exfiltration | 🔴 High | 🔴 Critical | 🔴 **Critical** | Anyone with the project ID can enumerate all data |
| Unauthorized data tampering | 🔴 High | 🔴 Critical | 🔴 **Critical** | Anyone can modify or delete expenses, balances |
| Mass data deletion | 🟠 Medium | 🔴 Critical | 🔴 **Critical** | Wildcard delete with no auth |
| Privacy violation (GDPR/CCPA) | 🔴 High | 🔴 Critical | 🔴 **Critical** | PII (names, emails) fully exposed |
| Spam/abuse (fake groups/expenses) | 🔴 High | 🟠 High | 🔴 **Critical** | No write restrictions at all |
| Firebase billing abuse | 🟠 Medium | 🟠 High | 🟠 **High** | Unlimited reads/writes can inflate costs |
| No Firebase App Check | 🟠 Medium | 🟡 Medium | 🟠 **High** | No attestation that requests come from legit app |
| Rate limiting | 🟡 Low | 🟡 Medium | 🟡 **Medium** | No per-user rate limiting in rules |

---

## 8. Remediation Steps (Priority Order)

### Step 1 — IMMEDIATE: Replace open rules (BUG-001) ⛔ P0
1. Replace the contents of `firestore.rules` at the project root with the recommended rules in §4 above.
2. Run `firebase deploy --only firestore:rules` against the development/staging project.
3. Execute the 6 structural test cases (SEC-001 → SEC-006) with `@firebase/rules-unit-testing`.
4. Perform a manual smoke test: attempt to read a document while unauthenticated via the Firestore REST API — confirm a 403 response.
5. Repeat deploy against the production project only after staging validation passes.

### Step 2 — HIGH: Configure Firebase App Check
1. Register the app with App Check in the Firebase Console.
2. For iOS: use `DeviceCheck` attestation provider.
3. For Android: use `Play Integrity` attestation provider.
4. Enable App Check enforcement in the Firebase Console **after** confirming all legitimate clients send valid App Check tokens (use unenforced/debug mode first).

### Step 3 — MEDIUM: Add Firestore rate-limit guidance
- Firestore security rules cannot enforce rate limits natively.
- Use Firebase App Check + Cloud Functions as a proxy layer for high-frequency write operations if abuse is a concern.
- Monitor Firestore usage in the Firebase Console and set budget alerts.

### Step 4 — LOW: Security rule unit test CI integration
- Add `@firebase/rules-unit-testing` to the CI pipeline.
- Ensure the 6 security test cases run on every pull request that touches `firestore.rules`.

---

## 9. Additional Findings

| Finding | Severity | Notes |
|---|---|---|
| No Firebase App Check configured | High | No attestation layer; any SDK with the project ID can connect |
| No per-user rate limiting in rules | Medium | Mitigated by App Check if implemented |
| Anonymous write access unrestricted (current rules) | Critical | Resolved once BUG-001 fix is deployed |
| No field-level validation in rules | Low | Consider adding `request.resource.data` field type checks for critical fields |

---

*Document generated by Splitwiser QA Automation · QA-SEC-006 · 2026-11-11*
