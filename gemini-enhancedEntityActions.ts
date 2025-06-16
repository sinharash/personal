// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

// The same separator used in the frontend component.
const HIDDEN_SEPARATOR = "|||";

// This action is now simpler and more robust.
export const resolveEntityFromDisplayAction = () => {
  return createTemplateAction<{
    displayValue: string; // This is the combined string, e.g., "John Doe;;jdoe"
    catalogFilter?: any;
    entityNamespace?: string;
  }>({
    id: "enhanced:resolveEntity",
    description:
      "Extracts an entity reference from a combined display value string.",
    schema: {
      input: {
        type: "object",
        required: ["displayValue"],
        properties: {
          displayValue: {
            type: "string",
            title: "Display Value",
            description:
              "The combined value from the EnhancedEntityPicker, containing a hidden metadata.name.",
          },
          catalogFilter: {
            type: "object",
            title: "Catalog Filter",
            description:
              "Filter from EnhancedEntityPicker (must contain entity kind).",
          },
          entityNamespace: {
            type: "string",
            title: "Entity Namespace",
            description:
              "Expected entity namespace (optional, defaults to 'default').",
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
        },
      },
    },
    async handler(ctx: any) {
      const {
        displayValue,
        catalogFilter = {},
        entityNamespace = "default",
      } = ctx.input;

      try {
        ctx.logger.info(
          `🔧 Received combined display value: "${displayValue}"`
        );

        const entityKind = catalogFilter.kind;
        if (!entityKind) {
          throw new Error("catalogFilter must contain a 'kind' property.");
        }
        ctx.logger.info(`🔍 Entity kind from catalogFilter: ${entityKind}`);

        // --- THE NEW, SIMPLER LOGIC ---
        // 1. Split the incoming string by our hidden separator.
        const parts = displayValue.split(HIDDEN_SEPARATOR);
        if (parts.length < 2) {
          throw new Error(
            `Input displayValue "${displayValue}" is malformed and does not contain the hidden separator.`
          );
        }

        // 2. The real metadata.name is the last part of the split.
        const extractedName = parts[parts.length - 1];
        // The part the user saw is the first part.
        const visibleDisplayValue = parts[0];

        ctx.logger.info(`✅ Extracted hidden entity name: "${extractedName}"`);

        // 3. Construct the entity reference reliably.
        const entityRef = `${entityKind.toLowerCase()}:${entityNamespace}/${extractedName}`;
        ctx.logger.info(`✅ Constructed entity reference: ${entityRef}`);

        ctx.output("entityRef", entityRef);
        ctx.output("extractedName", extractedName);
        ctx.output("displayValue", visibleDisplayValue);
      } catch (error: any) {
        ctx.logger.error(`❌ Error: ${error.message}`);
        throw new Error(`Failed to extract entity reference: ${error.message}`);
      }
    },
  });
};
