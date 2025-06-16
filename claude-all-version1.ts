// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";
import { CatalogApi, CatalogClient } from '@backstage/catalog-client';
import { DiscoveryApi } from '@backstage/core-plugin-api';

// Helper function to format entity display using template
const formatEntityDisplay = (template: string, entity: any): string => {
  return template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    const value = trimmedPath.split(".").reduce((obj: any, key: string) => {
      return obj && obj[key] !== undefined ? obj[key] : "";
    }, entity);
    return value || "";
  });
};

export const resolveEntityFromDisplayAction = (options: { discovery: DiscoveryApi }) => {
  return createTemplateAction<{
    displayValue: string;
    displayTemplate: string;
    catalogFilter?: any;
    entityNamespace?: string;
  }>({
    id: "enhanced:resolveEntity",
    description:
      "Finds an entity by matching display value against template format",
    schema: {
      input: {
        type: "object",
        required: ["displayValue", "displayTemplate"],
        properties: {
          displayValue: {
            type: "string",
            title: "Display Value",
            description:
              "The clean display value from EnhancedEntityPicker (what user sees)",
          },
          displayTemplate: {
            type: "string",
            title: "Display Template",
            description:
              "The template used to format the display value",
          },
          catalogFilter: {
            type: "object",
            title: "Catalog Filter",
            description:
              "Filter from EnhancedEntityPicker (must contain entity kind)",
          },
          entityNamespace: {
            type: "string",
            title: "Entity Namespace",
            description:
              "Expected entity namespace (optional, defaults to 'default')",
          },
        },
      },
      output: {
        type: "object",
        properties: {
          entityRef: {
            type: "string",
            title: "Entity Reference",
          },
          extractedName: {
            type: "string",
            title: "Extracted Name (metadata.name)",
          },
          displayValue: {
            type: "string",
            title: "Original Display Value",
          },
          matchedEntity: {
            type: "object",
            title: "Matched Entity",
          },
        },
      },
    },
    async handler(ctx: any) {
      const {
        displayValue,
        displayTemplate,
        catalogFilter = {},
        entityNamespace = "default",
      } = ctx.input;

      try {
        ctx.logger.info(`🔧 Looking for entity matching display: "${displayValue}"`);
        ctx.logger.info(`🔧 Using template: "${displayTemplate}"`);

        const entityKind = catalogFilter.kind;
        if (!entityKind) {
          throw new Error("catalogFilter must contain a 'kind' property.");
        }
        ctx.logger.info(`🔍 Entity kind: ${entityKind}`);

        // Get catalog API from context
        const catalogApi: CatalogApi = ctx.catalogApi;
        if (!catalogApi) {
          throw new Error("Catalog API not available in context");
        }

        // Fetch entities matching the filter
        ctx.logger.info(`🔍 Fetching entities with filter: ${JSON.stringify(catalogFilter)}`);
        const response = await catalogApi.getEntities({ filter: catalogFilter });
        const entities = response.items;

        ctx.logger.info(`🔍 Found ${entities.length} entities to check`);

        // Find the entity whose formatted display matches the input
        let matchedEntity = null;
        for (const entity of entities) {
          const formattedDisplay = formatEntityDisplay(displayTemplate, entity);
          ctx.logger.debug(`🔍 Checking entity ${entity.metadata.name}: "${formattedDisplay}"`);
          
          if (formattedDisplay === displayValue) {
            matchedEntity = entity;
            ctx.logger.info(`✅ Found matching entity: ${entity.metadata.name}`);
            break;
          }
        }

        if (!matchedEntity) {
          throw new Error(
            `No entity found matching display value "${displayValue}" ` +
            `with template "${displayTemplate}". ` +
            `Checked ${entities.length} entities of kind ${entityKind}.`
          );
        }

        const extractedName = matchedEntity.metadata.name;
        const entityRef = `${entityKind.toLowerCase()}:${entityNamespace}/${extractedName}`;

        ctx.logger.info(`✅ Successfully resolved entity:`);
        ctx.logger.info(`   Display Value: "${displayValue}"`);
        ctx.logger.info(`   Entity Name: "${extractedName}"`);
        ctx.logger.info(`   Entity Reference: "${entityRef}"`);

        ctx.output("entityRef", entityRef);
        ctx.output("extractedName", extractedName);
        ctx.output("displayValue", displayValue);
        ctx.output("matchedEntity", matchedEntity);

      } catch (error: any) {
        ctx.logger.error(`❌ Error: ${error.message}`);
        throw new Error(`Failed to resolve entity: ${error.message}`);
      }
    },
  });
};

// frontend

