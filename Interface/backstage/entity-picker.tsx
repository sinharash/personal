// Enhanced EntityPicker based on Backstage's EntityPicker with custom features
import React, { useCallback, useMemo } from "react";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
import { ScaffolderField } from "@backstage/plugin-scaffolder-react/alpha";
import { useApi } from "@backstage/core-plugin-api";
import {
  catalogApiRef,
  entityPresentationApiRef,
  EntityDisplayName,
} from "@backstage/plugin-catalog-react";
import { Entity, stringifyEntityRef } from "@backstage/catalog-model";
import {
  type EntityFilterQuery,
  CATALOG_FILTER_EXISTS,
} from "@backstage/catalog-client";
import { TextField, Autocomplete, createFilterOptions } from "@mui/material";
import type { AutocompleteChangeReason } from "@mui/material";
import useAsync from "react-use/esm/useAsync";

// Enhanced UI Options that extend EntityPicker options
interface EnhancedEntityPickerUiOptions {
  // Standard EntityPicker options
  allowArbitraryValues?: boolean;
  allowedKinds?: string[];
  catalogFilter?: Record<string, any>;
  defaultKind?: string;
  defaultNamespace?: string;

  // Enhanced options
  displayEntityFieldAfterFormatting?: string;
  uniqueIdentifierField?: string;
  hiddenFieldName?: string;
  placeholder?: string;
}

// Schema definition matching EntityPicker pattern
export const EnhancedEntityPickerSchema = {
  uiOptions: {
    type: "object",
    properties: {
      allowArbitraryValues: {
        type: "boolean",
        description: "Whether to allow arbitrary user input. Defaults to true.",
      },
      allowedKinds: {
        type: "array",
        description: "DEPRECATED: Use catalogFilter instead.",
        items: {
          type: "string",
        },
      },
      catalogFilter: {
        type: "object",
        description: "Filter entities by any field(s) of an entity",
      },
      defaultKind: {
        type: "string",
        description: "The default entity kind",
      },
      defaultNamespace: {
        type: "string",
        description: "The default entity namespace",
      },
      displayEntityFieldAfterFormatting: {
        type: "string",
        description:
          'Template for displaying entity names (e.g., "{{ metadata.title }} - {{ spec.profile.email }}")',
      },
      uniqueIdentifierField: {
        type: "string",
        description:
          "Field to use as unique identifier (default: metadata.name)",
      },
      hiddenFieldName: {
        type: "string",
        description: "Name of hidden field to store full entity reference",
      },
      placeholder: {
        type: "string",
        description: "Placeholder text for the input field",
      },
    },
  },
  returnValue: {
    type: "string",
  },
};

// Utility functions for custom formatting
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  try {
    return path.split(".").reduce((current, key) => {
      return current && typeof current === "object" ? current[key] : undefined;
    }, obj);
  } catch {
    return undefined;
  }
};

const formatDisplayValue = (template: string, entity: Entity): string => {
  if (!template || !entity) {
    return entity?.metadata?.title || entity?.metadata?.name || "";
  }

  try {
    // Handle fallback syntax: "property1 || property2"
    if (template.includes(" || ")) {
      const paths = template.split(" || ").map((p) => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        if (value && String(value).trim()) return String(value);
      }
      return entity?.metadata?.name || "";
    }

    // Handle template syntax: "{{ property }}"
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return value ? String(value) : "";
    });
  } catch {
    return entity?.metadata?.name || "";
  }
};

// Convert catalog filter to EntityFilterQuery (from Backstage EntityPicker)
function convertOpsValues(value: any): string | string[] | symbol {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    if (value.exists === true) {
      return CATALOG_FILTER_EXISTS;
    }
  }
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  return String(value);
}

function buildEntityFilterQuery(
  uiOptions: EnhancedEntityPickerUiOptions
): EntityFilterQuery | undefined {
  const { catalogFilter, allowedKinds, defaultKind, defaultNamespace } =
    uiOptions;

  if (!catalogFilter && !allowedKinds && !defaultKind) {
    return undefined;
  }

  const query: Record<string, string | string[] | symbol> = {};

  // Handle catalogFilter
  if (catalogFilter && typeof catalogFilter === "object") {
    for (const [key, value] of Object.entries(catalogFilter)) {
      if (value === undefined || value === null) continue;

      const convertedValue = convertOpsValues(value);
      if (convertedValue !== undefined) {
        query[key] = convertedValue;
      }
    }
  }

  // Handle legacy allowedKinds
  if (allowedKinds && !catalogFilter?.kind) {
    query.kind = allowedKinds;
  }

  // Handle defaultKind
  if (defaultKind && !query.kind) {
    query.kind = defaultKind;
  }

  // Handle defaultNamespace
  if (defaultNamespace) {
    query["metadata.namespace"] = defaultNamespace;
  }

  return Object.keys(query).length > 0
    ? (query as EntityFilterQuery)
    : undefined;
}

