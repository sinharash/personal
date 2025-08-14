/**
 * Enhanced Entity Picker Component
 * 
 * This component extends the original Backstage EntityPicker with two key enhancements:
 * 1. displayFormat: Allows custom formatting of how entities appear in the dropdown
 * 2. hiddenEntityRef: Stores the actual entity reference in a hidden field for backend processing
 * 
 * Usage Examples:
 * 
 * Basic usage (behaves like original EntityPicker):
 * ```yaml
 * userPicker:
 *   title: "Select User"
 *   type: string
 *   ui:field: EnhancedEntityPicker
 *   ui:options:
 *     catalogFilter:
 *       kind: User
 * ```
 * 
 * Enhanced usage with custom display format:
 * ```yaml
 * userPicker:
 *   title: "Select User" 
 *   type: string
 *   ui:field: EnhancedEntityPicker
 *   ui:options:
 *     catalogFilter:
 *       kind: User
 *     displayFormat: "{{ metadata.title }} - {{ spec.profile.email }}"
 *     hiddenEntityRef: "selectedUserRef"
 * 
 * selectedUserRef:
 *   type: string
 *   ui:widget: hidden
 * ```
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useAsync } from 'react-use/esm/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { useTranslationRef } from '@backstage/core-plugin-api/alpha';
import { ScaffolderField } from '@backstage/plugin-scaffolder-react/alpha';
import { 
  Entity, 
  parseEntityRef, 
  stringifyEntityRef 
} from '@backstage/catalog-model';
import {
  EntityDisplayName,
  EntityRefPresentationSnapshot,
  catalogApiRef,
  entityPresentationApiRef,
} from '@backstage/plugin-catalog-react';
import TextField from '@mui/material/TextField';
import Autocomplete, {
  AutocompleteChangeReason,
  createFilterOptions,
} from '@mui/material/Autocomplete';
import { VirtualizedListbox } from './VirtualizedListbox';
import { scaffolderTranslationRef } from './translation';
import { ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS } from './enhanced-entity-picker-fields';

export { EnhancedEntityPickerSchema } from './schema';

/**
 * Converts any value to a display-friendly string
 * Handles arrays, objects, and primitive values
 * 
 * @param value - The value to convert (can be string, number, array, object, etc.)
 * @returns String representation suitable for display
 * 
 * Examples:
 * convertToString("hello") → "hello"
 * convertToString(["a", "b", "c"]) → "a, b, c"
 * convertToString({name: "John"}) → '{"name":"John"}'
 * convertToString(null) → ""
 */
const convertToString = (value: any): string => {
  // Handle null/undefined values
  if (value === null || value === undefined) return '';
  
  // Handle arrays - join elements with commas
  // Example: ["admin1@email.com", "admin2@email.com"] → "admin1@email.com, admin2@email.com"
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  
  // Handle objects - convert to JSON string
  // Example: {type: "memberOf"} → '{"type":"memberOf"}'
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  // Handle primitives (string, number, boolean) - convert to string
  return String(value);
};

/**
 * Safely access nested object properties using dot notation
 * Supports array index access using numeric keys
 * 
 * @param obj - The object to traverse
 * @param path - Dot-separated path to the desired property
 * @returns The value at the specified path, or undefined if not found
 * 
 * Examples:
 * getNestedValue(entity, "metadata.name") → "my-component"
 * getNestedValue(entity, "metadata.admins.0") → "first-admin@email.com"
 * getNestedValue(entity, "spec.profile.email") → "user@company.com"
 * getNestedValue(entity, "nonexistent.path") → undefined
 */
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  
  try {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      
      // Handle array index access
      // Example: "admins.0" → access first element of admins array
      if (!isNaN(Number(key)) && Array.isArray(current)) {
        return current[Number(key)];
      }
      
      // Handle regular object property access
      return current[key];
    }, obj);
  } catch {
    // Return undefined if any error occurs during traversal
    return undefined;
  }
};

/**
 * Processes display format templates and returns formatted string
 * Supports two template syntaxes:
 * 1. Template syntax: "{{ property }}" - replaces with actual values
 * 2. Fallback syntax: "prop1 || prop2" - uses first non-empty value
 * 
 * @param template - The template string with placeholders
 * @param entity - The entity object containing the data
 * @returns Formatted display string
 * 
 * Examples:
 * Template syntax:
 * formatDisplayValue("{{ metadata.name }} - {{ spec.type }}", entity)
 * → "my-component - service"
 * 
 * Fallback syntax:
 * formatDisplayValue("metadata.title || metadata.name", entity)
 * → Uses title if available, otherwise falls back to name
 * 
 * Mixed usage:
 * formatDisplayValue("User: {{ spec.profile.displayName }} ({{ spec.profile.email }})", entity)
 * → "User: John Doe (john.doe@company.com)"
 */
