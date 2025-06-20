// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 EnhancedEntityPicker - Beautiful entity selection for Backstage templates
// packages/app/src/scaffolder/EnhancedEntityPicker/EnhancedEntityPicker.tsx
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 IMPORTS - Dependencies needed to build our enhanced entity picker
// ═══════════════════════════════════════════════════════════════════════════════

// React hooks for state management and lifecycle
import React, { useEffect, useState, useCallback, useMemo } from "react";

// Material-UI components for beautiful user interface
import { Autocomplete, TextField, Box } from "@mui/material";

// Backstage API integration - connects to Backstage backend services
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";

// Backstage entity types and utilities
import { Entity, stringifyEntityRef } from "@backstage/catalog-model";

// Scaffolder form field interface - makes this component work in templates
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";

// ═══════════════════════════════════════════════════════════════════════════════
// 🏗️ INTERFACE DEFINITIONS - TypeScript contracts for type safety
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 🔍 CatalogFilter: Defines how to filter entities from Backstage catalog
 * - kind: Filter by entity type (User, Group, Component, etc.)
 * - type: Filter by entity subtype (service, library, etc.)
 * - [key: string]: Allow any custom filter properties
 */
interface CatalogFilter {
  kind?: string;
  type?: string;
  [key: string]: any;
}

/**
 * ⚙️ EnhancedEntityPickerProps: Configuration options for our component
 * Extends standard Backstage form field props with our custom options
 */
interface EnhancedEntityPickerProps
  extends FieldExtensionComponentProps<
    string, // The field stores a string value (display name)
    {
      // 🎨 Template for how entities appear in dropdown (e.g., "{{ metadata.title }} - {{ spec.department }}")
      displayEntityFieldAfterFormatting?: string;

      // 🔑 Which entity property to use as unique identifier (e.g., "metadata.name")
      uniqueIdentifierField?: string;

      // 🔍 Filter criteria to limit which entities are shown
      catalogFilter?: CatalogFilter;

      // 💬 Placeholder text shown in empty dropdown
      placeholder?: string;

      // 🫥 Name of hidden form field where we store the entity unique ID
      hiddenFieldName?: string;
    }
  > {}

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ HELPER FUNCTIONS - Utility functions for data processing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 🎯 getNestedValue: Safely extracts nested properties from objects
 *
 * WHY THIS EXISTS: Entity objects have nested properties like metadata.name, spec.profile.email
 * JavaScript would crash if any level is undefined (obj.metadata.name when metadata is null)
 * This function safely navigates the object tree without crashing
 *
 * @param obj - The object to extract from (e.g., entity)
 * @param path - Dot-notation path (e.g., "metadata.name", "spec.profile.email")
 * @returns The value as string, or empty string if not found
 *
 * EXAMPLE:
 * getNestedValue(entity, "metadata.name") → "john.doe"
 * getNestedValue(entity, "spec.profile.email") → "john@company.com"
 * getNestedValue(entity, "missing.property") → "" (safe, no crash)
 */
const getNestedValue = (obj: any, path: string): string => {
  try {
    const keys = path.split("."); // Convert "metadata.name" to ["metadata", "name"]
    let value = obj;

    // Walk through each level of the object
    for (const key of keys) {
      value = value?.[key]; // Safe navigation - stops if any level is null/undefined
      if (value === undefined || value === null) return ""; // Exit early if property missing
    }

    return String(value || ""); // Convert to string, handle null/undefined
  } catch {
    return ""; // If anything goes wrong, return empty string (defensive programming)
  }
};

/**
 * 🎨 formatDisplayValue: Converts template strings into human-readable display text
 *
 * WHY THIS EXISTS: We want users to see "John Doe - Engineering" instead of "john.doe"
 * This function takes a template like "{{ metadata.title }} - {{ spec.department }}"
 * and replaces the {{ }} placeholders with actual values from the entity
 *
 * @param template - Template string with {{ }} placeholders
 * @param entity - Backstage entity object with the data
 * @returns Formatted display string
 *
 * EXAMPLE:
 * Template: "{{ metadata.title }} - {{ spec.profile.department }}"
 * Entity: { metadata: { title: "John Doe" }, spec: { profile: { department: "Engineering" } } }
 * Result: "John Doe - Engineering"
 *
 * SUPPORTS FALLBACKS:
 * Template: "{{ metadata.title || metadata.name }}"
 * → Uses title if available, otherwise falls back to name
 */
