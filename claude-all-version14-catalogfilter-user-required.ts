// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 EnhancedEntityPicker - Beautiful entity selection for Backstage templates
// packages/app/src/scaffolder/EnhancedEntityPicker/EnhancedEntityPicker.tsx
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 IMPORTS - Dependencies needed to build our enhanced entity picker
// ═══════════════════════════════════════════════════════════════════════════════

// React hooks for state management and lifecycle
import React, { useEffect, useState, useCallback } from "react";

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
    const keys = path.split('.'); // Convert "metadata.name" to ["metadata", "name"]
    let value = obj;
    
    // Walk through each level of the object
    for (const key of keys) {
      value = value?.[key]; // Safe navigation - stops if any level is null/undefined
      if (value === undefined || value === null) return ''; // Exit early if property missing
    }
    
    return String(value || ''); // Convert to string, handle null/undefined
  } catch {
    return ''; // If anything goes wrong, return empty string (defensive programming)
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
    if (trimmed.includes(' || ')) {
      const paths = trimmed.split(' || ').map(p => p.trim());
      
      // Try each property in order, return first non-empty value
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        if (value) return value; // Found a value, use it
      }
      return ''; // No fallback values found
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
  formData,      // 📝 Current field value (display name user selected)
  onChange,      // 📞 Function to call when user makes a selection
  schema,        // 📋 JSON schema definition for this field
  uiSchema,      // ⚙️ UI configuration options from template YAML
  rawErrors,     // ❌ Any validation errors for this field
  disabled,      // 🚫 Whether this field should be disabled
  formContext,   // 🌐 Access to entire form data (needed to update hidden fields)
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
  const catalogFilter = (() => {
    const filter = uiSchema?.["ui:options"]?.catalogFilter;
    
    if (!filter || Object.keys(filter).length === 0) {
      console.warn(`⚠️ No catalogFilter provided, defaulting to Templates.
      
💡 To specify different entities, add this to your YAML:
  ui:options:
    catalogFilter:
      kind: User          # or Group, Component, etc.
      # Optional additional filters:
      # spec.type: service
      # metadata.namespace: production

🎯 Using default: { kind: "Template" } (safe performance-wise)`);
      
      return { kind: "Template" }; // Safe default - templates are typically few in number
    }
    
    return filter;
  })();
  
  /**
   * 🫥 hiddenFieldName: Name of the hidden form field where we store entity ID
   * ⚠️ REQUIRED! Critical for backend integration
   * 
   * VALIDATION: Must be provided by developer to ensure proper field mapping
   */
  const hiddenFieldName = (() => {
    const fieldName = uiSchema?.["ui:options"]?.hiddenFieldName;
    
    if (!fieldName) {
      const errorMsg = `❌ REQUIRED: hiddenFieldName must be provided in ui:options!

💡 Add this to your YAML:
  ui:options:
    hiddenFieldName: "selectedUserEntityName"    # For users
    # OR
    hiddenFieldName: "selectedGroupEntityName"   # For groups
    # OR  
    hiddenFieldName: "selectedComponentEntityName" # For components

⚠️ Without hiddenFieldName, entity ID cannot be stored for backend processing!`;
      
      console.error(errorMsg);
      throw new Error("hiddenFieldName is required in ui:options");
    }
    
    return fieldName;
  })();

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
    uiSchema?.["ui:options"]?.uniqueIdentifierField ||
    "metadata.name";
  
  /**
   * 💬 placeholder: Text shown in empty dropdown
   * ✅ OPTIONAL: Has sensible default
   * Comes from YAML: placeholder: "Select a team member..."
   * Provides user guidance on what to select
   */
  const placeholder = uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

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
      if (catalogFilter.kind) filter.kind = catalogFilter.kind;           // e.g., kind: "User"
      if (catalogFilter.type) filter["spec.type"] = catalogFilter.type;   // e.g., spec.type: "service"
      
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
      console.error("Error fetching entities:", error);
      // TODO: Could show error message to user here
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
        // ⚠️ VALIDATION: Check if hidden field exists
        if (!formContext.formData.hasOwnProperty(hiddenFieldName)) {
          console.error(`❌ Hidden field '${hiddenFieldName}' not found in form!`);
          console.error(`💡 Add this to your YAML parameters:`);
          console.error(`   ${hiddenFieldName}:`);
          console.error(`     type: string`);
          console.error(`     ui:widget: hidden`);
          console.error(`     ui:backstage:`);
          console.error(`       review:`);
          console.error(`         show: false`);
          console.error(`💡 Or specify correct hiddenFieldName in ui:options`);
        }
        
        formContext.formData[hiddenFieldName] = uniqueValue; // Backend will use this
      } else {
        console.error(`❌ formContext not available! Cannot store entity ID.`);
      }

      // 🐛 Debug logging for development
      console.log('✨ Enhanced Entity Picker stored:', {
        display: displayValue,    // What user sees: "John Doe - Engineering"
        entityName: uniqueValue,  // What backend gets: "john.doe"
        hiddenField: hiddenFieldName, // Where it's stored: "selectedUserEntityName"
        hiddenFieldExists: formContext?.formData?.hasOwnProperty(hiddenFieldName),
      });

    } else {
      // 🧹 User cleared selection - reset everything
      onChange("");              // Clear main field
      setSelectedEntity(null);   // Clear component state
      
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
      entity,                                                           // Keep original entity
      displayText: formatDisplayValue(displayTemplate, entity),       // Format for display
      uniqueValue: getNestedValue(entity, uniqueIdentifierField),     // Extract unique ID
      entityRef: stringifyEntityRef(entity),                          // Create entity reference
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
        (opt) => stringifyEntityRef(opt.entity) === stringifyEntityRef(selectedEntity)
      ) || null
    : null;

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 RENDER - Create the visual interface
  // ═══════════════════════════════════════════════════════════════════════════════
  
  return (
    <Box>
      {/* 🎪 Main Autocomplete Component - The actual dropdown that users interact with */}
      <Autocomplete
        options={displayOptions}                    // All available options
        getOptionLabel={(option) => option.displayText} // What text to show for each option
        value={currentSelection}                    // Currently selected option
        onChange={(event, newValue) =>              // What to do when selection changes
          handleChange(event, newValue?.entity || null)
        }
        loading={loading}                           // Show loading spinner while fetching
        disabled={disabled}                         // Disable if field is disabled
        isOptionEqualToValue={(option, value) =>    // How to determine if two options are the same
          option.entityRef === value.entityRef
        }
        renderInput={(params) => (                  // How to render the input field
          <TextField
            {...params}
            label={schema.title}                    // Field label from schema
            placeholder={placeholder}              // Placeholder text
            error={!!rawErrors?.length}            // Show error styling if validation failed
            helperText={rawErrors?.length ? rawErrors[0] : schema.description} // Error or help text
            variant="outlined"                     // Material-UI styling
            fullWidth                              // Take full width of container
          />
        )}
        renderOption={(props, option) => (          // How to render each dropdown option
          <Box component="li" {...props}>
            <Box sx={{ fontWeight: "medium" }}>{option.displayText}</Box>
          </Box>
        )}
      />

      {/* 🐛 Development Debug Panel - Only visible during development */}
      {process.env.NODE_ENV === "development" && (
        <Box sx={{ mt: 1, p: 1, bgcolor: "grey.50", fontSize: "11px" }}>
          <strong>🚀 Enhanced Entity Picker Debug:</strong> {displayOptions.length} options
          <div>📋 Display Template: {displayTemplate}</div>
          <div>🔑 Hidden Field: {hiddenFieldName}</div>
          <div>✨ Mode: SIMPLIFIED (no custom action needed)</div>
          {selectedEntity && (
            <div>
              👤 Selected: {formatDisplayValue(displayTemplate, selectedEntity)}
              <br />
              🔑 Entity Name: {getNestedValue(selectedEntity, uniqueIdentifierField)} (hidden)
            </div>
          )}
        </Box>
      )}
    </Box>
  );
};
>>>>>>>>>>>
Read me and may be yaml:

