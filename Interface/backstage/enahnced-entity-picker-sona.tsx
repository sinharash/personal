/*
 * Enhanced Entity Picker - Migrated from Backstage EntityPicker
 * Converted from @material-ui to @mui
 */

import React, { useCallback } from "react";
import {
  type EntityFilterQuery,
  CATALOG_FILTER_EXISTS,
} from "@backstage/catalog-client";
import { stringifyEntityRef } from "@backstage/catalog-model";
import { useApi } from "@backstage/core-plugin-api";
import {
  EntityDisplayName,
  catalogApiRef,
  entityPresentationApiRef,
} from "@backstage/plugin-catalog-react";

// MUI Migration: Updated imports
import { TextField, FormControl, FormHelperText } from "@mui/material";
import { Autocomplete, createFilterOptions } from "@mui/material";
import { AutocompleteChangeReason } from "@mui/material";

import useAsync from "react-use/esm/useAsync";

// Type definitions based on Backstage EntityPicker
export type EntityPickerFilterQueryValue = string | string[] | { exists: true };

export type EntityPickerFilterQuery = Record<
  string,
  EntityPickerFilterQueryValue
>;

export interface EntityPickerUiOptions {
  allowArbitraryValues?: boolean;
  catalogFilter?: EntityPickerFilterQuery | EntityPickerFilterQuery[];
  defaultKind?: string;
  defaultNamespace?: string;
  allowedKinds?: string[];
}

export interface EntityPickerProps {
  schema: {
    title?: string;
    description?: string;
  };
  uiSchema: {
    "ui:options"?: EntityPickerUiOptions;
  };
  formData?: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  rawErrors?: string[];
}

/**
 * Simple virtualized listbox component for performance with large datasets
 * Alternative to Backstage's internal VirtualizedListbox
 */
const VirtualizedListbox = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLElement>
>((props, ref) => {
  const { children, ...other } = props;

  // For now, return a simple div - you can enhance this with react-window if needed
  return (
    <div ref={ref} {...other}>
      {children}
    </div>
  );
});

/**
 * Converts a special `{exists: true}` value to the `CATALOG_FILTER_EXISTS` symbol.
 */
function convertOpsValues(
  value: Exclude<EntityPickerFilterQueryValue, Array<any>>
): string | symbol {
  if (typeof value === "object" && value.exists) {
    return CATALOG_FILTER_EXISTS;
  }
  return value?.toString();
}

/**
 * Converts schema filters to entity filter query, replacing `{exists:true}` values
 * with the constant `CATALOG_FILTER_EXISTS`.
 */
function convertSchemaFiltersToQuery(
  schemaFilters: EntityPickerFilterQuery
): Exclude<EntityFilterQuery, Array<any>> {
  const query: EntityFilterQuery = {};

  for (const [key, value] of Object.entries(schemaFilters)) {
    if (Array.isArray(value)) {
      query[key] = value;
    } else {
      query[key] = convertOpsValues(value);
    }
  }

  return query;
}

/**
 * Builds an `EntityFilterQuery` based on the `uiSchema` passed in.
 */
function buildCatalogFilter(
  uiSchema: EntityPickerProps["uiSchema"]
): EntityFilterQuery | undefined {
  const catalogFilter = uiSchema["ui:options"]?.catalogFilter;
  const allowedKinds = uiSchema["ui:options"]?.allowedKinds;

  // Handle legacy allowedKinds option
  if (allowedKinds && !catalogFilter) {
    return { kind: allowedKinds };
  }

  // Handle new catalogFilter option
  if (catalogFilter) {
    if (Array.isArray(catalogFilter)) {
      // Handle array of filters - combine them
      const combinedQuery: EntityFilterQuery = {};
      catalogFilter.forEach((filter) => {
        const converted = convertSchemaFiltersToQuery(filter);
        Object.assign(combinedQuery, converted);
      });
      return combinedQuery;
    } else {
      return convertSchemaFiltersToQuery(catalogFilter);
    }
  }

  return undefined;
}

/**
 * Enhanced Entity Picker Component
 *
 * Features:
 * - Entity selection from Backstage catalog
 * - Filtering by kind, namespace, and custom fields
 * - Autocomplete with entity display names
 * - Support for arbitrary values
 * - Migrated to @mui from @material-ui
 * - Uses public Backstage APIs only
 */
