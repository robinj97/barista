# Barista: adding a bag of beans

Status: built (see section 7). Decisions marked **Decided** were agreed in discussion; **Proposed** items were my defaults.

## 1. Goal

Get a new bag into the user's inventory in about 30 seconds, with as little typing as possible, and make the data good enough for the recommendation engine (origin, process, roast level, tasting notes, roast date).

## 2. What other apps and guidance suggest

- Searching a shared catalogue and prefilling beats typing; the user then adds only the roast date and a rating. ([Tamp on Product Hunt](https://www.producthunt.com/products/tamp))
- Label scanning is common (Bloom, BeanBook) but fuzzy, and roast date is the hardest field because it is often not on the bag. Scan results must always go through a "check these details" step, and roast date needs a "not sure" option. (App store listings; vendor claims, not independent tests.)
- A first-use empty state works best with a short explanation and one strong action, and should never be a dead end. ([Set Product](https://www.setproduct.com/blog/empty-state-ui-design), [UXPin](https://www.uxpin.com/studio/blog/ux-best-practices-designing-the-overlooked-empty-states/))
- Apps let people archive finished bags instead of deleting them.

## 3. Decisions

| Topic | Decision |
|---|---|
| Entry when empty | **Decided.** Pebble cluster, "Add your first bag", one line of help, one primary pill button. |
| Entry when not empty | **Decided.** Floating round "+" button, pebble-shaped, bottom right just above the tab bar. |
| Flow shape | **Decided.** Search first, then add as new if not found, then a short "Your bag" step. |
| Required to add | **Decided.** Roaster and name only. Roast date and bag size are prompted with one-tap chips but can be skipped. |
| Asked up front for a brand-new bean | **Decided.** Origin and region, process, roast level, tasting notes. Variety, altitude and producer sit under "More". |
| After saving | **Decided.** Land on the bean page. |
| Roast date input | **Decided.** Quick chips plus a native date picker, with "Not sure". |
| Bean page right after saving | **Decided.** Shows a "Start dialing in" button that links to the Brew tab (still a placeholder for now). |
| Weak signal | **Decided.** Instant optimistic add now (client-generated id, rolls back with a message if saving fails). The full offline queue arrives with brewing. |
| Who sees a new bean | **Decided.** All signed-in users see only **static** bean facts. Anything that varies per bag stays private. See section 5. |
| Scan the bag | **Proposed.** Not shown until photo OCR exists (build step 9), so there is no dead control. |
| Cover art | **Proposed.** Automatic: a pebble shape and tint chosen from the bean's id, so it is stable and needs no input. |

## 4. The flow

### 4.1 Empty Beans tab

- Header as today (title, avatar button). No sample data anywhere.
- Centre: three overlapping pebbles, headline "Add your first bag", one line: "Search for it or type it in. About 30 seconds."
- Primary pill button "Add a bag". No floating "+" while the list is empty (one action only).

### 4.2 Add sheet (bottom sheet, full height when the keyboard is open)

1. **Search field**, focused on open. Matches roaster and bean name, tolerant of spelling (trigram match on the normalised key) and of word order.
2. **Results** from the shared catalogue: bean cover, name, "roaster · origin · process". A badge **"Sam has this dialed in"** when a friend has a locked recipe for it. Beans you already own show "In your beans" and open the existing bag instead of duplicating it.
3. **Last row, always.** What was typed is never assumed to be a bean name:
   - a **known roaster** (exact, or followed by more words) fills the Roaster field, and the rest fills the Name field: "Add a new bean from Coffea Circulor" or "Not here? Add “Brand New” from Coffea Circulor";
   - anything else asks: `Not here? Add “<query>” as a new…` with **Roaster** and **Bean name** buttons, so nothing is guessed.
4. Picking a result goes straight to step 4.4.

### 4.3 New bean

The form opens with whatever the search told us (see 4.2). The roaster field suggests known roasters as you type, and going back from the bag step keeps everything entered.

Required: **roaster** and **name** (inline messages: "Enter a roaster", "Enter a name").

Asked up front, all optional:

- **Origin:** country with type-ahead, plus free-text region.
- **Process:** chips (Washed, Natural, Honey, Anaerobic, Other), single choice.
- **Roast level:** chips (Light, Medium, Dark), single choice.
- **Tasting notes:** tag input with suggestions from a flavour vocabulary, plus free text. The notes become the notes you can choose to bring out when brewing.

Under **More** (collapsed): variety, altitude (m), producer.

While the roaster and name are typed, a "Did you mean…?" strip shows near matches from the catalogue so the same coffee is not created twice. Choosing one jumps to 4.4.

### 4.4 Your bag

- Summary row: cover, name, roaster.
- **Roast date** chips: Today, 3 days ago, 1 week ago, 2 weeks ago, Pick date, Not sure. Chips store an actual date; "Not sure" stores nothing. Date picker uses the native control, no future dates, nothing older than two years.
- **Bag size** chips: 100 g, 250 g, 340 g, 500 g, 1 kg, Other (numeric keypad, 1 to 5000 g).
- Primary button **"Add to my beans"** (enabled at once; both fields are optional).

### 4.5 Saved

- The sheet closes and the **bean page** opens for the new bag.
- If anything fails, the sheet stays open with an inline message and nothing is lost.

## 5. Data and rules

- Existing tables: `beans` (shared catalogue, anyone signed in can read and add, nobody can edit) and `user_beans` (your bag: roast date, grams remaining, status, notes).
- **New bean = two writes** (catalogue row, then your bag row). To keep them atomic, add a database function `add_bag(...)` that runs as the caller, so RLS still applies. If the bean already exists it only creates the bag.
- **Catalogue search** is a database function `search_beans(query)` that returns matches ranked by similarity, an `owned` flag, and a count of friends with a locked recipe for the bean (visibility comes from the existing recipe policies).
- New bag status is `new`. Later statuses: `dialing_in` (first brew), `locked`. A finished state for bags that reach zero grams is a later change; do not delete, archive.
- Validation: roaster 1 to 80 characters, name 1 to 120, at most 12 tasting notes of 40 characters each, altitude 1 to 5000 m, grams 1 to 5000.
- Duplicate guard: the normalised roaster+name key. Exact matches never create a second catalogue bean.
- **Static versus variable.** The shared catalogue holds only what is true of the coffee itself and does not change between bags:
  - shared (catalogue): roaster, name, origin, region, producer, variety, process, altitude, roast level, the roaster's tasting notes;
  - private (your bag): roast date, bag size and grams remaining, status, your own notes, collection, and everything you brew.
  A bag's roast date and size are never attached to the catalogue entry, so the same coffee bought twice is two private bags on one shared bean.
- **Schema gap:** `beans` has no `roast_level` column yet. A migration adds it (`light`, `medium`, `dark`; nullable), as a static product attribute.

## 6. Beans tab once it has beans

- List of your bags as pebble-cover cards, same look as today but from real data. Filter chips All, Dialing in, Locked stay.
- The "dialing in" feature card appears only when a bag has that status.
- Floating "+" opens the add sheet.
- Sample data (`sampleBeans`) and the placeholder recipe on the bean page are removed. The bean page shows the bean details, your bag details, an empty "Recipes" area ("No recipes yet") until recipes exist, and a "Start dialing in" button that opens the Brew tab.

## 7. What was built (and differences from the plan)

- **Database:** `beans.roast_level`, length and note-count constraints, `search_beans(q)` and `add_bag(...)`. Search needs every word to appear in roaster + name (any order) or a close `word_similarity` match; whole-string trigram similarity was too weak for short queries against long names, so the follow-up migration switched to `word_similarity`.
- **Friend signal** shows a count ("A friend has this dialed in", "3 friends have this dialed in"), not names. Showing names needs friend profile reads and is a later refinement.
- **Add flow:** empty-state button or floating pebble "+", search sheet, new-bean form with "Did you mean...?", bag step with roast-date and size chips. Bags you already own open their bag page instead of duplicating.
- **Optimistic add:** the bag shows in the list at once with a client-made id. If saving fails the bag is taken out again and a toast explains.
- **Beans tab and bean page** read real data; sample data is gone. The bean page has no edit yet (roast date and size are set when adding), and "Remove this bag" deletes the bag (bags with brews cannot be removed yet).
- Tests: `supabase/tests/beans.test.sql` for the database, and UI tests for the empty state, list, add flows, validation, duplicates, failure rollback and removal.

## 8. Still open

- Names for the friend signal, and editing a bag after adding it.
- Exact wording of the roast-date chips ("3 days ago", "1 week ago", "2 weeks ago") once we see them on a phone.
- Freshness advice (for example more bloom for fresh coffee) is a tuning topic still being researched, so the flow shows "Roasted N days ago" and no advice yet.
- Photo of the bag as the cover image, and photo scanning itself (build step 9).
- The offline queue (outbox) design, to be done with the brew flow.
