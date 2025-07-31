/*
 * Enhanced Entity Picker - Migrated from Backstage EntityPicker
 * Converted from @material-ui to @mui
 */

import React, { useCallback } from "react";
import {
  type EntityFilterQuery,
  CATALOG_FILTER_EXISTS,
} from "@backstage/catalog-client";
import {
  Entity,
  parseEntityRef,
  stringifyEntityRef,
} from "@backstage/catalog-model";
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
  const defaultNamespace = uiSchema["ui:options"]?.defaultNamespace;

  // Build catalog filter
  const catalogFilter = buildCatalogFilter(uiSchema);

  // Fetch entities from catalog
  const {
    value: entities,
    loading,
    error,
  } = useAsync(async () => {
    const catalogEntities = await catalogApi.getEntities({
      filter: catalogFilter,
    });

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
      entityRefToPresentation,
    };
  }, [catalogApi, entityPresentationApi, catalogFilter]);

  // Handle selection change
  const handleChange = useCallback(
    (
      _event: React.SyntheticEvent,
      value: Entity | string | null,
      _reason: AutocompleteChangeReason
    ) => {
      if (value === null) {
        onChange("");
        return;
      }

      if (typeof value === "string") {
        // Handle free text input
        onChange(value);
      } else {
        // Handle entity selection
        const entityRef = stringifyEntityRef({
          kind: value.kind,
          namespace: value.metadata.namespace || defaultNamespace || "default",
          name: value.metadata.name,
        });
        onChange(entityRef);
      }
    },
    [onChange, defaultNamespace]
  );

  // Get current value for display
  const getCurrentValue = () => {
    if (!formData) return null;

    try {
      const parsedRef = parseEntityRef(formData);
      return (
        entities?.items.find(
          (entity) =>
            entity.kind === parsedRef.kind &&
            entity.metadata.name === parsedRef.name &&
            (entity.metadata.namespace || "default") ===
              (parsedRef.namespace || "default")
        ) || (allowArbitraryValues ? formData : null)
      );
    } catch {
      return allowArbitraryValues ? formData : null;
    }
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
        options={entities?.items || []}
        getOptionLabel={(option) => {
          if (typeof option === "string") {
            return option;
          }
          const entityRef = stringifyEntityRef(option);
          return (
            entities?.entityRefToPresentation.get(entityRef)?.primaryTitle ||
            entityRef
          );
        }}
        isOptionEqualToValue={(option, value) => {
          if (typeof option === "string" && typeof value === "string") {
            return option === value;
          }
          if (typeof option === "object" && typeof value === "object") {
            return stringifyEntityRef(option) === stringifyEntityRef(value);
          }
          return false;
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
            <EntityDisplayName entityRef={stringifyEntityRef(option)} />
          </li>
        )}
        filterOptions={createFilterOptions({
          stringify: (option) => {
            const entityRef = stringifyEntityRef(option);
            return (
              entities?.entityRefToPresentation.get(entityRef)?.primaryTitle ||
              entityRef
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