/**
 * Enhanced EntityPicker field extension that extends Backstage's EntityPicker
 * with custom display formatting and entity reference storage capabilities
 */
export const EnhancedEntityPicker = (
  props: FieldExtensionComponentProps<string>
) => {
  // Simplified without translation for now - can be added back if available
  const {
    schema: { title = "Entity", description },
    uiSchema,
    formData,
    formContext,
    onChange,
    rawErrors = [],
    required = false,
    disabled = false,
    // These props are part of FieldExtensionComponentProps but not directly used
    // in this component - they're handled by the form system
    idSchema: _idSchema,
    errorSchema: _errorSchema,
    registry: _registry,
    name,
    onBlur,
    onFocus,
  } = props;

  const catalogApi = useApi(catalogApiRef);
  const entityPresentationApi = useApi(entityPresentationApiRef);

  // Extract UI options
  const uiOptions: EnhancedEntityPickerUiOptions = uiSchema["ui:options"] || {};
  const {
    allowArbitraryValues = true,
    displayEntityFieldAfterFormatting,
    uniqueIdentifierField = "metadata.name",
    hiddenFieldName,
    placeholder = "Select an entity...",
  } = uiOptions;

  // Build filter query using EntityPicker's logic
  const entityFilterQuery = useMemo(() => {
    return buildEntityFilterQuery(uiOptions);
  }, [uiOptions]);

  // Fetch entities using EntityPicker's approach
  const { value: entitiesWithPresentation, loading } = useAsync(async () => {
    if (!catalogApi) return undefined;

    const { items } = await catalogApi.getEntities({
      filter: entityFilterQuery,
    });

    const entityRefs = items.map(stringifyEntityRef);

    // Try to get presentation data if API is available
    let entityRefToPresentation: Map<string, any> | undefined;
    try {
      if (
        entityPresentationApi &&
        typeof entityPresentationApi.forEntityRefs === "function"
      ) {
        entityRefToPresentation = await entityPresentationApi.forEntityRefs(
          entityRefs
        );
      }
    } catch (error) {
      console.warn(
        "EntityPresentationApi not available, using fallback display"
      );
    }

    return {
      entities: items,
      entityRefToPresentation,
    };
  }, [catalogApi, entityPresentationApi, entityFilterQuery]);

  const entities = entitiesWithPresentation?.entities || [];
  const entityRefToPresentation =
    entitiesWithPresentation?.entityRefToPresentation;

  // Find selected entity with enhanced matching
  const selectedEntity = useMemo(() => {
    if (!formData || !entities.length) return null;

    return (
      entities.find((entity) => {
        // Check if formData matches the display value (enhanced feature)
        if (displayEntityFieldAfterFormatting) {
          const displayValue = formatDisplayValue(
            displayEntityFieldAfterFormatting,
            entity
          );
          if (displayValue === formData) return true;
        }

        // Check entity reference
        const entityRef = stringifyEntityRef(entity);
        if (entityRef === formData) return true;

        // Check custom identifier field (enhanced feature)
        if (uniqueIdentifierField !== "metadata.name") {
          const customRef = getNestedValue(entity, uniqueIdentifierField);
          if (customRef && String(customRef) === formData) return true;
        }

        // Check presentation title (EntityPicker compatibility)
        const presentation = entityRefToPresentation?.get(entityRef);
        if (presentation?.primaryTitle === formData) return true;

        return false;
      }) || null
    );
  }, [
    formData,
    entities,
    displayEntityFieldAfterFormatting,
    uniqueIdentifierField,
    entityRefToPresentation,
  ]);

  // Enhanced onChange handler
  const handleChange = useCallback(
    (
      _event: React.SyntheticEvent,
      value: Entity | null,
      _reason: AutocompleteChangeReason
    ) => {
      if (!value) {
        onChange("");
        return;
      }

      // Handle Entity objects - Enhanced Logic
      let displayValue: string;
      if (displayEntityFieldAfterFormatting) {
        // Use custom formatting template (enhanced feature)
        displayValue = formatDisplayValue(
          displayEntityFieldAfterFormatting,
          value
        );
      } else {
        // Use EntityPicker's presentation logic
        const entityRef = stringifyEntityRef(value);
        const presentation = entityRefToPresentation?.get(entityRef);
        displayValue =
          presentation?.primaryTitle ||
          value.metadata.title ||
          value.metadata.name;
      }

      // Store display value in main field (what user sees on review)
      onChange(displayValue);

      // Store entity reference in hidden field for template steps (enhanced feature)
      if (hiddenFieldName && formContext?.formData) {
        try {
          const entityRef = stringifyEntityRef(value);
          if (entityRef) {
            formContext.formData[hiddenFieldName] = entityRef;
          }
        } catch (error) {
          console.warn("Failed to store entity reference:", error);
        }
      }
    },
    [
      onChange,
      displayEntityFieldAfterFormatting,
      hiddenFieldName,
      formContext,
      entityRefToPresentation,
    ]
  );

  // Option label formatter - only for Entity objects
  const getOptionLabel = useCallback(
    (option: Entity) => {
      // Enhanced: Use custom formatting if provided
      if (displayEntityFieldAfterFormatting) {
        return formatDisplayValue(displayEntityFieldAfterFormatting, option);
      }

      // EntityPicker: Use presentation API
      const entityRef = stringifyEntityRef(option);
      const presentation = entityRefToPresentation?.get(entityRef);
      return (
        presentation?.primaryTitle ||
        option.metadata.title ||
        option.metadata.name
      );
    },
    [displayEntityFieldAfterFormatting, entityRefToPresentation]
  );

  // Render option formatter - only for Entity objects
  const renderOption = useCallback(
    (option: Entity) => {
      // Enhanced: Use custom formatting in dropdown if provided
      if (displayEntityFieldAfterFormatting) {
        const displayText = formatDisplayValue(
          displayEntityFieldAfterFormatting,
          option
        );
        return <span>{displayText}</span>;
      }

      // EntityPicker: Use EntityDisplayName component
      return <EntityDisplayName entityRef={stringifyEntityRef(option)} />;
    },
    [displayEntityFieldAfterFormatting]
  );

  return (
    <ScaffolderField
      rawDescription={description}
      rawErrors={rawErrors}
      required={required}
      disabled={disabled}
    >
      <Autocomplete<Entity, false, boolean, boolean>
        id={name}
        value={selectedEntity}
        loading={loading}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={onFocus}
        options={entities}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={(option, value) =>
          stringifyEntityRef(option) === stringifyEntityRef(value)
        }
        autoSelect
        freeSolo={allowArbitraryValues}
        renderInput={(params) => (
          <TextField
            {...params}
            label={title}
            margin="dense"
            variant="outlined"
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            InputProps={params.InputProps}
            error={rawErrors.length > 0}
          />
        )}
        renderOption={(props, option) => (
          <li {...props} key={stringifyEntityRef(option)}>
            {renderOption(option)}
          </li>
        )}
        filterOptions={createFilterOptions({
          stringify: (option: Entity) => {
            // Enhanced: Use custom formatting for filtering if provided
            if (displayEntityFieldAfterFormatting) {
              return formatDisplayValue(
                displayEntityFieldAfterFormatting,
                option
              );
            }

            // EntityPicker: Use presentation API for filtering
            const entityRef = stringifyEntityRef(option);
            return (
              entityRefToPresentation?.get(entityRef)?.primaryTitle ||
              option.metadata.name
            );
          },
        })}
      />
    </ScaffolderField>
  );
};

