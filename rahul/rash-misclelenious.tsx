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

>>>>>>>
again 

// EXACT FIX: Replace your onSelect function with this original-like behavior

const onSelect = useCallback(
  (_: any, ref: string | Entity | null, reason: AutocompleteChangeReason) => {
    if (!ref) {
      onChange(undefined);
      return;
    }

    if (typeof ref === 'string') {
      if (reason === 'blur' || reason === 'createOption') {
        if (!ref || (!defaultKind && !defaultNamespace)) {
          onChange(undefined);
          return;
        }
      }

      // Parse string input to entity reference
      let entityRef = ref;
      try {
        entityRef = stringifyEntityRef(
          parseEntityRef(ref as string, {
            defaultKind,
            defaultNamespace,
          }),
        );
      } catch (err) {
        // Keep original string if parsing fails
      }

      // CRITICAL: When displayFormat is used, store display value
      // Otherwise, ALWAYS store entity reference (original behavior)
      if (displayFormat) {
        onChange(ref); // Store display value
      } else {
        onChange(entityRef); // Store entity reference - ORIGINAL BEHAVIOR
      }

      // Store entity reference in hidden field
      if (hiddenEntityRef && formContext?.formData) {
        formContext.formData[hiddenEntityRef] = entityRef;
      }

    } else {
      // Handle Entity object selection
      if (reason === 'blur' || reason === 'createOption') {
        let entityRef = ref;
        try {
          entityRef = stringifyEntityRef(
            parseEntityRef(ref as string, {
              defaultKind,
              defaultNamespace,
            }),
          );
        } catch (err) {
          // Keep original if parsing fails
        }

        if (formData !== ref || allowArbitraryValues) {
          if (displayFormat) {
            const displayValue = formatDisplayValue(displayFormat, ref);
            onChange(displayValue);
          } else {
            // CRITICAL: ALWAYS store entity reference - ORIGINAL BEHAVIOR
            onChange(stringifyEntityRef(ref));
          }
        }
      } else {
        // Normal selection - CRITICAL: Check displayFormat first
        if (displayFormat) {
          const displayValue = formatDisplayValue(displayFormat, ref);
          onChange(displayValue);
        } else {
          // ORIGINAL BEHAVIOR: ALWAYS store stringified entity reference
          onChange(stringifyEntityRef(ref));
        }
      }

      // Store entity reference in hidden field
      if (hiddenEntityRef && formContext?.formData) {
        try {
          const entityRef = stringifyEntityRef(ref);
          formContext.formData[hiddenEntityRef] = entityRef;
        } catch {
          // Silent error handling
        }
      }
    }
  },
  [onChange, formData, formContext, defaultKind, defaultNamespace, allowArbitraryValues, displayFormat, hiddenEntityRef],
);

// ALSO: Make sure your fields array matches original EntityPicker
const baseFields = [
  'kind',
  'metadata.name',            // Required for entity references  
  'metadata.namespace',       // Required for entity references
  'metadata.title',           // Optional display field
  'metadata.description',     // Optional display field  
  'spec.profile.displayName', // For users
  'spec.type',               // For components/systems
];


>>>>>>>>>>>>
again2
// EXACT MATCH: Replace your selectedEntity and getOptionLabel with these original-like versions

// 1. ORIGINAL selectedEntity function (simplified)
const selectedEntity = () => {
  if (!formData || !entities?.catalogEntities.length) {
    return '';
  }

  // Handle single entity auto-selection (original behavior)
  if (entities.catalogEntities.length === 1 && !formData && !allowArbitraryValues) {
    return entities.catalogEntities[0];
  }

  // ORIGINAL LOGIC: Try to find entity by entity reference
  const entityByRef = entities.catalogEntities.find(e => stringifyEntityRef(e) === formData);
  if (entityByRef) return entityByRef;

  // ENHANCED LOGIC: Only when displayFormat is used, try display value matching
  if (displayFormat) {
    const entityByDisplay = entities.catalogEntities.find(e => {
      const displayValue = formatDisplayValue(displayFormat, e);
      return displayValue === formData;
    });
    if (entityByDisplay) return entityByDisplay;
  }

  // ORIGINAL FALLBACK: Free text handling
  return allowArbitraryValues && formData ? getLabel(formData) : '';
};

