// src/components/EnhancedEntityPicker/EnhancedEntityPicker.tsx

import React, { useState, useEffect, useMemo } from "react";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
import { useApi } from "@backstage/core-plugin-api";
import {
  catalogApiRef,
  humanizeEntityRef,
} from "@backstage/plugin-catalog-react";
import {
  Entity,
  parseEntityRef,
  stringifyEntityRef,
} from "@backstage/catalog-model";

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

import { get } from "lodash"; // For safe deep-access to object properties
import { EntityPickerUiOptions as StandardEntityPickerUiOptions } from "@backstage/plugin-scaffolder";

// Your custom UI options as well as EntityPicker that includes all standard options
export interface CustomEntityPickerUiOptions
  extends StandardEntityPickerUiOptions {
  /**
   * Specifies the path within the entity object to use for display in the dropdown.
   * Defaults to 'metadata.name'.
   * Examples: 'metadata.title', 'spec.profile.displayName', 'metadata.annotations["custom.org/identifier"]'
   */
  displayEntityField?: string;

  /**
   * Optional: A secondary path to display alongside the primary display field in the dropdown.
   * Example: 'metadata.namespace' or 'spec.type'
   */
  secondaryDisplayEntityField?: string;
}

// Helper to get display value from entity using a path string
const getDisplayValue = (
  entity: Entity,
  path: string,
  fallback: string
): string => {
  if (!path) return fallback;
  const value = get(entity, path);
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return fallback; // Fallback if path is invalid or value is not simple
};

export const EnhancedEntityPicker: React.FC<
  FieldExtensionComponentProps<string | string[], CustomEntityPickerUiOptions> // Supports string or array for multi-select if needed
> = (props) => {
  const {
    schema,
    uiSchema,
    formData,
    onChange,
    rawErrors,
    required,
    disabled,
  } = props;
  const options = uiSchema["ui:options"] as
    | CustomEntityPickerUiOptions
    | undefined;

  const [inputValue, setInputValue] = useState("");
  const [fetchedEntities, setFetchedEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const catalogApi = useApi(catalogApiRef);

  const {
    catalogFilter,
    allowedKinds = schema.allowedKinds as string[] | undefined, // from backstage.io/schema
    defaultKind = options?.defaultKind || "Component",
    allowArbitraryValues = options?.allowArbitraryValues || false,
    displayEntityField = options?.displayEntityField || "metadata.name", // Default display field
    secondaryDisplayEntityField = options?.secondaryDisplayEntityField,
  } = options || {};

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Build the filter for the API call
    // The `catalogFilter` from `ui:options` can be an array or object.
    // The `catalogApi.getEntities` expects a `filter` which is an array of key-value pairs or objects.
    let apiFilter: Record<string, string | symbol | (string | symbol)[]>[] = [];

    if (catalogFilter) {
      if (Array.isArray(catalogFilter)) {
        apiFilter = catalogFilter.map(
          (f) => f as Record<string, string | symbol | (string | symbol)[]>
        );
      } else {
        apiFilter = [
          catalogFilter as Record<
            string,
            string | symbol | (string | symbol)[]
          >,
        ];
      }
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
        setError(e);
        setFetchedEntities([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [catalogFilter, allowedKinds, defaultKind]);

  // Find the selected entity object from formData (which is an entity ref string)
  const selectedEntity = useMemo(() => {
    if (!formData || typeof formData !== "string") return null; // Assuming single string selection for now
    try {
      const searchRef = parseEntityRef(formData as string);
      return (
        fetchedEntities.find(
          (entity) =>
            entity.kind.toLowerCase() === searchRef.kind.toLowerCase() &&
            entity.metadata.name.toLowerCase() ===
              searchRef.name.toLowerCase() &&
            (searchRef.namespace?.toLowerCase() || "default") ===
              (entity.metadata.namespace?.toLowerCase() || "default")
        ) || null
      );
    } catch {
      return null; // Invalid entity ref string
    }
  }, [formData, fetchedEntities]);

  const handleAutocompleteChange = (
    _event: React.ChangeEvent<{}>,
    value: Entity | string | null
  ) => {
    if (typeof value === "string") {
      // Arbitrary value
      if (allowArbitraryValues) {
        onChange(value);
      }
    } else if (value) {
      // Entity object selected
      onChange(stringifyEntityRef(value));
    } else {
      // Cleared
      onChange(undefined);
    }
  };

  const getOptionLabel = (option: Entity | string): string => {
    if (typeof option === "string") {
      return option; // For arbitrary values
    }
    // For entity objects, use the custom display field
    return getDisplayValue(
      option,
      displayEntityField,
      humanizeEntityRef(option)
    );
  };

  const renderOption = (
    props: React.HTMLAttributes<HTMLLIElement>,
    option: Entity | string
    // state: { inputValue: string }
  ) => {
    if (typeof option === "string") {
      return (
        <li {...props}>
          <Typography>{option}</Typography>;
        </li>
      );
    }

    const primaryText = getDisplayValue(
      option,
      displayEntityField,
      humanizeEntityRef(option)
    );
    let secondaryText: string;
    if (secondaryDisplayEntityField) {
      secondaryText = getDisplayValue(option, secondaryDisplayEntityField, "");
    } else {
      // Default secondary text could be the kind or namespace if not specified by user
      secondaryText = humanizeEntityRef(option, { defaultKind: "component" });
      if (primaryText === secondaryText) secondaryText = ""; // Avoid repetition
    }

    return (
      <li {...props}>
        <Box>
          <Typography variant="body1">{primaryText}</Typography>
          {secondaryText && (
            <Typography variant="caption" color="textSecondary">
              {secondaryText}
            </Typography>
          )}
        </Box>
      </li>
    );
  };

  return (
    <Autocomplete
      fullWidth
      value={
        allowArbitraryValues && typeof formData === "string" && !selectedEntity
          ? formData
          : selectedEntity
      }
      inputValue={inputValue}
      onInputChange={(_event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      onChange={handleAutocompleteChange}
      options={fetchedEntities}
      getOptionLabel={getOptionLabel}
      renderOption={renderOption}
      loading={loading}
      disabled={disabled}
      freeSolo={allowArbitraryValues}
      isOptionEqualToValue={(option, val) => {
        if (typeof option === "string" && typeof val === "string")
          return option === val;
        if (
          typeof option !== "string" &&
          typeof val !== "string" &&
          val &&
          option
        ) {
          return stringifyEntityRef(option) === stringifyEntityRef(val);
        }
        return false;
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={schema.title || "Select Entity"}
          margin="normal"
          required={required}
          error={rawErrors && rawErrors.length > 0}
          helperText={
            rawErrors?.[0] ||
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
