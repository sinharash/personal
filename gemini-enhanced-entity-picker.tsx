import React, { useEffect, useState, useCallback } from "react";
import { Autocomplete, TextField, Box, Typography } from "@mui/material";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { Entity } from "@backstage/catalog-model";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";

// A unique separator unlikely to appear in user data. This is the key to the solution.
const HIDDEN_SEPARATOR = "|||";

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
      catalogFilter?: CatalogFilter;
      placeholder?: string;
    }
  > {}

// Formats the display of an entity based on a template string
const formatEntityDisplay = (template: string, entity: Entity): string => {
  return template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    const value = trimmedPath.split(".").reduce((obj: any, key: string) => {
      return obj && obj[key] !== undefined ? obj[key] : "";
    }, entity);
    return value || "";
  });
};

// Extract only the visible part from form data (before the separator)
const extractVisiblePart = (formDataValue: string): string => {
  if (!formDataValue) return "";
  const parts = formDataValue.split(HIDDEN_SEPARATOR);
  return parts[0] || formDataValue; // Return the display part
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

  const displayTemplate =
    uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
    "${{ metadata.name }}";
  const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
  const placeholder =
    uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const response = await catalogApi.getEntities({ filter: catalogFilter });
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

  // When the component loads with existing data, parse the hidden name
  // from formData to re-select the correct entity in the dropdown.
  useEffect(() => {
    if (formData && entities.length > 0) {
      const parts = formData.split(HIDDEN_SEPARATOR);
      const hiddenName = parts.length > 1 ? parts[1] : parts[0]; // Handle both cases

      if (hiddenName) {
        const found = entities.find(
          (entity) => entity.metadata.name === hiddenName
        );
        setSelectedEntity(found || null);
      }
    } else {
      setSelectedEntity(null);
    }
  }, [formData, entities]);

  const handleChange = (event: any, newValue: Entity | null) => {
    // This always keeps the entity object in our local state for the UI
    setSelectedEntity(newValue);

    if (newValue) {
      // 1. Create the pretty string for the user to see.
      const displayValue = formatEntityDisplay(displayTemplate, newValue);
      // 2. Get the real name we need for the backend.
      const hiddenName = newValue.metadata.name;

      // 🔧 SMART FIX: Check if template is only metadata.name
      const isOnlyMetadataName =
        displayTemplate.trim() === "${{ metadata.name }}";

      if (isOnlyMetadataName) {
        // If template is only metadata.name, just store the name directly
        // No need for separator since both display and hidden are the same
        onChange(displayValue);
      } else {
        // 3. Normal case: Combine them into a single string for the form data.
        onChange(`${displayValue}${HIDDEN_SEPARATOR}${hiddenName}`);
      }
    } else {
      // Clear the form data if the selection is cleared.
      onChange("");
    }
  };

  // The options for the dropdown are just the raw entities.
  const displayOptions = entities
    .map((entity) => ({
      entity,
      displayText: formatEntityDisplay(displayTemplate, entity),
    }))
    .filter((option) => option.displayText && option.displayText.trim() !== "");

  return (
    <Box>
      <Autocomplete
        options={displayOptions}
        getOptionLabel={(option) => option.displayText}
        value={{
          entity: selectedEntity,
          displayText: selectedEntity
            ? formatEntityDisplay(displayTemplate, selectedEntity)
            : "",
        }}
        onChange={(event, newValue) =>
          handleChange(event, newValue?.entity || null)
        }
        loading={loading}
        disabled={disabled}
        isOptionEqualToValue={(option, value) => {
          if (!option?.entityId || !value?.entityId) {
            return false;
          }
          return option.entityId === value.entityId;
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={schema.title}
            placeholder={placeholder}
            error={!!rawErrors?.length}
            helperText={rawErrors?.length ? rawErrors[0] : schema.description}
            variant="outlined"
            fullWidth
            // 🔧 CRITICAL FIX: Always show only the visible part to users
            InputProps={{
              ...params.InputProps,
              value: extractVisiblePart(formData), // This hides the separator from users
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Typography variant="body1">{option.displayText}</Typography>
          </Box>
        )}
      />
    </Box>
  );
};

// import React, { useEffect, useState, useCallback } from "react";
// import { Autocomplete, TextField, Box, Typography } from "@mui/material";
// import { useApi } from "@backstage/core-plugin-api";
// import { catalogApiRef } from "@backstage/plugin-catalog-react";
// import { Entity } from "@backstage/catalog-model";
// import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";

// // A unique separator unlikely to appear in user data. This is the key to the solution.
// const HIDDEN_SEPARATOR = "|||";

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
//       catalogFilter?: CatalogFilter;
//       placeholder?: string;
//     }
//   > {}

// // Formats the display of an entity based on a template string
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
//     "${{ metadata.name }}";
//   const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
//   const placeholder =
//     uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

//   const fetchEntities = useCallback(async () => {
//     setLoading(true);
//     try {
//       const response = await catalogApi.getEntities({ filter: catalogFilter });
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

//   // When the component loads with existing data, parse the hidden name
//   // from formData to re-select the correct entity in the dropdown.
//   useEffect(() => {
//     if (formData && entities.length > 0) {
//       const parts = formData.split(HIDDEN_SEPARATOR);
//       const hiddenName = parts.length > 1 ? parts[1] : parts[0]; // Handle both cases

//       if (hiddenName) {
//         const found = entities.find(
//           (entity) => entity.metadata.name === hiddenName
//         );
//         setSelectedEntity(found || null);
//       }
//     } else {
//       setSelectedEntity(null);
//     }
//   }, [formData, entities]);

//   const handleChange = (event: any, newValue: Entity | null) => {
//     // This always keeps the entity object in our local state for the UI
//     setSelectedEntity(newValue);

//     if (newValue) {
//       // 1. Create the pretty string for the user to see.
//       const displayValue = formatEntityDisplay(displayTemplate, newValue);
//       // 2. Get the real name we need for the backend.
//       const hiddenName = newValue.metadata.name;

//       // 🔧 SMART FIX: Check if template is only metadata.name
//       const isOnlyMetadataName =
//         displayTemplate.trim() === "${{ metadata.name }}";

//       if (isOnlyMetadataName) {
//         // If template is only metadata.name, just store the name directly
//         // No need for separator since both display and hidden are the same
//         onChange(displayValue);
//       } else {
//         // 3. Normal case: Combine them into a single string for the form data.
//         onChange(`${displayValue}${HIDDEN_SEPARATOR}${hiddenName}`);
//       }
//     } else {
//       // Clear the form data if the selection is cleared.
//       onChange("");
//     }
//   };

//   // The options for the dropdown are just the raw entities.
//   const displayOptions = entities
//     .map((entity) => ({
//       entity,
//       displayText: formatEntityDisplay(displayTemplate, entity),
//     }))
//     .filter((option) => option.displayText && option.displayText.trim() !== "");

//   return (
//     <Box>
//       <Autocomplete
//         options={displayOptions}
//         getOptionLabel={(option) => option.displayText}
//         value={{
//           entity: selectedEntity,
//           displayText: selectedEntity
//             ? formatEntityDisplay(displayTemplate, selectedEntity)
//             : "",
//         }}
//         onChange={(event, newValue) =>
//           handleChange(event, newValue?.entity || null)
//         }
//         loading={loading}
//         disabled={disabled}
//         isOptionEqualToValue={(option, value) => {
//           if (!option?.entityId || !value?.entityId) {
//             return false;
//           }
//           return option.entityId === value.entityId;
//         }}
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
//             <Typography variant="body1">{option.displayText}</Typography>
//           </Box>
//         )}
//       />
//     </Box>
//   );
// };

// import React, { useEffect, useState, useCallback } from "react";
// import { Autocomplete, TextField, Box, Typography } from "@mui/material";
// import { useApi } from "@backstage/core-plugin-api";
// import { catalogApiRef } from "@backstage/plugin-catalog-react";
// import { Entity } from "@backstage/catalog-model";
// import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";

// // A unique separator unlikely to appear in user data. This is the key to the solution.
// const HIDDEN_SEPARATOR = "|||";

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
//       catalogFilter?: CatalogFilter;
//       placeholder?: string;
//     }
//   > {}

// // Formats the display of an entity based on a template string
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
//     "${{ metadata.name }}";
//   const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
//   const placeholder =
//     uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

//   const fetchEntities = useCallback(async () => {
//     setLoading(true);
//     try {
//       const response = await catalogApi.getEntities({ filter: catalogFilter });
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

//   // When the component loads with existing data, parse the hidden name
//   // from formData to re-select the correct entity in the dropdown.
//   useEffect(() => {
//     if (formData && entities.length > 0) {
//       const parts = formData.split(HIDDEN_SEPARATOR);
//       const hiddenName = parts.length > 1 ? parts[1] : null;

//       if (hiddenName) {
//         const found = entities.find(
//           (entity) => entity.metadata.name === hiddenName
//         );
//         setSelectedEntity(found || null);
//       }
//     } else {
//       setSelectedEntity(null);
//     }
//   }, [formData, entities]);

//   const handleChange = (event: any, newValue: Entity | null) => {
//     // This always keeps the entity object in our local state for the UI
//     setSelectedEntity(newValue);

//     if (newValue) {
//       // 1. Create the pretty string for the user to see.
//       const displayValue = formatEntityDisplay(displayTemplate, newValue);
//       // 2. Get the real name we need for the backend.
//       const hiddenName = newValue.metadata.name;

//       // 3. Combine them into a single string for the form data.
//       onChange(`${displayValue}${HIDDEN_SEPARATOR}${hiddenName}`);
//     } else {
//       // Clear the form data if the selection is cleared.
//       onChange("");
//     }
//   };

//   // The options for the dropdown are just the raw entities.
//   const displayOptions = entities
//     .map((entity) => ({
//       entity,
//       displayText: formatEntityDisplay(displayTemplate, entity),
//     }))
//     .filter((option) => option.displayText && option.displayText.trim() !== "");

//   return (
//     <Box>
//       <Autocomplete
//         options={displayOptions}
//         getOptionLabel={(option) => option.displayText}
//         value={{
//           entity: selectedEntity,
//           displayText: selectedEntity
//             ? formatEntityDisplay(displayTemplate, selectedEntity)
//             : "",
//         }}
//         onChange={(event, newValue) =>
//           handleChange(event, newValue?.entity || null)
//         }
//         loading={loading}
//         disabled={disabled}
//         isOptionEqualToValue={(option, value) => {
//           if (!option?.entityId || !value?.entityId) {
//             return false;
//           }
//           return option.entityId === value.entityId;
//         }}
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
//             <Typography variant="body1">{option.displayText}</Typography>
//           </Box>
//         )}
//       />
//     </Box>
//   );
// };
