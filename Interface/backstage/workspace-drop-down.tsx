# Member Of Filter - Backstage Catalog Plugin

This refactored implementation fixes several issues with the original "Member of" filter:

## Issues Fixed

### 1. ✅ Filter Key Collision (CRITICAL)
**Problem:** Both `MemberOfFilter` and `UserListPicker` were using the `user` filter key, causing conflicts.

**Solution:** Changed `MemberOfFilter` to use a custom `memberOf` filter key instead.

### 2. ✅ Toggle Bug
**Problem:** Clicking "Member of" then "All" didn't work correctly - the filters were fighting each other.

**Solution:** 
- Removed the problematic `useEffect` that was auto-reapplying the filter
- Added mutual exclusivity logic in `CatalogFilters` to clear one filter when the other is activated
- The `MemberOfFilter` now clears the `user` filter when activated

### 3. ✅ Styling Mismatch
**Problem:** The "Additional Filters" section didn't match the "PERSONAL" section styling.

**Solution:** Updated `useStyles` to use:
- Transparent background
- Matching font size (11px), letter spacing, and color
- Consistent spacing and alignment

### 4. ✅ Backend Filtering
**Problem:** `getCatalogFilters()` returned empty object, only doing client-side filtering.

**Solution:** Implemented proper `getCatalogFilters()` that returns an array for OR logic:
```typescript
getCatalogFilters() {
  return [
    { 'relations.ownedBy': this.values },
    { 'relations.developedBy': this.values },
  ];
}
```

## File Structure

```
HubCatalogFilter/
├── index.ts                    # Exports
├── types.ts                    # Type definitions
├── CatalogFilters.tsx          # Main filter component (simple version)
├── CatalogFiltersImproved.tsx  # Main filter component (with useEffect-based mutual exclusivity)
├── MemberOfFilter.tsx          # The "Member of" toggle filter
└── useMemberOfEntitiesCount.ts # Hook for counting and creating the filter
```

## Integration Steps

### Step 1: Update your types

Add the `memberOf` filter to your custom entity filters type:

```typescript
// In your types file (e.g., types.ts)
import { DefaultEntityFilters } from '@backstage/plugin-catalog-react';
import { EntityMemberOfFilter } from './useMemberOfEntitiesCount';

export interface CustomEntityFilters extends DefaultEntityFilters {
  memberOf?: EntityMemberOfFilter;
}
```

### Step 2: Register the custom filter with EntityListProvider (if needed)

If you're using a custom `EntityListProvider`, you may need to ensure it recognizes the `memberOf` filter key. The default provider should work, but for URL persistence you might need additional configuration.

### Step 3: Replace the files

Copy the refactored files to your `HubCatalogFilter` directory:

1. `MemberOfFilter.tsx` - Replace existing
2. `useMemberOfEntitiesCount.ts` - Replace existing
3. `CatalogFilters.tsx` or `CatalogFiltersImproved.tsx` - Use one of these
4. `types.ts` - Merge with your existing types
5. `index.ts` - Update exports

### Step 4: Update imports

Make sure all imports in your project reference the correct paths.

## Count Explanation (3 vs 5)

- **"Member of (3)"**: Count of entities where WG119310 is owner OR developer
- **"All (5)"**: Count of all entities in the STATE FARM section (no user filter applied)
- **"Memberof logical-group Systems (5)"**: Title of the current view, showing there are 5 systems total in this category

The (3) vs (5) difference is expected - you're a member of 3 out of the 5 logical-group systems.

## Key Code Changes

### MemberOfFilter.tsx

```diff
- const isActive = filters.user?.toQueryValue?.() === 'memberOf'
+ const isActive = filters.memberOf !== undefined;

  const handleClick = () => {
    if (isActive) {
-     updateFilters({ user: undefined })
+     updateFilters({ memberOf: undefined })
    } else {
-     updateFilters({ user: memberOfEntitiesFilter as any })
+     updateFilters({ 
+       memberOf: memberOfEntitiesFilter,
+       user: undefined,  // Clear user filter when enabling memberOf
+     })
    }
  }

- // REMOVED: The problematic useEffect that was causing issues
- useEffect(() => {
-   if (isActive && !loadingMemberOfEntities && memberOfEntitiesFilter) {
-     updateFilters({ user: memberOfEntitiesFilter as any })
-   }
- }, [isActive, loadingMemberOfEntities, memberOfEntitiesFilter, updateFilters])
```

