/*
 * Copyright 2021 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useCallback, useEffect } from "react";
import { TextField, Autocomplete, createFilterOptions } from "@mui/material";
import { AutocompleteChangeReason } from "@mui/material/Autocomplete";
import useAsync from "react-use/esm/useAsync";

// Import all the actual Backstage dependencies
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
import { useTranslationRef } from "@backstage/core-plugin-api/alpha";
import { scaffolderTranslationRef } from "@backstage/core-plugin-api/alpha";
import { ScaffolderField } from "@backstage/plugin-scaffolder-react/alpha";

// Import schema types from the actual schema file
import {
  EntityPickerFilterQueryValue,
  EntityPickerProps,
  EntityPickerUiOptions,
  EntityPickerFilterQuery,
} from "./schema";

// Import VirtualizedListbox from the actual component
import { VirtualizedListbox } from "./VirtualizedListbox";

export { EntityPickerSchema } from "./schema";

/**
 * Converts a especial `{exists: true}` value to the `CATALOG_FILTER_EXISTS` symbol.
 *
 * @param value - The value to convert.
 * @returns The converted value.
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
 *
 * @param schemaFilters - An object containing schema filters with keys as filter names
 * and values as filter values.
 * @returns An object with the same keys as the input object, but with `{exists:true}` values
 * transformed to `CATALOG_FILTER_EXISTS` symbol.
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
 * If `catalogFilter` is specified in the `uiSchema`, it is converted to a `EntityFilterQuery`.
 * If `allowedKinds` is specified in the `uiSchema` will support the legacy `allowedKinds` option.
 *
 * @param uiSchema The `uiSchema` of an `EntityPicker` component.
 * @returns An `EntityFilterQuery` based on the `uiSchema`, or `undefined` if `catalogFilter` is not specified in the `uiSchema`.
 */
function buildCatalogFilter(
  uiSchema: EntityPickerProps["uiSchema"]
): EntityFilterQuery | undefined {
  const allowedKinds = uiSchema?.["ui:options"]?.allowedKinds;

  const catalogFilter: EntityPickerUiOptions["catalogFilter"] | undefined =
    uiSchema?.["ui:options"]?.catalogFilter ||
    (allowedKinds && { kind: allowedKinds });

  if (!catalogFilter) {
    return undefined;
  }

  if (Array.isArray(catalogFilter)) {
    return catalogFilter.map(convertSchemaFiltersToQuery) as any;
  }

  return convertSchemaFiltersToQuery(catalogFilter);
}

/**
 * The underlying component that is rendered in the form for the `EntityPicker`
 * field extension.
 *
 * @public
 */
export const EntityPicker = (props: EntityPickerProps) => {
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
    idSchema,
    errors,
  } = props;
  const catalogFilter = buildCatalogFilter(uiSchema);
  const defaultKind = uiSchema?.["ui:options"]?.defaultKind;
  const defaultNamespace =
    uiSchema?.["ui:options"]?.defaultNamespace || undefined;
  const isDisabled = uiSchema?.["ui:disabled"] ?? false;

  const catalogApi = useApi(catalogApiRef);
  const entityPresentationApi = useApi(entityPresentationApiRef);

  const { value: entities, loading } = useAsync(async () => {
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

    const entityRefToPresentation = new Map<
      string,
      EntityRefPresentationSnapshot
    >(
      await Promise.all(
        items.map(async (item) => {
          const presentation = await entityPresentationApi.forEntity(item)
            .promise;
          return [stringifyEntityRef(item), presentation] as [
            string,
            EntityRefPresentationSnapshot
          ];
        })
      )
    );

    return { catalogEntities: items, entityRefToPresentation };
  });

  const allowArbitraryValues =
    uiSchema?.["ui:options"]?.allowArbitraryValues ?? true;

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
            // If the passed in value isn't an entity ref, do nothing.
          }
          if (formData !== ref || allowArbitraryValues) {
            onChange(entityRef);
          }
        }
      }
    },
    [onChange, formData, defaultKind, defaultNamespace, allowArbitraryValues]
  );

  const selectedEntity =
    entities?.catalogEntities.find((e) => stringifyEntityRef(e) === formData) ??
    (allowArbitraryValues && formData ? getLabel(formData) : "");

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
      rawErrors={rawErrors}
      rawDescription={uiSchema?.["ui:description"] ?? description}
      required={required}
      disabled={isDisabled}
      errors={errors}
    >
      <Autocomplete
        disabled={
          isDisabled ||
          (required &&
            !allowArbitraryValues &&
            entities?.catalogEntities.length === 1)
        }
        id={idSchema?.$id}
        value={selectedEntity}
        loading={loading}
        onChange={onSelect}
        options={entities?.catalogEntities || []}
        getOptionLabel={(option) =>
          typeof option === "string"
            ? option
            : entities?.entityRefToPresentation.get(stringifyEntityRef(option))
                ?.entityRef!
        }
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
            InputProps={params.InputProps}
          />
        )}
        renderOption={(props, option) => (
          <li {...props}>
            <EntityDisplayName entityRef={option} />
          </li>
        )}
        filterOptions={createFilterOptions<Entity>({
          stringify: (option) =>
            entities?.entityRefToPresentation.get(stringifyEntityRef(option))
              ?.primaryTitle!,
        })}
        ListboxComponent={VirtualizedListbox as any}
      />
    </ScaffolderField>
  );
};

// Export enhanced version
export const EnhancedEntityPicker = EntityPicker;