# 🚀 EnhancedEntityPicker

A beautiful, user-friendly entity picker for Backstage Scaffolder templates that transforms complex entity references into clean, readable selections.

## ✨ What It Does

**For Users:**
- See friendly names like "John Doe - Engineering" instead of technical IDs
- Searchable dropdown with beautiful formatting
- Clean review page without technical clutter

**For Developers:**  
- Get clean entity references for backend processing
- No custom backend actions needed
- Works with any entity type (User, Group, Component, etc.)
- Integrates seamlessly with standard Backstage patterns

## 🎯 The Problem It Solves

**Before:**
```yaml
# Users see technical entity references
selectedUser: "user:default/john.doe"
```

**After:**  
```yaml
# Users see beautiful, readable names
selectedUser: "John Doe - Engineering"
# Technical details hidden but accessible
```

## 📦 Installation

### 1. Add the Component

Create the component file:
```
packages/app/src/scaffolder/EnhancedEntityPicker/EnhancedEntityPicker.tsx
```

### 2. Register the Field Extension

In your `packages/app/src/App.tsx`:

```typescript
import { EnhancedEntityPicker } from './scaffolder/EnhancedEntityPicker/EnhancedEntityPicker';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';

const enhancedEntityPickerExtension = createScaffolderFieldExtension({
  name: 'EnhancedEntityPicker',
  component: EnhancedEntityPicker,
});

// Add to your scaffolder field extensions
const scaffolderFieldExtensions = [
  enhancedEntityPickerExtension,
  // ... other extensions
];
```

