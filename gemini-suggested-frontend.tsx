// FILE: EnhancedEntityPicker.tsx

import React, { useEffect, useState, useCallback } from "react";
import { Autocomplete, TextField, Box, Typography } from "@mui/material";
import { useApi } from "@backstage/core-plugin-api";
import {
  catalogApiRef,
  humanizeEntityRef,
} from "@backstage/plugin-catalog-react";
import { Entity, stringifyEntityRef } from "@backstage/catalog-model";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
import { get } from "lodash";

// Define the shape of the ui:options this component accepts
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
    const path = placeholder.substring(2, placeholder.length - 1);
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
    formData, // This is the simple display string for our visible field
    onChange, // The onChange for our visible field
    rawErrors,
    disabled,
    formContext, // Access to the entire form's context and methods
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
    displayFormat = output?.displayValue || "${{ metadata.name }}",
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

  // When the component first loads, use the formData (display string)
  // to find the matching entity object and pre-fill the component state.
  useEffect(() => {
    if (formData && entities.length > 0 && !selectedEntity) {
      const found = entities.find(
        (entity) => formatFromTemplate(entity, displayFormat) === formData
      );
      if (found) {
        setSelectedEntity(found);
      }
    }
  }, [formData, entities, displayFormat, selectedEntity]);

  const handleChange = (
    _event: React.SyntheticEvent,
    newValue: Entity | null
  ) => {
    setSelectedEntity(newValue); // Update our internal UI state

    if (newValue) {
      // 1. Update the VISIBLE field with the simple display string.
      // The user sees this, and this is what will be on the review page.
      const displayValue =
        formatFromTemplate(newValue, displayFormat) ||
        humanizeEntityRef(newValue);
      onChange(displayValue);

      // 2. Update the HIDDEN field with the rich data object for the developer.
      if (output && outputTargetField && formContext.onChange) {
        const outputObject: { [key: string]: any } = {};
        for (const key of Object.keys(output)) {
          outputObject[key] = formatFromTemplate(newValue, output[key]);
        }
        // Use formContext.onChange to update the entire form's data state,
        // specifically setting the value for our hidden sibling field.
        formContext.onChange({
          ...formContext.formData,
          [outputTargetField]: outputObject,
        });
      }
    } else {
      // Item was cleared
      // 1. Clear the VISIBLE field
      onChange(undefined);
      // 2. Clear the HIDDEN field
      if (outputTargetField && formContext.onChange) {
        formContext.onChange({
          ...formContext.formData,
          [outputTargetField]: undefined,
        });
      }
    }
  };

  return (
    <Box>
      <Autocomplete<Entity>
        options={entities}
        value={selectedEntity}
        disabled={disabled}
        loading={loading}
        onChange={handleChange}
        getOptionLabel={(option) =>
          formatFromTemplate(option, displayFormat) || humanizeEntityRef(option)
        }
        isOptionEqualToValue={(option, value) =>
          option?.metadata?.uid === value?.metadata?.uid
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
              {formatFromTemplate(option, displayFormat) ||
                humanizeEntityRef(option)}
            </Typography>
          </Box>
        )}
      />
    </Box>
  );
};
