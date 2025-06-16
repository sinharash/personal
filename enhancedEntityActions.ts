// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";
import { CatalogClient } from "@backstage/catalog-client";

// SINGLE ACTION: Extract entity reference using template parsing with metadata.name requirement
export const resolveEntityFromDisplayAction = () => {
  return createTemplateAction<{
    displayValue: string;
    displayTemplate: string;
    catalogFilter?: any;
    entityNamespace?: string;
  }>({
    id: "enhanced:resolveEntity",
    description:
      "Extract entity reference from display format (requires metadata.name in template)",
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
              "Template used to format the display (must include metadata.name)",
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
            description: "Expected entity namespace (optional)",
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

        // Validate that template includes metadata.name (REQUIRED)
        if (!displayTemplate.includes("metadata.name")) {
          throw new Error(
            `Template must include 'metadata.name' to extract actual entity name. ` +
              `Current template: "${displayTemplate}". ` +
              `metadata.name is required for catalog:fetch to work properly.`
          );
        }

        // Extract entity kind from catalogFilter (REQUIRED - not hardcoded)
        const entityKind = catalogFilter.kind;

        if (!entityKind) {
          throw new Error(
            `Entity kind is required but not found in catalogFilter. ` +
              `Received catalogFilter: ${JSON.stringify(catalogFilter)}. ` +
              `Make sure your EnhancedEntityPicker has catalogFilter.kind specified.`
          );
        }

        ctx.logger.info(`🔍 Entity kind from catalogFilter: ${entityKind}`);

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
        const parsedValues = parseTemplate(displayTemplate, displayValue);
        ctx.logger.info(`🎯 Parsed values: ${JSON.stringify(parsedValues)}`);

        // Extract the ACTUAL entity name (metadata.name is required - no fallbacks!)
        const extractedName = parsedValues["metadata.name"];

        if (!extractedName) {
          throw new Error(
            `Could not extract metadata.name from parsed values. ` +
              `Parsed: ${JSON.stringify(parsedValues)}. ` +
              `The template must include metadata.name and your display value must match the template exactly.`
          );
        }

        // Try to lookup entity in catalog to get the correct namespace
        let resolvedNamespace = entityNamespace;

        // If no namespace was provided, attempt to look it up
        if (!resolvedNamespace) {
          try {
            // If we have a discovery service in context, use it to create a catalog client
            if (ctx.discovery) {
              const catalogClient = new CatalogClient({
                discoveryApi: ctx.discovery,
              });

              // Look up the entity by name and kind
              const entities = await catalogClient.getEntities({
                filter: {
                  kind: entityKind,
                  "metadata.name": extractedName,
                },
              });

              // If we found exactly one entity, use its namespace
              if (entities.items.length === 1) {
                resolvedNamespace = entities.items[0].metadata.namespace;
                ctx.logger.info(
                  `✅ Found entity in catalog, namespace: ${resolvedNamespace}`
                );
              } else if (entities.items.length > 1) {
                // If we found multiple entities with the same name, log a warning
                ctx.logger.warn(
                  `⚠️ Found multiple entities with name: ${extractedName}`
                );
                // List the entities we found with their namespaces
                entities.items.forEach((entity) => {
                  ctx.logger.warn(
                    `  - ${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`
                  );
                });
                // Use the first one's namespace
                resolvedNamespace = entities.items[0].metadata.namespace;
                ctx.logger.warn(
                  `⚠️ Using namespace from first entity: ${resolvedNamespace}`
                );
              } else {
                ctx.logger.warn(
                  `⚠️ Entity not found in catalog: ${entityKind}:*/${extractedName}`
                );
              }
            } else {
              ctx.logger.warn(
                "⚠️ No discovery service available, cannot look up entity namespace"
              );
            }
          } catch (error) {
            ctx.logger.warn(`⚠️ Error looking up entity namespace: ${error}`);
          }
        }

        // Fallback to "default" namespace if we couldn't resolve one
        if (!resolvedNamespace) {
          resolvedNamespace = "default";
          ctx.logger.info(`ℹ️ Using default namespace: "${resolvedNamespace}"`);
        } else {
          ctx.logger.info(`✅ Using namespace: "${resolvedNamespace}"`);
        }

        // Create entity reference using the REAL entity name and resolved namespace
        const entityRef = `${entityKind.toLowerCase()}:${resolvedNamespace}/${extractedName}`;

        ctx.logger.info(
          `✅ Extracted entity name: "${extractedName}" (from metadata.name)`
        );
        ctx.logger.info(`✅ Entity kind: ${entityKind}`);
        ctx.logger.info(`✅ Entity reference: ${entityRef}`);

        ctx.output("entityRef", entityRef);
        ctx.output("extractedName", extractedName);
        ctx.output("parsedValues", parsedValues);
        ctx.output("entityKind", entityKind);
        ctx.output("entityNamespace", resolvedNamespace);
      } catch (error: any) {
        ctx.logger.error(`❌ Error: ${error.message}`);
        throw new Error(`Failed to extract entity reference: ${error.message}`);
      }
    },
  });
};

// below is working code but always namespace is as default
// // packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

// import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

