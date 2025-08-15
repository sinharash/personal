/**
 * EnhancedEntityPicker Component
 *
 * An enhanced version of Backstage's EntityPicker that maintains 100% backward compatibility
 * while adding two powerful features:
 * 1. displayFormat: Custom display of selected entities using template strings
 * 2. hiddenEntityRef: Store the full entity reference in a hidden field while displaying formatted value
 *
 * Example YAML usage:
 *
 * Basic usage (identical to EntityPicker):
 * ```yaml
 * userOwner:
 *   title: "Select Service Owner"
 *   type: string
 *   ui:field: EnhancedEntityPicker
 *   ui:options:
 *     catalogFilter:
 *       kind: User
 * ```
 *
 * With display formatting:
 * ```yaml
 * userOwner:
 *   title: "Select Service Owner"
 *   type: string
 *   ui:field: EnhancedEntityPicker
 *   ui:options:
 *     catalogFilter:
 *       kind: User
 *     displayFormat: "{{ metadata.name }} - {{ spec.profile.email }}"
 *     hiddenEntityRef: "hiddenUserOwner"
 * ```
 */

import {
  type EntityFilterQuery,
  CATALOG_FILTER_EXISTS,
} from "@backstage/catalog-client";
import {
  Entity,
  parseEntityRef,
  stringifyEntityRef,
} from "@backstage/catalog-model";
import { useApi } from "@backstage/core-plugin-api";
import {
  EntityDisplayName,
  EntityRefPresentationSnapshot,
  catalogApiRef,
  entityPresentationApiRef,
} from "@backstage/plugin-catalog-react";
import { TextField, Autocomplete, createFilterOptions } from "@mui/material";
import type { AutocompleteChangeReason } from "@mui/material";
import { useCallback, useEffect } from "react";
import useAsync from "react-use/esm/useAsync";
import {
  EntityPickerFilterQueryValue,
  EnhancedEntityPickerProps,
  EnhancedEntityPickerUiOptions,
  EntityPickerFilterQuery,
} from "./enhanced-schema";
import { VirtualizedListbox } from "../VirtualizedListbox";
import { useTranslationRef } from "@backstage/core-plugin-api/alpha";
import { scaffolderTranslationRef } from "../../../translation";
import { ScaffolderField } from "@backstage/plugin-scaffolder-react/alpha";

export { EnhancedEntityPickerSchema } from "./enhanced-schema";
// Import additional fields that can be used in displayFormat templates
// These fields extend the basic entity fields for richer formatting options
import { ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS } from "./enhanced-entity-picker-fields";

/**
 * Utility function to convert any value to a string representation
 * Used when formatting display values from entity properties
 *
 * @param value - Any value from an entity property
 * @returns String representation of the value
 *
 * Examples:
 * - null/undefined -> ''
 * - ['tag1', 'tag2'] -> 'tag1, tag2'
 * - {key: 'value'} -> '{"key":"value"}'
 * - 'string' -> 'string'
 */
const convertToString = (value: any): string => {
  // Handle null/undefined gracefully
  if (value === null || value === undefined) return "";

  // Convert arrays to comma-separated string
  // Example: ['frontend', 'backend'] -> 'frontend, backend'
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  // Convert objects to JSON string
  // Example: {type: 'service'} -> '{"type":"service"}'
  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  // Convert primitives to string
  return String(value);
};

/**
 * Enhanced utility to extract nested values from objects
 * Supports dot notation for nested properties and array indexing
 *
 * @param obj - The object to extract value from (usually an Entity)
 * @param path - Dot-notated path to the property
 * @returns The value at the path, or undefined if not found
 *
 * Examples:
 * - getNestedValue(entity, 'metadata.name') -> 'my-service'
 * - getNestedValue(entity, 'spec.profile.displayName') -> 'John Doe'
 * - getNestedValue(entity, 'metadata.tags.0') -> 'frontend' (first tag)
 */
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;

  try {
    // Split path by dots and traverse the object
    return path.split(".").reduce((current, key) => {
      if (current === null || current === undefined) return undefined;

      // Handle array indices
      // Example: 'tags.0' where tags is an array
      if (!isNaN(Number(key)) && Array.isArray(current)) {
        return current[Number(key)];
      }

      // Handle object properties
      return current[key];
    }, obj);
  } catch (err) {
    return undefined;
  }
};