// import React, { useCallback, useMemo, useState, useEffect } from "react";
// import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
// import { useApi } from "@backstage/core-plugin-api";
// import {
//   catalogApiRef,
//   EntityDisplayName,
// } from "@backstage/plugin-catalog-react";
// import { Entity, stringifyEntityRef } from "@backstage/catalog-model";
// import { TextField, Autocomplete } from "@mui/material";
// import { EntityFilterQuery } from "@backstage/catalog-client";

// // Schema definition for the field extension
// export const EnhancedEntityPickerSchema = {
//   uiOptions: {
//     type: "object",
//     properties: {
//       displayEntityFieldAfterFormatting: {
//         type: "string",
//         description:
//           'Template for displaying entity names (e.g., "{{ metadata.title }} - {{ spec.profile.email }}")',
//       },
//       catalogFilter: {
//         type: "object",
//         description: "Filter entities by kind, type, or other properties",
//       },
//       uniqueIdentifierField: {
//         type: "string",
//         description:
//           "Field to use as unique identifier (default: metadata.name)",
//       },
//       defaultKind: {
//         type: "string",
//         description: "Default entity kind",
//       },
//       defaultNamespace: {
//         type: "string",
//         description: "Default entity namespace",
//       },
//       allowArbitraryValues: {
//         type: "boolean",
//         description: "Allow arbitrary user input",
//       },
//       hiddenFieldName: {
//         type: "string",
//         description: "Name of hidden field to store full entity reference",
//       },
//       placeholder: {
//         type: "string",
//         description: "Placeholder text for the input field",
//       },
//     },
//   },
//   returnValue: {
//     type: "string",
//   },
// };

