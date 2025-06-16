// FILE: EnhancedEntityPicker.tsx

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Autocomplete, TextField, Box, Typography } from "@mui/material";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { Entity, stringifyEntityRef } from "@backstage/catalog-model";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
import { get } from "lodash";

// Define the shape of the ui:options this component accepts from the YAML
interface CustomEntityPickerUiOptions {
  displayFormat?: string;
  catalogFilter?: { kind?: string; [key: string]: any };
  placeholder?: string;
  outputTargetField?: string;
  output?: Record<string, string>;
}

// Helper function to create a string from a template and an entity
const formatFromTemplate = (
  entity: Entity,
  templateString: string | undefined
): string => {
  if (!templateString) return "";

  if (templateString === "${entity.ref}") {
    return stringifyEntityRef(entity);
  }
  let result = templateString;
  const placeholders = templateString.match(/\$\{\{\s*([^}]+)\s*\}\}/g) || [];

  for (const placeholder of placeholders) {
    const path = placeholder.substring(2, placeholder.length - 1).trim();
    const value = get(entity, path);
    result = result.replace(
      placeholder,
      value !== undefined && value !== null ? String(value) : ""
    );
  }
  return result.trim();
};

export const EnhancedEntityPicker: React.FC<
  FieldExtensionComponentProps<string, CustomEntityPickerUiOptions>
> = (props) => {
  const {
    schema,
    uiSchema,
    formData,
    onChange,
    rawErrors,
    disabled,
    formContext,
  } = props;

  const { "ui:options": options } = uiSchema;

  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  const catalogApi = useApi(catalogApiRef);

  const {
    catalogFilter,
    output,
    outputTargetField,
    displayFormat = "${{ metadata.name }}",
    placeholder = "Select an entity...",
  } = options || {};

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

  // Create the list of options for the dropdown.
  // Each option contains the original entity and its formatted display text.
  const displayOptions = useMemo(() => {
    return (
      entities
        .map((entity) => ({
          entity,
          displayText: formatFromTemplate(entity, displayFormat),
        }))
        // --- IMPORTANT FIX ---
        // Filter out any entities that result in a blank display string.
        // This prevents empty rows in the dropdown.
        .filter((option) => option.displayText.trim() !== "")
    );
  }, [entities, displayFormat]);

  // When the component first loads with data, find the matching entity
  // to pre-fill the component's state.
  useEffect(() => {
    if (formData && displayOptions.length > 0 && !selectedEntity) {
      const foundOption = displayOptions.find(
        (option) => option.displayText === formData
      );
      if (foundOption) {
        setSelectedEntity(foundOption.entity);
      }
    }
  }, [formData, displayOptions, selectedEntity]);

  const handleChange = (
    _event: React.SyntheticEvent,
    option: { entity: Entity; displayText: string } | null
  ) => {
    const newValue = option?.entity || null;
    setSelectedEntity(newValue); // Update our internal UI state

    if (newValue) {
      // 1. Update the VISIBLE field with the simple display string.
      // NO FALLBACK - We only use the string from the template.
      const displayValue = formatFromTemplate(newValue, displayFormat);
      onChange(displayValue);

      // 2. Update the HIDDEN field with the rich data object.
      if (output && outputTargetField && formContext.onChange) {
        const outputObject: { [key: string]: any } = {};
        for (const key of Object.keys(output)) {
          outputObject[key] = formatFromTemplate(newValue, output[key]);
        }
        formContext.onChange({
          ...formContext.formData,
          [outputTargetField]: outputObject,
        });
      }
    } else {
      // Item was cleared
      onChange(undefined);
      if (outputTargetField && formContext.onChange) {
        formContext.onChange({
          ...formContext.formData,
          [outputTargetField]: undefined,
        });
      }
    }
  };

  // Find the full option object that matches our selected entity state
  const selectedOption = useMemo(() => {
    if (!selectedEntity) return null;
    return (
      displayOptions.find(
        (opt) => opt.entity.metadata.uid === selectedEntity.metadata.uid
      ) || null
    );
  }, [selectedEntity, displayOptions]);

  return (
    <Box>
      <Autocomplete<{ entity: Entity; displayText: string }>
        options={displayOptions}
        value={selectedOption}
        disabled={disabled}
        loading={loading}
        onChange={handleChange}
        // This now simply returns the pre-formatted displayText property. NO FALLBACK.
        getOptionLabel={(option) => option.displayText}
        isOptionEqualToValue={(option, value) =>
          option.entity.metadata.uid === value?.entity.metadata.uid
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
            {/* This also simply renders the pre-formatted displayText. NO FALLBACK. */}
            <Typography variant="body1">{option.displayText}</Typography>
          </Box>
        )}
      />
    </Box>
  );
};
