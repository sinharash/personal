const isActive = filters.user instanceof MemberOfAsUserFilter;

const handleClick = useCallback(() => {
  if (isActive) {
    // Deactivate: go back to Owned
    updateFilters({
      user: EntityUserFilter.owned(ownershipEntityRefs ?? []),
    });
  } else {
    // Activate: set MemberOfAsUserFilter on user key
    updateFilters({
      user: new MemberOfAsUserFilter(
        ownershipEntityRefs ?? []
      ) as unknown as EntityUserFilter,
    });
  }
}, [isActive, ownershipEntityRefs, updateFilters]);