// // Type for UI options
// interface UIOptions {
//   displayEntityFieldAfterFormatting?: string;
//   catalogFilter?: Record<string, any>;
//   uniqueIdentifierField?: string;
//   defaultKind?: string;
//   defaultNamespace?: string;
//   allowArbitraryValues?: boolean;
//   hiddenFieldName?: string;
//   placeholder?: string;
// }

// // Utility functions
// const getNestedValue = (obj: any, path: string): any => {
//   if (!obj || !path) return undefined;
//   try {
//     return path.split(".").reduce((current, key) => {
//       return current && typeof current === "object" ? current[key] : undefined;
//     }, obj);
//   } catch {
//     return undefined;
//   }
// };

// const formatDisplayValue = (template: string, entity: Entity): string => {
//   if (!template || !entity) {
//     return entity?.metadata?.title || entity?.metadata?.name || "";
//   }

//   try {
//     // Handle fallback syntax: "property1 || property2"
//     if (template.includes(" || ")) {
//       const paths = template.split(" || ").map((p) => p.trim());
//       for (const path of paths) {
//         const value = getNestedValue(entity, path);
//         if (value && String(value).trim()) return String(value);
//       }
//       return entity?.metadata?.name || "";
//     }

//     // Handle template syntax: "{{ property }}"
//     return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
//       const value = getNestedValue(entity, expression.trim());
//       return value ? String(value) : "";
//     });
//   } catch {
//     return entity?.metadata?.name || "";
//   }
// };

// // Simple filter query builder - similar to EntityPicker's approach
// const buildFilterQuery = (
//   catalogFilter: Record<string, any> | undefined
// ): EntityFilterQuery => {
//   if (!catalogFilter) return {};

//   const query: EntityFilterQuery = {};

//   // Handle simple mappings like EntityPicker does
//   if (catalogFilter.kind) {
//     query.kind = catalogFilter.kind;
//   }
//   if (catalogFilter.type) {
//     query["spec.type"] = catalogFilter.type;
//   }
//   if (catalogFilter.namespace) {
//     query["metadata.namespace"] = catalogFilter.namespace;
//   }

//   return query;
// };

// // Safe UI options extraction
// const extractUIOptions = (uiSchema: any): UIOptions => {
//   const options = uiSchema?.["ui:options"] || {};

//   return {
//     displayEntityFieldAfterFormatting:
//       options.displayEntityFieldAfterFormatting,
//     catalogFilter: options.catalogFilter,
//     uniqueIdentifierField: options.uniqueIdentifierField || "metadata.name",
//     defaultKind: options.defaultKind || "Component",
//     defaultNamespace: options.defaultNamespace || "default",
//     allowArbitraryValues: options.allowArbitraryValues !== false, // Default to true
//     hiddenFieldName: options.hiddenFieldName,
//     placeholder: options.placeholder || "Select an entity...",
//   };
// };

// /**
//  * Enhanced EntityPicker field extension that provides:
//  * - Custom display formatting for entities
//  * - Flexible catalog filtering
//  * - Hidden field storage for entity references
//  * - Full compatibility with scaffolder templates
//  */
// export const EnhancedEntityPicker = (
//   props: FieldExtensionComponentProps<string>
// ) => {
//   const {
//     onChange,
//     schema: { title = "Entity", description },
//     uiSchema,
//     formData,
//     formContext,
//     required = false,
//     rawErrors = [],
//     disabled = false,
//   } = props;

//   const catalogApi = useApi(catalogApiRef);
//   const [inputValue, setInputValue] = useState("");
//   const [entities, setEntities] = useState<Entity[]>([]);
//   const [loading, setLoading] = useState(false);

//   // Extract UI options
//   const {
//     displayEntityFieldAfterFormatting,
//     catalogFilter,
//     uniqueIdentifierField,
//     allowArbitraryValues,
//     hiddenFieldName,
//     placeholder,
//   } = extractUIOptions(uiSchema);

//   // Build filter query
//   const filterQuery = useMemo(() => {
//     return buildFilterQuery(catalogFilter);
//   }, [catalogFilter]);

//   // Fetch entities - non-blocking approach like EntityPicker
//   useEffect(() => {
//     let cancelled = false;

