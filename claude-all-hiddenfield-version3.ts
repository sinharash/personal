import React, { useEffect, useState, useCallback } from "react";
import { Autocomplete, TextField, Box } from "@mui/material";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { Entity } from "@backstage/catalog-model";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";

interface CatalogFilter {
  kind?: string;
  type?: string;
  [key: string]: any;
}

interface EnhancedEntityPickerProps
  extends FieldExtensionComponentProps<
    string,
    {
      displayEntityFieldAfterFormatting?: string;
      uniqueIdentifierField?: string; // NEW: Hidden hint field
      catalogFilter?: CatalogFilter;
      placeholder?: string;
    }
  > {}

// Formats the display of an entity based on a template string
const formatEntityDisplay = (template: string, entity: Entity): string => {
  return template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    const value = trimmedPath.split(".").reduce((obj: any, key: string) => {
      return obj && obj[key] !== undefined ? obj[key] : "";
    }, entity);
    return value || "";
  });
};

export const EnhancedEntityPicker = ({
  formData,
  onChange,
  schema,
  uiSchema,
  rawErrors,
  disabled,
  formContext,
}: EnhancedEntityPickerProps) => {
  const catalogApi = useApi(catalogApiRef);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  // Extract configuration from uiSchema
  const displayTemplate =
    uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
    "${{ metadata.name }}";
  
  // NEW: Extract the unique identifier hint field
  const uniqueIdentifierField =
    uiSchema?.["ui:options"]?.uniqueIdentifierField ||
    "${{ metadata.name }}"; // Default to metadata.name if not specified
    
  const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
  const placeholder =
    uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

  // Create hidden field name for storing the unique identifier
  const fieldName = schema.title?.toLowerCase().replace(/\s+/g, "") || "entity";
  const hiddenFieldName = `${fieldName}_unique_id`;

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const filter: any = {};

      if (catalogFilter.kind) {
        filter.kind = catalogFilter.kind;
      }
      if (catalogFilter.type) {
        filter["spec.type"] = catalogFilter.type;
      }

      Object.keys(catalogFilter).forEach((key) => {
        if (key !== "kind" && key !== "type") {
          filter[key] = catalogFilter[key];
        }
      });

      const response = await catalogApi.getEntities({ filter });
      setEntities(response.items);
    } catch (error) {
      console.error("Error fetching entities:", error);
    } finally {
      setLoading(false);
    }
  }, [catalogApi, catalogFilter]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  // Find the currently selected entity based on formData and hidden field
  useEffect(() => {
    if (formData && entities.length > 0) {
      // Try to find entity using the hidden unique identifier first
      const hiddenUniqueId = formContext?.formData?.[hiddenFieldName];
      
      let found = null;
      
      if (hiddenUniqueId) {
        // Use hidden unique ID to find entity (most reliable)
        found = entities.find((entity) => {
          const uniqueId = formatEntityDisplay(uniqueIdentifierField, entity);
          return uniqueId === hiddenUniqueId;
        });
      } 
      
      if (!found) {
        // Fallback: use display value to find entity (less reliable)
        found = entities.find((entity) => {
          const displayValue = formatEntityDisplay(displayTemplate, entity);
          return displayValue === formData;
        });
      }
      
      setSelectedEntity(found || null);
    } else {
      setSelectedEntity(null);
    }
  }, [formData, entities, displayTemplate, uniqueIdentifierField, formContext, hiddenFieldName]);

  const handleChange = (event: any, newValue: Entity | null) => {
    if (newValue) {
      // 1. Create the clean display value (what user sees)
      const displayValue = formatEntityDisplay(displayTemplate, newValue);
      
      // 2. Create the unique identifier (what backend uses)
      const uniqueId = formatEntityDisplay(uniqueIdentifierField, newValue);

      // 3. Store the clean display value in the main field
      onChange(displayValue);
      setSelectedEntity(newValue);

      // 4. Store the unique identifier in a hidden companion field
      if (formContext && formContext.formData) {
        formContext.formData[hiddenFieldName] = uniqueId;
      }

      // Debug information
      if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
        window.enhancedEntityPickerDebug = window.enhancedEntityPickerDebug || {};
        window.enhancedEntityPickerDebug[fieldName] = {
          displayValue,
          uniqueId,
          displayTemplate,
          uniqueIdentifierField,
          hiddenFieldName,
          entityRef: `${newValue.kind.toLowerCase()}:${
            newValue.metadata.namespace || "default"
          }/${newValue.metadata.name}`,
          entity: newValue,
        };
      }
    } else {
      onChange("");
      setSelectedEntity(null);
      
      // Clear the hidden field too
      if (formContext && formContext.formData) {
        delete formContext.formData[hiddenFieldName];
      }
    }
  };

  // Create display options with deduplication
  const displayOptions = entities
    .map((entity) => ({
      entity,
      displayText: formatEntityDisplay(displayTemplate, entity),
      uniqueId: formatEntityDisplay(uniqueIdentifierField, entity),
      entityId:
        entity.metadata.uid ||
        `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`,
    }))
    // Remove duplicates by entityId (not by display text!)
    .filter(
      (option, index, array) =>
        array.findIndex((item) => item.entityId === option.entityId) === index
    )
    // Remove empty display texts
    .filter((option) => option.displayText && option.displayText.trim() !== "");

  // Find current selection
  const currentSelection = selectedEntity
    ? displayOptions.find(
        (opt) => opt.entity.metadata.uid === selectedEntity.metadata.uid
      ) || null
    : null;

  return (
    <Box>
      <Autocomplete
        options={displayOptions}
        getOptionLabel={(option) => option.displayText}
        value={currentSelection}
        onChange={(event, newValue) =>
          handleChange(event, newValue?.entity || null)
        }
        loading={loading}
        disabled={disabled}
        isOptionEqualToValue={(option, value) =>
          option.entityId === value.entityId
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={schema.title}
            placeholder={placeholder}
            error={!!rawErrors?.length}
            variant="outlined"
            fullWidth
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Box>
              <Box sx={{ fontWeight: "medium" }}>{option.displayText}</Box>
            </Box>
          </Box>
        )}
      />

      {/* Debug information - development only */}
      {process.env.NODE_ENV === "development" && (
        <Box
          sx={{
            mt: 1,
            p: 1,
            bgcolor: "grey.50",
            borderRadius: 1,
            fontSize: "11px",
          }}
        >
          <strong>Debug Info (Hybrid with Hints):</strong>
          <div>Display Template: "{displayTemplate}"</div>
          <div>Unique ID Template: "{uniqueIdentifierField}"</div>
          <div>Form Data (Display): "{formData}"</div>
          <div>Hidden Field ({hiddenFieldName}): "{formContext?.formData?.[hiddenFieldName]}"</div>
          <div>Options: {displayOptions.length}</div>
          {selectedEntity && (
            <div style={{ marginTop: "4px" }}>
              <div>✅ User sees: "{formatEntityDisplay(displayTemplate, selectedEntity)}"</div>
              <div>🔧 Unique ID: "{formatEntityDisplay(uniqueIdentifierField, selectedEntity)}"</div>
              <div>🎯 EntityRef: {selectedEntity.kind.toLowerCase()}:{selectedEntity.metadata.namespace || "default"}/{selectedEntity.metadata.name}</div>
            </div>
          )}
        </Box>
      )}
    </Box>
  );
};

