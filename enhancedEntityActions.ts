// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";
import { CatalogClient } from "@backstage/catalog-client";

// FIXED: The full entity resolution action with proper authentication
export const resolveEntityFromDisplayAction = (options: { discovery: any }) => {
  const { discovery } = options;

  return createTemplateAction<{
    displayValue: string;
    displayTemplate: string;
    catalogFilter?: any;
  }>({
    id: "enhanced:resolveEntity",
    description:
      "Resolve entity data from ANY display format by searching catalog",
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
            description: "Template used to format the display",
          },
          catalogFilter: {
            type: "object",
            title: "Catalog Filter",
            description: "Filter to narrow down entity search",
          },
        },
      },
      output: {
        type: "object",
        properties: {
          entity: {
            type: "object",
            title: "Complete Entity",
            description: "Full entity object with ALL properties",
          },
          entityRef: {
            type: "string",
            title: "Entity Reference",
            description: "Entity reference string",
          },
          metadata: {
            type: "object",
            title: "Entity Metadata",
            description: "Entity metadata for quick access",
          },
          spec: {
            type: "object",
            title: "Entity Spec",
            description: "Entity spec for quick access",
          },
        },
      },
    },
    async handler(ctx) {
      const { displayValue, displayTemplate, catalogFilter = {} } = ctx.input;

      try {
        ctx.logger.info(
          `Resolving entity: "${displayValue}" with template: "${displayTemplate}"`
        );

        // FIXED: Create catalog client with proper authentication from context
        const catalogApi = new CatalogClient({
          discoveryApi: discovery,
          fetchApi: ctx, // Use the authenticated fetch from context
        });

        // Build filter for entity search
        const filter: any = {};
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

        ctx.logger.info(`Using catalog filter: ${JSON.stringify(filter)}`);

        // Fetch entities
        const response = await catalogApi.getEntities({ filter });
        ctx.logger.info(`Found ${response.items.length} entities in catalog`);

        // Generic function to format entity display (same logic as component)
        const formatEntityDisplay = (template: string, entity: any): string => {
          return template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
            const trimmedPath = path.trim();
            const value = trimmedPath
              .split(".")
              .reduce((obj: any, key: string) => {
                return obj && obj[key] !== undefined ? obj[key] : "";
              }, entity);
            return value || "";
          });
        };

        // Find entity that matches the display value
        const matchingEntity = response.items.find((entity) => {
          const formattedDisplay = formatEntityDisplay(displayTemplate, entity);
          const matches = formattedDisplay === displayValue;
          if (matches) {
            ctx.logger.info(
              `✅ Found matching entity: ${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`
            );
          }
          return matches;
        });

        if (!matchingEntity) {
          ctx.logger.error(
            `❌ Could not find entity matching display value: "${displayValue}"`
          );
          ctx.logger.info(`Template used: "${displayTemplate}"`);
          ctx.logger.info(`Available entities (first 10):`);

          response.items.slice(0, 10).forEach((entity) => {
            const formatted = formatEntityDisplay(displayTemplate, entity);
            ctx.logger.info(
              `  - Formatted: "${formatted}" | Entity: ${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`
            );
          });

          throw new Error(
            `Could not find entity matching display value: "${displayValue}". Found ${response.items.length} total entities.`
          );
        }

        const entityRef = `${matchingEntity.kind.toLowerCase()}:${
          matchingEntity.metadata.namespace || "default"
        }/${matchingEntity.metadata.name}`;

        ctx.logger.info(`✅ Successfully resolved entity: ${entityRef}`);

        // Output the results
        ctx.output("entity", matchingEntity);
        ctx.output("entityRef", entityRef);
        ctx.output("metadata", matchingEntity.metadata);
        ctx.output("spec", matchingEntity.spec || {});
      } catch (error) {
        ctx.logger.error(`Error resolving entity: ${error}`);
        throw new Error(
          `Failed to resolve entity: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
  });
};

// Debug action to show available entity properties
export const debugEntityPropertiesAction = () => {
  return createTemplateAction<{
    entity: any;
  }>({
    id: "enhanced:debugEntity",
    description: "Debug action to show all available properties of an entity",
    schema: {
      input: {
        type: "object",
        required: ["entity"],
        properties: {
          entity: {
            type: "object",
            title: "Entity",
            description: "Entity object to debug",
          },
        },
      },
    },
    async handler(ctx) {
      const { entity } = ctx.input;

      if (!entity || typeof entity !== "object") {
        ctx.logger.error("Invalid entity provided for debugging");
        return;
      }

      const getObjectStructure = (
        obj: any,
        prefix = "",
        maxDepth = 3,
        currentDepth = 0
      ): string[] => {
        if (!obj || typeof obj !== "object" || currentDepth >= maxDepth)
          return [];

        const keys: string[] = [];
        Object.keys(obj).forEach((key) => {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          keys.push(fullKey);

          if (
            typeof obj[key] === "object" &&
            obj[key] !== null &&
            !Array.isArray(obj[key])
          ) {
            keys.push(
              ...getObjectStructure(
                obj[key],
                fullKey,
                maxDepth,
                currentDepth + 1
              )
            );
          }
        });
        return keys;
      };

      try {
        const availableProperties = getObjectStructure(entity);

        ctx.logger.info(
          `🔍 ENTITY DEBUG - ${entity.kind}:${
            entity.metadata?.namespace || "default"
          }/${entity.metadata?.name}`
        );
        ctx.logger.info(
          `📋 Available properties (${availableProperties.length}):`
        );

        availableProperties.slice(0, 50).forEach((prop) => {
          ctx.logger.info(`   - ${prop}`);
        });

        if (availableProperties.length > 50) {
          ctx.logger.info(
            `   ... and ${availableProperties.length - 50} more properties`
          );
        }

        if (availableProperties.length > 0) {
          ctx.logger.info(
            `\n💡 Access properties in templates using: $\{{ steps['step-name'].output.entity.${availableProperties[0]} }}`
          );
        }
      } catch (error) {
        ctx.logger.error(`Error debugging entity: ${error}`);
      }
    },
  });
};

// Simple action that extracts entityRef from display format - ALSO FIXED
export const extractEntityRefAction = (options: { discovery: any }) => {
  const { discovery } = options;

  return createTemplateAction<{
    displayValue: string;
    displayTemplate: string;
    catalogFilter?: any;
  }>({
    id: "enhanced:extractEntityRef",
    description:
      "Extract entity reference from display format for use with catalog:fetch",
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
            description: "Template used to format the display",
          },
          catalogFilter: {
            type: "object",
            title: "Catalog Filter",
            description: "Filter to narrow down entity search",
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
            description: "Extracted entity name",
          },
        },
      },
    },
    async handler(ctx) {
      const { displayValue, displayTemplate, catalogFilter = {} } = ctx.input;

      try {
        ctx.logger.info(`Extracting entity reference from: "${displayValue}"`);

        // FIXED: Use the same catalog search approach as resolveEntity
        const catalogApi = new CatalogClient({
          discoveryApi: discovery,
          fetchApi: ctx, // Use authenticated fetch from context
        });

        // Build filter
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

        // Fetch entities and find match
        const response = await catalogApi.getEntities({ filter });

        const formatEntityDisplay = (template: string, entity: any): string => {
          return template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
            const trimmedPath = path.trim();
            const value = trimmedPath
              .split(".")
              .reduce((obj: any, key: string) => {
                return obj && obj[key] !== undefined ? obj[key] : "";
              }, entity);
            return value || "";
          });
        };

        const matchingEntity = response.items.find((entity) => {
          const formattedDisplay = formatEntityDisplay(displayTemplate, entity);
          return formattedDisplay === displayValue;
        });

        if (!matchingEntity) {
          throw new Error(
            `Could not find entity matching display value: "${displayValue}"`
          );
        }

        const entityRef = `${matchingEntity.kind.toLowerCase()}:${
          matchingEntity.metadata.namespace || "default"
        }/${matchingEntity.metadata.name}`;

        ctx.logger.info(`✅ Extracted entity reference: ${entityRef}`);

        ctx.output("entityRef", entityRef);
        ctx.output("extractedName", matchingEntity.metadata.name);
      } catch (error) {
        ctx.logger.error(`Error extracting entity reference: ${error}`);
        throw new Error(
          `Failed to extract entity reference: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
  });
};

