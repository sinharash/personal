// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

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
        ctx.logger.info(`Using template: "${displayTemplate}"`);

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
        // Handle names with dots, spaces, etc.
        const entityName = extractedName
          .toLowerCase()
          .replace(/\s+/g, ".") // spaces to dots
          .replace(/[^a-z0-9.\-_]/g, ""); // remove special chars

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
        ctx.logger.info(`Extracting email from: "${displayValue}"`);

        // Parse format like "john.doe.ffno_unitedhealth.com ( john.doe.ffno@unitedhealth.com)"
        const emailMatch = displayValue.match(/\(([^)]+)\)/);
        const nameMatch = displayValue.match(/^([^(]+)/);

        const email = emailMatch ? emailMatch[1].trim() : "";
        const name = nameMatch ? nameMatch[1].trim() : "";

        // Guess entity reference from email
        let entityRef = "";
        if (email) {
          const emailUsername = email.split("@")[0];
          entityRef = `user:default/${emailUsername}`;
        } else if (name) {
          const cleanName = name.toLowerCase().replace(/\s+/g, ".");
          entityRef = `user:default/${cleanName}`;
        }

        ctx.logger.info(
          `✅ Extracted - Name: "${name}", Email: "${email}", EntityRef: "${entityRef}"`
        );

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
