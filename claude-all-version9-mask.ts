// File 1: Enhanced Entity Picker Component (COMPLETELY FIXED)
// packages/app/src/scaffolder/EnhancedEntityPicker/EnhancedEntityPicker.tsx

import React, { useEffect, useState, useCallback } from "react";
import { Autocomplete, TextField, Box } from "@mui/material";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { Entity, stringifyEntityRef } from "@backstage/catalog-model";
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
      uniqueIdentifierField?: string;
      catalogFilter?: CatalogFilter;
      placeholder?: string;
    }
  > {}

// Helper to safely get nested property value
const getNestedValue = (obj: any, path: string): string => {
  try {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined || value === null) return '';
    }
    return String(value || '');
  } catch {
    return '';
  }
};

// Simple template replacement - NO dollar signs, just property paths
const formatDisplayValue = (template: string, entity: Entity): string => {
  // Handle templates like "{{ metadata.title }} - {{ spec.profile.department }}"
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expression) => {
    const trimmed = expression.trim();
    
    // Handle fallback like "metadata.title || metadata.name"
    if (trimmed.includes(' || ')) {
      const paths = trimmed.split(' || ').map(p => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        if (value) return value;
      }
      return '';
    }
    
    return getNestedValue(entity, trimmed);
  });
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

  // Get config options
  const displayTemplate =
    uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
    "{{ metadata.title || metadata.name }}";
  
  const uniqueIdentifierField =
    uiSchema?.["ui:options"]?.uniqueIdentifierField ||
    "metadata.name";
    
  const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
  const placeholder = uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

  // Fetch entities from catalog
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

  // Parse stored value to find selected entity
  useEffect(() => {
    if (formData && entities.length > 0) {
      // Parse format: "Display Value\n__ENTITY_NAME__:uniqueValue"
      const lines = formData.split('\n');
      if (lines.length >= 2) {
        const entityLine = lines.find(line => line.includes('__ENTITY_NAME__:'));
        if (entityLine) {
          const uniqueValue = entityLine.replace('__ENTITY_NAME__:', '').trim();
          const found = entities.find((entity) => {
            const entityUniqueValue = getNestedValue(entity, uniqueIdentifierField);
            return entityUniqueValue === uniqueValue;
          });
          setSelectedEntity(found || null);
        } else {
          // Fallback: try to match by display value
          const found = entities.find((entity) => {
            const displayValue = formatDisplayValue(displayTemplate, entity);
            return displayValue === formData;
          });
          setSelectedEntity(found || null);
        }
      } else {
        // Single line - try to match by display value
        const found = entities.find((entity) => {
          const displayValue = formatDisplayValue(displayTemplate, entity);
          return displayValue === formData;
        });
        setSelectedEntity(found || null);
      }
    } else {
      setSelectedEntity(null);
    }
  }, [formData, entities, displayTemplate, uniqueIdentifierField]);

  // Handle selection change
  const handleChange = (event: any, newValue: Entity | null) => {
    if (newValue) {
      const displayValue = formatDisplayValue(displayTemplate, newValue);
      const uniqueValue = getNestedValue(newValue, uniqueIdentifierField);
      
      // Since field is hidden from review, store in simple internal format
      const combinedValue = `${displayValue}\n__ENTITY_NAME__:${uniqueValue}`;
      
      onChange(combinedValue);
      setSelectedEntity(newValue);

      console.log('Enhanced Entity Picker stored:', {
        display: displayValue,
        unique: uniqueValue,
        combined: combinedValue,
        entityRef: stringifyEntityRef(newValue)
      });

    } else {
      onChange("");
      setSelectedEntity(null);
    }
  };

  // Prepare display options for dropdown
  const displayOptions = entities
    .map((entity) => ({
      entity,
      displayText: formatDisplayValue(displayTemplate, entity),
      uniqueValue: getNestedValue(entity, uniqueIdentifierField),
      entityRef: stringifyEntityRef(entity),
    }))
    .filter((option) => option.displayText && option.displayText.trim() !== "");

  const currentSelection = selectedEntity
    ? displayOptions.find(
        (opt) => stringifyEntityRef(opt.entity) === stringifyEntityRef(selectedEntity)
      ) || null
    : null;

  return (
    <Box>
      <Autocomplete
        options={displayOptions}
        getOptionLabel={(option) => option.displayText} // Only display text, no extra info
        value={currentSelection}
        onChange={(event, newValue) =>
          handleChange(event, newValue?.entity || null)
        }
        loading={loading}
        disabled={disabled}
        isOptionEqualToValue={(option, value) =>
          option.entityRef === value.entityRef
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={schema.title}
            placeholder={placeholder}
            error={!!rawErrors?.length}
            helperText={rawErrors?.length ? rawErrors[0] : schema.description}
            variant="outlined"
            fullWidth
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            {/* CLEAN: Only show the display text, no extra metadata */}
            <Box sx={{ fontWeight: "medium" }}>{option.displayText}</Box>
          </Box>
        )}
      />

      {/* Debug info only in development (field hidden from review page) */}
      {process.env.NODE_ENV === "development" && (
        <Box sx={{ mt: 1, p: 1, bgcolor: "grey.50", fontSize: "11px" }}>
          <strong>Debug:</strong> {displayOptions.length} options available
          <div>Display Template: {displayTemplate}</div>
          <div>Unique Field: {uniqueIdentifierField}</div>
          <div>Review Visibility: HIDDEN (ui:backstage.review.show: false)</div>
          {selectedEntity && (
            <div>
              Selected: {formatDisplayValue(displayTemplate, selectedEntity)}
              <br />
              Unique ID: {getNestedValue(selectedEntity, uniqueIdentifierField)}
            </div>
          )}
        </Box>
      )}
    </Box>
  );
};

