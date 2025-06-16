// FILE: EnhancedEntityPicker.tsx

import React, { useEffect, useState, useCallback } from "react";
import { Autocomplete, TextField, Box, Typography } from "@mui/material";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { Entity, stringifyEntityRef } from "@backstage/catalog-model";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
import { get } from "lodash";

// A unique separator unlikely to appear in user data. This is the key to the solution.
const HIDDEN_SEPARATOR = "|||";

interface CatalogFilter {
  kind?: string;
  type?: string;
  [key: string]: any;
}

interface EnhancedEntityPickerProps
  extends FieldExtensionComponentProps<
    string, // The component's formData is the combined string
    {
      displayEntityFieldAfterFormatting?: string;
      catalogFilter?: CatalogFilter;
      placeholder?: string;
    }
  > {}

// Formats the display of an entity based on a template string
const formatEntityDisplay = (template: string, entity: Entity): string => {
  // The special `${entity.ref}` can be used if desired by the developer
  if (template === "${entity.ref}") {
    return stringifyEntityRef(entity);
  }
  return template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    // Use lodash's get for safe, deep access to object properties
    const value = get(entity, trimmedPath);
    return value !== undefined && value !== null ? String(value) : "";
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
  // This local state holds the full Entity object for the UI, independent of the string in formData
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  const displayTemplate =
    uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
    "${{ metadata.name }}";
  const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
  const placeholder =
    uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

  // Fetch entities from catalog when the component loads or filters change
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

  // When the component first loads with existing data, parse the hidden name
  // from the `formData` string to re-select the correct entity in the dropdown.
  useEffect(() => {
    if (formData && entities.length > 0) {
      const parts = formData.split(HIDDEN_SEPARATOR);
      const hiddenName = parts.length > 1 ? parts[parts.length - 1] : null;

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

  const handleChange = (
    _event: React.SyntheticEvent,
    newValue: Entity | null
  ) => {
    // Always update the local state to keep the UI in sync
    setSelectedEntity(newValue);

    if (newValue) {
      // 1. Create the pretty string for the user to see, based on the template.
      const displayValue = formatEntityDisplay(displayTemplate, newValue);
      // 2. Get the real name we need for the backend.
      const hiddenName = newValue.metadata.name;

      // 3. Combine them into a single string and submit it to the form.
      onChange(`${displayValue}${HIDDEN_SEPARATOR}${hiddenName}`);
    } else {
      // Clear the form data if the selection is cleared.
      onChange("");
    }
  };

  return (
    <Box>
      <Autocomplete<Entity>
        options={entities}
        // Tell Autocomplete to use our local state for its value
        value={selectedEntity}
        disabled={disabled}
        loading={loading}
        onChange={handleChange}
        // Tell Autocomplete how to get the display string for any given Entity object
        getOptionLabel={(option) =>
          formatEntityDisplay(displayTemplate, option)
        }
        // Tell Autocomplete how to compare two Entity objects for equality
        isOptionEqualToValue={(option, value) =>
          option.metadata.name === value?.metadata.name &&
          option.metadata.namespace === value?.metadata.namespace &&
          option.kind === value.kind
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
            <Typography variant="body1">
              {formatEntityDisplay(displayTemplate, option)}
            </Typography>
          </Box>
        )}
      />
    </Box>
  );
};