## 🎨 Basic Usage

### Minimal Required Configuration

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: entity-picker-example
  title: "Entity Selection Example"
spec:
  parameters:
    - title: "🎯 Select Entity"
      required:
        - selectedEntity
      properties:
        selectedEntity:
          title: Choose Entity
          type: string
          ui:field: EnhancedEntityPicker
          ui:options:
            # ✅ REQUIRED: Must specify hidden field name  
            hiddenFieldName: "selectedEntityEntityName"
            # ✅ OPTIONAL: Defaults to Templates (performance-safe)
            # catalogFilter:
            #   kind: Template  # This is the default!
            placeholder: "🔍 Select an entity..."
        
        # ✅ REQUIRED: Hidden field must exist with exact name from hiddenFieldName
        selectedEntityEntityName:
          type: string
          ui:widget: hidden
          ui:backstage:
            review:
              show: false

  steps:
    # Direct catalog:fetch - works with Templates by default
    - id: fetch-entity
      name: "📋 Get Entity Details"
      action: catalog:fetch
      input:
        entityRef: "template:default/${{ parameters.selectedEntityEntityName }}"
    
    - id: show-result
      name: "✅ Show Result"
      action: debug:log
      input:
        message: |
          Selected: ${{ parameters.selectedEntity }}
          Description: ${{ steps['fetch-entity'].output.entity.metadata.description }}
```

### User Selection Example

```yaml
# For selecting users, specify catalogFilter
selectedUser:
  title: Choose User
  type: string
  ui:field: EnhancedEntityPicker
  ui:options:
    # ✅ Specify catalogFilter for non-Template entities
    catalogFilter:
      kind: User
    hiddenFieldName: "selectedUserEntityName"
    placeholder: "🔍 Select a team member..."

selectedUserEntityName:
  type: string
  ui:widget: hidden
  ui:backstage:
    review:
      show: false

# Usage in steps:
entityRef: "user:default/${{ parameters.selectedUserEntityName }}"
```

## ⚙️ Configuration Options

### `ui:options` Parameters

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `hiddenFieldName` | string | **✅ YES** | *none* | **REQUIRED** Name of hidden field to store entity ID |
| `catalogFilter` | object | ❌ No | `{ kind: "Template" }` | Filter criteria for catalog entities - defaults to Templates (performance-safe) |
| `displayEntityFieldAfterFormatting` | string | ❌ No | `"{{ metadata.title \|\| metadata.name }}"` | Template for how entities appear in dropdown |
| `uniqueIdentifierField` | string | ❌ No | `"metadata.name"` | Entity property to use as unique identifier |
| `placeholder` | string | ❌ No | `"Select an entity..."` | Placeholder text for empty dropdown |

### ⚠️ Required Configuration

**The component will throw an error if this is missing:**

#### `hiddenFieldName` (Integration Critical!)  
```yaml
# ✅ REQUIRED - Must specify where to store entity ID
ui:options:
  hiddenFieldName: "selectedUserEntityName"  # Must match your hidden field name

