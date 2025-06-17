import React, { useEffect, useState, useCallback } from "react";
import { Autocomplete, TextField, Box } from "@mui/material";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { Entity } from "@backstage/catalog-model";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";

// INVISIBLE UNICODE SEPARATOR - Users can't see this character!
const INVISIBLE_SEPARATOR = "\u200B"; // Zero-width space (completely invisible)

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
      uniqueIdentifierField?: string;
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

// Extract the visible part from form data (what user should see)
const extractVisiblePart = (formDataValue: string): string => {
  if (!formDataValue) return "";
  
  // Split by invisible separator and return the visible part
  const parts = formDataValue.split(INVISIBLE_SEPARATOR);
  return parts[0] || formDataValue;
};

// Extract the hidden unique ID from form data
const extractHiddenId = (formDataValue: string): string => {
  if (!formDataValue) return "";
  
  const parts = formDataValue.split(INVISIBLE_SEPARATOR);
  return parts[1] || "";
};

export const EnhancedEntityPicker = ({
  formData,
  onChange,
  schema,
  uiSchema,
  rawErrors,
  disabled,
}: EnhancedEntityPickerProps) => {
  const catalogApi = useApi(catalogApiRef);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  // Extract configuration from uiSchema
  const displayTemplate =
    uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
    "${{ metadata.name }}";
    
  const uniqueIdentifierField =
    uiSchema?.["ui:options"]?.uniqueIdentifierField ||
    "${{ metadata.name }}";
    
  const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
  const placeholder =
    uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

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

  // Find the currently selected entity based on formData
  useEffect(() => {
    if (formData && entities.length > 0) {
      // Try to use hidden unique ID first (most reliable)
      const hiddenId = extractHiddenId(formData);
      
      let found = null;
      
      if (hiddenId) {
        // Use hidden unique ID to find entity
        found = entities.find((entity) => {
          const uniqueId = formatEntityDisplay(uniqueIdentifierField, entity);
          return uniqueId === hiddenId;
        });
      }
      
      if (!found) {
        // Fallback: use visible display value
        const visiblePart = extractVisiblePart(formData);
        found = entities.find((entity) => {
          const displayValue = formatEntityDisplay(displayTemplate, entity);
          return displayValue === visiblePart;
        });
      }
      
      setSelectedEntity(found || null);
    } else {
      setSelectedEntity(null);
    }
  }, [formData, entities, displayTemplate, uniqueIdentifierField]);

  const handleChange = (event: any, newValue: Entity | null) => {
    if (newValue) {
      // Create clean display value (what user sees)
      const displayValue = formatEntityDisplay(displayTemplate, newValue);
      
      // Create unique identifier (for backend resolution)
      const uniqueId = formatEntityDisplay(uniqueIdentifierField, newValue);

      // Check if we need to embed unique ID
      const needsUniqueId = !displayTemplate.includes("metadata.name");
      
      let finalValue: string;
      if (needsUniqueId) {
        // Embed unique ID using invisible separator
        finalValue = `${displayValue}${INVISIBLE_SEPARATOR}${uniqueId}`;
      } else {
        // Display already contains metadata.name, no embedding needed
        finalValue = displayValue;
      }

      onChange(finalValue);
      setSelectedEntity(newValue);

      // Debug information
      if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
        window.enhancedEntityPickerDebug = window.enhancedEntityPickerDebug || {};
        const fieldName = schema.title?.toLowerCase().replace(/\s+/g, "") || "entity";
        
        window.enhancedEntityPickerDebug[fieldName] = {
          displayValue,
          uniqueId,
          finalValue,
          needsUniqueId,
          visibleOnReview: extractVisiblePart(finalValue),
          hiddenId: extractHiddenId(finalValue),
          entityRef: `${newValue.kind.toLowerCase()}:${
            newValue.metadata.namespace || "default"
          }/${newValue.metadata.name}`,
          entity: newValue,
        };
      }
    } else {
      onChange("");
      setSelectedEntity(null);
    }
  };

  // Create display options
  const displayOptions = entities
    .map((entity) => ({
      entity,
      displayText: formatEntityDisplay(displayTemplate, entity),
      entityId:
        entity.metadata.uid ||
        `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`,
    }))
    .filter(
      (option, index, array) =>
        array.findIndex((item) => item.entityId === option.entityId) === index
    )
    .filter((option) => option.displayText && option.displayText.trim() !== "");

  // Find current selection
  const currentSelection = selectedEntity
    ? displayOptions.find(
        (opt) => opt.entity.metadata.uid === selectedEntity.metadata.uid
      ) || null
    : null;

  // For display purposes, always show the clean visible part
  const displayValue = extractVisiblePart(formData || "");

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
            // 🎯 CRITICAL: Override input value to show only visible part
            InputProps={{
              ...params.InputProps,
              value: displayValue, // Always show clean value
            }}
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
          <strong>Debug Info (Invisible Separator):</strong>
          <div>Raw Form Data: "{formData}"</div>
          <div>Visible Part: "{extractVisiblePart(formData || "")}"</div>
          <div>Hidden ID: "{extractHiddenId(formData || "")}"</div>
          <div>Display Template: "{displayTemplate}"</div>
          <div>Unique ID Template: "{uniqueIdentifierField}"</div>
          {selectedEntity && (
            <div>Selected Entity: {selectedEntity.metadata.name}</div>
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

// action code 
// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

// SAME INVISIBLE SEPARATOR as frontend
const INVISIBLE_SEPARATOR = "\u200B"; // Zero-width space

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

// Extract visible and hidden parts from form data
const parseInvisibleSeparatorValue = (value: string) => {
  const parts = value.split(INVISIBLE_SEPARATOR);
  return {
    visiblePart: parts[0] || value,
    hiddenPart: parts[1] || "",
  };
};

// ENHANCED ACTION: Supports invisible separator approach
export const resolveEntityFromDisplayAction = () => {
  return createTemplateAction<{
    displayValue: string;
    displayTemplate?: string;
    uniqueIdentifierField?: string;
    catalogFilter?: any;
    entityNamespace?: string;
  }>({
    id: "enhanced:resolveEntity",
    description:
      "Extract entity reference using invisible separator approach (clean and reliable)",
    schema: {
      input: {
        type: "object",
        required: ["displayValue"],
        properties: {
          displayValue: {
            type: "string",
            title: "Display Value",
            description: "The display value from EnhancedEntityPicker (may contain hidden unique ID)",
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
            description: "What the user saw (visible part only)",
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
        uniqueIdentifierField = "${{ metadata.name }}",
        catalogFilter = {},
        entityNamespace,
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

        // Parse the display value to extract visible and hidden parts
        const { visiblePart, hiddenPart } = parseInvisibleSeparatorValue(displayValue);
        
        ctx.logger.info(`🔍 Visible part: "${visiblePart}"`);
        ctx.logger.info(`🔍 Hidden part: "${hiddenPart}"`);

        let uniqueId: string;
        let method: string;
        let extractedName: string;

        if (hiddenPart) {
          // 🎯 METHOD 1: Use hidden unique identifier (preferred)
          uniqueId = hiddenPart;
          method = "invisible-separator";
          
          ctx.logger.info(`✅ Found unique ID from invisible separator: "${uniqueId}"`);

          // Parse the unique identifier to extract metadata.name
          if (uniqueIdentifierField.includes("metadata.name")) {
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
              `uniqueIdentifierField "${uniqueIdentifierField}" must include metadata.name`
            );
          }

        } else {
          // 🔄 METHOD 2: Fallback - parse visible part (backwards compatibility)
          method = "fallback-template-parsing";
          ctx.logger.info(`🔄 No hidden part found, attempting to parse visible part`);

          if (!displayTemplate) {
            throw new Error(
              `No hidden unique ID found and no displayTemplate provided for fallback parsing`
            );
          }

          if (!displayTemplate.includes("metadata.name")) {
            throw new Error(
              `No hidden unique ID found and displayTemplate "${displayTemplate}" ` +
              `does not include metadata.name for fallback parsing`
            );
          }

          // Parse the visible part using the display template
          const parseTemplate = (template: string, value: string) => {
            const variables: string[] = [];
            const templateRegex = /\$\{\{\s*([^}]+)\s*\}\}/g;
            let match;

            while ((match = templateRegex.exec(template)) !== null) {
              variables.push(match[1].trim());
            }

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
                `Display value "${value}" doesn't match template pattern "${template}"`
              );
            }

            const extractedValues: { [key: string]: string } = {};
            for (let i = 0; i < variables.length; i++) {
              extractedValues[variables[i]] = valueMatch[i + 1]?.trim() || "";
            }

            return extractedValues;
          };

          const parsedValues = parseTemplate(displayTemplate, visiblePart);
          extractedName = parsedValues["metadata.name"];
          uniqueId = extractedName;

          if (!extractedName) {
            throw new Error(
              `Could not extract metadata.name from display value "${visiblePart}" ` +
              `using template "${displayTemplate}"`
            );
          }
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
        ctx.output("displayValue", visiblePart); // Return only visible part
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
# INVISIBLE SEPARATOR SOLUTION - Clean Review Page + Reliable Backend

apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: invisible-separator-entity-picker
  title: Invisible Separator Entity Picker
  description: Clean user display with invisible embedded unique identifiers
spec:
  owner: wg119310
  type: service

  parameters:
    # CLEAN DISPLAY: No metadata.name visible to users!
    - title: "Perfect Clean Display"
      properties:
        selectedUserClean:
          title: Choose User (Clean Display)
          type: string
          description: "Users see clean display, backend gets reliable unique ID"
          ui:field: EnhancedEntityPicker
          ui:options:
            # 🎉 CLEAN: What users see on review page
            displayEntityFieldAfterFormatting: "${{ metadata.title }} (Department: ${{ spec.profile.department }})"
            # 🔧 HINT: Embedded invisibly for backend (users never see this)
            uniqueIdentifierField: "${{ metadata.name }}"
            catalogFilter:
              kind: User
            placeholder: "Select a user..."

    # COMPLEX DISPLAY: Multiple fields for rich information
    - title: "Rich Display Format"
      properties:
        selectedUserRich:
          title: Choose User (Rich Display)
          type: string
          description: "Rich display with multiple entity fields"
          ui:field: EnhancedEntityPicker
          ui:options:
            displayEntityFieldAfterFormatting: "${{ metadata.title }} | ${{ spec.profile.department }} | ${{ spec.profile.email }}"
            uniqueIdentifierField: "${{ metadata.name }}"
            catalogFilter:
              kind: User

    # BACKWARDS COMPATIBLE: Existing templates still work
    - title: "Backwards Compatible"
      properties:
        selectedUserBackwards:
          title: Choose User (Backwards Compatible)
          type: string
          description: "Existing template format (includes metadata.name)"
          ui:field: EnhancedEntityPicker
          ui:options:
            # ✅ INCLUDES metadata.name: No invisible separator needed
            displayEntityFieldAfterFormatting: "${{ metadata.name }} - ${{ metadata.title }}"
            catalogFilter:
              kind: User

    # COMPONENT SELECTION: Works with any entity kind
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

    # Process rich display approach
    - id: resolve-user-rich
      name: Resolve User (Rich Display)
      action: enhanced:resolveEntity
      input:
        displayValue: ${{ parameters.selectedUserRich }}
        displayTemplate: "${{ metadata.title }} | ${{ spec.profile.department }} | ${{ spec.profile.email }}"
        uniqueIdentifierField: "${{ metadata.name }}"
        catalogFilter:
          kind: User

    - id: fetch-user-rich
      name: Fetch User Data (Rich)
      action: catalog:fetch
      input:
        entityRef: ${{ steps['resolve-user-rich'].output.entityRef }}

    # Process backwards compatible approach
    - id: resolve-user-backwards
      name: Resolve User (Backwards Compatible)
      action: enhanced:resolveEntity
      input:
        displayValue: ${{ parameters.selectedUserBackwards }}
        displayTemplate: "${{ metadata.name }} - ${{ metadata.title }}"
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

    # Show perfect results
    - id: show-results
      name: Show Invisible Separator Results
      action: debug:log
      input:
        message: |
          🎯 === INVISIBLE SEPARATOR RESULTS === 🎯

          ✨ PERFECT CLEAN DISPLAY:
          =========================
          ✅ Review Page Shows: "${{ parameters.selectedUserClean }}"
          Expected: "John Doe (Department: Engineering)"
          ❌ Users DO NOT See: "jdoe" (embedded invisibly!)
          
          🔧 Backend Resolution:
          - Method: ${{ steps['resolve-user-clean'].output.method }}
          - Visible Part: "${{ steps['resolve-user-clean'].output.displayValue }}"
          - Unique ID: "${{ steps['resolve-user-clean'].output.uniqueId }}"
          - Entity Reference: ${{ steps['resolve-user-clean'].output.entityRef }}
          
          📋 Full User Data:
          - Name: ${{ steps['fetch-user-clean'].output.entity.metadata.name }}
          - Title: ${{ steps['fetch-user-clean'].output.entity.metadata.title }}
          - Department: ${{ steps['fetch-user-clean'].output.entity.spec.profile.department }}
          - Email: ${{ steps['fetch-user-clean'].output.entity.spec.profile.email }}

          ✨ RICH DISPLAY FORMAT:
          =======================
          ✅ Review Page Shows: "${{ parameters.selectedUserRich }}"
          Expected: "John Doe | Engineering | john.doe@company.com"
          
          🔧 Backend Resolution:
          - Method: ${{ steps['resolve-user-rich'].output.method }}
          - Entity Reference: ${{ steps['resolve-user-rich'].output.entityRef }}

          ✨ BACKWARDS COMPATIBLE:
          ========================
          ✅ Review Page Shows: "${{ parameters.selectedUserBackwards }}"
          Expected: "jdoe - John Doe" (includes metadata.name as before)
          
          🔧 Backend Resolution:
          - Method: ${{ steps['resolve-user-backwards'].output.method }}
          - Entity Reference: ${{ steps['resolve-user-backwards'].output.entityRef }}

          📦 COMPONENT SELECTION:
          =======================
          ✅ Review Page Shows: "${{ parameters.selectedComponent }}"
          Expected: "Payment API [service]"
          
          🔧 Backend Resolution:
          - Method: ${{ steps['resolve-component'].output.method }}
          - Entity Reference: ${{ steps['resolve-component'].output.entityRef }}

          🏆 === PERFECT SOLUTION ACHIEVED === 🏆
          
          ✅ Clean Review Page: Users see ONLY clean, readable text
          ✅ No Exposed Fields: No hidden companion fields visible
          ✅ Reliable Backend: Uses embedded unique identifiers  
          ✅ High Performance: Direct entity resolution, no queries
          ✅ Backwards Compatible: Existing templates unchanged
          ✅ Developer Freedom: Create any display template
          ✅ Uniqueness Guaranteed: Uses metadata.name (guaranteed unique)

          🔧 === HOW INVISIBLE SEPARATOR WORKS === 🔧
          
          1. 🎨 Frontend: Shows "John Doe (Department: Engineering)" to user
          2. 🔧 Frontend: Stores "John Doe (Department: Engineering)​jdoe" (invisible separator)
          3. 👁️ Review Page: Shows "John Doe (Department: Engineering)" (invisible part hidden!)
          4. 📤 Backend: Receives both visible and invisible parts
          5. 🎯 Backend: Uses "jdoe" for reliable entity resolution
          6. ✅ Result: Perfect UX + Perfect functionality

          💡 The invisible separator (Unicode U+200B) is completely invisible to users
          but allows the backend to extract the unique identifier reliably!

          🎉 PROBLEM COMPLETELY SOLVED! 🎉