// Alternative: Parse email from display format - NO CHANGES NEEDED
export const extractEmailFromDisplayAction = () => {
  return createTemplateAction<{
    displayValue: string;
  }>({
    id: "enhanced:extractEmail",
    description:
      'Extract email and name from display format like "Name (email@domain.com)"',
    schema: {
      input: {
        type: "object",
        required: ["displayValue"],
        properties: {
          displayValue: {
            type: "string",
            title: "Display Value",
            description: "Display value containing email in parentheses",
          },
        },
      },
      output: {
        type: "object",
        properties: {
          email: {
            type: "string",
            title: "Extracted Email",
          },
          name: {
            type: "string",
            title: "Extracted Name",
          },
          entityRef: {
            type: "string",
            title: "Entity Reference",
            description: "Guessed entity reference based on email",
          },
        },
      },
    },
    async handler(ctx) {
      const { displayValue } = ctx.input;

      try {
        const emailMatch = displayValue.match(/\(([^)]+)\)/);
        const nameMatch = displayValue.match(/^([^(]+)/);

        const email = emailMatch ? emailMatch[1].trim() : "";
        const name = nameMatch ? nameMatch[1].trim() : "";

        let entityRef = "";
        if (email) {
          const emailUsername = email.split("@")[0];
          entityRef = `user:default/${emailUsername}`;
        } else if (name) {
          const cleanName = name.toLowerCase().replace(/\s+/g, ".");
          entityRef = `user:default/${cleanName}`;
        }

        ctx.output("email", email);
        ctx.output("name", name);
        ctx.output("entityRef", entityRef);
      } catch (error) {
        ctx.logger.error(`Error extracting email: ${error}`);
        throw new Error(
          `Failed to extract email: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
  });
};