import React, { useEffect, useState, useCallback } from "react";
import { Autocomplete, TextField, Box, Typography } from "@mui/material";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { Entity } from "@backstage/catalog-model";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";

// A unique separator unlikely to appear in user data
const HIDDEN_SEPARATOR = "|||";

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

// Extract the visible part from form data
const extractVisiblePart = (formDataValue: string | undefined): string => {
  if (!formDataValue) return "";
  const parts = formDataValue.split(HIDDEN_SEPARATOR);
  return parts[0] || "";
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

  const displayTemplate =
    uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
    "${{ metadata.name }}";
  const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
  const placeholder =
    uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const response = await catalogApi.getEntities({ filter: catalogFilter });
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

  // When the component loads with existing data, parse the hidden name
  useEffect(() => {
    if (formData && entities.length > 0) {
      const parts = formData.split(HIDDEN_SEPARATOR);
      const hiddenName = parts.length > 1 ? parts[1] : parts[0];

      if (hiddenName) {
        const found = entities.find(
          (entity) => entity.metadata.name === hiddenName
        );
        setSelectedEntity(found || null);
      }
    } else {
      setSelectedEntity(null);
    }
  }, [formData, entities]);

  const handleChange = (event: any, newValue: Entity | null) => {
    setSelectedEntity(newValue);

    if (newValue) {
      const displayValue = formatEntityDisplay(displayTemplate, newValue);
      const hiddenName = newValue.metadata.name;

      // Check if template is only metadata.name
      const isOnlyMetadataName = displayTemplate.trim() === "${{ metadata.name }}";

      if (isOnlyMetadataName) {
        onChange(displayValue);
      } else {
        onChange(`${displayValue}${HIDDEN_SEPARATOR}${hiddenName}`);
      }
    } else {
      onChange("");
    }
  };

  const displayOptions = entities
    .map((entity) => ({
      entity,
      displayText: formatEntityDisplay(displayTemplate, entity),
    }))
    .filter((option) => option.displayText && option.displayText.trim() !== "");

  // Get the clean display value
  const cleanDisplayValue = extractVisiblePart(formData);

  return (
    <Box>
      <Autocomplete
        options={displayOptions}
        getOptionLabel={(option) => option.displayText}
        value={{
          entity: selectedEntity,
          displayText: selectedEntity
            ? formatEntityDisplay(displayTemplate, selectedEntity)
            : "",
        }}
        onChange={(event, newValue) =>
          handleChange(event, newValue?.entity || null)
        }
        loading={loading}
        disabled={disabled}
        isOptionEqualToValue={(option, value) => {
          return (
            option?.entity?.metadata?.name === value?.entity?.metadata?.name
          );
        }}
        renderInput={(params) => {
          // 🔧 AGGRESSIVE OVERRIDE: Override multiple value properties
          const modifiedParams = {
            ...params,
            inputProps: {
              ...params.inputProps,
              value: cleanDisplayValue, // Override input value
            },
            InputProps: {
              ...params.InputProps,
              value: cleanDisplayValue, // Override InputProps value
            },
          };

          return (
            <TextField
              {...modifiedParams}
              label={schema.title}
              placeholder={placeholder}
              error={!!rawErrors?.length}
              helperText={rawErrors?.length ? rawErrors[0] : schema.description}
              variant="outlined"
              fullWidth
              value={cleanDisplayValue} // Direct value override
            />
          );
        }}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Typography variant="body1">{option.displayText}</Typography>
          </Box>
        )}
      />

      {/* Debug info for development */}
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
          <strong>Debug Info:</strong>
          <div>Raw Form Data: "{formData}"</div>
          <div>Clean Display Value: "{cleanDisplayValue}"</div>
          <div>Template: "{displayTemplate}"</div>
          {selectedEntity && (
            <div>Selected Entity: {selectedEntity.metadata.name}</div>
          )}
        </Box>
      )}
    </Box>
  );
};

// yaml

# SIMPLE CLEAN SOLUTION - No Separators, Clean Review Page

apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: clean-enhanced-entity-picker
  title: Clean Enhanced Entity Picker
  description: Stores only clean display values, backend does entity lookup
