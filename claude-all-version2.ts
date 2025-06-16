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
      catalogFilter?: CatalogFilter;
      placeholder?: string;
    }
  > {}

// Formats the display of an entity based on a template string
// ( replace ${} expressions with entity data
const formatEntityDisplay = (template: string, entity: Entity): string => {
  return template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
    const trimmedPath = path.trim();

    // Handle nested object access like metadata.name, spec.profile.email
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
}: EnhancedEntityPickerProps) => {
  const catalogApi = useApi(catalogApiRef);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  // Extract configuration from uiSchema
  const displayTemplate =
    uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
    "${{ metadata.name }}";
  const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
  const placeholder =
    uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

  // Fetch entities from catalog
  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const filter: any = {};

      // Apply catalog filter
      if (catalogFilter.kind) {
        filter.kind = catalogFilter.kind;
      }
      if (catalogFilter.type) {
        filter["spec.type"] = catalogFilter.type;
      }

      // Add any additional filters
      Object.keys(catalogFilter).forEach((key) => {
        if (key !== "kind" && key !== "type") {
          filter[key] = catalogFilter[key];
        }
      });

      const response = await catalogApi.getEntities({
        filter,
      });

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

  // Find the currently selected entity based on formData (clean display format)
  useEffect(() => {
    if (formData && entities.length > 0) {
      const found = entities.find((entity) => {
        const displayValue = formatEntityDisplay(displayTemplate, entity);
        return displayValue === formData;
      });
      setSelectedEntity(found || null);
    } else {
      setSelectedEntity(null);
    }
  }, [formData, entities, displayTemplate]);

  const handleChange = (event: any, newValue: Entity | null) => {
    if (newValue) {
      const displayValue = formatEntityDisplay(displayTemplate, newValue);

      // Store ONLY the clean display format
      // This is what user sees everywhere: dropdown, field, review
      onChange(displayValue);
      setSelectedEntity(newValue);

      // Store entity data for debugging/development only
      if (
        typeof window !== "undefined" &&
        process.env.NODE_ENV === "development"
      ) {
        window.enhancedEntityPickerDebug =
          window.enhancedEntityPickerDebug || {};
        const fieldName =
          schema.title?.toLowerCase().replace(/\s+/g, "") || "entity";
        window.enhancedEntityPickerDebug[fieldName] = {
          displayValue,
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

  // Create display options with deduplication
  const displayOptions = entities
    .map((entity) => ({
      entity,
      displayText: formatEntityDisplay(displayTemplate, entity),
      entityId:
        entity.metadata.uid ||
        `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`,
    }))
    // Remove duplicates by entityId
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
            // helperText={rawErrors?.length ? rawErrors[0] : schema.description}
            variant="outlined"
            fullWidth
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Box>
              <Box sx={{ fontWeight: "medium" }}>{option.displayText}</Box>
              {/* Only show description if it exists, NO entityRef */}
              {/* {option.entity.metadata.description && (
                <Box sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                  {option.entity.metadata.description}
                </Box>
              )} */}
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
          <strong>Debug Info:</strong>
          <div>Dropdown Options: {displayOptions.length}</div>
          {selectedEntity && (
            <div style={{ marginTop: "4px" }}>
              <div>
                ✅ User sees: "
                {formatEntityDisplay(displayTemplate, selectedEntity)}"
              </div>
              <div>
                🔧 EntityRef: {selectedEntity.kind.toLowerCase()}:
                {selectedEntity.metadata.namespace || "default"}/
                {selectedEntity.metadata.name}
              </div>
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


// action 

// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";
import { CatalogClient } from '@backstage/catalog-client';
import { DiscoveryApi } from '@backstage/core-plugin-api';

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

// ENHANCED ACTION: Supports both template parsing AND entity lookup
export const resolveEntityFromDisplayAction = (options: { discovery: DiscoveryApi }) => {
  return createTemplateAction<{
    displayValue: string;
    displayTemplate: string;
    catalogFilter?: any;
    entityNamespace?: string;
  }>({
    id: "enhanced:resolveEntity",
    description:
      "Extract entity reference from display format (supports both template parsing and entity lookup)",
    schema: {
      input: {
        type: "object",
        required: ["displayValue", "displayTemplate"],
        properties: {
          displayValue: {
            type: "string",
            title: "Display Value",
            description: "The display value from EnhancedEntityPicker",
          },
          displayTemplate: {
            type: "string",
            title: "Display Template",
            description:
              "Template used to format the display (metadata.name optional)",
          },
          catalogFilter: {
            type: "object",
            title: "Catalog Filter",
            description:
              "Filter from EnhancedEntityPicker (contains entity kind)",
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
            description: "Entity reference for use with catalog:fetch",
          },
          extractedName: {
            type: "string",
            title: "Extracted Name",
            description: "Extracted entity name (metadata.name)",
          },
          parsedValues: {
            type: "object",
            title: "Parsed Values",
            description: "All values extracted from the template",
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
            description: "How the entity was resolved: 'template-parsing' or 'entity-lookup'",
          },
        },
      },
    },
    async handler(ctx: any) {
      const {
        displayValue,
        displayTemplate,
        catalogFilter = {},
        entityNamespace,
      } = ctx.input;

      try {
        ctx.logger.info(`🔧 Parsing display value: "${displayValue}"`);
        ctx.logger.info(`🔧 Using template: "${displayTemplate}"`);
        ctx.logger.info(`🔧 Catalog filter: ${JSON.stringify(catalogFilter)}`);

        // Extract entity kind from catalogFilter (REQUIRED)
        const entityKind = catalogFilter.kind;
        if (!entityKind) {
          throw new Error(
            `Entity kind is required but not found in catalogFilter. ` +
              `Received catalogFilter: ${JSON.stringify(catalogFilter)}. ` +
              `Make sure your EnhancedEntityPicker has catalogFilter.kind specified.`
          );
        }

        ctx.logger.info(`🔍 Entity kind from catalogFilter: ${entityKind}`);

        // 🎯 SMART DETECTION: Check if template includes metadata.name
        const hasMetadataName = displayTemplate.includes("metadata.name");
        
        let extractedName: string;
        let parsedValues: { [key: string]: string } = {};
        let method: string;

        if (hasMetadataName) {
          // 📝 METHOD 1: Template Parsing (existing working approach)
          ctx.logger.info(`✅ Template includes metadata.name - using template parsing`);
          method = "template-parsing";

          // Parse the template to extract variable positions
          const parseTemplate = (template: string, value: string) => {
            // Find all variables in template
            const variables: string[] = [];
            const templateRegex = /\$\{\{\s*([^}]+)\s*\}\}/g;
            let match;

            while ((match = templateRegex.exec(template)) !== null) {
              variables.push(match[1].trim());
            }

            ctx.logger.info(
              `🔍 Found template variables: ${variables.join(", ")}`
            );

            // Create regex pattern by replacing variables with capture groups
            let regexPattern = template.replace(
              /\$\{\{\s*([^}]+)\s*\}\}/g,
              "(.+?)"
            );

            // Escape special regex characters except our capture groups
            regexPattern = regexPattern
              .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              .replace(/\\\(\\\.\\\+\\\?\\\)/g, "(.+?)");

            // Make the last capture group non-greedy to handle end of string
            regexPattern = regexPattern.replace(/\(\.\+\?\)$/, "(.+)");

            ctx.logger.info(`🔍 Created regex pattern: ${regexPattern}`);

            // Extract values using the regex
            const regex = new RegExp(regexPattern);
            const valueMatch = value.match(regex);

            if (!valueMatch) {
              throw new Error(
                `Display value "${value}" doesn't match template pattern "${template}"`
              );
            }

            // Map extracted values to variable names
            const extractedValues: { [key: string]: string } = {};
            for (let i = 0; i < variables.length; i++) {
              extractedValues[variables[i]] = valueMatch[i + 1]?.trim() || "";
            }

            return extractedValues;
          };

          // Parse the display value using the template
          parsedValues = parseTemplate(displayTemplate, displayValue);
          ctx.logger.info(`🎯 Parsed values: ${JSON.stringify(parsedValues)}`);

          // Extract the ACTUAL entity name (metadata.name is required here)
          extractedName = parsedValues["metadata.name"];

          if (!extractedName) {
            throw new Error(
              `Could not extract metadata.name from parsed values. ` +
                `Parsed: ${JSON.stringify(parsedValues)}. ` +
                `The template includes metadata.name but parsing failed.`
            );
          }

        } else {
          // 🔍 METHOD 2: Entity Lookup (new approach for templates without metadata.name)
          ctx.logger.info(`🔄 Template does NOT include metadata.name - using entity lookup`);
          method = "entity-lookup";

          // Create catalog client to query entities
          const catalogClient = new CatalogClient({ discoveryApi: options.discovery });

          // Fetch entities matching the filter
          ctx.logger.info(`🔍 Fetching entities with filter: ${JSON.stringify(catalogFilter)}`);
          const response = await catalogClient.getEntities({ filter: catalogFilter });
          const entities = response.items;

          ctx.logger.info(`🔍 Found ${entities.length} entities to check`);

          // Find the entity whose formatted display matches the input
          let matchedEntity = null;
          for (const entity of entities) {
            const formattedDisplay = formatEntityDisplay(displayTemplate, entity);
            
            if (formattedDisplay === displayValue) {
              matchedEntity = entity;
              ctx.logger.info(`✅ Found matching entity: ${entity.metadata.name}`);
              break;
            }
          }

          if (!matchedEntity) {
            // Provide helpful debugging info
            ctx.logger.error(`❌ No entity found matching "${displayValue}"`);
            ctx.logger.info(`🔍 Checked entities and their formatted values:`);
            for (const entity of entities.slice(0, 5)) { // Show first 5 for debugging
              const formattedDisplay = formatEntityDisplay(displayTemplate, entity);
              ctx.logger.info(`   - ${entity.metadata.name}: "${formattedDisplay}"`);
            }
            
            throw new Error(
              `No entity found matching display value "${displayValue}" ` +
                `with template "${displayTemplate}". ` +
                `Checked ${entities.length} entities of kind ${entityKind}.`
            );
          }

          extractedName = matchedEntity.metadata.name;
          
          // Create parsed values for consistency (even though we didn't parse)
          parsedValues = { "metadata.name": extractedName };
        }

        // Use provided namespace or fall back to "default"
        const resolvedNamespace = entityNamespace || "default";

        if (entityNamespace) {
          ctx.logger.info(
            `✅ Using provided namespace: "${resolvedNamespace}"`
          );
        } else {
          ctx.logger.info(`ℹ️ Using default namespace: "${resolvedNamespace}"`);
        }

        // Create entity reference using the extracted entity name and resolved namespace
        const entityRef = `${entityKind.toLowerCase()}:${resolvedNamespace}/${extractedName}`;

        ctx.logger.info(`✅ Resolution method: ${method}`);
        ctx.logger.info(
          `✅ Extracted entity name: "${extractedName}"`
        );
        ctx.logger.info(`✅ Entity kind: ${entityKind}`);
        ctx.logger.info(`✅ Entity reference: ${entityRef}`);

        ctx.output("entityRef", entityRef);
        ctx.output("extractedName", extractedName);
        ctx.output("parsedValues", parsedValues);
        ctx.output("entityKind", entityKind);
        ctx.output("entityNamespace", resolvedNamespace);
        ctx.output("method", method);
        
      } catch (error: any) {
        ctx.logger.error(`❌ Error: ${error.message}`);
        throw new Error(`Failed to extract entity reference: ${error.message}`);
      }
    },
  });
};

// module.ts

// packages/backend/src/plugins/scaffolder/module.ts

import {
    coreServices,
    createBackendModule,
  } from "@backstage/backend-plugin-api";
  import { scaffolderActionsExtensionPoint } from "@backstage/plugin-scaffolder-node/alpha";
  import { dataAuroraClusterCreateAction } from "./actions/dataAuroraClusterCreate";
  import { resolveEntityFromDisplayAction } from "./actions/enhancedEntityActions";
  
  const cloudExperienceScaffolderModule = createBackendModule({
    moduleId: "cloud-experience",
    pluginId: "scaffolder",
    register({ registerInit }) {
      registerInit({
        deps: {
          config: coreServices.rootConfig,
          discovery: coreServices.discovery,
          scaffolder: scaffolderActionsExtensionPoint,
        },
        init: async ({ config, discovery, scaffolder }) => {
          // Register your existing action
          scaffolder.addActions(
            dataAuroraClusterCreateAction({ config, discovery })
          );
  
          // Register the enhanced entity picker action WITH discovery service (needed for entity lookup)
          scaffolder.addActions(resolveEntityFromDisplayAction({ discovery }));
        },
      });
    },
  });
  
  export { cloudExperienceScaffolderModule };

  // yaml

  # HYBRID TEMPLATE - Demonstrates both template parsing and entity lookup

apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: hybrid-enhanced-entity-picker
  title: Hybrid Enhanced Entity Picker
  description: Shows both approaches - with and without metadata.name requirement
spec:
  owner: wg119310
  type: service

  parameters:
    # APPROACH 1: Developer includes metadata.name (template parsing)
    - title: "Traditional Approach (Template Parsing)"
      properties:
        selectedUserWithName:
          title: Choose User (With metadata.name)
          type: string
          description: "Uses template parsing approach"
          ui:field: EnhancedEntityPicker
          ui:options:
            # ✅ INCLUDES metadata.name - will use template parsing
            displayEntityFieldAfterFormatting: "${{ metadata.name }} - ${{ metadata.title }} - ${{ spec.profile.department }}"
            catalogFilter:
              kind: User

    # APPROACH 2: Developer excludes metadata.name (entity lookup) 
    - title: "New Approach (Entity Lookup)"
      properties:
        selectedUserWithoutName:
          title: Choose User (Clean Display)
          type: string
          description: "Uses entity lookup approach"
          ui:field: EnhancedEntityPicker
          ui:options:
            # 🎉 NO metadata.name required - will use entity lookup  
            displayEntityFieldAfterFormatting: "${{ metadata.title }} (Department: ${{ spec.profile.department }})"
            catalogFilter:
              kind: User

    # APPROACH 3: Simple template (entity lookup)
    - title: "Simplest Approach"
      properties:
        selectedUserSimple:
          title: Choose User (Title Only)
          type: string
          description: "Shows just the title"
          ui:field: EnhancedEntityPicker
          ui:options:
            # 🎯 SUPER SIMPLE - just title
            displayEntityFieldAfterFormatting: "${{ metadata.title }}"
            catalogFilter:
              kind: User

  steps:
    # Process traditional approach (template parsing)
    - id: extract-user-with-name
      name: Extract User (Template Parsing)
      action: enhanced:resolveEntity
      input:
        displayValue: ${{ parameters.selectedUserWithName }}
        displayTemplate: "${{ metadata.name }} - ${{ metadata.title }} - ${{ spec.profile.department }}"
        catalogFilter:
          kind: User

    - id: fetch-user-with-name
      name: Fetch User Data (Template Parsing)
      action: catalog:fetch
      input:
        entityRef: ${{ steps['extract-user-with-name'].output.entityRef }}

    # Process new approach (entity lookup)
    - id: extract-user-without-name
      name: Extract User (Entity Lookup)
      action: enhanced:resolveEntity
      input:
        displayValue: ${{ parameters.selectedUserWithoutName }}
        displayTemplate: "${{ metadata.title }} (Department: ${{ spec.profile.department }})"
        catalogFilter:
          kind: User

    - id: fetch-user-without-name
      name: Fetch User Data (Entity Lookup)
      action: catalog:fetch
      input:
        entityRef: ${{ steps['extract-user-without-name'].output.entityRef }}

    # Process simple approach (entity lookup)
    - id: extract-user-simple
      name: Extract User (Simple)
      action: enhanced:resolveEntity
      input:
        displayValue: ${{ parameters.selectedUserSimple }}
        displayTemplate: "${{ metadata.title }}"
        catalogFilter:
          kind: User

    - id: fetch-user-simple
      name: Fetch User Data (Simple)
      action: catalog:fetch
      input:
        entityRef: ${{ steps['extract-user-simple'].output.entityRef }}

    # Show comparison results
    - id: show-comparison
      name: Show Hybrid Results
      action: debug:log
      input:
        message: |
          🎯 === HYBRID APPROACH RESULTS === 🎯

          📋 APPROACH 1: Template Parsing (With metadata.name)
          ===================================================
          User Selected: "${{ parameters.selectedUserWithName }}"
          Expected Format: "jdoe - John Doe - Engineering"
          Resolution Method: ${{ steps['extract-user-with-name'].output.method }}
          
          🔧 Backend Processing:
          - Entity Reference: ${{ steps['extract-user-with-name'].output.entityRef }}
          - Extracted Name: ${{ steps['extract-user-with-name'].output.extractedName }}
          - Parsed Values: ${{ steps['extract-user-with-name'].output.parsedValues }}
          
          📋 Full User Data:
          - Name: ${{ steps['fetch-user-with-name'].output.entity.metadata.name }}
          - Title: ${{ steps['fetch-user-with-name'].output.entity.metadata.title }}
          - Department: ${{ steps['fetch-user-with-name'].output.entity.spec.profile.department }}

          📋 APPROACH 2: Entity Lookup (Without metadata.name)
          ====================================================
          User Selected: "${{ parameters.selectedUserWithoutName }}"
          Expected Format: "John Doe (Department: Engineering)"
          Resolution Method: ${{ steps['extract-user-without-name'].output.method }}
          
          🔧 Backend Processing:
          - Entity Reference: ${{ steps['extract-user-without-name'].output.entityRef }}
          - Extracted Name: ${{ steps['extract-user-without-name'].output.extractedName }}
          
          📋 Full User Data:
          - Name: ${{ steps['fetch-user-without-name'].output.entity.metadata.name }}
          - Title: ${{ steps['fetch-user-without-name'].output.entity.metadata.title }}
          - Department: ${{ steps['fetch-user-without-name'].output.entity.spec.profile.department }}

          📋 APPROACH 3: Simple Display (Entity Lookup)
          ==============================================
          User Selected: "${{ parameters.selectedUserSimple }}"
          Expected Format: "John Doe"
          Resolution Method: ${{ steps['extract-user-simple'].output.method }}
          
          🔧 Backend Processing:
          - Entity Reference: ${{ steps['extract-user-simple'].output.entityRef }}
          - Extracted Name: ${{ steps['extract-user-simple'].output.extractedName }}

          ✅ === SUCCESS CRITERIA === ✅
          
          🎯 All Review Pages: Should show clean values (no separators)
          🔧 All Entity References: Should be valid format "kind:namespace/name"
          📋 All catalog:fetch: Should succeed and return full entity data
          🔄 Backwards Compatibility: Existing templates still work
          🎉 Developer Freedom: New templates don't need metadata.name

          💡 === DEVELOPER BENEFITS === 💡
          
          👥 For Users: Always see clean, readable display values
          👨‍💻 For Developers: Choose your preferred template approach
          🏢 For Teams: Mix both approaches as needed
          📈 For Migration: Gradual adoption of cleaner templates