# Hidden field must exist:
selectedUserEntityName:
  type: string
  ui:widget: hidden

# ❌ WILL FAIL - Missing hiddenFieldName
ui:options:
  catalogFilter:
    kind: User
  # Missing hiddenFieldName!
```

**Why required:** The component needs to know where to store the entity ID for backend processing. Without this, entity selection cannot be passed to template steps.

### 🎯 Smart Defaults

#### `catalogFilter` (Performance Optimized!)
```yaml
# ✅ EXPLICIT - Best practice (specify what you want)
ui:options:
  catalogFilter:
    kind: User                    # Specific entity type
    spec.profile.role: developer  # Additional filters for performance

# ✅ SMART DEFAULT - Works out of the box
ui:options:
  hiddenFieldName: "selectedTemplateEntityName"
  # Missing catalogFilter defaults to { kind: "Template" }
  # Safe because most instances have 10-50 templates, not thousands

# ❌ NOT RECOMMENDED - Too broad for large catalogs
ui:options:
  catalogFilter:
    kind: Component  # Could be thousands of components!
```

**Why Template default:** Templates are typically limited in number (10-50 per instance), making them safe to fetch without causing performance issues. This provides a working component out-of-the-box while encouraging developers to specify appropriate filters for their use case.

### Display Templates

Use `{{ }}` syntax to format entity display:

```yaml
# Show title and department
displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.department }}"

# Show name with fallback
displayEntityFieldAfterFormatting: "{{ metadata.title || metadata.name }}"

# Show component with type
displayEntityFieldAfterFormatting: "{{ metadata.title }} ({{ spec.type }})"

# Custom format with multiple fields
displayEntityFieldAfterFormatting: "{{ metadata.title }} | {{ spec.profile.team }} | {{ metadata.namespace }}"
```

## 📋 Entity Type Examples

### 👥 Users
```yaml
selectedUser:
  title: Choose User  
  type: string
  ui:field: EnhancedEntityPicker
  ui:options:
    # ✅ REQUIRED: catalogFilter (prevents fetching ALL users)
    catalogFilter:
      kind: User
      # Optional: Add more specific filters for better performance
      spec.profile.department: engineering  # Only engineering users
    # ✅ REQUIRED: hiddenFieldName  
    hiddenFieldName: "selectedUserEntityName"
    # ✅ OPTIONAL: Custom display format
    displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.department }}"

# ✅ REQUIRED: Matching hidden field
selectedUserEntityName:
  type: string
  ui:widget: hidden
  ui:backstage:
    review:
      show: false

# Usage in steps:
entityRef: "user:default/${{ parameters.selectedUserEntityName }}"
```

### 👨‍👩‍👧‍👦 Groups  
```yaml
selectedGroup:
  title: Choose Team
  type: string
  ui:field: EnhancedEntityPicker
  ui:options:
    # ✅ REQUIRED: catalogFilter
    catalogFilter:
      kind: Group
      # Optional: Filter by group type for performance
      spec.type: team  # Only team groups, not organizational units
    # ✅ REQUIRED: hiddenFieldName (different from users!)
    hiddenFieldName: "selectedGroupEntityName"
    displayEntityFieldAfterFormatting: "{{ metadata.title }} ({{ spec.type }})"

selectedGroupEntityName:
  type: string
  ui:widget: hidden
  ui:backstage:
    review:
      show: false

