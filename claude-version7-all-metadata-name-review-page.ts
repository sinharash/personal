// File 1: Enhanced Entity Picker Component (FIXED - No template syntax mixing)
// packages/app/src/scaffolder/EnhancedEntityPicker/EnhancedEntityPicker.tsx

import React, { useEffect, useState, useCallback } from "react";
import { Autocomplete, TextField, Box } from "@mui/material";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { Entity, stringifyEntityRef } from "@backstage/catalog-model";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";

interface CatalogFilter {
  kind?: string;
  type?: string;
  [key: string]: any;
}

interface EnhancedEntityPickerProps
  extends FieldExtensionComponentProps<
    string,
    {
      displayEntityFieldAfterFormatting?: string;
      uniqueIdentifierField?: string;
      catalogFilter?: CatalogFilter;
      placeholder?: string;
    }
  > {}

// Helper function to get nested property value from object
const getNestedProperty = (obj: any, path: string): string => {
  try {
    const value = path.split(".").reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : "";
    }, obj);
    return value || "";
  } catch {
    return "";
  }
};

// Format entity display using simple template syntax {{path}}
const formatEntityDisplay = (template: string, entity: Entity): string => {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    
    // Handle fallback syntax like "metadata.title || metadata.name"
    if (trimmedPath.includes(" || ")) {
      const paths = trimmedPath.split(" || ").map(p => p.trim());
      for (const p of paths) {
        const value = getNestedProperty(entity, p);
        if (value) return value;
      }
      return "";
    }
    
    return getNestedProperty(entity, trimmedPath);
  });
};

export const EnhancedEntityPicker = ({
  formData,
  onChange,
  schema,
  uiSchema,
  rawErrors,
  disabled,
}: EnhancedEntityPickerProps) => {
  const catalogApi = useApi(catalogApiRef);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  // Use simple {{}} syntax instead of mixing with Nunjucks ${{}}
  const displayTemplate =
    uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
    "{{ metadata.title || metadata.name }}";
  
  const uniqueIdentifierTemplate =
    uiSchema?.["ui:options"]?.uniqueIdentifierField ||
    "metadata.name";
    
  const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
  const placeholder =
    uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const filter: any = {};

      if (catalogFilter.kind) {
        filter.kind = catalogFilter.kind;
      }
      if (catalogFilter.type) {
        filter["spec.type"] = catalogFilter.type;
      }

      Object.keys(catalogFilter).forEach((key) => {
        if (key !== "kind" && key !== "type") {
          filter[key] = catalogFilter[key];
        }
      });

      const response = await catalogApi.getEntities({ filter });
      setEntities(response.items);
    } catch (error) {
      console.error("Error fetching entities:", error);
    } finally {
      setLoading(false);
    }
  }, [catalogApi, catalogFilter]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  // Parse stored value to find selected entity
  useEffect(() => {
    if (formData && entities.length > 0) {
      // Try to parse the stored format: "displayValue\nEntity Name: uniqueValue"
      const lines = formData.split('\n');
      if (lines.length === 2 && lines[1].startsWith('Entity Name: ')) {
        const uniqueValue = lines[1].replace('Entity Name: ', '');
        const found = entities.find((entity) => {
          const entityUniqueValue = getNestedProperty(entity, uniqueIdentifierTemplate);
          return entityUniqueValue === uniqueValue;
        });
        setSelectedEntity(found || null);
      } else {
        // Fallback: try to match by display value
        const found = entities.find((entity) => {
          const displayValue = formatEntityDisplay(displayTemplate, entity);
          return displayValue === formData;
        });
        setSelectedEntity(found || null);
      }
    } else {
      setSelectedEntity(null);
    }
  }, [formData, entities, displayTemplate, uniqueIdentifierTemplate]);

  const handleChange = (event: any, newValue: Entity | null) => {
    if (newValue) {
      const displayValue = formatEntityDisplay(displayTemplate, newValue);
      const uniqueValue = getNestedProperty(newValue, uniqueIdentifierTemplate);
      
      // Store in format for review page with proper line break
      const combinedValue = `${displayValue}\nEntity Name: ${uniqueValue}`;
      
      onChange(combinedValue);
      setSelectedEntity(newValue);

      console.log('Enhanced Entity Picker stored:', {
        display: displayValue,
        unique: uniqueValue,
        combined: combinedValue,
        entityRef: stringifyEntityRef(newValue)
      });

    } else {
      onChange("");
      setSelectedEntity(null);
    }
  };

  const displayOptions = entities
    .map((entity) => ({
      entity,
      displayText: formatEntityDisplay(displayTemplate, entity),
      uniqueValue: getNestedProperty(entity, uniqueIdentifierTemplate),
      entityRef: stringifyEntityRef(entity),
    }))
    .filter((option) => option.displayText && option.displayText.trim() !== "");

  const currentSelection = selectedEntity
    ? displayOptions.find(
        (opt) => stringifyEntityRef(opt.entity) === stringifyEntityRef(selectedEntity)
      ) || null
    : null;

  return (
    <Box>
      <Autocomplete
        options={displayOptions}
        getOptionLabel={(option) => option.displayText}
        value={currentSelection}
        onChange={(event, newValue) =>
          handleChange(event, newValue?.entity || null)
        }
        loading={loading}
        disabled={disabled}
        isOptionEqualToValue={(option, value) =>
          option.entityRef === value.entityRef
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={schema.title}
            placeholder={placeholder}
            error={!!rawErrors?.length}
            helperText={rawErrors?.length ? rawErrors[0] : schema.description}
            variant="outlined"
            fullWidth
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Box>
              <Box sx={{ fontWeight: "medium" }}>{option.displayText}</Box>
            </Box>
          </Box>
        )}
      />

      {process.env.NODE_ENV === "development" && (
        <Box sx={{ mt: 1, p: 1, bgcolor: "grey.50", fontSize: "11px" }}>
          <strong>Debug:</strong> {displayOptions.length} options available
          <div>Display Template: {displayTemplate}</div>
          <div>Unique Identifier Field: {uniqueIdentifierTemplate}</div>
          {selectedEntity && (
            <div>
              Selected Display: {formatEntityDisplay(displayTemplate, selectedEntity)}
              <br />
              Unique ID: {getNestedProperty(selectedEntity, uniqueIdentifierTemplate)}
            </div>
          )}
        </Box>
      )}
    </Box>
  );
};