export const EnhancedEntityPicker = (props: EntityPickerProps) => {
  const {
    schema: { title = "Entity", description },
    uiSchema,
    formData,
    onChange,
    required = false,
    disabled = false,
    readonly = false,
    rawErrors,
  } = props;

  const catalogApi = useApi(catalogApiRef);
  const entityPresentationApi = useApi(entityPresentationApiRef);

  // Extract UI options
  const allowArbitraryValues =
    uiSchema["ui:options"]?.allowArbitraryValues ?? true;

  // Build catalog filter
  const catalogFilter = buildCatalogFilter(uiSchema);

  // Fetch entities from catalog
  const {
    value: entities,
    loading,
    error,
  } = useAsync(async () => {
    // Only fetch the fields we actually need for performance
    const fields = [
      "kind",
      "metadata.name",
      "metadata.namespace",
      "metadata.title",
      "metadata.description",
      "spec.profile.displayName",
      "spec.type",
    ];

    const catalogEntities = await catalogApi.getEntities(
      catalogFilter
        ? { filter: catalogFilter, fields }
        : { filter: undefined, fields }
    );

    // Create entity reference strings for the options
    const entityRefs = catalogEntities.items.map((entity) =>
      stringifyEntityRef(entity)
    );

    // Create a simple map for entity references to their display info
    const entityRefToPresentation = new Map();

    for (const entity of catalogEntities.items) {
      const entityRef = stringifyEntityRef(entity);
      try {
        const presentation = await entityPresentationApi.forEntity(entity)
          .promise;
        entityRefToPresentation.set(entityRef, presentation);
      } catch {
        // Fallback to entity ref if presentation fails
        entityRefToPresentation.set(entityRef, {
          primaryTitle: entityRef,
          secondaryTitle: entity.metadata.description,
        });
      }
    }

    return {
      items: catalogEntities.items,
      entityRefs, // This is what we use as options
      entityRefToPresentation,
    };
  }, [catalogApi, entityPresentationApi, catalogFilter]);

  // Handle selection change
  const handleChange = useCallback(
    (
      _event: React.SyntheticEvent,
      value: string | null,
      _reason: AutocompleteChangeReason
    ) => {
      if (value === null) {
        onChange("");
        return;
      }

      // Value is already an entity reference string or arbitrary text
      onChange(value);
    },
    [onChange]
  );

  // Get current value for display
  const getCurrentValue = () => {
    if (!formData) return null;

    // If the formData matches one of our entityRefs, return it
    if (entities?.entityRefs.includes(formData)) {
      return formData;
    }

    // If allowing arbitrary values, return the formData as-is
    if (allowArbitraryValues) {
      return formData;
    }

    // If not allowing arbitrary values and no match found, return null
    return null;
  };

  const currentValue = getCurrentValue();
  const isDisabled = disabled || readonly;
  const hasError = Boolean(rawErrors?.length);

  return (
    <FormControl fullWidth margin="dense" error={hasError}>
      <Autocomplete
        id="enhanced-entity-picker"
        value={currentValue}
        loading={loading}
        options={entities?.entityRefs || []}
        getOptionLabel={(option) => {
          // option is now an entityRef string
          return (
            entities?.entityRefToPresentation.get(option)?.primaryTitle ||
            option
          );
        }}
        isOptionEqualToValue={(option, value) => {
          // Both option and value are strings now
          return option === value;
        }}
        onChange={handleChange}
        autoSelect
        freeSolo={allowArbitraryValues}
        renderInput={(params) => (
          <TextField
            {...params}
            label={title}
            margin="dense"
            variant="outlined"
            required={required}
            disabled={isDisabled}
            error={hasError}
            helperText={hasError ? rawErrors?.[0] : description}
            InputProps={params.InputProps}
          />
        )}
        renderOption={(props, option) => (
          <li {...props}>
            <EntityDisplayName entityRef={option} />
          </li>
        )}
        filterOptions={createFilterOptions({
          stringify: (option) => {
            // option is an entityRef string
            return (
              entities?.entityRefToPresentation.get(option)?.primaryTitle ||
              option
            );
          },
        })}
        ListboxComponent={VirtualizedListbox}
        disabled={isDisabled}
      />
      {error && (
        <FormHelperText error>
          Failed to load entities: {error.message}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default EnhancedEntityPicker;