//     const fetchEntities = async () => {
//       setLoading(true);
//       try {
//         const response = await catalogApi.getEntities({
//           filter: filterQuery,
//         });

//         if (!cancelled) {
//           setEntities(response.items || []);
//         }
//       } catch (error) {
//         console.error("Failed to fetch entities:", error);
//         if (!cancelled) {
//           setEntities([]);
//         }
//       } finally {
//         if (!cancelled) {
//           setLoading(false);
//         }
//       }
//     };

//     fetchEntities();

//     return () => {
//       cancelled = true;
//     };
//   }, [catalogApi, filterQuery]);

//   // Find selected entity - now matching against display value
//   const selectedEntity = useMemo(() => {
//     if (!formData || !entities.length) return null;

//     return (
//       entities.find((entity) => {
//         // Check if formData matches the display value
//         const displayValue = displayEntityFieldAfterFormatting
//           ? formatDisplayValue(displayEntityFieldAfterFormatting, entity)
//           : entity.metadata.title || entity.metadata.name;

//         // Also check entity reference for backwards compatibility
//         const entityRef = stringifyEntityRef(entity);
//         const customRef = getNestedValue(entity, uniqueIdentifierField);
//         const customRefString = customRef ? String(customRef) : null;

//         return (
//           displayValue === formData ||
//           entityRef === formData ||
//           customRefString === formData
//         );
//       }) || null
//     );
//   }, [
//     formData,
//     entities,
//     displayEntityFieldAfterFormatting,
//     uniqueIdentifierField,
//   ]);

//   // Enhanced onChange handler
//   const handleChange = useCallback(
//     (
//       _event: React.SyntheticEvent,
//       value: Entity | string | null,
//       _reason: string
//     ) => {
//       if (!value) {
//         onChange("");
//         return;
//       }

//       // Handle string values (for freeSolo/arbitrary input)
//       if (typeof value === "string") {
//         onChange(value);
//         return;
//       }

//       // Handle Entity objects
//       // 🎯 KEY FIX: Store the display value that user sees, not the entity reference
//       let displayValue: string;
//       if (displayEntityFieldAfterFormatting) {
//         // Use the formatted display value that user selected
//         displayValue = formatDisplayValue(
//           displayEntityFieldAfterFormatting,
//           value
//         );
//       } else {
//         // Fallback to title or name (what user sees in dropdown)
//         displayValue = value.metadata.title || value.metadata.name;
//       }

//       // Store the display value in the main field (this shows on review page)
//       onChange(displayValue);

//       // Store entity reference in hidden field for template steps
//       if (hiddenFieldName && formContext?.formData) {
//         try {
//           const entityRef = stringifyEntityRef(value);
//           if (entityRef) {
//             formContext.formData[hiddenFieldName] = entityRef;
//           }
//         } catch (error) {
//           console.warn("Failed to store entity reference:", error);
//         }
//       }
//     },
//     [onChange, displayEntityFieldAfterFormatting, hiddenFieldName, formContext]
//   );

//   // Handle input change
//   const handleInputChange = useCallback(
//     (_event: React.SyntheticEvent, value: string, reason: string) => {
//       setInputValue(value);

//       if (allowArbitraryValues && value && reason === "input") {
//         const matchesExistingEntity = entities.some((e) => {
//           const displayValue = displayEntityFieldAfterFormatting
//             ? formatDisplayValue(displayEntityFieldAfterFormatting, e)
//             : e.metadata.title || e.metadata.name;
//           return displayValue === value;
//         });

//         if (!matchesExistingEntity) {
//           onChange(value);
//         }
//       }
//     },
//     [
//       allowArbitraryValues,
//       entities,
//       displayEntityFieldAfterFormatting,
//       onChange,
//     ]
//   );

//   // Custom option label formatter - this is what shows in the input field
//   const getOptionLabel = useCallback(
//     (option: Entity | string) => {
//       if (typeof option === "string") {
//         return option;
//       }

//       // Use custom formatting if provided
//       if (displayEntityFieldAfterFormatting) {
//         return formatDisplayValue(displayEntityFieldAfterFormatting, option);
//       }

//       // Fallback to title or name
//       return option.metadata.title || option.metadata.name;
//     },
//     [displayEntityFieldAfterFormatting]
//   );

