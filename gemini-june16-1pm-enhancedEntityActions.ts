// FILE: enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

// The same separator used in the frontend component must be used here.
const HIDDEN_SEPARATOR = "|||";

export const resolveEntityFromDisplayAction = () => {
  return createTemplateAction<{
    displayValue: string; // This is the combined string, e.g., "John Doe (Engineering)|||jdoe"
    catalogFilter?: { kind?: string };
    entityNamespace?: string;
  }>({
    id: "enhanced:resolveEntity",
    description:
      "Extracts an entity reference from a combined display value string.",
    schema: {
      input: {
        type: "object",
        required: ["displayValue", "catalogFilter"],
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
            properties: {
              kind: {
                type: "string",
                description:
                  "The kind of entity to resolve (e.g., User, Component).",
              },
            },
            required: ["kind"],
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
            title: "The user-facing display value",
          },
        },
      },
    },
    async handler(ctx) {
      const {
        displayValue,
        catalogFilter,
        entityNamespace = "default",
      } = ctx.input;

      try {
        ctx.logger.info(
          `🔧 Received combined display value: "${displayValue}"`
        );

        const entityKind = catalogFilter?.kind;
        if (!entityKind) {
          throw new Error(
            "Input 'catalogFilter' must contain a 'kind' property."
          );
        }
        ctx.logger.info(`🔍 Entity kind from catalogFilter: ${entityKind}`);

        // --- THE NEW, ROBUST LOGIC ---
        // 1. Split the incoming string by our hidden separator.
        const parts = displayValue.split(HIDDEN_SEPARATOR);
        if (parts.length < 2 || !parts[parts.length - 1]) {
          throw new Error(
            `Input displayValue "${displayValue}" is malformed. It must contain the hidden separator and a non-empty metadata.name.`
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
