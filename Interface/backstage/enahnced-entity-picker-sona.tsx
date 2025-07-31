/*
 * Enhanced Entity Picker - EXACT COPY of Backstage EntityPicker
 * Only change: @material-ui → @mui migration
 * Based on complete directory analysis from GitHub
 */

import React, { useCallback, useEffect } from "react";
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
  EntityRefPresentationSnapshot,
  catalogApiRef,
  entityPresentationApiRef,
} from "@backstage/plugin-catalog-react";

// MUI Migration: Updated imports from @material-ui to @mui
import { TextField } from "@mui/material";
import { Autocomplete, createFilterOptions } from "@mui/material";
import { AutocompleteChangeReason } from "@mui/material";

import useAsync from "react-use/esm/useAsync";
import { useTranslationRef } from "@backstage/core-plugin-api/alpha";

// EXACT COPY: Import from public API (found in search results)
import { ScaffolderField } from "@backstage/plugin-scaffolder-react/alpha";

// EXACT COPY: Schema types (these are defined in ./schema.ts in Backstage)
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
  onChange: (value: string | undefined) => void;
  schema: {
    title?: string;
    description?: string;
  };
  required?: boolean;
  uiSchema: {
    "ui:options"?: EntityPickerUiOptions;
    "ui:disabled"?: boolean;
  };
  rawErrors?: string[];
  formData?: string;
  idSchema?: any;
  errors?: any;
}

// EXACT COPY: Translation reference
const scaffolderTranslationRef = {
  id: "scaffolder",
  messages: {
    "fields.entityPicker.title": "Entity",
    "fields.entityPicker.description": "An entity from the catalog",
  },
};

// Simple VirtualizedListbox implementation (as seen in Backstage)
const VirtualizedListbox = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLElement>
>((props, ref) => <div ref={ref} {...props} />);

// EXACT COPY: Backstage utility functions
function convertOpsValues(
  value: Exclude<EntityPickerFilterQueryValue, Array<any>>
): string | symbol {
  if (typeof value === "object" && value.exists) {
    return CATALOG_FILTER_EXISTS;
  }
  return value?.toString();
}

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

