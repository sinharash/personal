// enhanced-entity-actions-auto.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

// Auto-enhanced template detection and processing
const processAutoEnhancedTemplate = (
  displayValue: string,
  displayTemplate: string
) => {
  const isAutoEnhanced = displayTemplate.includes("___HIDDEN_SEPARATOR___");

  if (isAutoEnhanced) {
    // Extract the enhanced template and value
    const [hiddenPart, visiblePart] = displayTemplate.split(
      "___HIDDEN_SEPARATOR___"
    );
    const [hiddenValue, visibleValue] = displayValue.split(
      "___HIDDEN_SEPARATOR___"
    );

    return {
      isAutoEnhanced: true,
      enhancedTemplate: displayTemplate, // Full template with metadata.name
      enhancedValue: displayValue, // Full value with metadata.name
      userTemplate: visiblePart, // What developer wrote
      userValue: visibleValue, // What user sees
    };
  }

  return {
    isAutoEnhanced: false,
    enhancedTemplate: displayTemplate,
    enhancedValue: displayValue,
    userTemplate: displayTemplate,
    userValue: displayValue,
  };
};

// ENHANCED ACTION: Extract entity reference with auto-enhancement support
export const resolveEntityFromDisplayAction = () => {
  return createTemplateAction<{
    displayValue: string;
    displayTemplate: string;
    catalogFilter?: any;
    entityNamespace?: string;
  }>({
    id: "enhanced:resolveEntity",
    description:
      "Extract entity reference from display format (auto-handles metadata.name requirement)",
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
              "Template used to format the display (auto-enhanced if needed)",
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
          userDisplayValue: {
            type: "string",
            title: "User Display Value",
            description: "What the user actually saw (visible portion)",
          },
          isAutoEnhanced: {
            type: "boolean",
            title: "Is Auto Enhanced",
            description: "Whether auto-enhancement was used",
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
        ctx.logger.info(`🔧 Processing display value: "${displayValue}"`);
        ctx.logger.info(`🔧 Using template: "${displayTemplate}"`);

        // Process auto-enhanced templates
        const processed = processAutoEnhancedTemplate(
          displayValue,
          displayTemplate
        );

        ctx.logger.info(`🎯 Auto-enhanced mode: ${processed.isAutoEnhanced}`);
        if (processed.isAutoEnhanced) {
          ctx.logger.info(`👤 User saw: "${processed.userValue}"`);
          ctx.logger.info(
            `🔧 Processing enhanced value: "${processed.enhancedValue}"`
          );
        }

        // Use the enhanced template and value for parsing (guaranteed to have metadata.name)
        const templateToUse = processed.enhancedTemplate;
        const valueToUse = processed.enhancedValue;

        // Validate that template includes metadata.name (should always be true now)
        if (!templateToUse.includes("metadata.name")) {
          throw new Error(
            `Internal error: Enhanced template should always include metadata.name. ` +
              `Template: "${templateToUse}"`
          );
        }

        // Extract entity kind from catalogFilter
        const entityKind = catalogFilter.kind;
        if (!entityKind) {
          throw new Error(
            `Entity kind is required but not found in catalogFilter. ` +
              `Received catalogFilter: ${JSON.stringify(catalogFilter)}`
          );
        }

        ctx.logger.info(`🔍 Entity kind: ${entityKind}`);

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

          // Handle the special separator in auto-enhanced mode
          if (regexPattern.includes("___HIDDEN_SEPARATOR___")) {
            regexPattern = regexPattern.replace(
              "___HIDDEN_SEPARATOR___",
              "___HIDDEN_SEPARATOR___"
            );
          }

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

        // Parse the enhanced template and value
        const parsedValues = parseTemplate(templateToUse, valueToUse);
        ctx.logger.info(`🎯 Parsed values: ${JSON.stringify(parsedValues)}`);

        // Extract the ACTUAL entity name (metadata.name - guaranteed to exist)
        const extractedName = parsedValues["metadata.name"];

        if (!extractedName) {
          throw new Error(
            `Could not extract metadata.name from parsed values. ` +
              `This should not happen with auto-enhancement. ` +
              `Parsed: ${JSON.stringify(parsedValues)}`
          );
        }

        // Use provided namespace or fall back to "default"
        const resolvedNamespace = entityNamespace || "default";

        // Create entity reference using the REAL entity name and resolved namespace
        const entityRef = `${entityKind.toLowerCase()}:${resolvedNamespace}/${extractedName}`;

        ctx.logger.info(`✅ Extracted entity name: "${extractedName}"`);
        ctx.logger.info(`✅ Entity kind: ${entityKind}`);
        ctx.logger.info(`✅ Entity reference: ${entityRef}`);

        if (processed.isAutoEnhanced) {
          ctx.logger.info(`👤 User-visible value: "${processed.userValue}"`);
        }

        ctx.output("entityRef", entityRef);
        ctx.output("extractedName", extractedName);
        ctx.output("parsedValues", parsedValues);
        ctx.output("entityKind", entityKind);
        ctx.output("entityNamespace", resolvedNamespace);
        ctx.output("userDisplayValue", processed.userValue);
        ctx.output("isAutoEnhanced", processed.isAutoEnhanced);
      } catch (error: any) {
        ctx.logger.error(`❌ Error: ${error.message}`);
        throw new Error(`Failed to extract entity reference: ${error.message}`);
      }
    },
  });
};
