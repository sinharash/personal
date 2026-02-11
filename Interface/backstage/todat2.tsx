import { useState, useEffect, useRef } from 'react'
import { MemberOfAsUserFilter } from './useMemberOfEntitiesCount'

export const CatalogFilters = () => {
  const { queryParameters, filters, updateFilters } = useEntityList<ExtendedEntityFilters>()
  // ... existing state ...

  // Keep a ref to always have latest updateFilters
  const updateFiltersRef = useRef(updateFilters)
  updateFiltersRef.current = updateFilters

  // Handles All/Starred clicks (filter.user reference changes)
  useEffect(() => {
    if (filters.memberOf !== undefined && filters.user !== undefined &&
        !(filters.user instanceof MemberOfAsUserFilter)) {
      updateFilters({ memberOf: undefined })
    }
  }, [filters.user, filters.memberOf, updateFilters])

  return (
    <>
      <HubEntityKindTypePicker ... />
      <div onClickCapture={() => {
        if (filters.memberOf !== undefined) {
          requestAnimationFrame(() => {
            updateFiltersRef.current({ memberOf: undefined })
          })
        }
      }}>
        <UserListPicker initialFilter='owned' />
      </div>
      <MemberOfFilter />
      ...
    </>
  )
}