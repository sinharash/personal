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

// Material UI imports for the picker UI
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

// Lodash for safe object property access. Make sure to install it:
// yarn add lodash && yarn add -D @types/lodash
import { get } from "lodash";

/**
 * The shape of the object this component will manage as its form data.
 * The keys here should correspond to the keys you define in the `output`
 * ui:option in your template.yaml.
 */
interface EnhancedPickerFormObject {
  [key: string]: any; // Allows for flexible keys from the `output` option
  ref?: string;
  displayValue?: string;
}

/**
 * The shape of the `ui:options` this component accepts in a template.yaml.
 */
export interface CustomEntityPickerUiOptions
  extends StandardEntityPickerUiOptions {
  /**
   * Defines the shape and content of the object to be populated when an entity is selected.
   * - Keys are the desired keys in the output object (e.g., 'ref', 'email', 'displayName').
   * - Values are template strings to extract data from the selected entity.
   * - Use `${path.to.field}` for entity fields. Use a special `${entity.ref}` for the entity reference string.
   *
   * @example
   * output:
   * displayValue: "${spec.profile.displayName} (${metadata.name})"
   * ref: "${entity.ref}"
   * email: "${spec.profile.email}"
   */
  output?: Record<string, string>;
}

/**
 * A helper function to create a string from a template and an entity.
 * It replaces placeholders like `${spec.profile.email}` with the actual entity data.
 */
const formatFromTemplate = (
  entity: Entity,
  templateString: string | undefined
): string => {
  if (!templateString) return "";

  // Handle the special case for the full entity reference string
  if (templateString === "${entity.ref}") {
    return stringifyEntityRef(entity);
  }

  let result = templateString;
  // Find all placeholders like ${path.to.field}
  const placeholders = templateString.match(/\$\{(.+?)\}/g) || [];

  for (const placeholder of placeholders) {
    // Extracts 'path.to.field' from '${path.to.field}'
    const path = placeholder.substring(2, placeholder.length - 1);
    const value = get(entity, path);

    // Replace placeholder with its value, or an empty string if value is null/undefined
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
  FieldExtensionComponentProps<
    EnhancedPickerFormObject | undefined,
    CustomEntityPickerUiOptions
  >
> = (props) => {
  const {
    schema,
    uiSchema,
    formData, // This is our object, e.g., { ref: '...', displayValue: '...' }
    onChange, // This updates our object in the form state
    rawErrors,
    required,
    disabled,
  } = props;

  const { "ui:options": options } = uiSchema;

  const [inputValue, setInputValue] = useState("");
  const [fetchedEntities, setFetchedEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const catalogApi = useApi(catalogApiRef);

  // Destructure the ui:options defined in the YAML
  const { catalogFilter, allowedKinds, defaultKind, output } = options || {};

  // Fetch entities from the catalog when the component mounts or filters change
  useEffect(() => {
    setLoading(true);
    setError(null);

    let apiFilter: Record<string, any>[] = [];
    if (catalogFilter) {
      apiFilter = Array.isArray(catalogFilter)
        ? catalogFilter
        : [catalogFilter];
    } else if (allowedKinds) {
      apiFilter.push({ kind: allowedKinds });
    } else if (defaultKind) {
      apiFilter.push({ kind: defaultKind });
    }

    catalogApi
      .getEntities({ filter: apiFilter.length > 0 ? apiFilter : undefined })
      .then((response) => {
        setFetchedEntities(response.items);
      })
      .catch((e) => {
        setError(
          e instanceof Error ? e : new Error("An unknown error occurred")
        );
        setFetchedEntities([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [catalogApi, catalogFilter, allowedKinds, defaultKind]);

  // When an entity is selected, this is the main handler
  const handleAutocompleteChange = (
    _event: React.SyntheticEvent,
    value: Entity | string | null // `value` is the selected Entity from Autocomplete's options
  ) => {
    if (value && typeof value !== "string") {
      // An entity object was selected
      if (!output) {
        console.error(
          "EnhancedEntityPicker: The 'output' ui:option is required but was not defined in the template."
        );
        return;
      }

      const outputObject: EnhancedPickerFormObject = {};
      // Iterate over the keys defined in the `output` ui:option in the YAML
      for (const key of Object.keys(output)) {
        const template = output[key];
        outputObject[key] = formatFromTemplate(value, template);
      }

      // Call onChange ONCE with the complete, newly created object
      onChange(outputObject);
    } else {
      // Item was cleared
      onChange(undefined);
    }
  };

  // From the `formData` object we receive, find the corresponding full Entity object
  // This is needed to tell the Autocomplete which item is currently selected.
  const selectedEntity = useMemo(() => {
    if (!formData?.ref) return null;
    return (
      fetchedEntities.find((e) => stringifyEntityRef(e) === formData.ref) ||
      null
    );
  }, [formData?.ref, fetchedEntities]);

  // This function tells Autocomplete what string to display for each option
  const getOptionLabel = (option: Entity | string): string => {
    if (typeof option === "string") return option;
    // We need a display format for the dropdown itself. Let's use `displayValue` from the output map.
    const displayFormatTemplate = output?.displayValue;
    return (
      formatFromTemplate(option, displayFormatTemplate) ||
      humanizeEntityRef(option)
    );
  };

  // This function tells Autocomplete how to render each option in the dropdown list
  const renderOption = (
    liProps: React.HTMLAttributes<HTMLLIElement>,
    option: Entity | string
  ) => {
    const displayString = getOptionLabel(option); // Reuse getOptionLabel for consistency
    return (
      <li {...liProps}>
        <Box>
          <Typography variant="body1">{displayString}</Typography>
        </Box>
      </li>
    );
  };

  return (
    <Autocomplete
      fullWidth
      value={selectedEntity} // The component's value is the full Entity object
      options={fetchedEntities}
      loading={loading}
      disabled={disabled}
      required={required}
      inputValue={inputValue}
      onInputChange={(_event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      onChange={handleAutocompleteChange}
      getOptionLabel={getOptionLabel}
      renderOption={renderOption}
      isOptionEqualToValue={(option, val) =>
        stringifyEntityRef(option) === stringifyEntityRef(val)
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={uiSchema["ui:title"] || schema.title}
          margin="normal"
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