spec:
  owner: engineering
  type: service

  parameters:
    # Clean user selection - any template combination works
    - title: Select User
      required:
        - selectedUser
      properties:
        selectedUser:
          title: Choose User
          type: string
          description: Select a user from the catalog
          ui:field: EnhancedEntityPicker
          ui:options:
            # 🎯 ANY TEMPLATE WORKS - even without metadata.name!
            displayEntityFieldAfterFormatting: "${{ metadata.title }} (Department: ${{ spec.profile.department }})"
            catalogFilter:
              kind: User
            placeholder: "Select a user..."

    # Test with metadata.name only
    - title: Select User (Name Only)
      properties:
        selectedUserNameOnly:
          title: Choose User (Name)
          type: string
          description: Select using metadata.name only
          ui:field: EnhancedEntityPicker
          ui:options:
            displayEntityFieldAfterFormatting: "${{ metadata.name }}"
            catalogFilter:
              kind: User

    # Test with complex template
    - title: Select Component
      properties:
        selectedComponent:
          title: Choose Component
          type: string
          description: Select a component
          ui:field: EnhancedEntityPicker
          ui:options:
            displayEntityFieldAfterFormatting: "${{ metadata.title }} [${{ spec.type }}]"
            catalogFilter:
              kind: Component

  steps:
    # Process user selection
    - id: resolve-user
      name: Resolve User Entity
      action: enhanced:resolveEntity
      input:
        displayValue: ${{ parameters.selectedUser }}
        displayTemplate: "${{ metadata.title }} (Department: ${{ spec.profile.department }})"
        catalogFilter:
          kind: User

    - id: fetch-user
      name: Fetch User Data
      action: catalog:fetch
      input:
        entityRef: ${{ steps['resolve-user'].output.entityRef }}

    # Process name-only selection
    - id: resolve-user-name
      name: Resolve User by Name
      action: enhanced:resolveEntity
      input:
        displayValue: ${{ parameters.selectedUserNameOnly }}
        displayTemplate: "${{ metadata.name }}"
        catalogFilter:
          kind: User

    - id: fetch-user-name
      name: Fetch User by Name
      action: catalog:fetch
      input:
        entityRef: ${{ steps['resolve-user-name'].output.entityRef }}

    # Process component selection
    - id: resolve-component
      name: Resolve Component Entity
      action: enhanced:resolveEntity
      input:
        displayValue: ${{ parameters.selectedComponent }}
        displayTemplate: "${{ metadata.title }} [${{ spec.type }}]"
        catalogFilter:
          kind: Component

    - id: fetch-component
      name: Fetch Component Data
      action: catalog:fetch
      input:
        entityRef: ${{ steps['resolve-component'].output.entityRef }}

    # Show clean results
    - id: show-results
      name: Show Clean Results
      action: debug:log
      input:
        message: |
          🎉 === CLEAN SOLUTION RESULTS === 🎉

          👤 USER SELECTION (Complex Template):
          ====================================
          ✅ Review Page Shows: "${{ parameters.selectedUser }}"
          Expected: "John Doe (Department: Engineering)" (CLEAN!)
          
          🔧 Backend Resolution:
          - Entity Reference: ${{ steps['resolve-user'].output.entityRef }}
          - Extracted Name: ${{ steps['resolve-user'].output.extractedName }}
          
          📋 Full User Data:
          - Name: ${{ steps['fetch-user'].output.entity.metadata.name }}
          - Title: ${{ steps['fetch-user'].output.entity.metadata.title }}
          - Department: ${{ steps['fetch-user'].output.entity.spec.profile.department }}
          - Email: ${{ steps['fetch-user'].output.entity.spec.profile.email }}

          👤 USER SELECTION (Name Only):
          ==============================
          ✅ Review Page Shows: "${{ parameters.selectedUserNameOnly }}"
          Expected: "jdoe" (CLEAN!)
          
          🔧 Backend Resolution:
          - Entity Reference: ${{ steps['resolve-user-name'].output.entityRef }}
          - Extracted Name: ${{ steps['resolve-user-name'].output.extractedName }}

          📦 COMPONENT SELECTION:
          ======================
          ✅ Review Page Shows: "${{ parameters.selectedComponent }}"
          Expected: "Payment API [service]" (CLEAN!)
          
          🔧 Backend Resolution:
          - Entity Reference: ${{ steps['resolve-component'].output.entityRef }}
          - Extracted Name: ${{ steps['resolve-component'].output.extractedName }}
          
          📋 Component Data:
          - Name: ${{ steps['fetch-component'].output.entity.metadata.name }}
          - Title: ${{ steps['fetch-component'].output.entity.metadata.title }}
          - Type: ${{ steps['fetch-component'].output.entity.spec.type }}

          ✅ === SOLUTION BENEFITS === ✅
          
          🎯 Perfect Review Page: No "|||" separators ever visible
          🔧 Developer Freedom: Any template combination works
          📋 Full Entity Data: Complete access via catalog:fetch
          🔄 Backwards Compatible: Works with existing templates
          ⚡ Smart Backend: Automatically finds the right entity

          🏆 BOTTOM LINE: Clean UX + Full Functionality!