/**
 * Formats a display template string with actual entity values
 * Supports two syntaxes:
 * 1. Template syntax: "{{ property }}" - replaced with actual values
 * 2. Fallback syntax: "property1 || property2" - uses first non-empty value
 *
 * @param template - The template string with placeholders
 * @param entity - The entity to extract values from
 * @returns Formatted string with placeholders replaced
 *
 * Examples:
 * - Template: "{{ metadata.name }}" with entity -> "my-service"
 * - Template: "{{ metadata.name }} ({{ spec.type }})" -> "my-service (service)"
 * - Template: "spec.profile.displayName || metadata.name" -> Uses displayName if exists, else name
 */
const formatDisplayValue = (template: string, entity: Entity): string => {
  // If no template or entity, fallback to basic display
  if (!template || !entity) {
    return entity?.metadata?.title || entity?.metadata?.name || "";
  }

  try {
    // Handle fallback syntax: "property1 || property2 || property3"
    // Uses the first property that has a non-empty value
    if (template.includes(" || ")) {
      const paths = template.split(" || ").map((p) => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        const stringValue = convertToString(value);
        if (stringValue && stringValue.trim()) return stringValue;
      }
      return "";
    }

    // Handle template syntax: "{{ property }}"
    // Replace all {{ ... }} placeholders with actual values
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return convertToString(value);
    });
  } catch {
    // On any error, fallback to entity name
    return entity?.metadata?.name || "";
  }
};

/**
 * Main EnhancedEntityPicker Component
 *
 * Props are provided by React JSON Schema Form (RJSF) framework
 * This component integrates with Backstage's scaffolder forms
 */