### useMemberOfEntitiesCount.ts

```diff
  getCatalogFilters() {
-   return {};
+   return [
+     { 'relations.ownedBy': this.values },
+     { 'relations.developedBy': this.values },
+   ];
  }
```

## Testing Checklist

After implementing:

- [ ] Click "Member of" - should show only entities where you're owner OR developer
- [ ] Click "All" - should show all entities (Member of should deselect)
- [ ] Click "Owned" - should show only owned entities (Member of should deselect)
- [ ] Click "Member of" - should deselect Owned and show member of entities
- [ ] Count (3) should match the number of entities displayed when filter is active
- [ ] Styling should match the PERSONAL section

>>>>>>>>>>>>
// MemberOfFilter
import React, { useCallback } from 'react';
import { useEntityList } from '@backstage/plugin-catalog-react';
import Card from '@mui/material/Card';
import List from '@mui/material/List';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import PeopleIcon from '@mui/icons-material/People';
import { useMemberOfEntitiesCount } from './useMemberOfEntitiesCount';
import type { Theme } from '@mui/material/styles';

/**
 * Styles matching the PERSONAL section of UserListPicker
 */
const useStyles = makeStyles(
  (theme: Theme) => ({
    root: {
      backgroundColor: 'transparent',
      boxShadow: 'none',
      margin: '8px 0',
    },
    title: {
      margin: '8px 0 8px 8px',
      textTransform: 'uppercase',
      fontSize: 11,
      fontWeight: 'bold',
      letterSpacing: 0.5,
      color: theme.palette.text.secondary,
    },
    listIcon: {
      minWidth: 30,
      color: theme.palette.text.primary,
    },
    menuItem: {
      minHeight: '48px',
      borderRadius: 4,
      '&.Mui-selected': {
        backgroundColor: theme.palette.action.selected,
      },
      '&.Mui-selected:hover': {
        backgroundColor: theme.palette.action.selected,
      },
    },
    menuItemText: {
      fontWeight: 500,
    },
    groupWrapper: {
      backgroundColor: 'transparent',
      boxShadow: 'none',
    },
    count: {
      color: theme.palette.text.secondary,
      fontSize: '0.875rem',
    },
  }),
  { name: 'MemberOfFilter' },
);

/**
 * Extended filter type that includes our custom memberOf filter
 * You'll need to add this to your CustomEntityFilters type definition
 */
export interface MemberOfFilterExtension {
  memberOf?: {
    values: string[];
    filterEntity: (entity: any) => boolean;
    toQueryValue: () => string;
  };
}

/**
 * A toggle filter for "Member of" (entities where user is owner OR developer)
 * 
 * IMPORTANT: This uses a separate 'memberOf' filter key to avoid conflicts
 * with the UserListPicker's 'user' filter.
 * 
 * To use this, you need to extend your DefaultEntityFilters type:
 * 
 * ```typescript
 * import { DefaultEntityFilters } from '@backstage/plugin-catalog-react';
 * import { EntityMemberOfFilter } from './useMemberOfEntitiesCount';
 * 
 * export interface CustomEntityFilters extends DefaultEntityFilters {
 *   memberOf?: EntityMemberOfFilter;
 * }
 * ```
 */
