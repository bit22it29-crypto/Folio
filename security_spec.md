# Folio Security Specification & Payload TDD

## 1. Data Invariants
1. **PII Isolation**: User email addresses and digest preferences live exclusively in `/users/{userId}/private/info`, readable and writable only when `request.auth.uid == userId`. Public `/users/{userId}` never stores email or phone fields.
2. **Publication Ownership**: Only `publication.ownerId == request.auth.uid` may edit publication metadata (`pinnedPostId`, `welcomeNote`, settings) or delete the publication.
3. **Post Integrity**: A post cannot exist without an existing parent `publicationId` owned by `request.auth.uid`. Drafts (`status == 'draft'`) and scheduled issues (`status == 'scheduled'`) are readable only by `authorId == request.auth.uid`; published posts (`status == 'published'`) are publicly readable. Topic tags are strictly bounded (`list.size() <= 5`) with element length checks.
4. **Revision History Master Gate**: `/posts/{postId}/revisions/{revId}` requires parent `/posts/{postId}` ownership (`authorId == request.auth.uid`) on `get`, `create`, and `delete`, and strictly scopes `list` to `resource.data.authorId == request.auth.uid`.
5. **Atomic Counters (`existsAfter`)**:
   - `publications.subscriberCount` can change by `+1` or `-1` ONLY in an atomic batch paired with creating/deleting `/subscriptions/{pubId}_{uid}`.
   - `posts.likesCount` can change by `+1` or `-1` ONLY in an atomic batch paired with creating/deleting `/postLikes/{postId}_{uid}`.
   - `notes.likesCount` can change by `+1` or `-1` ONLY in an atomic batch paired with creating/deleting `/noteLikes/{noteId}_{uid}`.
6. **Comment Master Gate & Edit Scope**: Comments under `/posts/{postId}/comments/{commentId}` require the parent post to exist and have `status == 'published'`. Authors may edit only `body` and `editedAt` (`request.time`) on their own comments.
7. **Reader Private Data (Highlights, Reading Progress, Notifications)**:
   - `/highlights/{highlightId}` and `/readingProgress/{progressId}` are strictly private to `userId == request.auth.uid`.
   - `/notifications/{notifId}` can be created by a verified actor (`actorId == request.auth.uid`, `read == false`) for an existing `recipientId`, while `get`, `list`, `update` (only `read`), and `delete` are strictly limited to `recipientId == request.auth.uid`.
8. **Temporal Integrity**: `createdAt` and `updatedAt` are strictly validated against `request.time`, and `createdAt` / `ownerId` / `authorId` / `publicationId` remain immutable after creation.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Shadow Field Injection on Publication Create**: `{ ...validPub, isVerified: true }` -> Blocked by `keys().hasOnly(...)`.
2. **Identity Spoofing on Post Create**: `{ ...validPost, authorId: "victim_uid" }` -> Blocked by `incoming().authorId == request.auth.uid`.
3. **Orphaned Post Creation**: `{ ...validPost, publicationId: "nonexistent_pub" }` -> Blocked by `exists(/databases/.../publications/nonexistent_pub)` and owner match.
4. **Scheduled Post Leakage**: Unauthenticated or non-author querying `posts` with `status == 'scheduled'` -> Blocked by `allow list: if resource.data.status == 'published' || (isSignedIn() && resource.data.authorId == request.auth.uid)`.
5. **Tag Array Exhaustion**: Post payload with 50 tags or oversized tag strings -> Blocked by `data.tags.size() <= 5` and `data.tags[0].size() <= 28`.
6. **PII Snooping**: Authenticated User B reading `/users/userA/private/info` or `/highlights` belonging to User A -> Blocked by `isOwner` / `userId == request.auth.uid`.
7. **Unverified Email Write**: Signed-in user with `email_verified: false` attempting to publish a post -> Blocked by `isVerifiedUser()`.
8. **ID Poisoning**: Document ID exceeding 128 chars or containing `/` / `$` -> Blocked by `isValidId(id)`.
9. **Counter Desync / Spoofing**: Client updating `posts.likesCount` by `+100` without creating `/postLikes/{postId}_{uid}` -> Blocked by `likesCount == existing().likesCount + 1 && existsAfter(...)`.
10. **Comment Ownership Hijack on Edit**: User B updating `authorId` or `createdAt` on User A's comment -> Blocked by `existing().authorId == request.auth.uid` and `affectedKeys().hasOnly(['body', 'editedAt'])`.
11. **Notification Tampering**: Actor updating or reading another user's notifications -> Blocked by `recipientId == request.auth.uid`.
12. **Comment on Unpublished/Scheduled Post**: Posting a comment under a draft or scheduled post -> Blocked by Master Gate `get(post).data.status == 'published'`.