export const EnhancedEntityPicker = (props: EnhancedEntityPickerProps) => {
  // Get translation function for internationalization
  const { t } = useTranslationRef(scaffolderTranslationRef);

  // Destructure all props from RJSF
  const {
    onChange, // Function to call when value changes
    schema: {
      title = t("fields.entityPicker.title"), // Field label
      description = t("fields.entityPicker.description"), // Field description/help text
    },
    required, // Whether field is required
    uiSchema, // UI configuration including our custom options
    rawErrors, // Validation errors
    formData, // Current field value
    formContext, // Form-wide context (used for hidden fields)
    idSchema, // Field ID for accessibility
    errors, // Processed errors
  } = props;

  // Build catalog filter from ui:options
  // This determines which entities are shown in the dropdown
  const catalogFilter = buildCatalogFilter(uiSchema);

  // Default kind if not specified in entity references
  // Example: "user:john" instead of "user:default/john"
  const defaultKind = uiSchema["ui:options"]?.defaultKind;

  // Default namespace if not specified in entity references
  const defaultNamespace =
    uiSchema["ui:options"]?.defaultNamespace || undefined;

  // Whether the field is disabled
  const isDisabled = uiSchema?.["ui:disabled"] ?? false;

  // === ENHANCED FEATURES ===
  // These are the new features that EnhancedEntityPicker adds

  // Template string for custom display format
  // Example: "{{ metadata.name }} - {{ spec.profile.email }}"
  const displayFormat = uiSchema["ui:options"]?.displayFormat;

  // Field name to store the actual entity reference
  // While the main field shows the formatted display
  const hiddenEntityRef = uiSchema["ui:options"]?.hiddenEntityRef;

  // Get Backstage APIs for catalog and entity presentation
  const catalogApi = useApi(catalogApiRef);
  const entityPresentationApi = useApi(entityPresentationApiRef);

  /**
   * Async hook to fetch entities from the catalog
   * Runs when component mounts and when catalogFilter changes
   */
  const { value: entities, loading } = useAsync(async () => {
    // Base fields that are always fetched for every entity
    const baseFields = [
      "kind",
      "metadata.name",
      "metadata.namespace",
      "metadata.title",
      "metadata.description",
      "spec.profile.displayName",
      "spec.profile.email",
      "spec.type",
    ];

    // Combine base fields with any additional fields needed for display formatting
    // ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS might include fields like:
    // "spec.owner", "spec.system", "metadata.tags", etc.
    const allFields = [
      ...baseFields,
      ...ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS,
    ];

    // Fetch entities from the catalog API
    // If catalogFilter exists, use it to filter entities
    const { items } = await catalogApi.getEntities(
      catalogFilter
        ? { filter: catalogFilter, fields: allFields }
        : { filter: undefined, fields: allFields }
    );

    // Build a map of entity references to their presentation data
    // This includes things like how the entity should be displayed
    const entityRefToPresentation = new Map<
      string,
      EntityRefPresentationSnapshot
    >(
      await Promise.all(
        items.map(async (item) => {
          const presentation = await entityPresentationApi.forEntity(item)
            .promise;
          return [stringifyEntityRef(item), presentation] as [
            string,
            EntityRefPresentationSnapshot
          ];
        })
      )
    );

    // Return both the entities and their presentation data
    return { catalogEntities: items, entityRefToPresentation };
  });

  // Whether to allow free text input (entities not in catalog)
  // Default is true for backward compatibility
  const allowArbitraryValues =
    uiSchema["ui:options"]?.allowArbitraryValues ?? true;

  /**
   * Helper to parse and format free solo input values
   * Ensures they conform to entity reference format
   *
   * Example: "my-service" -> "component:default/my-service"
   */
  const getLabel = useCallback(
    (freeSoloValue: string) => {
      try {
        // Parse the free input into a proper entity reference
        const parsedRef = parseEntityRef(freeSoloValue, {
          defaultKind,
          defaultNamespace,
        });
        return stringifyEntityRef(parsedRef);
      } catch (err) {
        // If parsing fails, return the original value
        return freeSoloValue;
      }
    },
    [defaultKind, defaultNamespace]
  );

  /**
   * Main selection handler
   * Called when user selects an entity or enters free text
   * This is where the enhanced logic for displayFormat and hiddenEntityRef is applied
   */
  const onSelect = useCallback(
    (_: any, ref: string | Entity | null, reason: AutocompleteChangeReason) => {
      // ref can be either:
      // - Entity object (when selected from dropdown)
      // - string (when typed as free text)
      // - null (when cleared)

      if (typeof ref !== "string") {
        // Handle Entity object selection
        if (!ref) {
          // Clear the field
          onChange(undefined);
          return;
        }

        // === ENHANCED LOGIC ===
        // Check if displayFormat is specified
        if (displayFormat) {
          // Format the display value using the template
          // Example: "{{ metadata.name }} - {{ spec.type }}" -> "my-service - service"
          const displayValue = formatDisplayValue(displayFormat, ref);
          onChange(displayValue);

          // Store the actual entity reference in a hidden field
          // This allows the form to show formatted text while preserving the entity reference
          if (hiddenEntityRef && formContext?.formData) {
            const entityRef = stringifyEntityRef(ref);
            formContext.formData[hiddenEntityRef] = entityRef;
          }
        } else {
          // === ORIGINAL BEHAVIOR ===
          // No displayFormat specified, behave like standard EntityPicker
          onChange(stringifyEntityRef(ref));
        }
      } else {
        // Handle string input (free solo mode)
        if (reason === "blur" || reason === "createOption") {
          let entityRef = ref;
          try {
            // Try to parse into full entity reference format
            // Example: "my-service" -> "component:default/my-service"
            entityRef = stringifyEntityRef(
              parseEntityRef(ref as string, {
                defaultKind,
                defaultNamespace,
              })
            );
          } catch (err) {
            // If parsing fails, use the raw input
          }
          // Only update if value actually changed or arbitrary values are allowed
          if (formData !== ref || allowArbitraryValues) {
            onChange(entityRef);
          }
        }
      }
    },
    [
      onChange,
      formData,
      formContext,
      defaultKind,
      defaultNamespace,
      allowArbitraryValues,
      displayFormat,
      hiddenEntityRef,
    ]
  );

  /**
   * Determine the currently selected entity
   * This handles both normal entity references and formatted display values
   *
   * Returns:
   * - Entity object if found in catalog
   * - String value if arbitrary values allowed
   * - Empty string if nothing selected
   */
  const selectedEntity = (() => {
    // No data or no entities loaded yet
    if (!formData || !entities?.catalogEntities.length) {
      return allowArbitraryValues && formData ? getLabel(formData) : "";
    }

    // Try to find entity by its reference (standard behavior)
    // Example: formData = "component:default/my-service"
    const entityByRef = entities.catalogEntities.find(
      (e: Entity) => stringifyEntityRef(e) === formData
    );
    if (entityByRef) return entityByRef;

    // === ENHANCED LOGIC ===
    // If using displayFormat, the formData might be the formatted value
    // Example: formData = "my-service - service" (from template "{{ metadata.name }} - {{ spec.type }}")
    if (displayFormat) {
      const entityByDisplay = entities.catalogEntities.find((e: Entity) => {
        const displayValue = formatDisplayValue(displayFormat, e);
        return displayValue === formData;
      });
      if (entityByDisplay) return entityByDisplay;
    }

    // Fallback: return the raw value if arbitrary values allowed
    return allowArbitraryValues && formData ? getLabel(formData) : "";
  })();

  /**
   * Auto-select single entity when required and no other options
   * This is a UX improvement - if there's only one valid option, select it automatically
   */
  useEffect(() => {
    if (
      required && // Field is required
      !allowArbitraryValues && // Can't enter custom values
      entities?.catalogEntities.length === 1 && // Only one option available
      selectedEntity === "" // Nothing selected yet
    ) {
      const singleEntity = entities.catalogEntities[0];

      // Apply display formatting if specified
      if (displayFormat) {
        const displayValue = formatDisplayValue(displayFormat, singleEntity);
        onChange(displayValue);

        // Store entity reference in hidden field
        if (hiddenEntityRef && formContext?.formData) {
          formContext.formData[hiddenEntityRef] =
            stringifyEntityRef(singleEntity);
        }
      } else {
        // Standard behavior - just set the entity reference
        onChange(stringifyEntityRef(singleEntity));
      }
    }
  }, [
    entities,
    onChange,
    selectedEntity,
    required,
    allowArbitraryValues,
    displayFormat,
    hiddenEntityRef,
    formContext,
  ]);

  // === RENDER ===
  return (
    <ScaffolderField
      rawErrors={rawErrors}
      rawDescription={uiSchema["ui:description"] ?? description}
      required={required}
      disabled={isDisabled}
      errors={errors}
    >
      <Autocomplete
        // Disable if field is disabled or auto-selected (single required option)
        disabled={
          isDisabled ||
          (required &&
            !allowArbitraryValues &&
            entities?.catalogEntities.length === 1)
        }
        id={idSchema?.$id}
        value={selectedEntity}
        loading={loading}
        onChange={onSelect}
        options={entities?.catalogEntities || []}
        /**
         * CRITICAL FOR BACKWARD COMPATIBILITY
         * getOptionLabel determines what text is shown in the input field
         *
         * For backward compatibility:
         * - Without displayFormat: shows entityRef (e.g., "component:default/my-service")
         * - With displayFormat: shows formatted value (e.g., "my-service - service")
         */
        getOptionLabel={(option) => {
          if (typeof option === "string") {
            // String options are passed through as-is
            return option;
          } else {
            // Entity objects
            if (displayFormat) {
              // Enhanced: Use custom display format
              return formatDisplayValue(displayFormat, option);
            }
            // Standard: Use entity reference (THIS IS KEY FOR BACKWARD COMPATIBILITY)
            // Original EntityPicker uses .entityRef, not .primaryTitle
            return (
              entities?.entityRefToPresentation.get(stringifyEntityRef(option))
                ?.entityRef || stringifyEntityRef(option)
            );
          }
        }}
        autoSelect
        freeSolo={allowArbitraryValues}
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
         * Render options in the dropdown
         * Uses EntityDisplayName for standard display
         * Uses formatted value when displayFormat is specified
         */
        renderOption={(renderProps, option) => (
          <li {...renderProps}>
            {displayFormat ? (
              // Enhanced: Show formatted display in dropdown
              <span>{formatDisplayValue(displayFormat, option)}</span>
            ) : (
              // Standard: Use Backstage's EntityDisplayName component
              <EntityDisplayName entityRef={option} />
            )}
          </li>
        )}
        /**
         * Configure filtering/search behavior
         * Uses primaryTitle for searching in standard mode
         * Uses formatted value for searching when displayFormat is used
         */
        filterOptions={createFilterOptions<Entity>({
          stringify: (option) =>
            displayFormat
              ? formatDisplayValue(displayFormat, option)
              : entities?.entityRefToPresentation.get(
                  stringifyEntityRef(option)
                )?.primaryTitle!,
        })}
        // Use virtualized list for performance with large entity lists
        ListboxComponent={VirtualizedListbox}
      />
    </ScaffolderField>
  );
};