// // SINGLE ACTION: Extract entity reference using template parsing with metadata.name requirement
// export const resolveEntityFromDisplayAction = () => {
//   return createTemplateAction<{
//     displayValue: string;
//     displayTemplate: string;
//     catalogFilter?: any;
//     entityNamespace?: string;
//   }>({
//     id: "enhanced:resolveEntity",
//     description:
//       "Extract entity reference from display format (requires metadata.name in template)",
//     schema: {
//       input: {
//         type: "object",
//         required: ["displayValue", "displayTemplate"],
//         properties: {
//           displayValue: {
//             type: "string",
//             title: "Display Value",
//             description: "The display value from EnhancedEntityPicker",
//           },
//           displayTemplate: {
//             type: "string",
//             title: "Display Template",
//             description:
//               "Template used to format the display (must include metadata.name)",
//           },
//           catalogFilter: {
//             type: "object",
//             title: "Catalog Filter",
//             description:
//               "Filter from EnhancedEntityPicker (contains entity kind)",
//           },
//           entityNamespace: {
//             type: "string",
//             title: "Entity Namespace",
//             description: "Expected entity namespace",
//             default: "default",
//           },
//         },
//       },
//       output: {
//         type: "object",
//         properties: {
//           entityRef: {
//             type: "string",
//             title: "Entity Reference",
//             description: "Entity reference for use with catalog:fetch",
//           },
//           extractedName: {
//             type: "string",
//             title: "Extracted Name",
//             description: "Extracted entity name (metadata.name)",
//           },
//           parsedValues: {
//             type: "object",
//             title: "Parsed Values",
//             description: "All values extracted from the template",
//           },
//           entityKind: {
//             type: "string",
//             title: "Entity Kind",
//             description: "Extracted entity kind from catalogFilter",
//           },
//         },
//       },
//     },
//     async handler(ctx: any) {
//       const {
//         displayValue,
//         displayTemplate,
//         catalogFilter = {},
//         entityNamespace = "default",
//       } = ctx.input;

//       try {
//         ctx.logger.info(`🔧 Parsing display value: "${displayValue}"`);
//         ctx.logger.info(`🔧 Using template: "${displayTemplate}"`);
//         ctx.logger.info(`🔧 Catalog filter: ${JSON.stringify(catalogFilter)}`);

//         // Validate that template includes metadata.name (REQUIRED)
//         if (!displayTemplate.includes("metadata.name")) {
//           throw new Error(
//             `Template must include 'metadata.name' to extract actual entity name. ` +
//               `Current template: "${displayTemplate}". ` +
//               `metadata.name is required for catalog:fetch to work properly.`
//           );
//         }

//         // Extract entity kind from catalogFilter (REQUIRED - not hardcoded)
//         const entityKind = catalogFilter.kind;

//         if (!entityKind) {
//           throw new Error(
//             `Entity kind is required but not found in catalogFilter. ` +
//               `Received catalogFilter: ${JSON.stringify(catalogFilter)}. ` +
//               `Make sure your EnhancedEntityPicker has catalogFilter.kind specified.`
//           );
//         }

//         ctx.logger.info(`🔍 Entity kind from catalogFilter: ${entityKind}`);

//         // Parse the template to extract variable positions
//         const parseTemplate = (template: string, value: string) => {
//           // Find all variables in template
//           const variables: string[] = [];
//           const templateRegex = /\$\{\{\s*([^}]+)\s*\}\}/g;
//           let match;

//           while ((match = templateRegex.exec(template)) !== null) {
//             variables.push(match[1].trim());
//           }

//           ctx.logger.info(
//             `🔍 Found template variables: ${variables.join(", ")}`
//           );

//           // Create regex pattern by replacing variables with capture groups
//           let regexPattern = template.replace(
//             /\$\{\{\s*([^}]+)\s*\}\}/g,
//             "(.+?)"
//           );

//           // Escape special regex characters except our capture groups
//           regexPattern = regexPattern
//             .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
//             .replace(/\\\(\\\.\\\+\\\?\\\)/g, "(.+?)");

//           // Make the last capture group non-greedy to handle end of string
//           regexPattern = regexPattern.replace(/\(\.\+\?\)$/, "(.+)");

//           ctx.logger.info(`🔍 Created regex pattern: ${regexPattern}`);

//           // Extract values using the regex
//           const regex = new RegExp(regexPattern);
//           const valueMatch = value.match(regex);

//           if (!valueMatch) {
//             throw new Error(
//               `Display value "${value}" doesn't match template pattern "${template}"`
//             );
//           }

//           // Map extracted values to variable names
//           const extractedValues: { [key: string]: string } = {};
//           for (let i = 0; i < variables.length; i++) {
//             extractedValues[variables[i]] = valueMatch[i + 1]?.trim() || "";
//           }

//           return extractedValues;
//         };

//         // Parse the display value using the template
//         const parsedValues = parseTemplate(displayTemplate, displayValue);
//         ctx.logger.info(`🎯 Parsed values: ${JSON.stringify(parsedValues)}`);

//         // Extract the ACTUAL entity name (metadata.name is required - no fallbacks!)
//         const extractedName = parsedValues["metadata.name"];

//         if (!extractedName) {
//           throw new Error(
//             `Could not extract metadata.name from parsed values. ` +
//               `Parsed: ${JSON.stringify(parsedValues)}. ` +
//               `The template must include metadata.name and your display value must match the template exactly.`
//           );
//         }

//         // Create entity reference using the REAL entity name (no conversion!)
//         const entityRef = `${entityKind.toLowerCase()}:${entityNamespace}/${extractedName}`;

//         ctx.logger.info(
//           `✅ Extracted entity name: "${extractedName}" (from metadata.name)`
//         );
//         ctx.logger.info(`✅ Entity kind: ${entityKind}`);
//         ctx.logger.info(`✅ Entity reference: ${entityRef}`);

//         ctx.output("entityRef", entityRef);
//         ctx.output("extractedName", extractedName);
//         ctx.output("parsedValues", parsedValues);
//         ctx.output("entityKind", entityKind);
//       } catch (error: any) {
//         ctx.logger.error(`❌ Error: ${error.message}`);
//         throw new Error(`Failed to extract entity reference: ${error.message}`);
//       }
//     },
//   });
// };
