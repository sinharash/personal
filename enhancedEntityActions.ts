// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

// SINGLE ACTION: Extract entity reference using template parsing with metadata.name requirement
export const resolveEntityFromDisplayAction = () => {
  return createTemplateAction<{
    displayValue: string;
    displayTemplate: string;
    catalogFilter?: any;
    entityNamespace?: string;
  }>({
    id: "enhanced:resolveEntity",
    description: "Extract entity reference from display format (requires metadata.name in template)",
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
            description: "Template used to format the display (must include metadata.name)",
          },
          catalogFilter: {
            type: "object",
            title: "Catalog Filter", 
            description: "Filter from EnhancedEntityPicker (contains entity kind)",
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
        },
      },
    },
    async handler(ctx: any) {
      const {
        displayValue,
        displayTemplate,
        catalogFilter = {},
        entityNamespace = "default",
      } = ctx.input;

      try {
        ctx.logger.info(`🔧 Parsing display value: "${displayValue}"`);
        ctx.logger.info(`🔧 Using template: "${displayTemplate}"`);
        ctx.logger.info(`🔧 Catalog filter: ${JSON.stringify(catalogFilter)}`);

        // Validate that template includes metadata.name
        if (!displayTemplate.includes('metadata.name')) {
          throw new Error(
            `Template must include 'metadata.name' to extract actual entity name. ` +
            `Current template: "${displayTemplate}". ` +
            `Example: "${{ metadata.name }} - ${{ metadata.title }}"`
          );
        }

        // Extract entity kind from catalogFilter
        const entityKind = catalogFilter.kind || 'Component';
        ctx.logger.info(`🔍 Entity kind from filter: ${entityKind}`);

        // Parse the template to extract variable positions
        const parseTemplate = (template: string, value: string) => {
          // Find all variables in template
          const variables: string[] = [];
          const templateRegex = /\$\{\{\s*([^}]+)\s*\}\}/g;
          let match;
          
          while ((match = templateRegex.exec(template)) !== null) {
            variables.push(match[1].trim());
          }
          
          ctx.logger.info(`🔍 Found template variables: ${variables.join(', ')}`);
          
          // Create regex pattern by replacing variables with capture groups
          let regexPattern = template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, '(.+?)');
          
          // Escape special regex characters except our capture groups
          regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\(\\\.\\\+\\\?\\\)/g, '(.+?)');
          
          // Make the last capture group non-greedy to handle end of string
          regexPattern = regexPattern.replace(/\(\.\+\?\)$/, '(.+)');
          
          ctx.logger.info(`🔍 Created regex pattern: ${regexPattern}`);
          
          // Extract values using the regex
          const regex = new RegExp(regexPattern);
          const valueMatch = value.match(regex);
          
          if (!valueMatch) {
            throw new Error(`Display value "${value}" doesn't match template pattern "${template}"`);
          }
          
          // Map extracted values to variable names
          const extractedValues: { [key: string]: string } = {};
          for (let i = 0; i < variables.length; i++) {
            extractedValues[variables[i]] = valueMatch[i + 1]?.trim() || '';
          }
          
          return extractedValues;
        };

        // Parse the display value using the template
        const parsedValues = parseTemplate(displayTemplate, displayValue);
        ctx.logger.info(`🎯 Parsed values: ${JSON.stringify(parsedValues)}`);

        // Extract the actual entity name (metadata.name is required)
        const extractedName = parsedValues['metadata.name'];
        
        if (!extractedName) {
          throw new Error(
            `Could not extract metadata.name from parsed values. ` +
            `Parsed: ${JSON.stringify(parsedValues)}. ` +
            `Make sure your template includes metadata.name and the display value matches the template.`
          );
        }

        // Create entity reference using the ACTUAL entity name (no conversion needed)
        const entityRef = `${entityKind.toLowerCase()}:${entityNamespace}/${extractedName}`;

        ctx.logger.info(`✅ Extracted entity name: "${extractedName}"`);
        ctx.logger.info(`✅ Entity kind: ${entityKind}`);
        ctx.logger.info(`✅ Entity reference: ${entityRef}`);

        ctx.output("entityRef", entityRef);
        ctx.output("extractedName", extractedName);
        ctx.output("parsedValues", parsedValues);
        ctx.output("entityKind", entityKind);

      } catch (error: any) {
        ctx.logger.error(`❌ Error: ${error.message}`);
        throw new Error(`Failed to extract entity reference: ${error.message}`);
      }
    },
  });
};