/**
 * Converts special filter values to Backstage catalog symbols
 * Specifically handles {exists: true} -> CATALOG_FILTER_EXISTS
 *
 * This allows YAML like:
 * catalogFilter:
 *   'metadata.name': {exists: true}  # Only entities with a name
 */
function convertOpsValues(
  value: Exclude<EntityPickerFilterQueryValue, Array<any>>
): string | symbol {
  // Convert {exists: true} to special symbol
  if (typeof value === "object" && value.exists) {
    return CATALOG_FILTER_EXISTS;
  }
  // Convert other values to string
  return value?.toString();
}

/**
 * Converts YAML schema filters to Backstage EntityFilterQuery format
 * Handles the special {exists: true} syntax
 *
 * Example input from YAML:
 * catalogFilter:
 *   kind: ['Component', 'Resource']
 *   spec.type: 'service'
 *   metadata.name: {exists: true}
 */
function convertSchemaFiltersToQuery(
  schemaFilters: EntityPickerFilterQuery
): Exclude<EntityFilterQuery, Array<any>> {
  const query: EntityFilterQuery = {};

  for (const [key, value] of Object.entries(schemaFilters)) {
    if (Array.isArray(value)) {
      // Keep arrays as-is (e.g., kind: ['Component', 'Resource'])
      query[key] = value;
    } else {
      // Convert single values (including {exists: true})
      query[key] = convertOpsValues(value);
    }
  }

  return query;
}