const formatDisplayValue = (template: string, entity: Entity): string => {
  if (!template || !entity) {
    // Fallback to standard entity display if no template provided
    return entity?.metadata?.title || entity?.metadata?.name || '';
  }

  try {
    // Handle fallback syntax: "property1 || property2 || property3"
    // Use the first property that has a non-empty value
    if (template.includes(' || ')) {
      const paths = template.split(' || ').map(p => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        const stringValue = convertToString(value);
        if (stringValue && stringValue.trim()) return stringValue;
      }
      return '';
    }

    // Handle template syntax: "{{ property }}" placeholders
    // Replace all {{ expression }} with actual values from entity
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return convertToString(value);
    });
  } catch {
    // Fallback to entity name if template processing fails
    return entity?.metadata?.name || '';
  }
};

/**
 * Main Enhanced Entity Picker Component
 * 
 * Renders an autocomplete dropdown for selecting Backstage entities with enhanced formatting capabilities.
 * Maintains backward compatibility with the original EntityPicker while adding new features.
 * 
 * Key Features:
 * - Custom display formatting using displayFormat template
 * - Hidden entity reference storage for backend processing
 * - Support for all original EntityPicker features
 * - Performance optimization with selective field loading
 * 
 * @param props - Component props including form data, schema, and UI configuration
 */