// 2. ORIGINAL getOptionLabel function (based on code fragments)
// From the search results: entities?.entityRefToPresentation.get(stringifyEntityRef(option))?.primaryTitle!
getOptionLabel={(option) => {
  // Handle string options (for free-text input)
  if (typeof option === 'string') {
    if (displayFormat) {
      return option; // When displayFormat used, show the display value
    }
    // ORIGINAL: Use presentation data or fallback to the string
    return entities?.entityRefToPresentation.get(option)?.primaryTitle || option;
  }
  
  // Handle Entity object options
  if (displayFormat) {
    // ENHANCED: Use custom display format
    return formatDisplayValue(displayFormat, option);
  }
  
  // ORIGINAL BEHAVIOR: Use primaryTitle from presentation or fallback to stringified ref
  return entities?.entityRefToPresentation.get(stringifyEntityRef(option))?.primaryTitle || 
         stringifyEntityRef(option);
}}

// 3. ORIGINAL renderOption (this one is definitely from the original)
renderOption={(option) => <EntityDisplayName entityRef={option} />}

// 4. ORIGINAL filterOptions (based on search results)
filterOptions={createFilterOptions<Entity>({
  stringify: option => {
    if (displayFormat) {
      // ENHANCED: Filter by display format
      return formatDisplayValue(displayFormat, option);
    }
    // ORIGINAL: Filter by primaryTitle from presentation
    return entities?.entityRefToPresentation.get(stringifyEntityRef(option))?.primaryTitle || 
           stringifyEntityRef(option);
  }
})}

// 5. ORIGINAL useEffect for auto-selection (from search results)
useEffect(() => {
  if (
    required &&
    !allowArbitraryValues &&
    entities?.catalogEntities.length === 1 &&
    selectedEntity === ''
  ) {
    if (displayFormat) {
      // ENHANCED: Store display value
      const displayValue = formatDisplayValue(displayFormat, entities.catalogEntities[0]);
      onChange(displayValue);
    } else {
      // ORIGINAL BEHAVIOR: Store entity reference
      onChange(stringifyEntityRef(entities.catalogEntities[0]));
    }
  }
}, [entities, onChange, selectedEntity, required, allowArbitraryValues, displayFormat]);

// IMPORTANT: Keep the original field array exactly as it is
const fields = [
  'kind',
  'metadata.name',
  'metadata.namespace', 
  'metadata.title',
  'metadata.description',
  'spec.profile.displayName',
  'spec.type',
];
// DO NOT add your ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS to this base array
// Only add them when displayFormat is actually used by a specific field



>>>>>>>>
I hope this is complete :

// FIX 1: Replace your onSelect function (around lines 198-247) with this:
const onSelect = useCallback(
  (_: any, ref: string | Entity | null, reason: AutocompleteChangeReason) => {
    if (!ref) {
      onChange(undefined);
      return;
    }

    if (typeof ref === 'string') {
      if (reason === 'blur' || reason === 'createOption') {
        if (!ref || (!defaultKind && !defaultNamespace)) {
          onChange(undefined);
          return;
        }
      }

      // Parse string input to entity reference
      let entityRef = ref;
      try {
        entityRef = stringifyEntityRef(
          parseEntityRef(ref as string, {
            defaultKind,
            defaultNamespace,
          }),
        );
      } catch (err) {
        // Keep original string if parsing fails
      }

      // CRITICAL: When displayFormat is used, store display value
      // Otherwise, ALWAYS store entity reference (original behavior)
      if (displayFormat) {
        onChange(ref); // Store display value
      } else {
        onChange(entityRef); // Store entity reference - ORIGINAL BEHAVIOR
      }

      // Store entity reference in hidden field
      if (hiddenEntityRef && formContext?.formData) {
        formContext.formData[hiddenEntityRef] = entityRef;
      }

    } else {
      // Handle Entity object selection
      if (reason === 'blur' || reason === 'createOption') {
        let entityRef = ref;
        try {
          entityRef = stringifyEntityRef(
            parseEntityRef(ref as string, {
              defaultKind,
              defaultNamespace,
            }),
          );
        } catch (err) {
          // Keep original if parsing fails
        }

        if (formData !== ref || allowArbitraryValues) {
          if (displayFormat) {
            const displayValue = formatDisplayValue(displayFormat, ref);
            onChange(displayValue);
          } else {
            // CRITICAL: ALWAYS store entity reference - ORIGINAL BEHAVIOR
            onChange(stringifyEntityRef(ref));
          }
        }
      } else {
        // Normal selection - CRITICAL: Check displayFormat first
        if (displayFormat) {
          const displayValue = formatDisplayValue(displayFormat, ref);
          onChange(displayValue);
        } else {
          // ORIGINAL BEHAVIOR: ALWAYS store stringified entity reference
          onChange(stringifyEntityRef(ref));
        }
      }

      // Store entity reference in hidden field
      if (hiddenEntityRef && formContext?.formData) {
        try {
          const entityRef = stringifyEntityRef(ref);
          formContext.formData[hiddenEntityRef] = entityRef;
        } catch {
          // Silent error handling
        }
      }
    }
  },
  [onChange, formData, formContext, defaultKind, defaultNamespace, allowArbitraryValues, displayFormat, hiddenEntityRef],
);