//   // Option equality check
//   const isOptionEqualToValue = useCallback(
//     (option: Entity | string, value: Entity | string) => {
//       if (typeof option === "string" && typeof value === "string") {
//         return option === value;
//       }
//       if (typeof option === "object" && typeof value === "object") {
//         return stringifyEntityRef(option) === stringifyEntityRef(value);
//       }
//       if (typeof option === "object" && typeof value === "string") {
//         return (
//           stringifyEntityRef(option) === value ||
//           getOptionLabel(option) === value
//         );
//       }
//       if (typeof option === "string" && typeof value === "object") {
//         return (
//           option === stringifyEntityRef(value) ||
//           option === getOptionLabel(value)
//         );
//       }
//       return false;
//     },
//     [getOptionLabel]
//   );

//   return (
//     <Autocomplete<Entity | string, false, boolean, boolean>
//       options={entities}
//       value={selectedEntity}
//       inputValue={inputValue}
//       onChange={handleChange}
//       onInputChange={handleInputChange}
//       getOptionLabel={getOptionLabel}
//       isOptionEqualToValue={isOptionEqualToValue}
//       loading={loading}
//       disabled={disabled}
//       freeSolo={allowArbitraryValues}
//       renderInput={(params) => (
//         <TextField
//           {...params}
//           label={title}
//           helperText={description}
//           placeholder={placeholder}
//           required={required}
//           error={rawErrors.length > 0}
//           variant="outlined"
//           margin="normal"
//         />
//       )}
//       renderOption={(props, entity) => {
//         // THIS IS THE KEY FIX: Use custom formatting in dropdown options
//         if (typeof entity === "string") {
//           return (
//             <li {...props} key={entity}>
//               {entity}
//             </li>
//           );
//         }

//         // Use custom display formatting if provided
//         const displayText = displayEntityFieldAfterFormatting
//           ? formatDisplayValue(displayEntityFieldAfterFormatting, entity)
//           : undefined;

//         return (
//           <li {...props} key={stringifyEntityRef(entity)}>
//             {displayText ? (
//               // Show custom formatted text
//               <span>{displayText}</span>
//             ) : (
//               // Fallback to EntityDisplayName for default formatting
//               <EntityDisplayName entityRef={stringifyEntityRef(entity)} />
//             )}
//           </li>
//         );
//       }}
//     />
//   );
// };

// import React, { useCallback, useMemo, useState, useEffect } from "react";
// import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
// import { useApi } from "@backstage/core-plugin-api";
// import {
//   catalogApiRef,
//   EntityDisplayName,
// } from "@backstage/plugin-catalog-react";
// import { Entity, stringifyEntityRef } from "@backstage/catalog-model";
// import { TextField, Autocomplete } from "@mui/material";
// import { EntityFilterQuery } from "@backstage/catalog-client";

// // Schema definition for the field extension
// export const EnhancedEntityPickerSchema = {
//   uiOptions: {
//     type: "object",
//     properties: {
//       displayEntityFieldAfterFormatting: {
//         type: "string",
//         description:
//           'Template for displaying entity names (e.g., "{{ metadata.title }} - {{ spec.profile.email }}")',
//       },
//       catalogFilter: {
//         type: "object",
//         description: "Filter entities by kind, type, or other properties",
//       },
//       uniqueIdentifierField: {
//         type: "string",
//         description:
//           "Field to use as unique identifier (default: metadata.name)",
//       },
//       defaultKind: {
//         type: "string",
//         description: "Default entity kind",
//       },
//       defaultNamespace: {
//         type: "string",
//         description: "Default entity namespace",
//       },
//       allowArbitraryValues: {
//         type: "boolean",
//         description: "Allow arbitrary user input",
//       },
//       hiddenFieldName: {
//         type: "string",
//         description: "Name of hidden field to store full entity reference",
//       },
//       placeholder: {
//         type: "string",
//         description: "Placeholder text for the input field",
//       },
//     },
//   },
//   returnValue: {
//     type: "string",
//   },
// };

// // Type for UI options
// interface UIOptions {
//   displayEntityFieldAfterFormatting?: string;
//   catalogFilter?: Record<string, any>;
//   uniqueIdentifierField?: string;
//   defaultKind?: string;
//   defaultNamespace?: string;
//   allowArbitraryValues?: boolean;
//   hiddenFieldName?: string;
//   placeholder?: string;
// }

// // Utility functions
// const getNestedValue = (obj: any, path: string): any => {
//   if (!obj || !path) return undefined;
//   try {
//     return path.split(".").reduce((current, key) => {
//       return current && typeof current === "object" ? current[key] : undefined;
//     }, obj);
//   } catch {
//     return undefined;
//   }
// };

// const formatDisplayValue = (template: string, entity: Entity): string => {
//   if (!template || !entity) {
//     return entity?.metadata?.title || entity?.metadata?.name || "";
//   }