const formatDisplayValue = (template: string, entity: Entity): string => {
  // Use regex to find all {{ }} patterns and replace them
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expression) => {
    const trimmed = expression.trim();

    // Handle fallback syntax: "property1 || property2"
    if (trimmed.includes(" || ")) {
      const paths = trimmed.split(" || ").map((p) => p.trim());

      // Try each property in order, return first non-empty value
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        if (value) return value; // Found a value, use it
      }
      return ""; // No fallback values found
    }

    // Single property access (no fallback)
    return getNestedValue(entity, trimmed);
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 MAIN COMPONENT - The React component that creates the enhanced entity picker
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 🚀 EnhancedEntityPicker: The main component that provides beautiful UX for entity selection
 *
 * WHAT IT DOES:
 * 1. Fetches entities from Backstage catalog based on filters
 * 2. Shows them in a searchable dropdown with beautiful formatting
 * 3. Stores user-friendly display value in main field (visible on review page)
 * 4. Stores technical entity ID in hidden field (for backend processing)
 * 5. Integrates seamlessly with Backstage scaffolder forms
 *
 * WHY IT'S VALUABLE:
 * - Users see "John Doe - Engineering" instead of "user:default/john.doe"
 * - Developers get clean entity IDs for backend processing
 * - One component works with any entity type (User, Group, Component, etc.)
 * - No custom backend actions needed - integrates with standard Backstage patterns
 */
