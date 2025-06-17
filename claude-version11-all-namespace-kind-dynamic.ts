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
      hiddenFieldName?: string; // NEW: Name of hidden field to store entity identifier
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
  formContext, // Access to the entire form context
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

  const hiddenFieldName = 
    uiSchema?.["ui:options"]?.hiddenFieldName ||
    "selectedUserEntityName"; // Default hidden field name
    
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
      // formData now contains only the display value
      const found = entities.find((entity) => {
        const displayValue = formatDisplayValue(displayTemplate, entity);
        return displayValue === formData;
      });
      setSelectedEntity(found || null);
    } else {
      setSelectedEntity(null);
    }
  }, [formData, entities, displayTemplate, uniqueIdentifierField]);

  // Handle selection change
  const handleChange = (event: any, newValue: Entity | null) => {
    if (newValue) {
      const displayValue = formatDisplayValue(displayTemplate, newValue);
      const uniqueValue = getNestedValue(newValue, uniqueIdentifierField);
      
      // Extract entity metadata for dynamic action inputs
      const entityKind = newValue.kind;
      const entityNamespace = newValue.metadata.namespace || 'default';
      
      // Store only display value in main field (shows cleanly on review)
      onChange(displayValue);
      setSelectedEntity(newValue);

      // Update hidden fields through form context - make it dynamic!
      if (formContext?.formData) {
        formContext.formData[hiddenFieldName] = uniqueValue;
        formContext.formData[`${hiddenFieldName}Kind`] = entityKind;
        formContext.formData[`${hiddenFieldName}Namespace`] = entityNamespace;
      }

      console.log('Enhanced Entity Picker stored:', {
        display: displayValue,
        unique: uniqueValue,
        kind: entityKind,
        namespace: entityNamespace,
        hiddenField: hiddenFieldName,
        entityRef: stringifyEntityRef(newValue)
      });

    } else {
      onChange("");
      setSelectedEntity(null);
      
      // Clear all hidden fields
      if (formContext?.formData) {
        formContext.formData[hiddenFieldName] = "";
        formContext.formData[`${hiddenFieldName}Kind`] = "";
        formContext.formData[`${hiddenFieldName}Namespace`] = "";
      }
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

      {/* Debug info only in development */}
      {process.env.NODE_ENV === "development" && (
        <Box sx={{ mt: 1, p: 1, bgcolor: "grey.50", fontSize: "11px" }}>
          <strong>Debug:</strong> {displayOptions.length} options available
          <div>Display Template: {displayTemplate}</div>
          <div>Unique Field: {uniqueIdentifierField}</div>
          <div>Hidden Field: {hiddenFieldName}</div>
          <div>Mode: DYNAMIC (auto-detects kind & namespace)</div>
          <div>Review Shows: Display value only (clean)</div>
          {selectedEntity && (
            <div>
              Selected: {formatDisplayValue(displayTemplate, selectedEntity)}
              <br />
              Unique ID: {getNestedValue(selectedEntity, uniqueIdentifierField)} (hidden)
              <br />
              Kind: {selectedEntity.kind} (auto-detected)
              <br />
              Namespace: {selectedEntity.metadata.namespace || 'default'} (auto-detected)
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
    displayValue: string;
    entityName: string;
    entityKind: string;
    entityNamespace: string;
  }>({
    id: "enhanced:createEntityRef",
    description:
      "Create entity reference from dynamic entity metadata - works with any entity type",
    schema: {
      input: {
        type: "object",
        required: ["displayValue", "entityName", "entityKind", "entityNamespace"],
        properties: {
          displayValue: {
            type: "string",
            title: "Display Value",
            description: "The display value shown to user (e.g., 'John Doe - Engineering')",
          },
          entityName: {
            type: "string", 
            title: "Entity Name",
            description: "The unique entity identifier (e.g., 'jdoe')",
          },
          entityKind: {
            type: "string",
            title: "Entity Kind",
            description: "Dynamic entity kind from selected entity (User, Group, Component, etc.)",
          },
          entityNamespace: {
            type: "string",
            title: "Entity Namespace",
            description: "Dynamic entity namespace from selected entity (default, production, etc.)",
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
          entityKind: {
            type: "string",
            title: "Entity Kind",
            description: "The kind of entity selected",
          },
          entityNamespace: {
            type: "string", 
            title: "Entity Namespace",
            description: "The namespace of entity selected",
          },
        },
      },
    },
    async handler(ctx: any) {
      const {
        displayValue,
        entityName,
        entityKind,
        entityNamespace,
      } = ctx.input;

      try {
        ctx.logger.info(`Creating entityRef from display: "${displayValue}"`);
        ctx.logger.info(`Entity details - Kind: ${entityKind}, Namespace: ${entityNamespace}, Name: ${entityName}`);

        // Validate inputs
        if (!entityName || entityName.trim() === '') {
          throw new Error('Entity name cannot be empty');
        }
        
        if (!entityKind || entityKind.trim() === '') {
          throw new Error('Entity kind cannot be empty');
        }

        if (!entityNamespace || entityNamespace.trim() === '') {
          throw new Error('Entity namespace cannot be empty');
        }

        // Sanitize inputs for entity reference
        const sanitizedEntityName = entityName.trim();
        const sanitizedKind = entityKind.trim().toLowerCase();
        const sanitizedNamespace = entityNamespace.trim();
        
        // Create dynamic entityRef - works for any entity type!
        const entityRef = `${sanitizedKind}:${sanitizedNamespace}/${sanitizedEntityName}`;

        ctx.logger.info(`✅ Created dynamic entityRef: ${entityRef}`);

        // Output all the details for further use
        ctx.output("entityRef", entityRef);
        ctx.output("displayValue", displayValue);
        ctx.output("uniqueValue", sanitizedEntityName);
        ctx.output("entityKind", sanitizedKind);
        ctx.output("entityNamespace", sanitizedNamespace);

      } catch (error: any) {
        ctx.logger.error(`❌ EntityRef creation failed: ${error.message}`);
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
  name: enhanced-entity-picker-dynamic
  title: "Enhanced Entity Picker - Dynamic & Developer-Friendly"
  description: "Beautiful UX that works with ANY entity type - auto-detects kind & namespace"
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
          ui:options:
            # Display template (simple property paths, no dollar signs in component)
            displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.department }}"
            # Unique identifier field (just the property path)
            uniqueIdentifierField: "metadata.name"
            # Hidden field name where entity identifier will be stored
            hiddenFieldName: "selectedUserEntityName"
            catalogFilter:
              kind: User
            placeholder: "Select a team member..."

  # 🚀 EXAMPLE: Same component works for Groups! Just change catalogFilter:
  # - title: Select Team
  #   properties:
  #     selectedGroup:
  #       title: Choose Team
  #       ui:field: EnhancedEntityPicker
  #       ui:options:
  #         displayEntityFieldAfterFormatting: "{{ metadata.title }} ({{ spec.type }})"
  #         catalogFilter:
  #           kind: Group  # 👈 Just change this!
  #         hiddenFieldName: "selectedGroupEntityName"

  # 🚀 EXAMPLE: Same component works for Components!
  # - title: Select Component  
  #   properties:
  #     selectedComponent:
  #       title: Choose Component
  #       ui:field: EnhancedEntityPicker
  #       ui:options:
  #         displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.type }}"
  #         catalogFilter:
  #           kind: Component  # 👈 Just change this!
  #         hiddenFieldName: "selectedComponentEntityName"
        # Hidden fields to store the entity metadata (auto-populated by component)
        selectedUserEntityName:
          type: string
          ui:widget: hidden  # Entity unique identifier
          ui:backstage:
            review:
              show: false
        selectedUserEntityNameKind:
          type: string
          ui:widget: hidden  # Entity kind (User, Group, Component, etc.)
          ui:backstage:
            review:
              show: false
        selectedUserEntityNameNamespace:
          type: string
          ui:widget: hidden  # Entity namespace (default, production, etc.)
          ui:backstage:
            review:
              show: false

  steps:
    # STEP 1: Create entityRef from dynamic entity metadata (auto-extracted!)
    - id: resolve-user
      name: Resolve User EntityRef
      action: enhanced:createEntityRef
      input:
        displayValue: ${{ parameters.selectedUser }}
        entityName: ${{ parameters.selectedUserEntityName }}
        entityKind: ${{ parameters.selectedUserEntityNameKind }}
        entityNamespace: ${{ parameters.selectedUserEntityNameNamespace }}

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
          SUCCESS! Fully dynamic entity picker - works with ANY entity type!

          User Selection:
          - What User Saw: "${{ steps['resolve-user'].output.displayValue }}"
          - Entity Name: ${{ steps['resolve-user'].output.uniqueValue }} (auto-extracted)
          - Entity Kind: ${{ steps['resolve-user'].output.entityKind }} (auto-detected)
          - Entity Namespace: ${{ steps['resolve-user'].output.entityNamespace }} (auto-detected)
          - EntityRef: ${{ steps['resolve-user'].output.entityRef }} (dynamically created)

          Full User Details:
          - Name: ${{ steps['fetch-user'].output.entity.metadata.name }}
          - Title: ${{ steps['fetch-user'].output.entity.metadata.title }}
          - Email: ${{ steps['fetch-user'].output.entity.spec.profile.email }}

          🚀 DEVELOPER-FRIENDLY FEATURES:
          1. ✅ Clean dropdown - no technical details shown to users
          2. ✅ Review page shows user selection only
          3. ✅ Auto-detects entity Kind (User, Group, Component, etc.)
          4. ✅ Auto-detects entity Namespace (default, production, etc.)
          5. ✅ Works with ANY entity type without code changes
          6. ✅ No hardcoded values - fully dynamic
          7. ✅ Developer just configures catalogFilter - rest is automatic
          8. ✅ One component works for Users, Groups, Components, Systems, APIs, etc.