# Usage in steps:
entityRef: "group:default/${{ parameters.selectedGroupEntityName }}"
```

### 🧩 Components
```yaml
selectedComponent:
  title: Choose Component
  type: string
  ui:field: EnhancedEntityPicker
  ui:options:
    # ✅ REQUIRED: catalogFilter with specific filtering for performance
    catalogFilter:
      kind: Component
      spec.type: service        # Only services, not libraries
      spec.lifecycle: production # Only production components
    # ✅ REQUIRED: hiddenFieldName
    hiddenFieldName: "selectedComponentEntityName"
    displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.type }}"

selectedComponentEntityName:
  type: string
  ui:widget: hidden
  ui:backstage:
    review:
      show: false

# Usage in steps:
entityRef: "component:default/${{ parameters.selectedComponentEntityName }}"
```

⚠️ **Performance Tip:** Always add specific filters to `catalogFilter` to limit the number of entities fetched. The more specific your filters, the faster the dropdown will load!

### 🌍 Different Namespaces
```yaml
selectedProdUser:
  title: Choose Production User
  type: string
  ui:field: EnhancedEntityPicker
  ui:options:
    displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.role }}"
    catalogFilter:
      kind: User
      metadata.namespace: production
    hiddenFieldName: "selectedProdUserEntityName"

selectedProdUserEntityName:
  type: string
  ui:widget: hidden
  ui:backstage:
    review:
      show: false

# Usage in steps:
entityRef: "user:production/${{ parameters.selectedProdUserEntityName }}"
```

## 🔧 Advanced Examples

### Multiple Entity Selection
```yaml
parameters:
  - title: "👥 Team Setup"
    properties:
      # Owner selection
      projectOwner:
        title: Project Owner
        type: string
        ui:field: EnhancedEntityPicker
        ui:options:
          displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.role }}"
          catalogFilter:
            kind: User
            spec.profile.role: tech-lead
          hiddenFieldName: "projectOwnerEntityName"
      
      # Team selection  
      developmentTeam:
        title: Development Team
        type: string
        ui:field: EnhancedEntityPicker
        ui:options:
          displayEntityFieldAfterFormatting: "{{ metadata.title }} ({{ spec.memberCount }} members)"
          catalogFilter:
            kind: Group
            spec.type: team
          hiddenFieldName: "developmentTeamEntityName"

      # Component selection
      baseComponent:
        title: Base Component
        type: string
        ui:field: EnhancedEntityPicker
        ui:options:
          displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.type }}"
          catalogFilter:
            kind: Component
            spec.type: library
          hiddenFieldName: "baseComponentEntityName"

      # Hidden fields
      projectOwnerEntityName:
        type: string
        ui:widget: hidden
        ui:backstage:
          review:
            show: false
      
      developmentTeamEntityName:
        type: string
        ui:widget: hidden  
        ui:backstage:
          review:
            show: false
      
      baseComponentEntityName:
        type: string
        ui:widget: hidden
        ui:backstage:
          review:
            show: false

steps:
  # Fetch all entities
  - id: fetch-owner
    name: "👤 Get Project Owner"
    action: catalog:fetch
    input:
      entityRef: "user:default/${{ parameters.projectOwnerEntityName }}"
  
  - id: fetch-team
    name: "👥 Get Development Team"  
    action: catalog:fetch
    input:
      entityRef: "group:default/${{ parameters.developmentTeamEntityName }}"
  
  - id: fetch-component
    name: "🧩 Get Base Component"
    action: catalog:fetch
    input:
      entityRef: "component:default/${{ parameters.baseComponentEntityName }}"
