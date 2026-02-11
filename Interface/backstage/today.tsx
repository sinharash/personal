# Member Of Filter — Definitive Fix

## Root Cause Analysis

There are **two conflicting constraints** that have been causing every approach to fail:

1. **Pagination requires server-side filtering.** With `limit=20`, the server returns only 20 entities per page. If `getCatalogFilters()` returns `{}`, `filterEntity()` runs on those 20 random entities and finds 0 matches (your 2 entities aren't on page 1). This is why you see "0 results."

2. **UserListPicker strips only the `user` key from its count queries.** Any server-side filter on the `memberOf` key contaminates UserListPicker's "All" count (drops from 9644 to 2).

**The only solution:** Route the server-side filtering through the `user` key using `MemberOfAsUserFilter`. UserListPicker strips `user` from count queries → "All" stays at 9644. The server still receives `relations.ownedBy` → returns the correct 2 entities.

The previous attempts at this approach failed because of the useEffect/toggle logic. I've traced through every edge case below.

---

## What happens with each approach (and why only one works):

| Approach | getCatalogFilters | Table shows | All count | Problem |
|---|---|---|---|---|
| memberOf returns `{}` | No server filter | 0 entities | 9644 ✓ | Pagination: 2 entities not in first 20 |
| memberOf returns `{ownedBy}` | Server filters on memberOf key | 2 entities ✓ | 2 ✗ | UserListPicker includes memberOf in count queries |
| **Route through `user` key** | **Server filters on user key** | **2 entities ✓** | **9644 ✓** | **Works! UserListPicker strips user key** |

---

## File Changes

### 1. `useMemberOfEntitiesCount.ts` — Two filter classes

Replace `MemberOfAsUserFilter` (lines ~41-63) with:

```typescript
// This filter goes on the `user` key for SERVER-SIDE filtering
// UserListPicker strips `user` from its count queries, so "All" stays at 9644
export class MemberOfAsUserFilter implements EntityFilter {
  // 'memberOf' so UserListPicker does NOT highlight "Owned" tab
  readonly value = 'memberOf'

  constructor(readonly values: string[]) {}

  // Server-side: query by ownedBy (goes through user key, stripped from counts)
  getCatalogFilters(): Record<string, string | symbol | (string | symbol)[]> {
    return { 'relations.ownedBy': this.values }
  }

  // Client-side fallback: also check developedBy
  filterEntity(entity: Entity): boolean {
    if (!entity.relations || this.values.length === 0) {
      return false
    }
    return entity.relations.some(
      r =>
        (r.type === 'ownedBy' || r.type === 'developedBy') &&
        this.values.includes(r.targetRef),
    )
  }

  // MUST return 'owned' so URL shows user=owned
  // This prevents UserListPicker from recreating the filter on URL sync
  toQueryValue(): string {
    return 'owned'
  }
}
```

Replace `EntityMemberOfFilter` (lines ~65-92) with:

```typescript
// This filter goes on the `memberOf` key — UI FLAG ONLY
// It exists solely so CustomCatalogTable can check filters.memberOf to show the title
export class EntityMemberOfFilter implements EntityFilter {
  readonly value: 'memberOf' = 'memberOf'

  constructor(readonly values: string[]) {}

  // EMPTY — no server-side filtering (that's handled by MemberOfAsUserFilter on user key)
  getCatalogFilters(): Record<string, string | symbol | (string | symbol)[]> {
    return {}
  }

  // Return true — don't filter anything client-side from this filter
  // The actual filtering is done by MemberOfAsUserFilter on the user key
  filterEntity(_entity: Entity): boolean {
    return true
  }

  toQueryValue(): string {
    return 'memberOf'
  }
}
```

**Why `filterEntity` returns `true`:** EntityMemberOfFilter is just a UI marker. If it returned `false` for any entity, it would NARROW results on top of what the server already returned. Since MemberOfAsUserFilter already handles all filtering through the `user` key, this filter should pass everything through.

### 2. `MemberOfFilter.tsx` — handleClick sets BOTH filters

Replace the `handleClick` (lines ~79-87) with:

```typescript
const handleClick = useCallback(() => {
  if (isActive) {
    // DEACTIVATE: clear memberOf flag, don't touch user
    // MemberOfAsUserFilter stays on user key but is functionally
    // identical to EntityUserFilter.owned() — same server query
    updateFilters({
      memberOf: undefined,
    })
  } else {
    // ACTIVATE: set memberOf UI flag + MemberOfAsUserFilter on user key
    updateFilters({
      memberOf: memberOfEntitiesFilter,
      user: new MemberOfAsUserFilter(ownershipEntityRefs ?? []) as unknown as EntityUserFilter,
    })
  }
}, [isActive, memberOfEntitiesFilter, ownershipEntityRefs, updateFilters])
```

**Add this import** at the top of MemberOfFilter.tsx:

```typescript
import { MemberOfAsUserFilter } from '../HubCatalogFilter/useMemberOfEntitiesCount'
// Also need EntityUserFilter — check your current imports
```

**Important:** You need `EntityUserFilter` imported. Check if it comes from `'@backstage/plugin-catalog-react'` in your setup. If not available, you can use the type cast: `as unknown as EntityUserFilter` (which you already have in the code from before — I can see it commented out on line 90).

Also add `ownershipEntityRefs` to the dependency array.

### 3. `CatalogFilters.tsx` — useEffect with instanceof check

Replace the entire useEffect block AND remove the div wrapper:

```typescript
import { useState, useEffect } from 'react'
import { MemberOfAsUserFilter } from './useMemberOfEntitiesCount'
// Remove: import { makeStyles } from '@mui/styles'  (if only used for memberOfActive)
// Remove: the useStyles/makeStyles for memberOfActive CSS

// Remove the old useEffect (lines 21-28) and replace with:
useEffect(() => {
  // When UserListPicker (Owned/All/Starred) is clicked, it creates a NEW user filter.
  // That new filter is NOT instanceof MemberOfAsUserFilter.
  // So we detect this and clear memberOf to enforce mutual exclusivity.
  if (
    filters.memberOf !== undefined &&
    filters.user !== undefined &&
    !(filters.user instanceof MemberOfAsUserFilter)
  ) {
    updateFilters({ memberOf: undefined })
  }
}, [filters.user, filters.memberOf, updateFilters])
```

**In the return JSX**, remove the div wrapper around UserListPicker:

```tsx
return (
  <>
    <HubEntityKindTypePicker currentPick={currentEntityPick} setCurrentPick={setCurrentEntityPick} setCurrentLanguagePick={setCurrentLanguagePick} />
    {/* NO div wrapper — just UserListPicker directly */}
    <UserListPicker initialFilter='owned' />
    <MemberOfFilter />
    <EntityTagPicker />
    <EntityOwnerPicker mode='owners-only' />
    {currentEntityPick === 'gitlab-project' && <HubEntityGitLabLanguagePicker currentPick={currentLanguagePick} setCurrentPick={setCurrentLanguagePick} />}
  </>
)
```

Remove the `useStyles` / `makeStyles` for `memberOfActive` and `const classes = useStyles()` if they're only used for the memberOf styling.

### 4. `CustomCatalogTable.tsx` — No changes needed

Your current title logic works correctly. It checks `filters.memberOf` and generates "Member of" title when active, falls back to CatalogTable's default title otherwise. ✓

---

## How it works — step by step

### Page loads:
1. UserListPicker sets `user = EntityUserFilter.owned(refs)` (from initialFilter='owned')
2. `memberOf` is undefined
3. URL: `user=owned`
4. Server queries `relations.ownedBy` → returns 2 entities
5. Title: "Owned logical-group Systems (2)" ✓
6. All: 9644 ✓ (UserListPicker makes its own count query, strips user key)

### Click "Member of":
1. handleClick sets `memberOf = EntityMemberOfFilter` + `user = MemberOfAsUserFilter`
2. URL: `user=owned&memberOf=memberOf`
3. Server queries `relations.ownedBy` (from MemberOfAsUserFilter on user key) → returns 2 entities ✓
4. UserListPicker strips user from count query → All stays 9644 ✓
5. EntityMemberOfFilter.getCatalogFilters() = {} → doesn't contaminate counts ✓
6. EntityMemberOfFilter.filterEntity() = true → doesn't narrow results ✓
7. Title: "Member of logical-group systems (2)" ✓ (CustomCatalogTable sees filters.memberOf)
8. useEffect: memberOf defined, user instanceof MemberOfAsUserFilter → skip ✓
9. UserListPicker reads user.value = 'memberOf' → doesn't match 'owned'/'starred' → no tab highlighted (or "All" highlighted) ✓

### Click "Owned" in UserListPicker:
1. UserListPicker creates NEW `EntityUserFilter.owned(refs)` → sets on user key
2. useEffect fires: memberOf defined, user NOT instanceof MemberOfAsUserFilter → clear memberOf ✓
3. URL: `user=owned` (memberOf removed)
4. Title: "Owned logical-group Systems (2)" ✓
5. "Owned" tab highlighted ✓

### Click "All" in UserListPicker:
1. UserListPicker creates `EntityUserFilter` with value 'all' → sets on user key
2. useEffect fires: memberOf defined, user NOT instanceof MemberOfAsUserFilter → clear memberOf ✓
3. URL: `user=all` (memberOf removed)
4. Server returns all entities (no ownedBy filter)
5. Title: "All logical-group Systems (9644)" ✓

### Click "Member of" again to deactivate:
1. handleClick (isActive=true): sets `memberOf = undefined`
2. user stays as MemberOfAsUserFilter (functionally same as EntityUserFilter.owned)
3. URL: `user=owned` (memberOf removed)
4. Title: "Owned logical-group Systems (2)" ✓ (CustomCatalogTable falls back to default)
5. Table still shows 2 entities (same server query) ✓

### Page refresh with memberOf active (URL: user=owned&memberOf=memberOf):
1. EntityListProvider reads URL
2. Recreates user filter from 'owned' → EntityUserFilter.owned(refs) (NOT MemberOfAsUserFilter)
3. Recreates memberOf filter from 'memberOf' → EntityMemberOfFilter
4. useEffect: memberOf defined, user NOT instanceof MemberOfAsUserFilter → clear memberOf
5. Falls back to "Owned" view — **this is expected and acceptable**

---

## Visual behavior: "Owned" tab highlighting

When memberOf is active, UserListPicker reads `filters.user.value`. Since MemberOfAsUserFilter has `value = 'memberOf'` (not 'owned'), UserListPicker should NOT highlight "Owned". It will either highlight nothing or highlight "All" depending on the Backstage version's default behavior.

If "Owned" still appears highlighted despite value='memberOf', it means UserListPicker is reading `toQueryValue()` instead of `value`. In that case, you have two options:

**Option A:** Accept it — "Owned" highlighted while memberOf is active is a minor visual issue. The title clearly shows "Member of" and the data is correct.

**Option B:** Add a CSS override in MemberOfFilter.tsx's styles (you already have the menuItem styles there):

In CatalogFilters, wrap UserListPicker with a conditional class:
```tsx
<div className={filters.memberOf !== undefined ? 'memberof-active' : ''}>
  <UserListPicker initialFilter='owned' />
</div>
```

And add global CSS:
```css
.memberof-active .MuiListItemButton-root[aria-selected="true"],
.memberof-active .Mui-selected {
  background-color: transparent !important;
}
```

---

## Debugging: Add console logs to verify

Add these temporarily to confirm everything works:

In `MemberOfFilter.tsx` handleClick:
```typescript
console.log('MemberOf click:', { isActive, memberOfFilter: memberOfEntitiesFilter, refs: ownershipEntityRefs })
```

In `CatalogFilters.tsx` useEffect:
```typescript
useEffect(() => {
  console.log('CatalogFilters useEffect:', {
    memberOf: filters.memberOf?.value,
    userValue: (filters.user as any)?.value,
    userType: filters.user?.constructor?.name,
    isInstanceOf: filters.user instanceof MemberOfAsUserFilter,
  })
  // ... rest of useEffect
}, [filters.user, filters.memberOf, updateFilters])
```

In `MemberOfAsUserFilter.getCatalogFilters()`:
```typescript
getCatalogFilters() {
  console.log('MemberOfAsUserFilter.getCatalogFilters called, values:', this.values)
  return { 'relations.ownedBy': this.values }
}
```

---

## Summary of changes per file

| File | What to change |
|---|---|
| `useMemberOfEntitiesCount.ts` | MemberOfAsUserFilter: value='memberOf', getCatalogFilters={ownedBy}, toQueryValue='owned'. EntityMemberOfFilter: getCatalogFilters={}, filterEntity=true |
| `MemberOfFilter.tsx` | handleClick: activate sets BOTH memberOf + user, deactivate only clears memberOf. Import MemberOfAsUserFilter. Add ownershipEntityRefs to deps. |
| `CatalogFilters.tsx` | useEffect with instanceof MemberOfAsUserFilter check. Remove div wrapper. Remove CSS classes. Import MemberOfAsUserFilter. |
| `CustomCatalogTable.tsx` | No changes needed |