export const MemberOfFilter = () => {
  const classes = useStyles();
  const { filters, updateFilters } = useEntityList<any>();

  const {
    count: memberOfEntitiesCount,
    loading: loadingMemberOfEntities,
    filter: memberOfEntitiesFilter,
  } = useMemberOfEntitiesCount();

  // Check if this filter is active using our custom key
  const isActive = filters.memberOf !== undefined;

  const handleClick = useCallback(() => {
    if (isActive) {
      // Deactivate - clear BOTH the memberOf filter AND reset user filter
      // This ensures clean state when toggling off
      updateFilters({ 
        memberOf: undefined,
        // Don't touch 'user' - let UserListPicker manage it
      });
    } else {
      // Activate - apply the memberOf filter
      // Also clear the 'user' filter to avoid conflicts
      updateFilters({ 
        memberOf: memberOfEntitiesFilter,
        user: undefined,  // Clear user filter when enabling memberOf
      });
    }
  }, [isActive, memberOfEntitiesFilter, updateFilters]);

  // Don't render if still loading and no count yet
  const displayCount = loadingMemberOfEntities ? '...' : (memberOfEntitiesCount ?? 0);
  const isDisabled = !loadingMemberOfEntities && memberOfEntitiesCount === 0;

  return (
    <Card className={classes.root}>
      <Typography 
        variant="subtitle2" 
        component="span" 
        className={classes.title}
      >
        Additional Filters
      </Typography>
      <Card className={classes.groupWrapper}>
        <List disablePadding dense>
          <MenuItem
            onClick={handleClick}
            selected={isActive}
            className={classes.menuItem}
            disabled={isDisabled}
            data-testid="user-picker-memberOf"
          >
            <ListItemIcon className={classes.listIcon}>
              <PeopleIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body1" className={classes.menuItemText}>
                  Member of
                </Typography>
              }
            />
            <ListItemSecondaryAction className={classes.count}>
              {displayCount}
            </ListItemSecondaryAction>
          </MenuItem>
        </List>
      </Card>
    </Card>
  );
};

export default MemberOfFilter;


// useMemberofentitiescount

import { useMemo } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  catalogApiRef,
  identityApiRef,
  useEntityList,
  EntityFilter,
} from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { useAsync, useAsyncFn } from 'react-use';
import useDeepCompareEffect from 'use-deep-compare-effect';
import { compact } from 'lodash';
import { reduceCatalogFilters } from '@backstage/plugin-catalog-react';

/**
 * Custom filter class for "member of" that combines owned and developed entities.
 * 
 * This filter finds entities where the user has either an 'ownedBy' or 'developedBy'
 * relationship, effectively showing all entities the user is a "member of".
 * 
 * Key improvements:
 * 1. Implements getCatalogFilters() with OR logic for backend filtering
 * 2. Uses a unique query value 'memberOf' to avoid conflicts
 * 3. Properly typed to work with Backstage's filter system
 */
export class EntityMemberOfFilter implements EntityFilter {
  /**
   * The filter value - always 'memberOf' for this filter type
   */
  readonly value: 'memberOf' = 'memberOf';

  /**
   * The ownership entity refs (user + groups they belong to)
   */
  readonly values: string[];

  constructor(values: string[]) {
    this.values = values;
  }

  /**
   * Returns catalog filter criteria for backend API calls.
   * 
   * Returns an ARRAY of filter objects to create OR logic:
   * - First object: entities where relations.ownedBy matches
   * - Second object: entities where relations.developedBy matches
   * 
   * The Backstage catalog API treats arrays as OR conditions.
   */
  getCatalogFilters(): Record<string, string | symbol | (string | symbol)[]>[] {
    if (this.values.length === 0) {
      return [];
    }

    // Return array for OR logic: ownedBy OR developedBy
    return [
      { 'relations.ownedBy': this.values },
      { 'relations.developedBy': this.values },
    ];
  }

  /**
   * Client-side filtering for entities already loaded.
   * This is used when entities are already in memory and need filtering.
   */
  filterEntity(entity: Entity): boolean {
    if (!entity.relations || this.values.length === 0) {
      return false;
    }

    return entity.relations.some(
      relation =>
        (relation.type === 'ownedBy' || relation.type === 'developedBy') &&
        this.values.includes(relation.targetRef),
    );
  }

  /**
   * Returns the query string value for URL parameters.
   * This must be unique to avoid conflicts with UserListPicker.
   */
  toQueryValue(): string {
    return 'memberOf';
  }
}

/**
 * Interface for the hook return value
 */
export interface UseMemberOfEntitiesCountResult {
  /** The count of unique entities where user is owner or developer */
  count: number | undefined;
  /** Whether the count is still loading */
  loading: boolean;
  /** The filter instance to apply */
  filter: EntityMemberOfFilter;
  /** The user's ownership entity refs */
  ownershipEntityRefs: string[] | undefined;
}