/**
 * Builds the catalog filter from uiSchema options
 * Supports both new catalogFilter and legacy allowedKinds
 *
 * Example uiSchema:
 * ui:options:
 *   catalogFilter:
 *     kind: User
 *     spec.type: employee
 *
 * Or legacy format:
 * ui:options:
 *   allowedKinds: ['Component', 'Resource']
 */
function buildCatalogFilter(
  uiSchema: EnhancedEntityPickerProps["uiSchema"]
): EntityFilterQuery | undefined {
  // Support legacy allowedKinds for backward compatibility
  const allowedKinds = uiSchema["ui:options"]?.allowedKinds;

  // Get catalogFilter, or build one from allowedKinds if present
  const catalogFilter:
    | EnhancedEntityPickerUiOptions["catalogFilter"]
    | undefined =
    uiSchema["ui:options"]?.catalogFilter ||
    (allowedKinds && { kind: allowedKinds });

  if (!catalogFilter) {
    return undefined;
  }

  // Handle array of filters (OR condition)
  if (Array.isArray(catalogFilter)) {
    return catalogFilter.map(convertSchemaFiltersToQuery);
  }

  // Handle single filter object
  return convertSchemaFiltersToQuery(catalogFilter);
}

/**
 * === SIMPLE README ===
 *
 * # EnhancedEntityPicker
 *
 * A drop-in replacement for Backstage's EntityPicker with additional display formatting capabilities.
 *
 * ## Features
 * - 100% backward compatible with EntityPicker
 * - Custom display formatting using template strings
 * - Hidden field storage for entity references
 *
 * ## Basic Usage (same as EntityPicker)
 * ```yaml
 * userOwner:
 *   title: "Select Service Owner"
 *   type: string
 *   ui:field: EnhancedEntityPicker
 *   ui:options:
 *     catalogFilter:
 *       kind: User
 * ```
 *
 * ## Enhanced Usage with Display Formatting
 * ```yaml
 * userOwner:
 *   title: "Select Service Owner"
 *   type: string
 *   ui:field: EnhancedEntityPicker
 *   ui:options:
 *     catalogFilter:
 *       kind: User
 *     displayFormat: "{{ metadata.name }} ({{ spec.profile.email }})"
 *     hiddenEntityRef: "hiddenUserOwner"
 * ```
 *
 * ## Available Template Fields
 * - metadata.name, metadata.title, metadata.description
 * - spec.profile.displayName, spec.profile.email
 * - spec.type, spec.owner, spec.system
 * - Any field from ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS
 *
 * ## Template Syntax
 * - `{{ field.path }}` - Replaced with actual value
 * - `field1 || field2` - Uses first non-empty value
 *
 * ## Migration from EntityPicker
 * Simply replace `ui:field: EntityPicker` with `ui:field: EnhancedEntityPicker`
 * No other changes needed unless you want to use the enhanced features.
 */