export const EnhancedEntityPicker = (props: EnhancedEntityPickerProps) => {
  const {
    onChange,        // Function called when selection changes
    schema,          // JSON schema definition
    required,        // Whether field is required
    uiSchema,        // UI schema with component configuration
    rawErrors,       // Validation errors to display
    formData,        // Current form data value
    formContext,     // Form context for accessing other form data
    idSchema,        // Schema for generating field IDs
  } = props;

  // Get translation functions for internationalization support
  const { t } = useTranslationRef(scaffolderTranslationRef);

  // Extract configuration from UI schema
  const catalogFilter = buildCatalogFilter(uiSchema);              // Entity filtering criteria
  const defaultKind = uiSchema['ui:options']?.defaultKind;         // Default entity kind
  const defaultNamespace = uiSchema['ui:options']?.defaultNamespace || undefined; // Default namespace
  const isDisabled = uiSchema['ui:disabled'] ?? false;            // Whether field is disabled

  // Enhanced options for custom display and hidden reference storage
  const displayFormat = uiSchema['ui:options']?.displayFormat;     // Custom display template
  const hiddenEntityRef = uiSchema['ui:options']?.hiddenEntityRef; // Hidden field name for entity reference

  // Get API references for data fetching
  const catalogApi = useApi(catalogApiRef);
  const entityPresentationApi = useApi(entityPresentationApiRef);

  /**
   * Load entities from the catalog with enhanced field selection
   * Combines base fields (for performance) with additional fields (for displayFormat support)
   */
  const { value: entities, loading } = useAsync(async () => {
    // Base fields array - essential fields that are always loaded for performance
    // These are the minimum fields needed for basic EntityPicker functionality
    const baseFields = [
      'kind',                           // Entity type (User, Component, System, etc.)
      'metadata.account_id',            // Custom field example
      'metadata.name',                  // Entity name (required field)
      'metadata.namespace',             // Entity namespace
      'metadata.title',                 // Human-readable title
      'metadata.description',           // Entity description
      'spec.profile.displayName',       // User display name
      'spec.profile.email',            // User email address
      'spec.type',                     // Component/System type
    ];
    
    // Combine base fields with additional fields for comprehensive displayFormat support
    // This allows users to reference any common field in their displayFormat templates
    const allFields = [...baseFields, ...ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS];
    
    // Fetch entities from catalog with combined field set
    // This ensures we have all necessary data while maintaining performance
    const { items } = await catalogApi.getEntities(
      catalogFilter
        ? { filter: catalogFilter, fields: allFields }
        : { filter: undefined, fields: allFields },
    );

    // Build entity presentation map for display names and metadata
    // This provides additional display information like primary titles
    const entityRefToPresentation = new Map<
      string,
      EntityRefPresentationSnapshot
    >();

    // Load presentation data for each entity
    await Promise.all(
      items.map(async item => {
        const presentation = await entityPresentationApi.forEntity(item)
          .promise;
        return [stringifyEntityRef(item), presentation] as [
          string,
          EntityRefPresentationSnapshot,
        ];
      }),
    ).then(
      entries => {
        entries.forEach(([ref, presentation]) => {
          entityRefToPresentation.set(ref, presentation);
        });
      },
    );

    return { catalogEntities: items, entityRefToPresentation };
  }, [catalogFilter]); // Only re-run when catalog filter changes

  // Configuration for allowing free-text input (arbitrary values)
  const allowArbitraryValues = uiSchema['ui:options']?.allowArbitraryValues ?? true;

  /**
   * Get display label for free-text input values
   * Attempts to parse and format entity references
   * 
   * @param freeSoloValue - The free-text input value
   * @returns Formatted entity reference or original value
   */
  const getLabel = useCallback(
    (freeSoloValue: string) => {
      try {
        // Try to parse the input as an entity reference
        // Example: "component:default/my-service" → parsed entity reference
        const parsedRef = parseEntityRef(freeSoloValue, {
          defaultKind,
          defaultNamespace,
        });
        return stringifyEntityRef(parsedRef);
      } catch (err) {
        // If parsing fails, return the original value
        // This allows for free-text input when allowArbitraryValues is true
        return freeSoloValue;
      }
    },
    [defaultKind, defaultNamespace],
  );

  /**
   * Handle selection changes from the autocomplete component
   * Supports both entity objects and free-text string inputs
   * Implements enhanced logic for displayFormat and hiddenEntityRef
   * 
   * @param _ - Unused event parameter
   * @param ref - Selected entity object or string value
   * @param reason - The reason for the change (selection, blur, etc.)
   */
  const onSelect = useCallback(
    (_: any, ref: string | Entity | null, reason: AutocompleteChangeReason) => {
      // Handle different types of selections and reasons
      
      if (typeof ref === 'string') {
        // Handle free-text string input
        
        if (reason === 'blur' || reason === 'createOption') {
          // Validate that required defaults are available for parsing
          if (!ref || (!defaultKind && !defaultNamespace)) {
            onChange(undefined);
            return;
          }
        }

        // Enhanced Logic: Store display value if displayFormat is specified
        if (displayFormat) {
          const displayValue = formatDisplayValue(displayFormat, ref);
          onChange(displayValue);
        } else {
          // Store entity reference in hidden field if specified
          if (hiddenEntityRef && formContext?.formData) {
            const entityRef = stringifyEntityRef(ref);
            formContext.formData[hiddenEntityRef] = entityRef;
          }
          
          // Store entity reference as string
          onChange(stringifyEntityRef(ref));
        }
      } else {
        // Handle Entity object selection
        
        if (reason === 'blur' || reason === 'createOption') {
          // Add in default namespace, etc.
          let entityRef = ref;
          try {
            entityRef = stringifyEntityRef(
              parseEntityRef(ref as string, {
                defaultKind,
                defaultNamespace,
              }),
            );
          } catch (err) {
            // If the passed in value isn't an entity ref, do nothing.
          }

          // We need to check against formData here as that's the previous value for this field.
          if (formData !== ref || allowArbitraryValues) {
            onChange(entityRef);
          }
        } else {
          // Enhanced Logic: Store display value if displayFormat is specified
          if (displayFormat) {
            const displayValue = formatDisplayValue(displayFormat, ref);
            onChange(displayValue);
          } else {
            // Store entity reference in hidden field if specified
            if (hiddenEntityRef && formContext?.formData) {
              const entityRef = stringifyEntityRef(ref);
              formContext.formData[hiddenEntityRef] = entityRef;
            }
            
            // Store entity reference as string (original logic)
            onChange(stringifyEntityRef(ref));
          }
        }
      }
    },
    [onChange, formData, formContext, defaultKind, defaultNamespace, allowArbitraryValues, displayFormat, hiddenEntityRef],
  );

  /**
   * Enhanced logic to determine and return the currently selected entity
   * Handles both entity reference lookup and display format matching
   * 
   * @returns The currently selected entity object, string value, or empty string
   */
  const selectedEntity = () => {
    // Return empty if no form data or no entities available
    if (!formData || !entities?.catalogEntities.length) {
      return '';
    }

    // Handle single entity auto-selection case
    if (entities.catalogEntities.length === 1 && !allowArbitraryValues) {
      return allowArbitraryValues && formData ? getLabel(formData) : '';
    }

    // Try to find entity by reference first (original logic)
    // Example: "user:default/john.doe" → finds matching entity
    const entityByRef = entities.catalogEntities.find(e => stringifyEntityRef(e) === formData);
    if (entityByRef) return entityByRef;

    // If displayFormat is used, try to find by display value
    // Example: "John Doe - john.doe@company.com" → finds entity with matching display format
    if (displayFormat) {
      const entityByDisplay = entities.catalogEntities.find(e => {
        const displayValue = formatDisplayValue(displayFormat, e);
        return displayValue === formData;
      });
      if (entityByDisplay) return entityByDisplay;
    }

    // Fallback to original logic for free-text values
    return allowArbitraryValues && formData ? getLabel(formData) : '';
  };

  /**
   * Auto-select single entity when required and no arbitrary values allowed
   * This matches the original EntityPicker behavior for single-entity scenarios
   */
  useEffect(() => {
    if (
      required &&
      !allowArbitraryValues &&
      entities?.catalogEntities.length === 1 &&
      selectedEntity === ''
    ) {
      const singleEntity = entities.catalogEntities[0];
      
      if (displayFormat) {
        // Use custom display format for auto-selected entity
        const displayValue = formatDisplayValue(displayFormat, singleEntity);
        onChange(displayValue);
      } else {
        // Store entity reference in hidden field if specified
        if (hiddenEntityRef && formContext?.formData) {
          formContext.formData[hiddenEntityRef] = stringifyEntityRef(singleEntity);
        }
        // Store entity reference (original logic)
        onChange(stringifyEntityRef(singleEntity));
      }
    }
  }, [entities, onChange, selectedEntity, required, allowArbitraryValues, displayFormat, hiddenEntityRef, formContext]);

  // Render the enhanced entity picker component
  return (
    <ScaffolderField
      rawErrors={rawErrors}
      rawDescription={(uiSchema['ui:description'] ?? description)}
      required={required}
      disabled={isDisabled}
    >
      <Autocomplete
        // Disable component when disabled by config or when auto-selecting single required entity
        disabled={isDisabled ||
          (required &&
            !allowArbitraryValues &&
            entities?.catalogEntities.length === 1)}
        id={idSchema?.$id}
        value={selectedEntity}
        loading={loading}
        onChange={onSelect}
        freeSolo={allowArbitraryValues}  // Allow free-text input if configured
        options={entities?.catalogEntities || []}
        autoSelect
        
        /**
         * Custom option label rendering with displayFormat support
         * Determines how each option appears in the dropdown
         */
        getOptionLabel={(option) => {
          if (typeof option === 'string') {
            // Handle string options
            if (displayFormat) {
              return option; // For string options when displayFormat is used
            }
            // Use presentation data or fallback to option string
            return entities?.entityRefToPresentation.get(option)?.primaryTitle || option;
          } else {
            // Handle Entity object options
            if (displayFormat) {
              // Use custom display format
              // Example: "{{ metadata.name }} - {{ spec.type }}" → "my-component - service"
              return formatDisplayValue(displayFormat, option);
            }
            // Use presentation data or fallback to stringified entity reference
            return entities?.entityRefToPresentation.get(stringifyEntityRef(option))?.primaryTitle || 
                   stringifyEntityRef(option);
          }
        }}
        
        // Configure filtering options for the autocomplete
        filterOptions={createFilterOptions<Entity>({
          stringify: option =>
            displayFormat
              ? formatDisplayValue(displayFormat, option)  // Filter by custom display format
              : entities?.entityRefToPresentation.get(stringifyEntityRef(option))?.primaryTitle ||
                stringifyEntityRef(option)
        })}
        
        // Use virtualized listbox for performance with large entity lists
        ListboxComponent={VirtualizedListbox}
        
        // Render the input field
        renderInput={(params) => (
          <TextField
            {...params}
            label={title}
            margin="dense"
            variant="outlined"
            required={required}
            disabled={isDisabled}
            InputProps={params.InputProps}
          />
        )}
        
        /**
         * Custom option rendering in the dropdown
         * Controls how each individual option appears when dropdown is open
         */
        renderOption={(renderProps, option) => (
          <li {...renderProps}>
            {displayFormat ? (
              // Custom display format rendering
              // Shows formatted text like "John Doe - john.doe@company.com"
              <span>{formatDisplayValue(displayFormat, option)}</span>
            ) : (
              // Default entity display name rendering (original EntityPicker behavior)
              // Shows standard Backstage entity display with icon and formatted name
              <EntityDisplayName entityRef={option} />
            )}
          </li>
        )}
      />
    </ScaffolderField>
  );
};