/**
 * Hook to get count of entities where the user is either an owner OR developer.
 * 
 * This creates a "member of" filter that combines both relationships and returns
 * a deduplicated count of unique entities.
 * 
 * @returns Object containing count, loading state, filter instance, and ownership refs
 * 
 * @example
 * ```tsx
 * const { count, loading, filter } = useMemberOfEntitiesCount();
 * 
 * // Apply the filter
 * updateFilters({ memberOf: filter });
 * 
 * // Display the count
 * <span>{loading ? '...' : count}</span>
 * ```
 */
export function useMemberOfEntitiesCount(): UseMemberOfEntitiesCountResult {
  const identityApi = useApi(identityApiRef);
  const catalogApi = useApi(catalogApiRef);

  const { filters } = useEntityList();

  // Get the user's ownership entity refs (includes user and their groups)
  const { value: ownershipEntityRefs, loading: loadingEntityRefs } = useAsync(
    async () => {
      const identity = await identityApi.getBackstageIdentity();
      return identity.ownershipEntityRefs;
    },
    [],
  );

  // Extract filters excluding 'user', 'owners', and 'memberOf' to avoid double-filtering
  const { user, owners, memberOf, ...remainingFilters } = filters as any;
  const catalogFilters = reduceCatalogFilters(compact(Object.values(remainingFilters)));

  // Async function to fetch and count entities
  const [{ value: count, loading: loadingEntityMembership }, fetchEntities] =
    useAsyncFn(
      async (req: { 
        ownershipEntityRefs: string[]; 
        filter: ReturnType<typeof reduceCatalogFilters>;
      }) => {
        if (!req.ownershipEntityRefs || req.ownershipEntityRefs.length === 0) {
          return 0;
        }

        // Get base filter, excluding metadata.name as it may cause issues
        const { ['metadata.name']: _metadataName, ...baseFilter } = req.filter.filter || {};

        try {
          // Fetch entities where user is owner
          const ownedResponse = await catalogApi.queryEntities({
            ...req.filter,
            filter: {
              ...baseFilter,
              'relations.ownedBy': req.ownershipEntityRefs,
            },
            fields: ['metadata.uid'],
          });

          // Fetch entities where user is developer
          const developedResponse = await catalogApi.queryEntities({
            ...req.filter,
            filter: {
              ...baseFilter,
              'relations.developedBy': req.ownershipEntityRefs,
            },
            fields: ['metadata.uid'],
          });

          // Deduplicate by entity UID to get unique count
          // (user might be both owner AND developer of same entity)
          const uniqueEntityUids = new Set<string>();

          ownedResponse.items.forEach(entity => {
            if (entity.metadata.uid) {
              uniqueEntityUids.add(entity.metadata.uid);
            }
          });

          developedResponse.items.forEach(entity => {
            if (entity.metadata.uid) {
              uniqueEntityUids.add(entity.metadata.uid);
            }
          });

          return uniqueEntityUids.size;
        } catch (error) {
          console.error('Error fetching member of entities count:', error);
          return 0;
        }
      },
      [],
      { loading: true },
    );

  // Refetch when dependencies change
  useDeepCompareEffect(() => {
    if (ownershipEntityRefs === undefined) {
      return;
    }

    fetchEntities({
      ownershipEntityRefs,
      filter: catalogFilters,
    });
  }, [ownershipEntityRefs, catalogFilters]);

  // Memoize the filter instance
  const filter = useMemo(
    () => new EntityMemberOfFilter(ownershipEntityRefs ?? []),
    [ownershipEntityRefs],
  );

  const loading = loadingEntityRefs || loadingEntityMembership;

  return {
    count,
    loading,
    filter,
    ownershipEntityRefs,
  };
}

export default useMemberOfEntitiesCount;

//catalogFiltersImproved

import React, { useState, useEffect, useRef } from 'react';
import {
  UserListPicker,
  EntityTagPicker,
  EntityOwnerPicker,
  useEntityList,
} from '@backstage/plugin-catalog-react';

// Import your custom components - adjust paths as needed
import { HubEntityKindTypePicker } from '../EntityPicker/HubEntityKindTypePicker';
import { HubEntityGitLabLanguagePicker } from '../EntityPicker/HubEntityGitLabLanguagePicker';
import { MemberOfFilter } from './MemberOfFilter';
import { 
  CustomEntityFilters, 
  CustomLangFilters, 
  HubPickKey, 
  HubLanguageKey 
} from './types';

