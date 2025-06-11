// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";
import { CatalogClient } from "@backstage/catalog-client";
import { DiscoveryService } from "@backstage/backend-plugin-api";

// Generic action to resolve ANY entity from display format
export const resolveEntityFromDisplayAction = (options: {
  discovery: DiscoveryService;
}) => {
  const { discovery } = options;

  return createTemplateAction<{
    displayValue: string;
    displayTemplate: string;
    catalogFilter?: any;
  }>({
    id: "enhanced:resolveEntity",
    description:
      "Resolve entity data from EnhancedEntityPicker display format - works with ANY entity type",
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
              'Template used to format the display (e.g., "${{ metadata.name }}" or "${{ spec.definition.openapi }}")',
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

      // Create catalog API client - CORRECTED
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

      const response = await catalogApi.getEntities({ filter });

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

      // Find entity that matches the display value - GENERIC approach
      const matchingEntity = response.items.find((entity) => {
        const formattedDisplay = formatEntityDisplay(displayTemplate, entity);
        return formattedDisplay === displayValue;
      });

      if (!matchingEntity) {
        throw new Error(
          `Could not find entity matching display value: "${displayValue}" using template: "${displayTemplate}". Found ${response.items.length} entities in catalog with the given filter.`
        );
      }

      const entityRef = `${matchingEntity.kind.toLowerCase()}:${
        matchingEntity.metadata.namespace || "default"
      }/${matchingEntity.metadata.name}`;

      ctx.logger.info(
        `✅ Resolved entity: ${entityRef} from display: "${displayValue}"`
      );
      ctx.logger.info(
        `📋 Entity type: ${matchingEntity.kind}, Available properties: metadata, spec, apiVersion, kind`
      );

      // CORRECTED - Use ctx.output() instead of return
      ctx.output("entity", matchingEntity); // Complete entity object - access ANY property
      ctx.output("entityRef", entityRef); // Entity reference for Backstage relationships
      ctx.output("metadata", matchingEntity.metadata); // Quick access to metadata
      ctx.output("spec", matchingEntity.spec || {}); // Quick access to spec (if exists)
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

      const getObjectStructure = (obj: any, prefix = ""): string[] => {
        if (!obj || typeof obj !== "object") return [];

        const keys: string[] = [];
        Object.keys(obj).forEach((key) => {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          keys.push(fullKey);

          if (
            typeof obj[key] === "object" &&
            obj[key] !== null &&
            !Array.isArray(obj[key])
          ) {
            keys.push(...getObjectStructure(obj[key], fullKey));
          }
        });
        return keys;
      };

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

      ctx.logger.info(
        `\n💡 Access any property in templates using: $\{{ steps['step-name'].output.entity.${availableProperties[0]} }}`
      );
    },
  });
};