//   try {
//     // Handle fallback syntax: "property1 || property2"
//     if (template.includes(" || ")) {
//       const paths = template.split(" || ").map((p) => p.trim());
//       for (const path of paths) {
//         const value = getNestedValue(entity, path);
//         if (value && String(value).trim()) return String(value);
//       }
//       return entity?.metadata?.name || "";
//     }

//     // Handle template syntax: "{{ property }}"
//     return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
//       const value = getNestedValue(entity, expression.trim());
//       return value ? String(value) : "";
//     });
//   } catch {
//     return entity?.metadata?.name || "";
//   }
// };

// // Simple filter query builder - similar to EntityPicker's approach
// const buildFilterQuery = (
//   catalogFilter: Record<string, any> | undefined
// ): EntityFilterQuery => {
//   if (!catalogFilter) return {};

//   const query: EntityFilterQuery = {};

//   // Handle simple mappings like EntityPicker does
//   if (catalogFilter.kind) {
//     query.kind = catalogFilter.kind;
//   }
//   if (catalogFilter.type) {
//     query["spec.type"] = catalogFilter.type;
//   }
//   if (catalogFilter.namespace) {
//     query["metadata.namespace"] = catalogFilter.namespace;
//   }

//   return query;
// };

// // Safe UI options extraction
// const extractUIOptions = (uiSchema: any): UIOptions => {
//   const options = uiSchema?.["ui:options"] || {};

//   return {
//     displayEntityFieldAfterFormatting:
//       options.displayEntityFieldAfterFormatting,
//     catalogFilter: options.catalogFilter,
//     uniqueIdentifierField: options.uniqueIdentifierField || "metadata.name",
//     defaultKind: options.defaultKind || "Component",
//     defaultNamespace: options.defaultNamespace || "default",
//     allowArbitraryValues: options.allowArbitraryValues !== false, // Default to true
//     hiddenFieldName: options.hiddenFieldName,
//     placeholder: options.placeholder || "Select an entity...",
//   };
// };

// /**
//  * Enhanced EntityPicker field extension that provides:
//  * - Custom display formatting for entities
//  * - Flexible catalog filtering
//  * - Hidden field storage for entity references
//  * - Full compatibility with scaffolder templates
//  */
// export const EnhancedEntityPicker = (
//   props: FieldExtensionComponentProps<string>
// ) => {
//   const {
//     onChange,
//     schema: { title = "Entity", description },
//     uiSchema,
//     formData,
//     formContext,
//     required = false,
//     rawErrors = [],
//     disabled = false,
//   } = props;

//   const catalogApi = useApi(catalogApiRef);
//   const [inputValue, setInputValue] = useState("");
//   const [entities, setEntities] = useState<Entity[]>([]);
//   const [loading, setLoading] = useState(false);

//   // Extract UI options
//   const {
//     displayEntityFieldAfterFormatting,
//     catalogFilter,
//     uniqueIdentifierField,
//     allowArbitraryValues,
//     hiddenFieldName,
//     placeholder,
//   } = extractUIOptions(uiSchema);

//   // Build filter query
//   const filterQuery = useMemo(() => {
//     return buildFilterQuery(catalogFilter);
//   }, [catalogFilter]);

//   // Fetch entities - non-blocking approach like EntityPicker
//   useEffect(() => {
//     let cancelled = false;

//     const fetchEntities = async () => {
//       setLoading(true);
//       try {
//         const response = await catalogApi.getEntities({
//           filter: filterQuery,
//         });

//         if (!cancelled) {
//           setEntities(response.items || []);
//         }
//       } catch (error) {
//         console.error("Failed to fetch entities:", error);
//         if (!cancelled) {
//           setEntities([]);
//         }
//       } finally {
//         if (!cancelled) {
//           setLoading(false);
//         }
//       }
//     };

//     fetchEntities();

//     return () => {
//       cancelled = true;
//     };
//   }, [catalogApi, filterQuery]);

//   // Find selected entity
//   const selectedEntity = useMemo(() => {
//     if (!formData || !entities.length) return null;

//     return (
//       entities.find((entity) => {
//         const entityRef = stringifyEntityRef(entity);
//         const customRef = getNestedValue(entity, uniqueIdentifierField);
//         const customRefString = customRef ? String(customRef) : null;
//         return entityRef === formData || customRefString === formData;
//       }) || null
//     );
//   }, [formData, entities, uniqueIdentifierField]);

//   // Enhanced onChange handler
//   const handleChange = useCallback(
//     (
//       _event: React.SyntheticEvent,
//       value: Entity | string | null,
//       _reason: string
//     ) => {
//       if (!value) {
//         onChange("");
//         return;
//       }

