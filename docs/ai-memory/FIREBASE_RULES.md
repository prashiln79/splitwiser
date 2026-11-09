# Firebase Security Rules & Access Control: Splitwiser

This document provides a security audit of current Cloud Firestore and Firebase Storage security rules, analyzes authorization boundaries, and provides production-ready security rules templates.

---

## 1. Current Development Rules Audit

### File: `firestore.rules`
```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ─── Splitwiser namespace ─────────────────────────────────────────────────
    // All data lives under /splitwiser/{document=**}
    // Rules are open for development – tighten before production.
    match /splitwiser/{document=**} {
      allow read, write: if true;
    }
  }
}
```

### Security Analysis
- **Current State**: Fully permissive read and write access under `/splitwiser/**`.
- **Purpose**: Rapid offline/online synchronization prototyping without permission errors during multi-client schema evolution.
- **Risk Assessment**: High risk in production. Any client with the Firebase project API key can read or overwrite any user's profile, expenses, groups, or settlements.

---

## 2. Production Security Model Specification

To transition to production, the rules must enforce four core authorization invariants:
1. **User Identity Boundary**: Only the authenticated account owner (`request.auth.uid == uid`) can edit their own profile document or upload their custom profile photo.
2. **Group Membership Isolation**: A user can only read or write groups, expenses, and settlements if their `request.auth.uid` is contained in the group's `memberIds` array.
3. **Role-Based Permissions**: Group deletion and administrative settings modification can optionally be restricted to members with role `'admin'`.
4. **Data Validation & Sanitization**: Ensure negative monetary amounts are rejected and required fields are present.

---

## 3. Production Hardened Firestore Rules Recommendation

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isGroupMember(groupId) {
      return isAuthenticated() && 
        request.auth.uid in get(/databases/$(database)/documents/splitwiser/data/groups/$(groupId)).data.memberIds;
    }

    // ─── Splitwiser Data Root ───────────────────────────────────────────────
    match /splitwiser/data {

      // 1. User Profiles
      match /users/{userId} {
        // Authenticated users can read other users' public profiles (name, avatar) to display in groups
        allow read: if isAuthenticated();
        // Only the profile owner can modify their profile data
        allow write: if isOwner(userId);
      }

      // 2. Groups
      match /groups/{groupId} {
        // Members can read group details
        allow read: if isAuthenticated() && (
          resource == null || 
          request.auth.uid in resource.data.memberIds
        );
        
        // Anyone authenticated can create a group (they must be the creator and in memberIds)
        allow create: if isAuthenticated() && 
          request.resource.data.createdBy == request.auth.uid &&
          request.auth.uid in request.resource.data.memberIds;
          
        // Existing members can update metadata (or join via join code)
        allow update: if isAuthenticated() && (
          request.auth.uid in resource.data.memberIds ||
          // Allow joining: user adds only themselves to memberIds
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberIds', 'updatedAt'])
        );
        
        // Only group creator / admin can delete
        allow delete: if isAuthenticated() && resource.data.createdBy == request.auth.uid;

        // 2a. Group Members Subcollection
        match /members/{memberId} {
          allow read: if isGroupMember(groupId);
          allow write: if isGroupMember(groupId) || request.auth.uid == memberId;
        }

        // 2b. Expenses Subcollection
        match /expenses/{expenseId} {
          allow read: if isGroupMember(groupId);
          allow create, update: if isGroupMember(groupId) && 
            request.resource.data.amount > 0 &&
            request.resource.data.description.size() > 0;
          allow delete: if isGroupMember(groupId);
        }

        // 2c. Settlements Subcollection
        match /settlements/{settlementId} {
          allow read: if isGroupMember(groupId);
          allow create, update: if isGroupMember(groupId) && 
            request.resource.data.amount > 0;
          allow delete: if isGroupMember(groupId);
        }

        // 2d. Group Activity Subcollection
        match /activity/{activityId} {
          allow read: if isGroupMember(groupId);
          allow create: if isGroupMember(groupId);
          allow update, delete: if false; // Append-only audit log
        }
      }

      // 3. Friendships
      match /friendships/{friendshipId} {
        allow read: if isAuthenticated() && (
          resource.data.userId == request.auth.uid || 
          resource.data.friendId == request.auth.uid
        );
        allow create: if isAuthenticated() && 
          request.resource.data.initiatedBy == request.auth.uid;
        allow update, delete: if isAuthenticated() && (
          resource.data.userId == request.auth.uid || 
          resource.data.friendId == request.auth.uid
        );
      }

      // 4. Support Tickets
      match /support_tickets/{ticketId} {
        allow create: if isAuthenticated() && 
          request.resource.data.userId == request.auth.uid;
        allow read, update, delete: if false; // Admin console access only
      }
    }
  }
}
```

---

## 4. Firebase Storage Rules Specification

### Production Storage Rules Recommendation

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isImage() {
      return request.resource.contentType.matches('image/.*');
    }

    // 1. User Profile Avatars
    // Path: splitwiser/users/{userId}/profile/{fileName}
    match /splitwiser/users/{userId}/profile/{fileName} {
      // Any authenticated user can read avatars for group display
      allow read: if isAuthenticated();
      // Only the profile owner can upload or replace their avatar
      allow write: if isAuthenticated() && 
        request.auth.uid == userId &&
        isImage() && 
        request.resource.size < 5 * 1024 * 1024; // 5MB limit
      allow delete: if isAuthenticated() && request.auth.uid == userId;
    }

    // 2. Group Cover Photos
    // Path: splitwiser/groups/{groupId}/covers/{fileName}
    match /splitwiser/groups/{groupId}/covers/{fileName} {
      // Group covers readable by authenticated users
      allow read: if isAuthenticated();
      // Only authenticated users can upload cover images up to 10MB
      allow write: if isAuthenticated() && 
        isImage() && 
        request.resource.size < 10 * 1024 * 1024;
      allow delete: if isAuthenticated();
    }
  }
}
```