// File 2: Backend Action (FIXED)
// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

export const resolveEntityFromDisplayAction = () => {
  return createTemplateAction<{
    combinedValue: string;
    entityKind: string;
    entityNamespace?: string;
  }>({
    id: "enhanced:createEntityRef",
    description:
      "Create entity reference from unique identifier - no catalog API needed",
    schema: {
      input: {
        type: "object",
        required: ["combinedValue", "entityKind"],
        properties: {
          combinedValue: {
            type: "string",
            title: "Combined Value",
            description: "Combined value from EnhancedEntityPicker (Display Value\\n__ENTITY_NAME__:uniqueValue)",
          },
          entityKind: {
            type: "string",
            title: "Entity Kind",
            description: "Kind of entity (User, Component, Group, etc.)",
          },
          entityNamespace: {
            type: "string",
            title: "Entity Namespace",
            description: "Entity namespace (defaults to 'default')",
            default: "default",
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
          displayValue: {
            type: "string",
            title: "Display Value",
            description: "Clean display value (what user saw)",
          },
          uniqueValue: {
            type: "string",
            title: "Unique Value", 
            description: "Unique identifier value used for resolution",
          },
        },
      },
    },
    async handler(ctx: any) {
      const {
        combinedValue,
        entityKind,
        entityNamespace = "default",
      } = ctx.input;

      try {
        ctx.logger.info(`Creating entityRef from: "${combinedValue}"`);

        // Parse the combined value: "Display Value\n__ENTITY_NAME__:uniqueValue"
        const lines = combinedValue.split('\n');
        
        let displayValue = '';
        let uniqueValue = '';
        
        if (lines.length >= 2) {
          displayValue = lines[0];
          // Find the line that contains "__ENTITY_NAME__:"
          const entityLine = lines.find(line => line.includes('__ENTITY_NAME__:'));
          if (entityLine) {
            uniqueValue = entityLine.replace('__ENTITY_NAME__:', '').trim();
          } else {
            throw new Error(
              `No "__ENTITY_NAME__:" marker found in combined value: "${combinedValue}"`
            );
          }
        } else {
          throw new Error(
            `Invalid combined value format. Expected "Display Value\\n__ENTITY_NAME__:uniqueValue", ` +
            `got: "${combinedValue}"`
          );
        }
        
        ctx.logger.info(`Display value: "${displayValue}"`);
        ctx.logger.info(`Unique value: "${uniqueValue}"`);

        // Create entityRef using the unique value as the entity name
        const entityRef = `${entityKind.toLowerCase()}:${entityNamespace}/${uniqueValue}`;

        ctx.logger.info(`Created entityRef: ${entityRef}`);

        // Output the results
        ctx.output("entityRef", entityRef);
        ctx.output("displayValue", displayValue);
        ctx.output("uniqueValue", uniqueValue);

      } catch (error: any) {
        ctx.logger.error(`EntityRef creation failed: ${error.message}`);
        throw new Error(`Failed to create entity reference: ${error.message}`);
      }
    },
  });
};

// File 3: Template YAML (FIXED)
# your-template.yaml

apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: enhanced-entity-picker-clean
  title: "Enhanced Entity Picker - Clean Review Page"
  description: "Beautiful UX with clean review page format"
spec:
  owner: platform-team
  type: service

  parameters:
    - title: Select User
      required:
        - selectedUser
      properties:
        selectedUser:
          title: Choose User
          type: string
          ui:field: EnhancedEntityPicker
          ui:backstage:
            review:
              show: false  # This completely hides the field from review page
          ui:options:
            # Display template (simple property paths, no dollar signs in component)
            displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.department }}"
            # Unique identifier field (just the property path)
            uniqueIdentifierField: "metadata.name"
            catalogFilter:
              kind: User
            placeholder: "Select a team member..."

  steps:
    # STEP 1: Create entityRef from unique identifier
    - id: resolve-user
      name: Resolve User EntityRef
      action: enhanced:createEntityRef
      input:
        combinedValue: ${{ parameters.selectedUser }}
        entityKind: User
        entityNamespace: default

    # STEP 2: Use standard catalog:fetch with created entityRefs
    - id: fetch-user
      name: Fetch User Details
      action: catalog:fetch
      input:
        entityRef: ${{ steps['resolve-user'].output.entityRef }}

    # STEP 3: Show it working
    - id: show-success
      name: Show Success
      action: debug:log
      input:
        message: |
          SUCCESS! Clean dropdown and hidden review field.

          User Selection:
          - What User Saw: "${{ steps['resolve-user'].output.displayValue }}"
          - Unique Identifier: ${{ steps['resolve-user'].output.uniqueValue }}
          - EntityRef: ${{ steps['resolve-user'].output.entityRef }}

          Full User Details:
          - Name: ${{ steps['fetch-user'].output.entity.metadata.name }}
          - Title: ${{ steps['fetch-user'].output.entity.metadata.title }}
          - Email: ${{ steps['fetch-user'].output.entity.spec.profile.email }}

          PERFECT SOLUTION:
          1. ✅ Clean dropdown - no dollar signs or extra metadata shown
          2. ✅ HIDDEN review field - user doesn't see any entity name data
          3. ✅ No template syntax mixing
          4. ✅ Pure JavaScript property access
          5. ✅ Works with any entity kind
          6. ✅ Handles duplicates with unique identifier
          7. ✅ Completely masks internal entity details from user