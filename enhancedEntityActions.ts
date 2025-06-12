// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";
import { CatalogClient } from "@backstage/catalog-client";

// ADD THIS: The full entity resolution action for composite templates
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

        // Create catalog client with discovery
        const catalogApi = new CatalogClient({
          discoveryApi: discovery,
          fetchApi: { fetch },
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

// Simple action that extracts entityRef from display format
export const extractEntityRefAction = () => {
  return createTemplateAction<{
    displayValue: string;
    displayTemplate: string;
    entityKind?: string;
    entityNamespace?: string;
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
          entityKind: {
            type: "string",
            title: "Entity Kind",
            description: "Expected entity kind (User, Component, etc.)",
            default: "User",
          },
          entityNamespace: {
            type: "string",
            title: "Entity Namespace",
            description: "Expected entity namespace",
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
          extractedName: {
            type: "string",
            title: "Extracted Name",
            description: "Extracted entity name",
          },
        },
      },
    },
    async handler(ctx) {
      const {
        displayValue,
        displayTemplate,
        entityKind = "User",
        entityNamespace = "default",
      } = ctx.input;

      try {
        ctx.logger.info(`Extracting entity reference from: "${displayValue}"`);

        // Parse different display template patterns
        let extractedName = "";

        // Pattern 1: "Name [Kind]" -> extract Name
        const kindBracketMatch = displayValue.match(/^(.+?)\s*\[.+\]$/);
        if (kindBracketMatch) {
          extractedName = kindBracketMatch[1].trim();
        }
        // Pattern 2: "Name (email)" -> extract Name
        else if (displayValue.includes("(") && displayValue.includes(")")) {
          const emailParenMatch = displayValue.match(/^(.+?)\s*\(/);
          if (emailParenMatch) {
            extractedName = emailParenMatch[1].trim();
          }
        }
        // Pattern 3: Just the name
        else {
          extractedName = displayValue.trim();
        }

        if (!extractedName) {
          throw new Error(
            `Could not extract entity name from display value: "${displayValue}"`
          );
        }

        // Convert name to entity reference format
        const entityName = extractedName
          .toLowerCase()
          .replace(/\s+/g, ".")
          .replace(/[^a-z0-9.\-_]/g, "");

        const entityRef = `${entityKind.toLowerCase()}:${entityNamespace}/${entityName}`;

        ctx.logger.info(`✅ Extracted entity reference: ${entityRef}`);

        ctx.output("entityRef", entityRef);
        ctx.output("extractedName", extractedName);
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

// Alternative: Parse email from display format
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