// Helper functions from original EntityPicker (implementation details)

/**
 * Converts special `{exists: true}` values to CATALOG_FILTER_EXISTS symbol
 * Used for filtering entities where a field exists regardless of value
 */
function convertOpsValues(
  value: EntityPickerFilterQueryValue,
  Array<any>,
): string | symbol {
  if (typeof value === 'object' && value.exists) {
    return CATALOG_FILTER_EXISTS;
  }
  return value?.toString();
}

/**
 * Converts schema filters to entity filter query format
 * Processes filtering configuration from YAML into API format
 */
function convertSchemaFiltersToQuery(
  schemaFilters: EntityFilterQuery,
): EntityFilterQuery {
  const query: EntityFilterQuery = {};
  
  for (const [key, value] of Object.entries(schemaFilters)) {
    if (Array.isArray(value)) {
      query[key] = value.map(convertOpsValues);
    } else {
      query[key] = convertOpsValues(value);
    }
  }
  
  return query;
}

/**
 * Builds catalog filter from UI schema configuration
 * Converts YAML filter configuration into API-compatible format
 * 
 * @param uiSchema - The UI schema containing filter configuration
 * @returns EntityFilterQuery for the catalog API
 */
function buildCatalogFilter(
  uiSchema: EnhancedEntityPickerUiOptions['uiSchema'],
): EntityFilterQuery | undefined {
  const allowedKinds = uiSchema['ui:options']?.allowedKinds;
  const catalogFilter: EnhancedEntityPickerUiOptions['catalogFilter'] | undefined =
    uiSchema['ui:options']?.catalogFilter ||
    (allowedKinds && { kind: allowedKinds });

  if (!catalogFilter) {
    return undefined;
  }

  if (Array.isArray(catalogFilter)) {
    return catalogFilter.map(convertSchemaFiltersToQuery);
  }

  return convertSchemaFiltersToQuery(catalogFilter);
}