export const EnhancedEntityPicker = ({
  formData, // 📝 Current field value (display name user selected)
  onChange, // 📞 Function to call when user makes a selection
  schema, // 📋 JSON schema definition for this field
  uiSchema, // ⚙️ UI configuration options from template YAML
  rawErrors, // ❌ Any validation errors for this field
  disabled, // 🚫 Whether this field should be disabled
  formContext, // 🌐 Access to entire form data (needed to update hidden fields)
}: EnhancedEntityPickerProps) => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎛️ API ACCESS - Connect to Backstage backend services
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * 🔌 catalogApi: Connection to Backstage catalog service
   * This is how we fetch entities (users, groups, components) from the catalog
   */
  const catalogApi = useApi(catalogApiRef);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📊 STATE MANAGEMENT - React state to track component data
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * 📚 entities: List of all entities fetched from catalog that match our filters
   * Used to populate the dropdown options
   */
  const [entities, setEntities] = useState<Entity[]>([]);

  /**
   * ⏳ loading: Whether we're currently fetching entities from the catalog
   * Used to show loading spinner in dropdown
   */
  const [loading, setLoading] = useState(false);

  /**
   * 👤 selectedEntity: The complete entity object that user has selected
   * Used to track selection state and extract entity details
   */
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════════
  // ⚙️ CONFIGURATION EXTRACTION & VALIDATION - Get settings from template YAML
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * 🔍 catalogFilter: Criteria for filtering which entities to show
   * ✅ SMART DEFAULT: Uses kind: "Template" if not provided (safe performance-wise)
   *
   * WHY Template DEFAULT:
   * - Most Backstage instances have 10-50 templates (safe number to fetch)
   * - Much safer than fetching ALL entities or throwing errors
   * - Logical fallback - if no filter specified, probably want template picker
   *
   * EXAMPLE: { kind: "User" } or { kind: "Component", "spec.type": "service" }
   */
  const catalogFilter = useMemo(() => {
    const filter = uiSchema?.["ui:options"]?.catalogFilter;

    // Check if filter exists and has properties - avoid Object.keys() on undefined
    if (
      !filter ||
      typeof filter !== "object" ||
      Object.keys(filter).length === 0
    ) {
      // Default to Templates (safe performance-wise)
      return { kind: "Template" };
    }

    return filter;
  }, [uiSchema?.["ui:options"]?.catalogFilter]);

  /**
   * 🫥 hiddenFieldName: Name of the hidden form field where we store entity ID
   * ⚠️ REQUIRED! Critical for backend integration
   *
   * VALIDATION: Must be provided by developer to ensure proper field mapping
   */
  const hiddenFieldName = useMemo(() => {
    const fieldName = uiSchema?.["ui:options"]?.hiddenFieldName;

    if (!fieldName) {
      throw new Error(`hiddenFieldName is required in ui:options! Add this to your YAML:
      
ui:options:
  hiddenFieldName: "selectedUserEntityName"    # For users
  # OR
  hiddenFieldName: "selectedGroupEntityName"   # For groups  
  # OR
  hiddenFieldName: "selectedComponentEntityName" # For components

Without hiddenFieldName, entity ID cannot be stored for backend processing!`);
    }

    return fieldName;
  }, [uiSchema?.["ui:options"]?.hiddenFieldName]);

  /**
   * 🎨 displayTemplate: How to format entity names for display
   * ✅ OPTIONAL: Has sensible default
   * Comes from YAML: displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.department }}"
   * Default: Show entity title or fall back to name
   */
  const displayTemplate =
    uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
    "{{ metadata.title || metadata.name }}";

  /**
   * 🔑 uniqueIdentifierField: Which entity property to use as unique ID
   * ✅ OPTIONAL: Has sensible default
   * Comes from YAML: uniqueIdentifierField: "metadata.name"
   * Default: Use metadata.name (most entities have unique names)
   */
  const uniqueIdentifierField =
    uiSchema?.["ui:options"]?.uniqueIdentifierField || "metadata.name";

  /**
   * 💬 placeholder: Text shown in empty dropdown
   * ✅ OPTIONAL: Has sensible default
   * Comes from YAML: placeholder: "Select a team member..."
   * Provides user guidance on what to select
   */
  const placeholder =
    uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🌐 DATA FETCHING - Get entities from Backstage catalog
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * 📡 fetchEntities: Async function that loads entities from Backstage catalog
   *
   * WHAT IT DOES:
   * 1. Builds filter criteria from configuration
   * 2. Calls Backstage catalog API
   * 3. Updates component state with results
   *
   * WHY useCallback: Prevents unnecessary re-renders when dependencies haven't changed
   * Dependencies: catalogApi and catalogFilter - only re-create function if these change
   */
  const fetchEntities = useCallback(async () => {
    setLoading(true); // Show loading indicator
    try {
      const filter: any = {};

      // Build filter object for API call
      if (catalogFilter.kind) filter.kind = catalogFilter.kind; // e.g., kind: "User"
      if (catalogFilter.type) filter["spec.type"] = catalogFilter.type; // e.g., spec.type: "service"

      // Add any additional custom filters from configuration
      Object.keys(catalogFilter).forEach((key) => {
        if (key !== "kind" && key !== "type") {
          filter[key] = catalogFilter[key];
        }
      });

      // 🔥 THE ACTUAL API CALL - Fetch entities from Backstage catalog
      const response = await catalogApi.getEntities({ filter });
      setEntities(response.items); // Store results in component state
    } catch (error) {
      // Handle error silently - could add proper error UI here
      setEntities([]); // Set empty array on error
    } finally {
      setLoading(false); // Hide loading indicator
    }
  }, [catalogApi, catalogFilter]); // Only recreate if API or filter changes

  /**
   * 🚀 Effect: Fetch entities when component mounts or filters change
   * Automatically loads entities when component first renders or when catalogFilter changes
   */
  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔄 SELECTION SYNCHRONIZATION - Keep component in sync with form data
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * 🎯 Effect: Find and set selected entity when form data changes
   *
   * WHAT IT DOES:
   * When formData contains a value (e.g., "John Doe - Engineering"), this finds
   * the corresponding entity object from our entities list and sets it as selected
   *
   * WHY THIS IS NEEDED:
   * - Form might be pre-populated with existing data
   * - User might go back/forward in multi-step form
   * - Component needs to show correct selection state
   *
   * HOW IT WORKS:
   * 1. Takes current formData (display value)
   * 2. Formats each entity using our display template
   * 3. Finds entity whose formatted display matches formData
   * 4. Sets that entity as selected
   */
  useEffect(() => {
    if (formData && entities.length > 0) {
      // Search through all entities to find one that matches current form data
      const found = entities.find((entity) => {
        const displayValue = formatDisplayValue(displayTemplate, entity);
        return displayValue === formData; // Match display value with form data
      });
      setSelectedEntity(found || null); // Set selected entity (or null if not found)
    } else {
      setSelectedEntity(null); // Clear selection if no form data or no entities
    }
  }, [formData, entities, displayTemplate]); // Re-run when any of these change

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎪 EVENT HANDLING - Respond to user interactions
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * 🎯 handleChange: Called when user selects or deselects an entity
   *
   * THIS IS THE CORE MAGIC OF THE COMPONENT! 🪄
   *
   * WHAT HAPPENS WHEN USER SELECTS AN ENTITY:
   * 1. Extract display value (what user sees): "John Doe - Engineering"
   * 2. Extract unique ID (what backend needs): "john.doe"
   * 3. Store display value in main field (shows on review page)
   * 4. Store unique ID in hidden field (used by backend)
   * 5. Update component state to reflect selection
   *
   * WHY THIS APPROACH:
   * - Users see beautiful, readable names on review page
   * - Backend gets clean entity IDs for processing
   * - No complex parsing needed in backend - direct access to entity ID
   * - Works with standard Backstage patterns (no custom actions needed)
   *
   * @param event - The selection event (not used, but required by Autocomplete)
   * @param newValue - The entity object user selected (or null if cleared)
   */
  const handleChange = (event: any, newValue: Entity | null) => {
    if (newValue) {
      // 🎨 Extract display value using our formatting template
      const displayValue = formatDisplayValue(displayTemplate, newValue);

      // 🔑 Extract unique identifier that backend will use
      const uniqueValue = getNestedValue(newValue, uniqueIdentifierField);

      // 📝 Store display value in main field (this appears on review page)
      onChange(displayValue);

      // 💾 Update component state to reflect new selection
      setSelectedEntity(newValue);

      // 🫥 Store technical details in hidden field for backend use
      if (formContext?.formData) {
        formContext.formData[hiddenFieldName] = uniqueValue; // Backend will use this
      }
    } else {
      // 🧹 User cleared selection - reset everything
      onChange(""); // Clear main field
      setSelectedEntity(null); // Clear component state

      // Clear hidden field too
      if (formContext?.formData) {
        formContext.formData[hiddenFieldName] = "";
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📋 DATA PREPARATION - Prepare entities for display in dropdown
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * 🎭 displayOptions: Transform raw entities into dropdown-ready options
   *
   * WHAT THIS DOES:
   * Takes raw entity objects from catalog and transforms them into objects
   * that have everything the Autocomplete component needs for display
   *
   * EACH OPTION CONTAINS:
   * - entity: The original entity object (full data)
   * - displayText: Formatted text for dropdown ("John Doe - Engineering")
   * - uniqueValue: The unique identifier ("john.doe")
   * - entityRef: Full Backstage entity reference ("user:default/john.doe")
   *
   * FILTERING: Removes entities that don't have valid display text
   * (e.g., entities missing required properties for the display template)
   */
  const displayOptions = entities
    .map((entity) => ({
      entity, // Keep original entity
      displayText: formatDisplayValue(displayTemplate, entity), // Format for display
      uniqueValue: getNestedValue(entity, uniqueIdentifierField), // Extract unique ID
      entityRef: stringifyEntityRef(entity), // Create entity reference
    }))
    .filter((option) => option.displayText && option.displayText.trim() !== ""); // Remove invalid options

  /**
   * 🎯 currentSelection: Find which option represents the currently selected entity
   *
   * WHAT THIS DOES:
   * The Autocomplete component needs to know which option is currently selected
   * This finds the option that corresponds to our selectedEntity state
   *
   * WHY COMPLEX COMPARISON:
   * Can't just compare objects directly - need to compare entity references
   * because objects might be different instances of the same entity
   */
  const currentSelection = selectedEntity
    ? displayOptions.find(
        (opt) =>
          stringifyEntityRef(opt.entity) === stringifyEntityRef(selectedEntity)
      ) || null
    : null;

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 RENDER - Create the visual interface
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <Box>
      {/* 🎪 Main Autocomplete Component - The actual dropdown that users interact with */}
      <Autocomplete
        options={displayOptions} // All available options
        getOptionLabel={(option) => option.displayText} // What text to show for each option
        value={currentSelection} // Currently selected option
        onChange={(
          event,
          newValue // What to do when selection changes
        ) => handleChange(event, newValue?.entity || null)}
        loading={loading} // Show loading spinner while fetching
        disabled={disabled} // Disable if field is disabled
        isOptionEqualToValue={(
          option,
          value // How to determine if two options are the same
        ) => option.entityRef === value.entityRef}
        renderInput={(
          params // How to render the input field
        ) => (
          <TextField
            {...params}
            label={schema.title} // Field label from schema
            placeholder={placeholder} // Placeholder text
            error={!!rawErrors?.length} // Show error styling if validation failed
            helperText={rawErrors?.length ? rawErrors[0] : schema.description} // Error or help text
            variant="outlined" // Material-UI styling
            fullWidth // Take full width of container
          />
        )}
        renderOption={(
          props,
          option // How to render each dropdown option
        ) => (
          <Box component="li" {...props}>
            <Box sx={{ fontWeight: "medium" }}>{option.displayText}</Box>
          </Box>
        )}
      />

      {/* 🐛 Development Debug Panel - Only visible during development */}
      {process.env.NODE_ENV === "development" && (
        <Box sx={{ mt: 1, p: 1, bgcolor: "grey.50", fontSize: "11px" }}>
          <strong>🚀 Enhanced Entity Picker Debug:</strong>{" "}
          {displayOptions.length} options
          <div>📋 Display Template: {displayTemplate}</div>
          <div>🔑 Hidden Field: {hiddenFieldName}</div>
          <div>✨ Mode: SIMPLIFIED (no custom action needed)</div>
          <div>🔍 Filter: {JSON.stringify(catalogFilter)}</div>
          {selectedEntity && (
            <div>
              👤 Selected: {formatDisplayValue(displayTemplate, selectedEntity)}
              <br />
              🔑 Entity Name:{" "}
              {getNestedValue(selectedEntity, uniqueIdentifierField)} (hidden)
              <br />
              📄 Entity Kind: {selectedEntity.kind}
            </div>
          )}
        </Box>
      )}
    </Box>
  );
};