```

### Conditional Entity Selection
```yaml
parameters:
  - title: "🎯 Project Type"
    properties:
      projectType:
        title: Project Type
        type: string
        enum:
          - frontend
          - backend
          - fullstack
        enumNames:
          - "🎨 Frontend"
          - "⚙️ Backend"  
          - "🌐 Full Stack"

  - title: "👥 Team Selection"
    dependencies:
      projectType:
        oneOf:
          - properties:
              projectType:
                enum: [frontend]
              frontendLead:
                title: Frontend Lead
                type: string
                ui:field: EnhancedEntityPicker
                ui:options:
                  displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.skills }}"
                  catalogFilter:
                    kind: User
                    spec.profile.skills: frontend
                  hiddenFieldName: "frontendLeadEntityName"
              frontendLeadEntityName:
                type: string
                ui:widget: hidden
                ui:backstage:
                  review:
                    show: false
            required: [frontendLead]

          - properties:
              projectType:
                enum: [backend]
              backendLead:
                title: Backend Lead
                type: string
                ui:field: EnhancedEntityPicker
                ui:options:
                  displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.skills }}"
                  catalogFilter:
                    kind: User
                    spec.profile.skills: backend
                  hiddenFieldName: "backendLeadEntityName"
              backendLeadEntityName:
                type: string
                ui:widget: hidden
                ui:backstage:
                  review:
                    show: false
            required: [backendLead]
```

## 🎨 User Experience

### What Users See

**Form Step:**
- Beautiful dropdown with formatted entity names
- Search functionality
- Clean, professional interface

**Review Page:**  
```
Choose User: John Doe - Engineering Department
Choose Team: Platform Team (8 members)
Choose Component: User Service - microservice
```

**What's Hidden:**
- Technical entity IDs
- Entity namespaces  
- Complex entity references

### What Developers Get

```yaml
# In template steps, developers get clean entity references:
steps:
  - action: catalog:fetch
    input:
      entityRef: "user:default/${{ parameters.selectedUserEntityName }}"
      # Gets full entity object with all properties
```

## 🐛 Troubleshooting

### Configuration Errors

**1. "hiddenFieldName is required in ui:options"**
```yaml
# ❌ ERROR: Missing hiddenFieldName
selectedUser:
  ui:field: EnhancedEntityPicker
  ui:options:
    catalogFilter:
      kind: User
    # Missing hiddenFieldName!

# ✅ FIX: Add hiddenFieldName
selectedUser:
  ui:field: EnhancedEntityPicker
  ui:options:
    catalogFilter:
      kind: User
    hiddenFieldName: "selectedUserEntityName"  # REQUIRED!
```

### Runtime Issues

**2. "No options in dropdown"**
```yaml
# Check catalogFilter configuration
catalogFilter:
  kind: User  # Ensure this matches entities in your catalog
```

**2. "Entity not found in steps"**
```yaml
# Ensure hidden field name matches
hiddenFieldName: "selectedUserEntityName"  # In ui:options
selectedUserEntityName:                    # Hidden field name must match
```

**3. "Display template not working"**
```yaml
# Check entity properties exist
displayEntityFieldAfterFormatting: "{{ metadata.title || metadata.name }}"
# Use fallbacks for optional properties
```

### **❌ Hidden field shows technical details**
```yaml
# Ensure hidden field is properly masked
selectedUserEntityName:
  type: string
  ui:widget: hidden          # Hide from form
  ui:backstage:
    review:
      show: false           # Hide from review page
```

**5. "hiddenFieldName mismatch"**
```yaml
# ❌ WRONG: hiddenFieldName doesn't match actual field
selectedGroup:
  ui:options:
    hiddenFieldName: "selectedUserEntityName"  # Wrong!
selectedGroupEntityName:  # Actual field name
  ui:widget: hidden

# ✅ CORRECT: Names must match exactly
selectedGroup:
  ui:options:
    hiddenFieldName: "selectedGroupEntityName"  # Matches!
selectedGroupEntityName:
  ui:widget: hidden
```

**6. "Missing hiddenFieldName option"**
```yaml
# ❌ BAD: No hiddenFieldName specified
selectedGroup:
  ui:field: EnhancedEntityPicker
  # Missing: hiddenFieldName option!

# Component will warn and fall back to "selectedEntityName"
# But your hidden field might be named differently!

# ✅ GOOD: Always specify hiddenFieldName
selectedGroup:
  ui:field: EnhancedEntityPicker
  ui:options:
    hiddenFieldName: "selectedGroupEntityName"  # Explicit!