// Global type declaration for debugging
declare global {
  interface Window {
    enhancedEntityPickerDebug?: { [key: string]: any };
  }
}

// action/backend code

// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

// Helper function to format entity display using template (same as frontend)
const formatEntityDisplay = (template: string, entity: any): string => {
  return template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    const value = trimmedPath.split(".").reduce((obj: any, key: string) => {
      return obj && obj[key] !== undefined ? obj[key] : "";
    }, entity);
    return value || "";
  });
};

// ENHANCED ACTION: Supports hints approach for reliable entity resolution
export const resolveEntityFromDisplayAction = () => {
  return createTemplateAction<{
    displayValue: string;
    displayTemplate?: string;
    uniqueIdentifierField?: string;
    catalogFilter?: any;
    entityNamespace?: string;
    // Hidden field parameters (automatically passed by scaffolder)
    [key: string]: any; // Allow additional hidden field parameters
  }>({
    id: "enhanced:resolveEntity",
    description:
      "Extract entity reference using hints approach (reliable and performant)",
    schema: {
      input: {
        type: "object",
        required: ["displayValue"],
        properties: {
          displayValue: {
            type: "string",
            title: "Display Value",
            description: "The clean display value from EnhancedEntityPicker (what user sees)",
          },
          displayTemplate: {
            type: "string",
            title: "Display Template",
            description: "Template used to format the display (optional)",
          },
          uniqueIdentifierField: {
            type: "string",
            title: "Unique Identifier Field",
            description: "Template used for unique identification (defaults to metadata.name)",
          },
          catalogFilter: {
            type: "object",
            title: "Catalog Filter",
            description: "Filter from EnhancedEntityPicker (contains entity kind)",
          },
          entityNamespace: {
            type: "string",
            title: "Entity Namespace",
            description: "Expected entity namespace (optional, defaults to 'default')",
          },
        },
        additionalProperties: true, // Allow hidden field parameters
      },
      output: {
        type: "object",
        properties: {
          entityRef: {
            type: "string",
            title: "Entity Reference",
            description: "Entity reference for use with catalog:fetch",
          },
          extractedName: {
            type: "string",
            title: "Extracted Name",
            description: "Extracted entity name (metadata.name)",
          },
          displayValue: {
            type: "string",
            title: "Display Value",
            description: "What the user saw (clean display value)",
          },
          uniqueId: {
            type: "string",
            title: "Unique Identifier",
            description: "The unique identifier used for resolution",
          },
          entityKind: {
            type: "string",
            title: "Entity Kind",
            description: "Extracted entity kind from catalogFilter",
          },
          entityNamespace: {
            type: "string",
            title: "Entity Namespace",
            description: "Namespace used in the entity reference",
          },
          method: {
            type: "string",
            title: "Resolution Method",
            description: "How the entity was resolved",
          },
        },
      },
    },
    async handler(ctx: any) {
      const {
        displayValue,
        displayTemplate,
        uniqueIdentifierField = "${{ metadata.name }}", // Default to metadata.name
        catalogFilter = {},
        entityNamespace,
        ...additionalParams
      } = ctx.input;

      try {
        ctx.logger.info(`🔧 Processing display value: "${displayValue}"`);
        ctx.logger.info(`🔧 Display template: "${displayTemplate}"`);
        ctx.logger.info(`🔧 Unique identifier field: "${uniqueIdentifierField}"`);

        // Extract entity kind from catalogFilter (REQUIRED)
        const entityKind = catalogFilter.kind;
        if (!entityKind) {
          throw new Error(
            `Entity kind is required but not found in catalogFilter. ` +
              `Received catalogFilter: ${JSON.stringify(catalogFilter)}.`
          );
        }

        ctx.logger.info(`🔍 Entity kind: ${entityKind}`);

        // 🎯 HINTS APPROACH: Look for the hidden unique identifier field
        // The hidden field name should be something like: fieldname_unique_id
        const hiddenFieldKeys = Object.keys(additionalParams).filter(key => 
          key.endsWith('_unique_id')
        );

        ctx.logger.info(`🔍 Found hidden field keys: ${hiddenFieldKeys.join(', ')}`);

        let uniqueId: string | null = null;
        let method: string;

        if (hiddenFieldKeys.length > 0) {
          // 🎯 METHOD 1: Use hidden unique identifier (preferred)
          const hiddenFieldKey = hiddenFieldKeys[0]; // Use the first one found
          uniqueId = additionalParams[hiddenFieldKey];
          method = "hints-approach";
          
          ctx.logger.info(`✅ Found unique ID from hidden field "${hiddenFieldKey}": "${uniqueId}"`);
        }

        if (!uniqueId) {
          // 🔄 METHOD 2: Fallback - check if display value contains metadata.name
          if (uniqueIdentifierField.includes("metadata.name")) {
            uniqueId = displayValue;
            method = "fallback-display-parsing";
            ctx.logger.info(`🔄 Fallback: Using display value as unique ID: "${uniqueId}"`);
          } else {
            throw new Error(
              `No unique identifier found. Either provide a uniqueIdentifierField that includes metadata.name, ` +
              `or ensure the hidden field is properly set by the frontend component. ` +
              `Available parameters: ${Object.keys(additionalParams).join(', ')}`
            );
          }
        }

        // Parse the unique identifier to extract metadata.name
        let extractedName: string;

        if (uniqueIdentifierField.includes("metadata.name")) {
          // Parse the unique identifier using the template
          const parseTemplate = (template: string, value: string) => {
            const variables: string[] = [];
            const templateRegex = /\$\{\{\s*([^}]+)\s*\}\}/g;
            let match;

            while ((match = templateRegex.exec(template)) !== null) {
              variables.push(match[1].trim());
            }

            if (variables.length === 1 && variables[0] === "metadata.name") {
              // Simple case: template is just "${{ metadata.name }}"
              return { "metadata.name": value };
            }

            // Complex case: parse using regex
            let regexPattern = template.replace(
              /\$\{\{\s*([^}]+)\s*\}\}/g,
              "(.+?)"
            );

            regexPattern = regexPattern
              .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              .replace(/\\\(\\\.\\\+\\\?\\\)/g, "(.+?)");

            regexPattern = regexPattern.replace(/\(\.\+\?\)$/, "(.+)");

            const regex = new RegExp(regexPattern);
            const valueMatch = value.match(regex);

            if (!valueMatch) {
              throw new Error(
                `Unique identifier "${value}" doesn't match template pattern "${template}"`
              );
            }

            const extractedValues: { [key: string]: string } = {};
            for (let i = 0; i < variables.length; i++) {
              extractedValues[variables[i]] = valueMatch[i + 1]?.trim() || "";
            }

            return extractedValues;
          };

          const parsedValues = parseTemplate(uniqueIdentifierField, uniqueId);
          extractedName = parsedValues["metadata.name"];

          if (!extractedName) {
            throw new Error(
              `Could not extract metadata.name from unique identifier "${uniqueId}" ` +
              `using template "${uniqueIdentifierField}"`
            );
          }
        } else {
          throw new Error(
            `uniqueIdentifierField "${uniqueIdentifierField}" must include metadata.name ` +
            `for entity reference creation.`
          );
        }

        // Use provided namespace or fall back to "default"
        const resolvedNamespace = entityNamespace || "default";

        // Create entity reference
        const entityRef = `${entityKind.toLowerCase()}:${resolvedNamespace}/${extractedName}`;

        ctx.logger.info(`✅ Resolution method: ${method}`);
        ctx.logger.info(`✅ Extracted entity name: "${extractedName}"`);
        ctx.logger.info(`✅ Entity reference: "${entityRef}"`);

        ctx.output("entityRef", entityRef);
        ctx.output("extractedName", extractedName);
        ctx.output("displayValue", displayValue);
        ctx.output("uniqueId", uniqueId);
        ctx.output("entityKind", entityKind);
        ctx.output("entityNamespace", resolvedNamespace);
        ctx.output("method", method);

      } catch (error: any) {
        ctx.logger.error(`❌ Error: ${error.message}`);
        throw new Error(`Failed to resolve entity: ${error.message}`);
      }
    },
  });
};