>>>>>>>
this code is imporoved function for fall back inside the <template>
// Enhanced formatDisplayValue to support fallback within {{ }} brackets
const formatDisplayValue = (template: string, entity: Entity): string => {
  if (!template || !entity) {
    return entity?.metadata?.title || entity?.metadata?.name || '';
  }

  try {
    // Handle pure fallback syntax (no {{ }} brackets): "prop1 || prop2"
    if (template.includes(' || ') && !template.includes('{{')) {
      const paths = template.split(' || ').map(p => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        const stringValue = convertToString(value);
        if (stringValue && stringValue.trim()) return stringValue;
      }
      return '';
    }

    // Handle template syntax with fallback support within {{ }}
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const trimmedExpression = expression.trim();
      
      // Check if expression contains fallback syntax
      if (trimmedExpression.includes(' || ')) {
        // Handle fallback within the {{ }} brackets
        const paths = trimmedExpression.split(' || ').map(p => p.trim());
        for (const path of paths) {
          const value = getNestedValue(entity, path);
          const stringValue = convertToString(value);
          if (stringValue && stringValue.trim()) return stringValue;
        }
        return ''; // No fallback value found
      } else {
        // Handle single property access
        const value = getNestedValue(entity, trimmedExpression);
        return convertToString(value);
      }
    });
  } catch {
    return entity?.metadata?.name || '';
  }
};

// Usage Examples with Enhanced Support:

/*
YAML Examples that will work with enhanced version:

# 1. Template without fallback (already works)
displayFormat: "Email: {{ metadata.title }} - Name: {{ metadata.name }}"
# Result: "Email: My Service - Name: my-service"

# 2. Pure fallback (already works)  
displayFormat: "metadata.title || metadata.name || spec.type"
# Result: First non-empty value

# 3. Template with fallback within brackets (NEW - will work with enhanced code)
displayFormat: "Type: {{ spec.type || metadata.title }}"
# Result: "Type: service" (uses spec.type if available, otherwise metadata.title)

# 4. Multiple templates with fallbacks (NEW)
displayFormat: "{{ spec.profile.displayName || metadata.name }} - {{ spec.profile.email || metadata.account_email }}"
# Result: "John Doe - john.doe@company.com"

# 5. Mixed static text with fallback templates (NEW)
displayFormat: "User: {{ spec.profile.displayName || metadata.title }} ({{ spec.profile.department || 'Unknown Dept' }})"
# Result: "User: John Doe (Engineering)"
*/</template>