// Utility functions - adjust imports as needed
import { 
  setInitialEntityValue, 
  setInitialLanguageValue 
} from '../../utils/filterUtils';

/**
 * CatalogFilters component that includes all filter options for the catalog.
 * 
 * This version properly handles mutual exclusivity between:
 * - UserListPicker (owned/starred/all)
 * - MemberOfFilter (entities where user is owner OR developer)
 * 
 * When one is activated, the other is automatically cleared.
 */
export const CatalogFilters = () => {
  const { 
    queryParameters: entityQueryParameters,
    filters,
    updateFilters,
  } = useEntityList<CustomEntityFilters>();
  
  const { queryParameters: langQueryParameters } = useEntityList<CustomLangFilters>();

  const [currentEntityPick, setCurrentEntityPick] = useState<HubPickKey>(
    setInitialEntityValue(entityQueryParameters) as HubPickKey
  );
  
  const [currentLanguagePick, setCurrentLanguagePick] = useState<HubLanguageKey>(
    setInitialLanguageValue(langQueryParameters) as HubLanguageKey
  );

  // Track previous filter states to detect changes
  const prevUserFilter = useRef(filters.user);
  const prevMemberOfFilter = useRef(filters.memberOf);

  /**
   * Effect to handle mutual exclusivity between UserListPicker and MemberOfFilter.
   * 
   * When the 'user' filter changes (UserListPicker was clicked), clear memberOf.
   * When the 'memberOf' filter changes (MemberOfFilter was clicked), clear user.
   */
  useEffect(() => {
    const userChanged = filters.user !== prevUserFilter.current;
    const memberOfChanged = filters.memberOf !== prevMemberOfFilter.current;

    // If user filter was just set and memberOf is active, clear memberOf
    if (userChanged && filters.user !== undefined && filters.memberOf !== undefined) {
      updateFilters({ memberOf: undefined });
    }

    // Update refs for next comparison
    prevUserFilter.current = filters.user;
    prevMemberOfFilter.current = filters.memberOf;
  }, [filters.user, filters.memberOf, updateFilters]);

  return (
    <>
      {/* Entity Kind/Type Picker */}
      <HubEntityKindTypePicker 
        currentPick={currentEntityPick} 
        setCurrentPick={setCurrentEntityPick} 
      />

      {/* Standard User List Picker (Owned, Starred, All) */}
      <UserListPicker initialFilter="owned" />

      {/* Custom Member Of Filter (Owner OR Developer) */}
      <MemberOfFilter />

      {/* Entity Tag Picker */}
      <EntityTagPicker />

      {/* Entity Owner Picker */}
      <EntityOwnerPicker mode="owners-only" />

      {/* GitLab Language Picker - only shown for gitlab-project entities */}
      {currentEntityPick === 'gitlab-project' && (
        <HubEntityGitLabLanguagePicker 
          currentLanguagePick={currentLanguagePick} 
          setCurrentPick={setCurrentLanguagePick} 
        />
      )}
    </>
  );
};

export default CatalogFilters;

>>>>>>>>>>>>>>

// Types

import { DefaultEntityFilters } from '@backstage/plugin-catalog-react';
import { EntityMemberOfFilter } from './useMemberOfEntitiesCount';

/**
 * Extended entity filters that include the custom "memberOf" filter.
 * 
 * This extends Backstage's DefaultEntityFilters to add support for
 * filtering by entities where the user is either owner or developer.
 * 
 * Usage:
 * ```typescript
 * const { filters, updateFilters } = useEntityList<CustomEntityFilters>();
 * 
 * // Apply the memberOf filter
 * updateFilters({ memberOf: new EntityMemberOfFilter(ownershipRefs) });
 * 
 * // Clear the memberOf filter
 * updateFilters({ memberOf: undefined });
 * ```
 */
export interface CustomEntityFilters extends DefaultEntityFilters {
  /**
   * Filter for entities where the user is a "member of" (owner or developer)
   */
  memberOf?: EntityMemberOfFilter;
}

/**
 * If you have other custom filters (like language filters), extend them here
 */
export interface CustomLangFilters extends DefaultEntityFilters {
  language?: {
    value: string;
    toQueryValue: () => string;
  };
}

/**
 * Hub pick keys for entity type picker
 */
