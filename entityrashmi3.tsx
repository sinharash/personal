// src/components/EnhancedEntityPicker/EnhancedEntityPicker.tsx

import React, { useState, useEffect, useMemo } from "react";

// Backstage-specific imports
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
import { useApi } from "@backstage/core-plugin-api";
import {
  catalogApiRef,
  humanizeEntityRef,
} from "@backstage/plugin-catalog-react";
import { Entity, stringifyEntityRef } from "@backstage/catalog-model";
import { EntityPickerUiOptions as StandardEntityPickerUiOptions } from "@backstage/plugin-scaffolder";

// Material UI imports
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

// Lodash for safe object property access
import { get } from "lodash";

/**
 * The shape of the `ui:options` this component accepts in a template.yaml.
 */
export interface CustomEntityPickerUiOptions
  extends StandardEntityPickerUiOptions {
  // The name of the hidden field where the rich data object should be stored.
  outputTargetField?: string;
  // Defines the shape of the object to be stored in the hidden 'outputTargetField'.
  output?: Record<string, string>;
}

/**
 * A helper function to create a string from a template and an entity.
 */
const formatFromTemplate = (
  entity: Entity,
  templateString: string | undefined
): string => {
  if (!templateString) return "";
  if (templateString === "${entity.ref}") {
    return stringifyEntityRef(entity);
  }
  let result = templateString;
  const placeholders = templateString.match(/\$\{(.+?)\}/g) || [];
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

/**
 * The main React component for our custom field extension.
 */
export const EnhancedEntityPicker: React.FC<
  FieldExtensionComponentProps<string, CustomEntityPickerUiOptions>
> = (props) => {
  const {
    schema,
    uiSchema,
    formData, // This is the simple display string for our visible field
    onChange, // The onChange for our visible field
    rawErrors,
    required,
    disabled,
    formContext, // Access to the entire form's context and methods
  } = props;

  const { "ui:options": options } = uiSchema;

  const [fetchedEntities, setFetchedEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // We need to store the currently selected Entity object in our own state
  // because the `formData` prop only gives us the simple display string.
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  const catalogApi = useApi(catalogApiRef);

  const { catalogFilter, output, outputTargetField } = options || {};

  useEffect(() => {
    // This effect runs once when the component loads to pre-select an entity
    // if the form is re-opened with existing data. It's a UX improvement.
    if (formData && fetchedEntities.length > 0 && !selectedEntity) {
      const found = fetchedEntities.find(
        (e) =>
          (formatFromTemplate(e, output?.displayValue) ||
            humanizeEntityRef(e)) === formData
      );
      if (found) {
        setSelectedEntity(found);
      }
    }
  }, [formData, fetchedEntities, output?.displayValue, selectedEntity]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const apiFilter = Array.isArray(catalogFilter)
      ? catalogFilter
      : [catalogFilter];
    catalogApi
      .getEntities({ filter: catalogFilter ? apiFilter : undefined })
      .then((response) => setFetchedEntities(response.items))
      .catch((e) =>
        setError(
          e instanceof Error ? e : new Error("An unknown error occurred")
        )
      )
      .finally(() => setLoading(false));
  }, [catalogApi, catalogFilter]);

  const handleAutocompleteChange = (
    _event: React.SyntheticEvent,
    value: Entity | null // `value` is the selected Entity object from Autocomplete
  ) => {
    setSelectedEntity(value); // Update our internal state

    if (value) {
      // An entity object was selected
      // 1. Update the VISIBLE field with the simple display string
      const displayValue =
        formatFromTemplate(value, output?.displayValue) ||
        humanizeEntityRef(value);
      onChange(displayValue);

      // 2. Update the HIDDEN field with the rich data object
      if (output && outputTargetField && formContext.onChange) {
        const outputObject: { [key: string]: any } = {};
        for (const key of Object.keys(output)) {
          outputObject[key] = formatFromTemplate(value, output[key]);
        }
        // This is the key: update the entire form's data with the new hidden object
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

  const getOptionLabel = (option: Entity): string => {
    return (
      formatFromTemplate(option, output?.displayValue) ||
      humanizeEntityRef(option)
    );
  };

  return (
    <Autocomplete<Entity> // Specify that Autocomplete works with Entity objects
      fullWidth
      value={selectedEntity}
      options={fetchedEntities}
      loading={loading}
      disabled={disabled}
      onChange={handleAutocompleteChange}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={(option, val) =>
        stringifyEntityRef(option) === stringifyEntityRef(val)
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={uiSchema["ui:title"] || schema.title}
          margin="normal"
          required={required}
          error={rawErrors && rawErrors.length > 0}
          helperText={
            (rawErrors && rawErrors[0]) ||
            uiSchema["ui:description"] ||
            schema.description ||
            (error && `Error loading entities: ${error.message}`)
          }
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};
