# Barista: friends and invites

Status: **built.** Friends only ever see each other's *locked* recipes. They show in the Library's Friends switch and feed your suggestions.

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

## Friends' recipes

- **Library > Friends** lists every recipe a friend has locked (newest first): their photo, the bean, their name, the date, and the numbers (coffee, water, temperature, and the grind **in your grinder's units**: the recipe stores microns, so it converts like your own). Rating, brews and notes are never visible.
- **Tap one for a bean you have a bag of** and the recipe screen opens with their numbers filled in as edits (coffee, temperature, grind, pours, time) on *your* grinder and filter, ready to brew or tweak. Nothing is copied into your library until you brew it, when it becomes your working recipe for that bean like any other. For a bean you do not have, the row just shows the recipe with "Add this bean to brew it".
- **Suggestions:** for a bean where you have no recipe of your own, a friend's locked recipe for the same bean is the starting point (temperature and grind), with **medium** confidence, and the pill says whose: "Based on Sam's locked recipe". Your own locked recipe always wins; several friends use the middle value; friends' recipes for *other* beans count as similar-bean evidence, as the engine already supported. The engine reports where a start came from (`confidence.source`, `confidence.who`).
- Not built: saving a copy with "reset to original" (decided against for now: brewing from their numbers makes them yours when you brew).

## Removing a friend

A **Remove** button on each friend, with a confirmation: you stop seeing each other's locked recipes, recipes you already brewed from theirs stay yours, and being friends again takes a new invite. Either person can end it, and it ends for both (`friendships` allows delete for both participants; tested in `supabase/tests/bags_friends.test.sql`). Their recipes leave your Library and suggestions at once.

## Next

- Telling you when a friend locks a recipe for a bean you have.
