// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

// SINGLE ACTION: Extract entity reference from display value (NO HTTP CALLS)
export const resolveEntityFromDisplayAction = () => {
  return createTemplateAction<{
    displayValue: string;
    displayTemplate: string;
    entityKind?: string;
    entityNamespace?: string;
  }>({
    id: "enhanced:resolveEntity",
    description:
      "Extract entity reference from display format for catalog:fetch",
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
    async handler(ctx: any) {
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

        // Parse display value to extract entity name
        let extractedName = "";

        // Pattern 1: "Name - Department" -> extract Name
        if (displayValue.includes(" - ")) {
          extractedName = displayValue.split(" - ")[0].trim();
        }
        // Pattern 2: "Name (email)" -> extract Name
        else if (displayValue.includes("(") && displayValue.includes(")")) {
          const match = displayValue.match(/^(.+?)\s*\(/);
          if (match) {
            extractedName = match[1].trim();
          }
        }
        // Pattern 3: Just the name
        else {
          extractedName = displayValue.trim();
        }

        if (!extractedName) {
          throw new Error(
            `Could not extract entity name from: "${displayValue}"`
          );
        }

        // Convert to entity reference format
        const entityName = extractedName
          .toLowerCase()
          .replace(/\s+/g, ".")
          .replace(/[^a-z0-9.\-_]/g, "");

        const entityRef = `${entityKind.toLowerCase()}:${entityNamespace}/${entityName}`;

        ctx.logger.info(`✅ Extracted entity reference: ${entityRef}`);

        ctx.output("entityRef", entityRef);
        ctx.output("extractedName", extractedName);
      } catch (error: any) {
        ctx.logger.error(`❌ Error: ${error.message}`);
        throw new Error(`Failed to extract entity reference: ${error.message}`);
      }
    },
  });
};