//       // Handle string values (for freeSolo/arbitrary input)
//       if (typeof value === "string") {
//         onChange(value);
//         return;
//       }

//       // Handle Entity objects
//       let entityValue: string;
//       if (uniqueIdentifierField !== "metadata.name") {
//         const customValue = getNestedValue(value, uniqueIdentifierField);
//         entityValue = customValue
//           ? String(customValue)
//           : stringifyEntityRef(value);
//       } else {
//         entityValue = stringifyEntityRef(value);
//       }

//       onChange(entityValue);

//       // Store entity reference in hidden field if configured
//       if (hiddenFieldName && formContext?.formData) {
//         try {
//           const entityRef = stringifyEntityRef(value);
//           if (entityRef) {
//             formContext.formData[hiddenFieldName] = entityRef;
//           }
//         } catch (error) {
//           console.warn("Failed to store entity reference:", error);
//         }
//       }
//     },
//     [onChange, uniqueIdentifierField, hiddenFieldName, formContext]
//   );

//   // Handle input change
//   const handleInputChange = useCallback(
//     (_event: React.SyntheticEvent, value: string, reason: string) => {
//       setInputValue(value);

//       if (allowArbitraryValues && value && reason === "input") {
//         const matchesExistingEntity = entities.some((e) => {
//           const displayValue = displayEntityFieldAfterFormatting
//             ? formatDisplayValue(displayEntityFieldAfterFormatting, e)
//             : e.metadata.title || e.metadata.name;
//           return displayValue === value;
//         });

//         if (!matchesExistingEntity) {
//           onChange(value);
//         }
//       }
//     },
//     [
//       allowArbitraryValues,
//       entities,
//       displayEntityFieldAfterFormatting,
//       onChange,
//     ]
//   );

//   // Custom option label formatter - this is what shows in the input field
//   const getOptionLabel = useCallback(
//     (option: Entity | string) => {
//       if (typeof option === "string") {
//         return option;
//       }

//       // Use custom formatting if provided
//       if (displayEntityFieldAfterFormatting) {
//         return formatDisplayValue(displayEntityFieldAfterFormatting, option);
//       }

//       // Fallback to title or name
//       return option.metadata.title || option.metadata.name;
//     },
//     [displayEntityFieldAfterFormatting]
//   );

//   // Option equality check
//   const isOptionEqualToValue = useCallback(
//     (option: Entity | string, value: Entity | string) => {
//       if (typeof option === "string" && typeof value === "string") {
//         return option === value;
//       }
//       if (typeof option === "object" && typeof value === "object") {
//         return stringifyEntityRef(option) === stringifyEntityRef(value);
//       }
//       if (typeof option === "object" && typeof value === "string") {
//         return (
//           stringifyEntityRef(option) === value ||
//           getOptionLabel(option) === value
//         );
//       }
//       if (typeof option === "string" && typeof value === "object") {
//         return (
//           option === stringifyEntityRef(value) ||
//           option === getOptionLabel(value)
//         );
//       }
//       return false;
//     },
//     [getOptionLabel]
//   );

//   return (
//     <Autocomplete<Entity | string, false, boolean, boolean>
//       options={entities}
//       value={selectedEntity}
//       inputValue={inputValue}
//       onChange={handleChange}
//       onInputChange={handleInputChange}
//       getOptionLabel={getOptionLabel}
//       isOptionEqualToValue={isOptionEqualToValue}
//       loading={loading}
//       disabled={disabled}
//       freeSolo={allowArbitraryValues}
//       renderInput={(params) => (
//         <TextField
//           {...params}
//           label={title}
//           helperText={description}
//           placeholder={placeholder}
//           required={required}
//           error={rawErrors.length > 0}
//           variant="outlined"
//           margin="normal"
//         />
//       )}
//       renderOption={(props, entity) => {
//         // THIS IS THE KEY FIX: Use custom formatting in dropdown options
//         if (typeof entity === "string") {
//           return (
//             <li {...props} key={entity}>
//               {entity}
//             </li>
//           );
//         }

//         // Use custom display formatting if provided
//         const displayText = displayEntityFieldAfterFormatting
//           ? formatDisplayValue(displayEntityFieldAfterFormatting, entity)
//           : undefined;

//         return (
//           <li {...props} key={stringifyEntityRef(entity)}>
//             {displayText ? (
//               // Show custom formatted text
//               <span>{displayText}</span>
//             ) : (
//               // Fallback to EntityDisplayName for default formatting
//               <EntityDisplayName entityRef={stringifyEntityRef(entity)} />
//             )}
//           </li>
//         );
//       }}
//     />
//   );
// };