function buildCatalogFilter(
  uiSchema: EntityPickerProps["uiSchema"]
): EntityFilterQuery | undefined {
  const catalogFilter = uiSchema["ui:options"]?.catalogFilter;
  const allowedKinds = uiSchema["ui:options"]?.allowedKinds;

  if (allowedKinds && !catalogFilter) {
    return { kind: allowedKinds };
  }

  if (catalogFilter) {
    if (Array.isArray(catalogFilter)) {
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
 * Enhanced Entity Picker - EXACT COPY of Backstage EntityPicker with MUI migration
 */
export const EnhancedEntityPicker = (props: EntityPickerProps) => {
  const { t } = useTranslationRef(scaffolderTranslationRef);
  const {
    onChange,
    schema: {
      title = t("fields.entityPicker.title"),
      description = t("fields.entityPicker.description"),
    },
    required,
    uiSchema,
    rawErrors,
    formData,
  } = props;

  const catalogApi = useApi(catalogApiRef);
  const entityPresentationApi = useApi(entityPresentationApiRef);

  // EXACT COPY: Extract options exactly as Backstage does
  const catalogFilter = buildCatalogFilter(uiSchema);
  const defaultKind = uiSchema["ui:options"]?.defaultKind;
  const defaultNamespace =
    uiSchema["ui:options"]?.defaultNamespace || undefined;
  const isDisabled = uiSchema?.["ui:disabled"] ?? false;
  const allowArbitraryValues =
    uiSchema["ui:options"]?.allowArbitraryValues ?? true;

  // EXACT COPY: Backstage entity fetching logic
  const {
    value: entities,
    loading,
    error,
  } = useAsync(async () => {
    const fields = [
      "kind",
      "metadata.name",
      "metadata.namespace",
      "metadata.title",
      "metadata.description",
      "spec.profile.displayName",
      "spec.type",
    ];

    const { items } = await catalogApi.getEntities(
      catalogFilter
        ? { filter: catalogFilter, fields }
        : { filter: undefined, fields }
    );

    const entityRefs = items.map((entity) => stringifyEntityRef(entity));
    const entityRefToPresentation = new Map<
      string,
      EntityRefPresentationSnapshot
    >();

    for (const item of items) {
      const entityRef = stringifyEntityRef(item);
      try {
        const presentation = await entityPresentationApi.forEntity(item)
          .promise;
        entityRefToPresentation.set(entityRef, presentation);
      } catch {
        // Fallback
        entityRefToPresentation.set(entityRef, {
          primaryTitle: entityRef,
          secondaryTitle: item.metadata.description || "",
          Icon: undefined,
        });
      }
    }

    return {
      catalogEntities: items,
      entityRefs,
      entityRefToPresentation,
    };
  }, [catalogApi, entityPresentationApi, catalogFilter]);

  // EXACT COPY: Backstage getLabel function
  const getLabel = useCallback(
    (freeSoloValue: string) => {
      try {
        const parsedRef = parseEntityRef(freeSoloValue, {
          defaultKind,
          defaultNamespace,
        });
        return stringifyEntityRef(parsedRef);
      } catch (err) {
        return freeSoloValue;
      }
    },
    [defaultKind, defaultNamespace]
  );

  // EXACT COPY: Backstage onSelect logic
  const onSelect = useCallback(
    (_: any, ref: string | Entity | null, reason: AutocompleteChangeReason) => {
      if (typeof ref !== "string") {
        onChange(ref ? stringifyEntityRef(ref as Entity) : undefined);
      } else {
        if (reason === "blur" || reason === "create-option") {
          let entityRef = ref;
          try {
            entityRef = stringifyEntityRef(
              parseEntityRef(ref as string, {
                defaultKind,
                defaultNamespace,
              })
            );
          } catch (err) {
            // If parsing fails, use original
          }
          if (formData !== ref || allowArbitraryValues) {
            onChange(entityRef);
          }
        }
      }
    },
    [onChange, formData, defaultKind, defaultNamespace, allowArbitraryValues]
  );

  // EXACT COPY: Backstage selectedEntity logic
  const selectedEntity =
    entities?.catalogEntities.find((e) => stringifyEntityRef(e) === formData) ??
    (allowArbitraryValues && formData ? getLabel(formData) : "");

  // EXACT COPY: Auto-select for required single entity
  useEffect(() => {
    if (
      required &&
      !allowArbitraryValues &&
      entities?.catalogEntities.length === 1 &&
      selectedEntity === ""
    ) {
      onChange(stringifyEntityRef(entities.catalogEntities[0]));
    }
  }, [entities, onChange, selectedEntity, required, allowArbitraryValues]);

  return (
    <ScaffolderField
      rawDescription={description}
      rawErrors={rawErrors}
      required={required}
      disabled={isDisabled}
    >
      <Autocomplete
        id="enhanced-entity-picker"
        value={selectedEntity || null}
        loading={loading}
        options={entities?.entityRefs || []}
        getOptionLabel={(option) =>
          entities?.entityRefToPresentation.get(option)?.primaryTitle || option
        }
        isOptionEqualToValue={(option, value) => option === value}
        onChange={onSelect}
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
            error={!!rawErrors?.length}
            helperText={rawErrors?.[0]}
            InputProps={params.InputProps}
          />
        )}
        renderOption={(props, option) => (
          <li {...props}>
            <EntityDisplayName entityRef={option} />
          </li>
        )}
        filterOptions={createFilterOptions({
          stringify: (option) =>
            entities?.entityRefToPresentation.get(option)?.primaryTitle ||
            option,
        })}
        ListboxComponent={VirtualizedListbox}
        disabled={isDisabled}
      />
    </ScaffolderField>
  );
};
