---
name: state-machine
description: Authoring contract for Punch's state machine. Use when any task touches useAppState.ts, src/types.ts, src/lib/store.ts, adds a new entry kind, changes earnings logic, modifies sync/attachment behaviour, or adds a new feature (not just a restyle).
compatibility: No network access required. All content is inline.
metadata:
  generated_at: "2026-07-03"
  generator: "manual"
---
# Punch State Machine Skill

## When to use this skill

Load this skill whenever a task:
- Touches `src/hooks/useAppState.ts` or `src/types.ts`
- Adds or changes an entry kind, rate period, or financial calculation
- Modifies sync, ETag handling, or attachment logic
- Introduces a new domain entity or view-model interface
- Adds a new page or panel that requires state plumbing

## The three-file authoring contract

Every feature that changes **behaviour** (not just style) requires three coordinated edits, **in this order**:

1. **`src/types.ts`** — add/extend the domain type *and* the view-model interface(s) for the affected component(s). Both sides of the state boundary must agree before either compiles cleanly.

2. **`src/hooks/useAppState.ts`** — implement the business logic and extend the `useMemo` view-model builder to populate the new fields. This is the **only** file that reads or mutates domain state; components never import from `store.ts` or access raw domain arrays.

3. **The component** (`src/components/*.tsx`) — consume the new view-model props. Accept data, render it, call callbacks. Done.

**Run `npx tsc -b` after each step** and fix errors before moving on. Skipping this causes misleading errors: the component compiles against the old interface while the hook produces the new shape, or vice versa.

## Entry kinds and earnings

Three entry kinds exist. The `Entry.kind` discriminant controls both validation and financial calculation. Get this wrong and numbers break silently everywhere (Track, Export, Earnings, Sidebar).

| `kind`       | Required non-null fields         | `entryEarnValue()` formula                                          |
|--------------|----------------------------------|---------------------------------------------------------------------|
| `'project'`  | `projectId`                      | `((minutes / 60) / hoursPerDay) × rateForDate(project.rates, date)` |
| `'service'`  | `serviceId`, `customerId`        | `rateForDate(service.rates, date)` — daily flat rate, not prorated  |
| `'customer'` | `customerId`, `amount`           | `entry.amount` — fixed fee; `minutes` still logged but not used for earnings |

Note: on a `'project'` entry `customerId` is **`null`** — the customer is reached via `project.customerId`. On `'service'` and `'customer'` entries `customerId` is set directly on the entry.

**The canonical formula lives in `src/lib/earnings.ts → entryEarnValue()`.**  
Never duplicate it. Never compute earnings inline in a component or a new helper. All financial aggregations (Track summary, Export totals, Earnings page, Sidebar week earnings) call `entryEarnValue()` through `aggregateBy()` or `summarize()`.

```typescript
// src/lib/earnings.ts
export function entryEarnValue(
  entry: Entry,
  project: Project | undefined,
  service: Service | undefined,
  hoursPerDay: number,
): number {
  if (entry.kind === 'customer') return entry.amount ?? 0;
  if (entry.kind === 'service') return service ? rateForDate(service.rates, entry.date) : 0;
  if (!project) return 0;
  return ((entry.minutes / 60) / hoursPerDay) * rateForDate(project.rates, entry.date);
}
```

## ETag concurrency — the immovable rule

`store.saveState(data, etag)` sends `If-Match: <etag>` on every PUT. A 412 response throws `store.ConflictError`. The hook handles this in `pushStateNow()` by fetching the remote copy and replacing local state — it does **not** retry the save.

Agents must never:
- Pass an empty string etag intentionally to bypass the check (empty etag is only valid on the very first write before the blob exists).
- Add a retry loop around `saveState` — that would silently clobber concurrent writes.
- Implement an "optimistic concurrency bypass for simplicity."

```typescript
// src/hooks/useAppState.ts — pushStateNow
const result = await store.saveState(data, stateRef.current.stateEtag);
// ...
if (error instanceof store.ConflictError) {
  // fetch remote and replace — do NOT retry the save
}
```

## Entry ID pre-assignment

`openEntry()` calls `uid()` to generate an ID **before** the entry is saved. This is intentional: it lets attachments be uploaded to `<entryId>/<attachmentId>` in Azure Blob Storage while the modal is still open, before the entry record is persisted.

Any refactor that moves ID assignment to save time will break the attachment upload flow.

```typescript
// openEntry() — id is assigned here, not at save time
id: entry.id || uid(),
```

## The `stateRef` pattern

The hook exposes `stateRef = useRef(state)` and keeps it current via a `useEffect`. Callbacks use `stateRef.current` to read state synchronously without adding it to their `useCallback` dependency arrays. This avoids stale closure bugs in async handlers (sync, attachment upload).

New callbacks should follow this same pattern:

```typescript
const stateRef = useRef(state);
useEffect(() => { stateRef.current = state; });

const someCallback = useCallback(async () => {
  const current = stateRef.current;  // always fresh
  // ...
}, []); // no [state] dependency needed
```

## Demo mode

Two parallel storage namespaces exist. `store.getDemoModeFlag()` reads a `localStorage` boolean. When true:
- All reads/writes go to the `demo.v1` localStorage key.
- Remote sync is completely bypassed — `pushStateNow` and `pullStateNow` return early.

Any code path that reads or modifies data must check `current.demoMode` and route accordingly, exactly as `pushStateNow()` does:

```typescript
const pushStateNow = useCallback(async () => {
  const current = stateRef.current;
  if (current.demoMode) return; // bypass all remote I/O
  // ...
}, []);
```

## Delete cascades

Deleting a parent entity must cascade to all dependent records:

| Deleted entity | Must also delete |
|----------------|-----------------|
| Customer       | All its projects + all entries referencing those projects or the customer directly |
| Project        | All entries with `projectId === project.id` |
| Service        | All entries with `serviceId === service.id` |

These cascades are implemented in `deleteCustomerById`, `deleteProjectDraft`, and `deleteServiceDraft`. Follow the same pattern for any new entity type.

## Common mistakes

| Mistake | Consequence | Observed in session |
|---------|-------------|---------------------|
| Editing a component before updating `types.ts` | Misleading TypeScript errors that look like step-3 bugs | *Display Timesheet Entries in Project View* |
| Computing earnings inline instead of calling `entryEarnValue()` | Silent numeric drift across all aggregation pages | *Add Earnings Progression Chart* |
| Setting `customerId` on a `'project'` entry | `aggregateBy()` double-counts the entry in the wrong customer bucket | *Implement Custom Time Entry Pricing* |
| Moving ID assignment to save time | Attachment upload fails — blob path `<entryId>/...` is unknown until the entry is opened | *Add Repeatable Work Types* |
| Adding a retry loop around `saveState` | Silent clobber of concurrent remote writes | Would have been caught in *Conduct Security Review* |
| Not checking `demoMode` in a new sync handler | Demo sessions inadvertently write to Azure | *Redesign Time Logging Interface* |