// yaml

# HYBRID WITH HINTS APPROACH - Clean Display + Reliable Backend Resolution

apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: hybrid-hints-entity-picker
  title: Hybrid with Hints Entity Picker
  description: Clean user display with hidden unique identifiers for reliable backend resolution
spec:
  owner: wg119310
  type: service

  parameters:
    # APPROACH 1: Clean Display with Hidden Unique Identifier (NEW!)
    - title: "Clean Display Approach"
      properties:
        selectedUserClean:
          title: Choose User (Clean Display)
          type: string
          description: "Shows clean display to users, uses hidden unique ID for backend"
          ui:field: EnhancedEntityPicker
          ui:options:
            # 🎉 CLEAN DISPLAY: No metadata.name visible to users!
            displayEntityFieldAfterFormatting: "${{ metadata.title }} (Department: ${{ spec.profile.department }})"
            # 🔧 HIDDEN HINT: Used internally for reliable entity resolution
            uniqueIdentifierField: "${{ metadata.name }}"
            catalogFilter:
              kind: User
            placeholder: "Select a user..."

    # APPROACH 2: Complex Display with Hidden Unique Identifier
    - title: "Complex Display Approach"
      properties:
        selectedUserComplex:
          title: Choose User (Complex Display)
          type: string
          description: "Complex display format with hidden unique ID"
          ui:field: EnhancedEntityPicker
          ui:options:
            # 🎨 COMPLEX DISPLAY: Multiple fields for rich display
            displayEntityFieldAfterFormatting: "${{ metadata.title }} | ${{ spec.profile.department }} | ${{ spec.profile.email }}"
            # 🔧 HIDDEN HINT: Simple unique identifier
            uniqueIdentifierField: "${{ metadata.name }}"
            catalogFilter:
              kind: User

    # APPROACH 3: Backwards Compatibility (No uniqueIdentifierField)
    - title: "Backwards Compatible Approach"
      properties:
        selectedUserBackwards:
          title: Choose User (Backwards Compatible)
          type: string
          description: "Works with existing templates (includes metadata.name in display)"
          ui:field: EnhancedEntityPicker
          ui:options:
            # ✅ INCLUDES metadata.name: Works without hints
            displayEntityFieldAfterFormatting: "${{ metadata.name }} - ${{ metadata.title }}"
            # No uniqueIdentifierField needed - will use displayValue as fallback
            catalogFilter:
              kind: User

    # APPROACH 4: Component Selection with Hints
    - title: "Component Selection"
      properties:
        selectedComponent:
          title: Choose Component
          type: string
          description: "Component selection with clean display"
          ui:field: EnhancedEntityPicker
          ui:options:
            displayEntityFieldAfterFormatting: "${{ metadata.title }} [${{ spec.type }}]"
            uniqueIdentifierField: "${{ metadata.name }}" 
            catalogFilter:
              kind: Component

  steps:
    # Process clean display approach
    - id: resolve-user-clean
      name: Resolve User (Clean Display)
      action: enhanced:resolveEntity
      input:
        displayValue: ${{ parameters.selectedUserClean }}
        displayTemplate: "${{ metadata.title }} (Department: ${{ spec.profile.department }})"
        uniqueIdentifierField: "${{ metadata.name }}"
        catalogFilter:
          kind: User

    - id: fetch-user-clean
      name: Fetch User Data (Clean)
      action: catalog:fetch
      input:
        entityRef: ${{ steps['resolve-user-clean'].output.entityRef }}

    # Process complex display approach
    - id: resolve-user-complex
      name: Resolve User (Complex Display)
      action: enhanced:resolveEntity
      input:
        displayValue: ${{ parameters.selectedUserComplex }}
        displayTemplate: "${{ metadata.title }} | ${{ spec.profile.department }} | ${{ spec.profile.email }}"
        uniqueIdentifierField: "${{ metadata.name }}"
        catalogFilter:
          kind: User

    - id: fetch-user-complex
      name: Fetch User Data (Complex)
      action: catalog:fetch
      input:
        entityRef: ${{ steps['resolve-user-complex'].output.entityRef }}

    # Process backwards compatible approach
    - id: resolve-user-backwards
      name: Resolve User (Backwards Compatible)
      action: enhanced:resolveEntity
      input:
        displayValue: ${{ parameters.selectedUserBackwards }}
        displayTemplate: "${{ metadata.name }} - ${{ metadata.title }}"
        # No uniqueIdentifierField - will use fallback parsing
        catalogFilter:
          kind: User

    - id: fetch-user-backwards
      name: Fetch User Data (Backwards)
      action: catalog:fetch
      input:
        entityRef: ${{ steps['resolve-user-backwards'].output.entityRef }}

    # Process component selection
    - id: resolve-component
      name: Resolve Component
      action: enhanced:resolveEntity
      input:
        displayValue: ${{ parameters.selectedComponent }}
        displayTemplate: "${{ metadata.title }} [${{ spec.type }}]"
        uniqueIdentifierField: "${{ metadata.name }}"
        catalogFilter:
          kind: Component

    - id: fetch-component
      name: Fetch Component Data
      action: catalog:fetch
      input:
        entityRef: ${{ steps['resolve-component'].output.entityRef }}

    # Show comprehensive results
    - id: show-results
      name: Show Hybrid with Hints Results
      action: debug:log
      input:
        message: |
          🎯 === HYBRID WITH HINTS RESULTS === 🎯

          📋 CLEAN DISPLAY APPROACH:
          ===========================
          ✅ Review Page Shows: "${{ parameters.selectedUserClean }}"
          Expected: "John Doe (Department: Engineering)" (NO metadata.name visible!)
          
          🔧 Backend Resolution:
          - Method: ${{ steps['resolve-user-clean'].output.method }}
          - Unique ID: "${{ steps['resolve-user-clean'].output.uniqueId }}"
          - Entity Reference: ${{ steps['resolve-user-clean'].output.entityRef }}
          - Extracted Name: ${{ steps['resolve-user-clean'].output.extractedName }}
          
          📋 User Data:
          - Name: ${{ steps['fetch-user-clean'].output.entity.metadata.name }}
          - Title: ${{ steps['fetch-user-clean'].output.entity.metadata.title }}
          - Department: ${{ steps['fetch-user-clean'].output.entity.spec.profile.department }}

          📋 COMPLEX DISPLAY APPROACH:
          =============================
          ✅ Review Page Shows: "${{ parameters.selectedUserComplex }}"
          Expected: "John Doe | Engineering | john.doe@company.com"
          
          🔧 Backend Resolution:
          - Method: ${{ steps['resolve-user-complex'].output.method }}
          - Unique ID: "${{ steps['resolve-user-complex'].output.uniqueId }}"
          - Entity Reference: ${{ steps['resolve-user-complex'].output.entityRef }}

          📋 BACKWARDS COMPATIBLE APPROACH:
          ==================================
          ✅ Review Page Shows: "${{ parameters.selectedUserBackwards }}"
          Expected: "jdoe - John Doe" (includes metadata.name)
          
          🔧 Backend Resolution:
          - Method: ${{ steps['resolve-user-backwards'].output.method }}
          - Entity Reference: ${{ steps['resolve-user-backwards'].output.entityRef }}

          📦 COMPONENT SELECTION:
          =======================
          ✅ Review Page Shows: "${{ parameters.selectedComponent }}"
          Expected: "Payment API [service]"
          
          🔧 Backend Resolution:
          - Method: ${{ steps['resolve-component'].output.method }}
          - Unique ID: "${{ steps['resolve-component'].output.uniqueId }}"
          - Entity Reference: ${{ steps['resolve-component'].output.entityRef }}

          ✅ === HYBRID WITH HINTS BENEFITS === ✅
          
          🎯 Perfect Review Page: Clean display values, no technical IDs
          🔧 Reliable Resolution: Uses unique identifiers, no duplicate concerns  
          ⚡ High Performance: No entity lookup queries needed
          🔄 Backwards Compatible: Existing templates continue working
          🎨 Developer Freedom: Choose display format independently of backend needs
          📋 Full Entity Data: Complete access via catalog:fetch
          🛡️ Uniqueness Guaranteed: Uses metadata.name for reliable identification

          💡 === HOW IT WORKS === 💡
          
          1. 🎨 Frontend: Shows clean display to users
          2. 🔧 Frontend: Stores unique ID in hidden field  
          3. 📤 Backend: Gets both display value + unique ID
          4. 🎯 Backend: Uses unique ID for reliable entity resolution
          5. ✅ Result: Clean UX + Reliable functionality

          🏆 BOTTOM LINE: Clean display + Hidden hints = Perfect solution!