```

### Debug Mode

In development, the component shows debug information:

```
🚀 Simplified Debug: 15 options
📋 Display Template: {{ metadata.title }} - {{ spec.profile.department }}
🔑 Hidden Field: selectedUserEntityName
✨ Mode: SIMPLIFIED (no custom action needed)
👤 Selected: John Doe - Engineering
🔑 Entity Name: john.doe (hidden)
```

## 🎯 Best Practices

### 1. ⚠️ Always Provide Required Configuration
```yaml
# ✅ ALWAYS include required hiddenFieldName
selectedUser:
  ui:field: EnhancedEntityPicker
  ui:options:
    hiddenFieldName: "selectedUserEntityName"  # REQUIRED - enables backend integration
    # catalogFilter is optional - defaults to Templates

# ❌ BAD - missing required option (will throw error)
selectedUser:
  ui:field: EnhancedEntityPicker
  ui:options:
    placeholder: "Select user..."  # Missing hiddenFieldName!
```

### 2. 🚀 Specify catalogFilter for Better Performance
```yaml
# ✅ EXPLICIT - Best practice for non-Template entities
catalogFilter:
  kind: User
  spec.profile.department: engineering
  spec.profile.status: active
  metadata.namespace: production

# ✅ SMART DEFAULT - Works for Template pickers
# (No catalogFilter specified = defaults to Templates)

# ⚠️ CAREFUL - Broad filters on large entity types
catalogFilter:
  kind: Component  # Could be thousands! Add more specific filters
```

### 3. 📛 Match hiddenFieldName Exactly
```yaml
# ✅ GOOD - names match exactly
selectedGroup:
  ui:options:
    hiddenFieldName: "selectedGroupEntityName"  # Exact match!

selectedGroupEntityName:  # Must match hiddenFieldName exactly
  type: string
  ui:widget: hidden

# ❌ BAD - name mismatch
selectedGroup:
  ui:options:
    hiddenFieldName: "selectedUserEntityName"  # Wrong name!

selectedGroupEntityName:  # Actual field name doesn't match
  type: string
  ui:widget: hidden
```
```yaml
# ✅ Good - informative
displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.department }}"

# ❌ Bad - not descriptive  
displayEntityFieldAfterFormatting: "{{ metadata.name }}"
```

### 4. Use Appropriate Filters
```yaml
# ✅ Good - specific filtering
catalogFilter:
  kind: User
  spec.profile.role: developer

# ❌ Bad - too broad, might be slow
catalogFilter: {}
```

### 5. Handle Different Namespaces
```yaml
# ✅ Good - explicit namespace
entityRef: "user:production/${{ parameters.selectedUserEntityName }}"

# ✅ Also good - default namespace
entityRef: "user:default/${{ parameters.selectedUserEntityName }}"
```

## 🚀 Benefits

### For End Users
- ✅ **Beautiful UX** - See friendly names, not technical IDs
- ✅ **Searchable** - Easy to find entities in large catalogs
- ✅ **Clean Review** - Review page shows what they selected
- ✅ **No Training** - Intuitive interface

### For Developers  
- ✅ **Simple Integration** - Drop into any template
- ✅ **No Backend Code** - Works with standard Backstage actions
- ✅ **Type Flexible** - Works with any entity type
- ✅ **Maintainable** - Clear, documented code

### For Organizations
- ✅ **Consistent UX** - Same experience across all templates
- ✅ **Reduced Support** - Less confusion about entity selection
- ✅ **Faster Adoption** - Users understand entity picker immediately
- ✅ **Developer Productivity** - Less time explaining technical concepts

## 📚 Related Documentation

- [Backstage Scaffolder](https://backstage.io/docs/features/software-templates/)
- [Custom Field Extensions](https://backstage.io/docs/features/software-templates/writing-custom-field-extensions)
- [Catalog API](https://backstage.io/docs/features/software-catalog/software-catalog-api)

## 🤝 Contributing

1. Follow existing code patterns
2. Add comments for complex logic
3. Update README for new features
4. Test with different entity types

## 📝 License

Same as your Backstage installation.

---

**Happy entity picking!** 🎉