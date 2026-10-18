# Barista: friends and invites

Status: **built (first version).** Friends only ever see each other's *locked* recipes; using them in suggestions and the Library's Friends switch come next.

## How it works

- **Friends tab** (`/friends`): **Invite a friend** makes a single-use link and shows it once in a sheet (Copy, and Share where the phone supports it). Below: **Pending invites** (links nobody has used yet, with the expiry and a Cancel button) and **Your friends** (name, photo, friends since).
- **Invite link** (`/invite/<token>`): says "Sam invited you to be friends", with **Accept** and **Not now**. A link that is used, cancelled, expired, unknown or your own gives one generic "This invite doesn't work" screen, so a link cannot be probed.
- **Signed out?** The link shows the sign-in page; the destination is remembered (`barista.after-sign-in`, since Google's round trip returns to the home page) and you carry on to the invite after signing in.
- Friends see each other's **name and photo** (the profile policy already allowed it) and **locked recipes only**. Brews, notes, working recipes and bags stay private.

## Decisions

| Topic | Decision |
|---|---|
| Where | A fourth tab, Friends. |
| Accepting | A screen shows who invited you first; nobody becomes friends by just opening a link. |
| Invites you sent | A list of the open ones with expiry and Cancel. The link itself cannot be shown again: only its hash is stored (architecture.md section 4), so lose it and you cancel and make a new one. |
| Removing a friend | Not in this version. |

## Database

`20261018123557_peek_and_cancel_invite.sql` adds two functions (tests in `supabase/tests/friends.test.sql`): `peek_invite(token)` returns only the inviter's name and photo with the same generic failure as `accept_invite`; `cancel_invite(token_hash)` lets the inviter withdraw an unused link. Everything else (create and accept, friendships, the profile and recipe policies) existed from the first schema.

## Next

- Friends' locked recipes in the Library (a Mine / Friends switch) and in the suggestion, with their grind converted to your grinder.
- Removing a friend.
