// FIXED onSelect function - replace your existing onSelect function with this:

const onSelect = useCallback(
  (_: any, ref: string | Entity | null, reason: AutocompleteChangeReason) => {
    // Handle null selection
    if (!ref) {
      onChange(undefined);
      return;
    }

    // Handle string input (free-text)
    if (typeof ref === 'string') {
      if (reason === 'blur' || reason === 'createOption') {
        // Validate required defaults for parsing
        if (!ref || (!defaultKind && !defaultNamespace)) {
          onChange(undefined);
          return;
        }
      }

      // Try to parse and format the string input
      let entityRef = ref;
      try {
        entityRef = stringifyEntityRef(
          parseEntityRef(ref as string, {
            defaultKind,
            defaultNamespace,
          }),
        );
      } catch (err) {
        // If parsing fails, use the original string
      }

      // Enhanced Logic: Only use displayFormat if specified
      if (displayFormat) {
        // For string inputs with displayFormat, store the display value
        onChange(ref);
      } else {
        // Default behavior: store entity reference
        onChange(entityRef);
      }

      // Store entity reference in hidden field if specified
      if (hiddenEntityRef && formContext?.formData) {
        formContext.formData[hiddenEntityRef] = entityRef;
      }

      return;
    }

    // Handle Entity object selection
    if (reason === 'blur' || reason === 'createOption') {
      // Parse with defaults for blur/create events
      let entityRef = ref;
      try {
        entityRef = stringifyEntityRef(
          parseEntityRef(ref as string, {
            defaultKind,
            defaultNamespace,
          }),
        );
      } catch (err) {
        // If parsing fails, keep original
      }

      // Check against formData for change detection
      if (formData !== ref || allowArbitraryValues) {
        if (displayFormat) {
          const displayValue = formatDisplayValue(displayFormat, ref);
          onChange(displayValue);
        } else {
          // CRITICAL FIX: Always store entity reference for backward compatibility
          onChange(stringifyEntityRef(ref));
        }
      }
    } else {
      // Handle normal selection (not blur/create)
      
      // CRITICAL FIX: Check displayFormat first, then default to entity reference
      if (displayFormat) {
        // Enhanced behavior: store formatted display value
        const displayValue = formatDisplayValue(displayFormat, ref);
        onChange(displayValue);
      } else {
        // DEFAULT BEHAVIOR: Always store full entity reference (backward compatibility)
        onChange(stringifyEntityRef(ref));
      }
    }

    // Store entity reference in hidden field if specified (for all Entity selections)
    if (hiddenEntityRef && formContext?.formData) {
      try {
        const entityRef = stringifyEntityRef(ref);
        formContext.formData[hiddenEntityRef] = entityRef;
      } catch {
        // Silently handle error if entity ref creation fails
      }
    }
  },
  [onChange, formData, formContext, defaultKind, defaultNamespace, allowArbitraryValues, displayFormat, hiddenEntityRef],
);

// ALSO FIX: Update selectedEntity function to handle entity reference lookup correctly

const selectedEntity = () => {
  if (!formData || !entities?.catalogEntities.length) {
    return '';
  }

  // Handle single entity auto-selection case  
  if (entities.catalogEntities.length === 1 && !formData && !allowArbitraryValues) {
    return entities.catalogEntities[0];
  }

  // CRITICAL FIX: Try to find entity by reference first (for backward compatibility)
  const entityByRef = entities.catalogEntities.find(e => stringifyEntityRef(e) === formData);
  if (entityByRef) return entityByRef;

  // If displayFormat is used, try to find by display value
  if (displayFormat) {
    const entityByDisplay = entities.catalogEntities.find(e => {
      const displayValue = formatDisplayValue(displayFormat, e);
      return displayValue === formData;
    });
    if (entityByDisplay) return entityByDisplay;
  }

  // Fallback for free-text input
  return allowArbitraryValues && formData ? getLabel(formData) : '';
};

// ALSO FIX: Update getOptionLabel to be consistent with original EntityPicker

getOptionLabel={(option) => {
  if (typeof option === 'string') {
    if (displayFormat) {
      return option; // For string options when displayFormat is used
    }
    // Use presentation data or fallback to option string (original behavior)
    return entities?.entityRefToPresentation.get(option)?.primaryTitle || option;
  } else {
    if (displayFormat) {
      // Use custom display format
      return formatDisplayValue(displayFormat, option);
    }
    // ORIGINAL BEHAVIOR: Use presentation data or fallback to stringified entity reference
    return entities?.entityRefToPresentation.get(stringifyEntityRef(option))?.primaryTitle || 
           stringifyEntityRef(option);
  }
}}