// FIX 2: Replace your selectedEntity function (around lines 249-269) with this:
const selectedEntity = () => {
  if (!formData || !entities?.catalogEntities.length) {
    return '';
  }

  // Handle single entity auto-selection case  
  if (entities.catalogEntities.length === 1 && !formData && !allowArbitraryValues) {
    return entities.catalogEntities[0];
  }

  // ORIGINAL LOGIC: Try to find entity by reference first
  const entityByRef = entities.catalogEntities.find(e => stringifyEntityRef(e) === formData);
  if (entityByRef) return entityByRef;

  // ENHANCED LOGIC: Only when displayFormat is used, try display value matching
  if (displayFormat) {
    const entityByDisplay = entities.catalogEntities.find(e => {
      const displayValue = formatDisplayValue(displayFormat, e);
      return displayValue === formData;
    });
    if (entityByDisplay) return entityByDisplay;
  }

  // ORIGINAL FALLBACK: Free text handling
  return allowArbitraryValues && formData ? getLabel(formData) : '';
};

// FIX 3: Replace your useEffect (around lines 272-291) with this:
useEffect(() => {
  if (
    required &&
    !allowArbitraryValues &&
    entities?.catalogEntities.length === 1 &&
    selectedEntity === ''
  ) {
    const singleEntity = entities.catalogEntities[0];
    
    if (displayFormat) {
      // ENHANCED: Store display value
      const displayValue = formatDisplayValue(displayFormat, singleEntity);
      onChange(displayValue);
    } else {
      // ORIGINAL BEHAVIOR: Store entity reference
      onChange(stringifyEntityRef(singleEntity));
    }

    // Store in hidden field if specified
    if (hiddenEntityRef && formContext?.formData) {
      formContext.formData[hiddenEntityRef] = stringifyEntityRef(singleEntity);
    }
  }
}, [entities, onChange, selectedEntity, required, allowArbitraryValues, displayFormat, hiddenEntityRef, formContext]);

// FIX 4: Replace your getOptionLabel (around lines 313-326) with this:
getOptionLabel={(option) => {
  // Handle string options (for free-text input)
  if (typeof option === 'string') {
    if (displayFormat) {
      return option; // When displayFormat used, show the display value
    }
    // ORIGINAL: Use presentation data or fallback to the string
    return entities?.entityRefToPresentation.get(option)?.primaryTitle || option;
  }
  
  // Handle Entity object options
  if (displayFormat) {
    // ENHANCED: Use custom display format
    return formatDisplayValue(displayFormat, option);
  }
  
  // ORIGINAL BEHAVIOR: Use primaryTitle from presentation or fallback to stringified ref
  return entities?.entityRefToPresentation.get(stringifyEntityRef(option))?.primaryTitle || 
         stringifyEntityRef(option);
}}

// FIX 5: Replace your renderOption (around lines 340-347) with this:
renderOption={(renderProps, option) => (
  <li {...renderProps}>
    {displayFormat ? (
      // ENHANCED: Custom display format rendering
      <span>{formatDisplayValue(displayFormat, option)}</span>
    ) : (
      // ORIGINAL: Use EntityDisplayName component
      <EntityDisplayName entityRef={option} />
    )}
  </li>
)}

// FIX 6: Replace your filterOptions (around lines 349-356) with this:
filterOptions={createFilterOptions<Entity>({
  stringify: option => {
    if (displayFormat) {
      // ENHANCED: Filter by display format
      return formatDisplayValue(displayFormat, option);
    }
    // ORIGINAL: Filter by primaryTitle from presentation
    return entities?.entityRefToPresentation.get(stringifyEntityRef(option))?.primaryTitle || 
           stringifyEntityRef(option);
  }
})}

// FIX 7: Keep your baseFields array as is (lines 137-145) - it's correct!
// Your current baseFields array is fine and matches the original EntityPicker