export type HubPickKey = 
  | 'component' 
  | 'api' 
  | 'system' 
  | 'domain' 
  | 'resource' 
  | 'gitlab-project'
  | 'aws-account'
  | 'logical-group';

/**
 * Hub language keys for GitLab language picker
 */
export type HubLanguageKey = 
  | 'all' 
  | 'python' 
  | 'javascript' 
  | 'typescript' 
  | 'java' 
  | 'go'
  | 'rust'
  | 'other';

  >>>>>>>>>>>>
  // index

  // Main components
export { CatalogFilters } from './CatalogFilters';
export { MemberOfFilter } from './MemberOfFilter';

// Hooks
export { 
  useMemberOfEntitiesCount, 
  EntityMemberOfFilter,
} from './useMemberOfEntitiesCount';
export type { UseMemberOfEntitiesCountResult } from './useMemberOfEntitiesCount';

// Types
export type { 
  CustomEntityFilters, 
  CustomLangFilters,
  HubPickKey,
  HubLanguageKey,
} from './types';

>>>>>>>>

// catalogFilters

import React, { useState, useCallback } from 'react';
import {
  UserListPicker,
  EntityTagPicker,
  EntityOwnerPicker,
  useEntityList,
} from '@backstage/plugin-catalog-react';

// Import your custom components - adjust paths as needed
import { HubEntityKindTypePicker } from '../EntityPicker/HubEntityKindTypePicker';
import { HubEntityGitLabLanguagePicker } from '../EntityPicker/HubEntityGitLabLanguagePicker';
import { MemberOfFilter } from './MemberOfFilter';
import { 
  CustomEntityFilters, 
  CustomLangFilters, 
  HubPickKey, 
  HubLanguageKey 
} from './types';

// Utility functions - adjust imports as needed
import { 
  setInitialEntityValue, 
  setInitialLanguageValue 
} from '../../utils/filterUtils';

/**
 * CatalogFilters component that includes all filter options for the catalog.
 * 
 * Key changes:
 * 1. MemberOfFilter now uses 'memberOf' key instead of 'user' to avoid conflicts
 * 2. When MemberOfFilter is activated, it clears the UserListPicker selection
 * 3. Properly typed with CustomEntityFilters for type safety
 */
export const CatalogFilters = () => {
  // Use our extended filter type
  const { 
    queryParameters: entityQueryParameters,
    filters,
    updateFilters,
  } = useEntityList<CustomEntityFilters>();
  
  const { queryParameters: langQueryParameters } = useEntityList<CustomLangFilters>();

  const [currentEntityPick, setCurrentEntityPick] = useState<HubPickKey>(
    setInitialEntityValue(entityQueryParameters) as HubPickKey
  );
  
  const [currentLanguagePick, setCurrentLanguagePick] = useState<HubLanguageKey>(
    setInitialLanguageValue(langQueryParameters) as HubLanguageKey
  );

  /**
   * Handler to clear the memberOf filter when UserListPicker is used.
   * This ensures mutual exclusivity between the two filter types.
   */
  const handleUserListPickerChange = useCallback(() => {
    // When user selects something in UserListPicker, clear the memberOf filter
    if (filters.memberOf !== undefined) {
      updateFilters({ memberOf: undefined });
    }
  }, [filters.memberOf, updateFilters]);

  return (
    <>
      {/* Entity Kind/Type Picker */}
      <HubEntityKindTypePicker 
        currentPick={currentEntityPick} 
        setCurrentPick={setCurrentEntityPick} 
      />

      {/* Standard User List Picker (Owned, Starred, All) */}
      {/* Note: We wrap this to handle clearing memberOf when used */}
      <div onClick={handleUserListPickerChange}>
        <UserListPicker initialFilter="owned" />
      </div>

      {/* Custom Member Of Filter */}
      <MemberOfFilter />

      {/* Entity Tag Picker */}
      <EntityTagPicker />

      {/* Entity Owner Picker */}
      <EntityOwnerPicker mode="owners-only" />

      {/* GitLab Language Picker - only shown for gitlab-project entities */}
      {currentEntityPick === 'gitlab-project' && (
        <HubEntityGitLabLanguagePicker 
          currentLanguagePick={currentLanguagePick} 
          setCurrentPick={setCurrentLanguagePick} 
        />
      )}
    </>
  );
};

export default CatalogFilters;