// File 2: Backend Action (No template syntax issues)
// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

export const resolveEntityFromDisplayAction = () => {
  return createTemplateAction<{
    combinedValue: string;
    entityKind: string;
    entityNamespace?: string;
  }>({
    id: "enhanced:createEntityRef",
    description:
      "Create entity reference from unique identifier - no catalog API needed",
    schema: {
      input: {
        type: "object",
        required: ["combinedValue", "entityKind"],
        properties: {
          combinedValue: {
            type: "string",
            title: "Combined Value",
            description: "Combined value from EnhancedEntityPicker (displayValue\\nEntity Name: uniqueValue)",
          },
          entityKind: {
            type: "string",
            title: "Entity Kind",
            description: "Kind of entity (User, Component, Group, etc.)",
          },
          entityNamespace: {
            type: "string",
            title: "Entity Namespace",
            description: "Entity namespace (defaults to 'default')",
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
          displayValue: {
            type: "string",
            title: "Display Value",
            description: "Clean display value (what user saw)",
          },
          uniqueValue: {
            type: "string",
            title: "Unique Value", 
            description: "Unique identifier value used for resolution",
          },
        },
      },
    },
    async handler(ctx: any) {
      const {
        combinedValue,
        entityKind,
        entityNamespace = "default",
      } = ctx.input;

      try {
        ctx.logger.info(`Creating entityRef from: "${combinedValue}"`);

        // Parse the combined value: "displayValue\nEntity Name: uniqueValue"
        const lines = combinedValue.split('\n');
        
        if (lines.length !== 2 || !lines[1].startsWith('Entity Name: ')) {
          throw new Error(
            `Invalid combined value format. Expected "displayValue\\nEntity Name: uniqueValue", ` +
            `got: "${combinedValue}"`
          );
        }

        const displayValue = lines[0];
        const uniqueValue = lines[1].replace('Entity Name: ', '');
        
        ctx.logger.info(`Display value: "${displayValue}"`);
        ctx.logger.info(`Unique value: "${uniqueValue}"`);

        // Create entityRef using the unique value as the entity name
        // Format: kind:namespace/name
        const entityRef = `${entityKind.toLowerCase()}:${entityNamespace}/${uniqueValue}`;

        ctx.logger.info(`Created entityRef: ${entityRef}`);

        // Output the results
        ctx.output("entityRef", entityRef);
        ctx.output("displayValue", displayValue);
        ctx.output("uniqueValue", uniqueValue);

      } catch (error: any) {
        ctx.logger.error(`EntityRef creation failed: ${error.message}`);
        throw new Error(`Failed to create entity reference: ${error.message}`);
      }
    },
  });
};


// // File 1: Enhanced Entity Picker Component
// // packages/app/src/scaffolder/EnhancedEntityPicker/EnhancedEntityPicker.tsx

// import React, { useEffect, useState, useCallback } from "react";
// import { Autocomplete, TextField, Box } from "@mui/material";
// import { useApi } from "@backstage/core-plugin-api";
// import { catalogApiRef } from "@backstage/plugin-catalog-react";
// import { Entity, stringifyEntityRef } from "@backstage/catalog-model";
// import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";

// interface CatalogFilter {
//   kind?: string;
//   type?: string;
//   [key: string]: any;
// }

// interface EnhancedEntityPickerProps
//   extends FieldExtensionComponentProps<
//     string,
//     {
//       displayEntityFieldAfterFormatting?: string;
//       uniqueIdentifierField?: string; // NEW: Unique field for entity resolution
//       catalogFilter?: CatalogFilter;
//       placeholder?: string;
//     }
//   > {}

// const formatEntityDisplay = (template: string, entity: Entity): string => {
//   return template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
//     const trimmedPath = path.trim();
//     const value = trimmedPath.split(".").reduce((obj: any, key: string) => {
//       return obj && obj[key] !== undefined ? obj[key] : "";
//     }, entity);
//     return value || "";
//   });
// };

// export const EnhancedEntityPicker = ({
//   formData,
//   onChange,
//   schema,
//   uiSchema,
//   rawErrors,
//   disabled,
// }: EnhancedEntityPickerProps) => {
//   const catalogApi = useApi(catalogApiRef);
//   const [entities, setEntities] = useState<Entity[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

//   const displayTemplate =
//     uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
//     "${{ metadata.title || metadata.name }}";
  
//   // NEW: Unique identifier template for resolution
//   const uniqueIdentifierTemplate =
//     uiSchema?.["ui:options"]?.uniqueIdentifierField ||
//     "metadata.name"; // Default to metadata.name
    
//   const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
//   const placeholder =
//     uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

//   const fetchEntities = useCallback(async () => {
//     setLoading(true);
//     try {
//       const filter: any = {};

//       if (catalogFilter.kind) {
//         filter.kind = catalogFilter.kind;
//       }
//       if (catalogFilter.type) {
//         filter["spec.type"] = catalogFilter.type;
//       }

//       Object.keys(catalogFilter).forEach((key) => {
//         if (key !== "kind" && key !== "type") {
//           filter[key] = catalogFilter[key];
//         }
//       });

//       const response = await catalogApi.getEntities({ filter });
//       setEntities(response.items);
//     } catch (error) {
//       console.error("Error fetching entities:", error);
//     } finally {
//       setLoading(false);
//     }
//   }, [catalogApi, catalogFilter]);

//   useEffect(() => {
//     fetchEntities();
//   }, [fetchEntities]);

//   // Parse stored value to find selected entity
//   useEffect(() => {
//     if (formData && entities.length > 0) {
//       // Try to parse the stored format: "displayValue\nEntity Name: uniqueValue"
//       const lines = formData.split('\n');
//       if (lines.length === 2 && lines[1].startsWith('Entity Name: ')) {
//         const displayValue = lines[0];
//         const uniqueValue = lines[1].replace('Entity Name: ', '');
//         const found = entities.find((entity) => {
//           const entityUniqueValue = formatEntityDisplay(`${{ ${uniqueIdentifierTemplate} }}`, entity);
//           return entityUniqueValue === uniqueValue;
//         });
//         setSelectedEntity(found || null);
//       } else {
//         // Fallback: try to match by display value
//         const found = entities.find((entity) => {
//           const displayValue = formatEntityDisplay(displayTemplate, entity);
//           return displayValue === formData;
//         });
//         setSelectedEntity(found || null);
//       }
//     } else {
//       setSelectedEntity(null);
//     }
//   }, [formData, entities, displayTemplate, uniqueIdentifierTemplate]);

//   const handleChange = (event: any, newValue: Entity | null) => {
//     if (newValue) {
//       const displayValue = formatEntityDisplay(displayTemplate, newValue);
//       const uniqueValue = formatEntityDisplay(`${{ ${uniqueIdentifierTemplate} }}`, newValue);
      
//       // 🎯 Store in a clean, user-friendly format for review page
//       // Format: "Display Value\nEntity Name: uniqueValue"
//       const combinedValue = `${displayValue}\nEntity Name: ${uniqueValue}`;
      
//       onChange(combinedValue);
//       setSelectedEntity(newValue);

//       console.log(`🎯 Enhanced Entity Picker stored:`, {
//         display: displayValue,
//         unique: uniqueValue,
//         combined: combinedValue,
//         entityRef: stringifyEntityRef(newValue)
//       });

//     } else {
//       onChange("");
//       setSelectedEntity(null);
//     }
//   };

//   const displayOptions = entities
//     .map((entity) => ({
//       entity,
//       displayText: formatEntityDisplay(displayTemplate, entity),
//       uniqueValue: formatEntityDisplay(`${{ ${uniqueIdentifierTemplate} }}`, entity),
//       entityRef: stringifyEntityRef(entity),
//     }))
//     .filter((option) => option.displayText && option.displayText.trim() !== "");

//   const currentSelection = selectedEntity
//     ? displayOptions.find(
//         (opt) => stringifyEntityRef(opt.entity) === stringifyEntityRef(selectedEntity)
//       ) || null
//     : null;

//   return (
//     <Box>
//       <Autocomplete
//         options={displayOptions}
//         getOptionLabel={(option) => option.displayText}
//         value={currentSelection}
//         onChange={(event, newValue) =>
//           handleChange(event, newValue?.entity || null)
//         }
//         loading={loading}
//         disabled={disabled}
//         isOptionEqualToValue={(option, value) =>
//           option.entityRef === value.entityRef
//         }
//         renderInput={(params) => (
//           <TextField
//             {...params}
//             label={schema.title}
//             placeholder={placeholder}
//             error={!!rawErrors?.length}
//             helperText={rawErrors?.length ? rawErrors[0] : schema.description}
//             variant="outlined"
//             fullWidth
//           />
//         )}
//         renderOption={(props, option) => (
//           <Box component="li" {...props}>
//             <Box>
//               <Box sx={{ fontWeight: "medium" }}>{option.displayText}</Box>
//               {/* Show unique identifier in development */}
//               {process.env.NODE_ENV === "development" && (
//                 <Box sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
//                   {uniqueIdentifierTemplate}: {option.uniqueValue}
//                 </Box>
//               )}
//             </Box>
//           </Box>
//         )}
//       />

//       {process.env.NODE_ENV === "development" && (
//         <Box sx={{ mt: 1, p: 1, bgcolor: "grey.50", fontSize: "11px" }}>
//           <strong>Debug:</strong> {displayOptions.length} options
//           <div>Display Template: {displayTemplate}</div>
//           <div>Unique Identifier: {uniqueIdentifierTemplate}</div>
//           {selectedEntity && (
//             <div>
//               ✅ Display: {formatEntityDisplay(displayTemplate, selectedEntity)}
//               <br />
//               🔑 Unique: {formatEntityDisplay(`${{ ${uniqueIdentifierTemplate} }}`, selectedEntity)}
//             </div>
//           )}
//         </Box>
//       )}
//     </Box>
//   );
// };

// action
// File 2: Backend Action
// packages/backend/src/plugins/scaffolder/actions/enhancedEntityActions.ts

import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

export const resolveEntityFromDisplayAction = () => {
  return createTemplateAction<{
    combinedValue: string;
    entityKind: string;
    entityNamespace?: string;
  }>({
    id: "enhanced:createEntityRef",
    description:
      "Create entity reference from unique identifier - no catalog API needed",
    schema: {
      input: {
        type: "object",
        required: ["combinedValue", "entityKind"],
        properties: {
          combinedValue: {
            type: "string",
            title: "Combined Value",
            description: "Combined value from EnhancedEntityPicker (displayValue\\nEntity Name: uniqueValue)",
          },
          entityKind: {
            type: "string",
            title: "Entity Kind",
            description: "Kind of entity (User, Component, Group, etc.)",
          },
          entityNamespace: {
            type: "string",
            title: "Entity Namespace",
            description: "Entity namespace (defaults to 'default')",
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
          displayValue: {
            type: "string",
            title: "Display Value",
            description: "Clean display value (what user saw)",
          },
          uniqueValue: {
            type: "string",
            title: "Unique Value", 
            description: "Unique identifier value used for resolution",
          },
        },
      },
    },
    async handler(ctx: any) {
      const {
        combinedValue,
        entityKind,
        entityNamespace = "default",
      } = ctx.input;

      try {
        ctx.logger.info(`🎯 Creating entityRef from: "${combinedValue}"`);

        // Parse the combined value: "displayValue\nEntity Name: uniqueValue"
        const lines = combinedValue.split('\n');
        
        if (lines.length !== 2 || !lines[1].startsWith('Entity Name: ')) {
          throw new Error(
            `Invalid combined value format. Expected "displayValue\\nEntity Name: uniqueValue", ` +
            `got: "${combinedValue}"`
          );
        }

        const displayValue = lines[0];
        const uniqueValue = lines[1].replace('Entity Name: ', '');
        
        ctx.logger.info(`👤 Display value: "${displayValue}"`);
        ctx.logger.info(`🔑 Unique value: "${uniqueValue}"`);

        // Create entityRef using the unique value as the entity name
        // Format: kind:namespace/name
        const entityRef = `${entityKind.toLowerCase()}:${entityNamespace}/${uniqueValue}`;

        ctx.logger.info(`✅ Created entityRef: ${entityRef}`);

        // Output the results
        ctx.output("entityRef", entityRef);
        ctx.output("displayValue", displayValue);
        ctx.output("uniqueValue", uniqueValue);

      } catch (error: any) {
        ctx.logger.error(`❌ EntityRef creation failed: ${error.message}`);
        throw new Error(`Failed to create entity reference: ${error.message}`);
      }
    },
  });
};





// yaml
# File 3: Template YAML
# your-template.yaml

apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: enhanced-entity-picker-clean
  title: "Enhanced Entity Picker - Clean Review Page"
  description: "Beautiful UX with clean review page format"
spec:
  owner: platform-team
  type: service

  parameters:
    - title: Select User
      required:
        - selectedUser
      properties:
        selectedUser:
          title: Choose User
          type: string
          ui:field: EnhancedEntityPicker
          ui:options:
            # 🎨 Beautiful display template (what user sees in dropdown)
            displayEntityFieldAfterFormatting: "${{ metadata.title }} - ${{ spec.profile.department }}"
            # 🔑 Unique identifier for resolution (includes metadata.name)
            uniqueIdentifierField: "metadata.name"
            catalogFilter:
              kind: User
            placeholder: "Select a team member..."

    

  steps:
    # 🎯 STEP 1: Create entityRef from unique identifier (no catalog API!)
    - id: resolve-user
      name: Resolve User EntityRef
      action: enhanced:createEntityRef
      input:
        combinedValue: ${{ parameters.selectedUser }}
        entityKind: User
        entityNamespace: default

   

    # 🎯 STEP 2: Use standard catalog:fetch with created entityRefs
    - id: fetch-user
      name: Fetch User Details
      action: catalog:fetch
      input:
        entityRef: ${{ steps['resolve-user'].output.entityRef }}

   

    # 🎉 STEP 3: Show it working
    - id: show-success
      name: Show Success
      action: debug:log
      input:
        message: |
          🎯 CLEAN REVIEW PAGE SUCCESS!

          👤 User Selection:
          - What User Saw: "${{ steps['resolve-user'].output.displayValue }}"
          - Unique Identifier: ${{ steps['resolve-user'].output.uniqueValue }}
          - EntityRef: ${{ steps['resolve-user'].output.entityRef }}

         
          📋 Full User Details:
          - Name: ${{ steps['fetch-user'].output.entity.metadata.name }}
          - Title: ${{ steps['fetch-user'].output.entity.metadata.title }}
          - Email: ${{ steps['fetch-user'].output.entity.spec.profile.email }}

         

          ✅ PERFECT SOLUTION:
          1. ✅ Beautiful UX - users see clean display values in dropdown
          2. ✅ Clean review page - shows "John Doe - Engineering\nEntity Name: jdoe"
          3. ✅ No catalog API needed in backend action
          4. ✅ Handles duplicates perfectly (uses unique metadata.name)
          5. ✅ Developer controls unique identifier field
          6. ✅ Works with any entity kind
          7. ✅ No hidden field issues

          🚀 This approach is simple, clean, and reliable!

