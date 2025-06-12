// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

// DEBUGGING VERSION: The full entity resolution action with extensive logging
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
        ctx.logger.info("🚀 ENHANCED ENTITY RESOLVER STARTED");
        ctx.logger.info(`📋 Display Value: "${displayValue}"`);
        ctx.logger.info(`🔧 Template: "${displayTemplate}"`);
        ctx.logger.info(`🔍 Filter: ${JSON.stringify(catalogFilter)}`);

        // DEBUGGING: Test discovery service
        ctx.logger.info("🔍 Testing discovery service...");
        const catalogBaseUrl = await discovery.getBaseUrl("catalog");
        ctx.logger.info(`📍 Catalog base URL: ${catalogBaseUrl}`);

        // Build query parameters for the catalog API
        const queryParams = new URLSearchParams();
        if (catalogFilter.kind) {
          queryParams.append("filter", `kind=${catalogFilter.kind}`);
        }
        if (catalogFilter.type) {
          queryParams.append("filter", `spec.type=${catalogFilter.type}`);
        }

        // Add any additional filters
        Object.keys(catalogFilter).forEach((key) => {
          if (key !== "kind" && key !== "type") {
            queryParams.append("filter", `${key}=${catalogFilter[key]}`);
          }
        });

        const catalogUrl = `${catalogBaseUrl}/entities?${queryParams.toString()}`;
        ctx.logger.info(`🌐 Full catalog URL: ${catalogUrl}`);

        // DEBUGGING: Try to understand the network setup
        ctx.logger.info("🔍 Making HTTP request...");

        const https = require("https");
        const http = require("http");
        const { URL } = require("url");

        const fetchEntities = (): Promise<any> => {
          return new Promise((resolve, reject) => {
            const parsedUrl = new URL(catalogUrl);
            const client = parsedUrl.protocol === "https:" ? https : http;

            ctx.logger.info(`🔗 Protocol: ${parsedUrl.protocol}`);
            ctx.logger.info(`🏠 Hostname: ${parsedUrl.hostname}`);
            ctx.logger.info(`🚪 Port: ${parsedUrl.port || "default"}`);
            ctx.logger.info(
              `🛤️ Path: ${parsedUrl.pathname}${parsedUrl.search}`
            );

            const options = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port,
              path: parsedUrl.pathname + parsedUrl.search,
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            };

            ctx.logger.info(
              `📤 Request options: ${JSON.stringify(options, null, 2)}`
            );

            const req = client.request(options, (res: any) => {
              ctx.logger.info(`📥 Response status: ${res.statusCode}`);
              ctx.logger.info(
                `📥 Response headers: ${JSON.stringify(res.headers, null, 2)}`
              );

              let data = "";
              res.on("data", (chunk: any) => (data += chunk));
              res.on("end", () => {
                try {
                  if (res.statusCode >= 400) {
                    ctx.logger.error(
                      `❌ HTTP Error ${res.statusCode}: ${res.statusMessage}`
                    );
                    ctx.logger.error(
                      `❌ Response body: ${data.substring(0, 500)}`
                    );
                    reject(
                      new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`)
                    );
                    return;
                  }
                  ctx.logger.info(
                    `✅ Response body length: ${data.length} characters`
                  );
                  ctx.logger.info(
                    `📄 Response preview: ${data.substring(0, 200)}...`
                  );

                  const parsed = JSON.parse(data);
                  ctx.logger.info(`📊 Parsed data type: ${typeof parsed}`);
                  if (parsed.items) {
                    ctx.logger.info(`📋 Items found: ${parsed.items.length}`);
                  }
                  resolve(parsed);
                } catch (err) {
                  ctx.logger.error(`❌ JSON Parse error: ${err}`);
                  ctx.logger.error(`❌ Raw data: ${data.substring(0, 500)}`);
                  reject(err);
                }
              });
            });

            req.on("error", (err: any) => {
              ctx.logger.error(`❌ Request error: ${err.message}`);
              ctx.logger.error(
                `❌ Error details: ${JSON.stringify(err, null, 2)}`
              );
              reject(err);
            });

            req.end();
          });
        };

        const catalogData = await fetchEntities();
        const entities = catalogData.items || [];

        ctx.logger.info(`🎯 Found ${entities.length} entities in catalog`);

        // Log some sample entities for debugging
        if (entities.length > 0) {
          ctx.logger.info("📋 Sample entities:");
          entities.slice(0, 3).forEach((entity, index) => {
            ctx.logger.info(
              `  ${index + 1}. ${entity.kind}:${entity.metadata.namespace}/${
                entity.metadata.name
              }`
            );
            if (entity.metadata.title) {
              ctx.logger.info(`     Title: ${entity.metadata.title}`);
            }
            if (entity.spec?.profile?.department) {
              ctx.logger.info(
                `     Department: ${entity.spec.profile.department}`
              );
            }
          });
        }

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

        // DEBUG: Try formatting a few entities to see what we get
        ctx.logger.info("🔧 Testing template formatting:");
        entities.slice(0, 3).forEach((entity, index) => {
          const formatted = formatEntityDisplay(displayTemplate, entity);
          ctx.logger.info(`  ${index + 1}. Formatted: "${formatted}"`);
          ctx.logger.info(`     Looking for: "${displayValue}"`);
          ctx.logger.info(
            `     Match: ${formatted === displayValue ? "✅ YES" : "❌ NO"}`
          );
        });

        // Find entity that matches the display value
        const matchingEntity = entities.find((entity) => {
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
          ctx.logger.info(`🔧 Template used: "${displayTemplate}"`);
          ctx.logger.info(`📋 Available entities (first 10):`);

          entities.slice(0, 10).forEach((entity, index) => {
            const formatted = formatEntityDisplay(displayTemplate, entity);
            ctx.logger.info(
              `  ${index + 1}. Formatted: "${formatted}" | Entity: ${
                entity.kind
              }:${entity.metadata.namespace}/${entity.metadata.name}`
            );
          });

          throw new Error(
            `Could not find entity matching display value: "${displayValue}". Found ${entities.length} total entities.`
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

        ctx.logger.info("🎉 ENHANCED ENTITY RESOLVER COMPLETED SUCCESSFULLY");
      } catch (error) {
        ctx.logger.error(`💥 ENHANCED ENTITY RESOLVER FAILED`);
        ctx.logger.error(`❌ Error type: ${error.constructor.name}`);
        ctx.logger.error(`❌ Error message: ${error.message}`);
        ctx.logger.error(`❌ Error stack: ${error.stack}`);
        throw new Error(
          `Failed to resolve entity: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
  });
};

// ALTERNATIVE APPROACH: Use existing Backstage catalog patterns
export const resolveEntityUsingCatalogFetchAction = () => {
  return createTemplateAction<{
    displayValue: string;
    displayTemplate: string;
    catalogFilter?: any;
  }>({
    id: "enhanced:resolveEntityAlt",
    description: "Alternative approach using built-in catalog fetch",
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
          message: {
            type: "string",
            title: "Status Message",
          },
        },
      },
    },
    async handler(ctx) {
      ctx.logger.info(
        "🔄 ALTERNATIVE RESOLVER: This action will guide you to use catalog:fetch instead"
      );

      // Extract likely entity name from display value
      let entityName = "";
      const displayValue = ctx.input.displayValue;

      // Try to extract name from common patterns
      if (displayValue.includes(" - ")) {
        entityName = displayValue
          .split(" - ")[0]
          .toLowerCase()
          .replace(/\s+/g, ".");
      } else if (displayValue.includes(" (")) {
        entityName = displayValue
          .split(" (")[0]
          .toLowerCase()
          .replace(/\s+/g, ".");
      } else {
        entityName = displayValue.toLowerCase().replace(/\s+/g, ".");
      }

      const guessedEntityRef = `user:default/${entityName}`;

      ctx.logger.info(
        `💡 SUGGESTION: Instead of this action, use catalog:fetch with:`
      );
      ctx.logger.info(`   entityRef: ${guessedEntityRef}`);
      ctx.logger.info(
        `💡 Or modify your YAML to use the catalog:fetch action directly`
      );

      ctx.output(
        "message",
        `Use catalog:fetch with entityRef: ${guessedEntityRef}`
      );
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

// Simple extraction without HTTP calls
export const extractEntityRefAction = () => {
  return createTemplateAction<{
    displayValue: string;
    displayTemplate: string;
    entityKind?: string;
    entityNamespace?: string;
  }>({
    id: "enhanced:extractEntityRef",
    description: "Extract entity reference from display format (no HTTP calls)",
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
        ctx.logger.info(
          `🔧 Extracting entity reference from: "${displayValue}"`
        );

        // Parse different display template patterns without HTTP calls
        let extractedName = "";

        // Pattern 1: "Name - Department" -> extract Name
        if (displayValue.includes(" - ")) {
          extractedName = displayValue.split(" - ")[0].trim();
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
