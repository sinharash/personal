import React, { useCallback, useEffect } from "react";
import {
  Entity,
  parseEntityRef,
  stringifyEntityRef,
  CATALOG_FILTER_EXISTS,
  EntityFilterQuery,
} from "@backstage/catalog-model";
import { useApi } from "@backstage/core-plugin-api";
import {
  EntityDisplayName,
  EntityRefPresentationSnapshot,
  catalogApiRef,
  entityPresentationApiRef,
} from "@backstage/plugin-catalog-react";
import { useAsync } from "react-use/esm/useAsync";
import {
  EntityPickerFilterQueryValue,
  EnhancedEntityPickerProps,
  EnhancedEntityPickerUiOptions,
  EntityPickerFilterQuery,
} from "./schema";
import { VirtualizedListbox } from "./VirtualizedListbox";
import { useTranslationRef } from "@backstage/core-plugin-api/alpha";
import { scaffolderTranslationRef } from "../../../translation";
import { ScaffolderField } from "@backstage/plugin-scaffolder-react/alpha";

// Migration: Changed from @material-ui/core and @material-ui/lab to @mui/material
import TextField from "@mui/material/TextField";
import Autocomplete, {
  AutocompleteChangeReason,
  createFilterOptions,
} from "@mui/material/Autocomplete";

// Utility functions for display formatting
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  try {
    return path.split(".").reduce((current, key) => {
      return current && typeof current === "object" ? current[key] : undefined;
    }, obj);
  } catch {
    return undefined;
  }
};

// Convert template strings with {{ }} placeholders into display text
const formatDisplayValue = (template: string, entity: Entity): string => {
  if (!template || !entity) {
    return entity?.metadata?.name || "";
  }

  try {
    // Handle fallback syntax: "property1 || property2"
    if (template.includes(" || ")) {
      const paths = template.split(" || ").map((p) => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        if (value && String(value).trim()) return String(value);
      }
      return entity?.metadata?.name || "";
    }

    // Handle template syntax: "{{ property }}"
    return template.replace(/\{\{(\s*[^}]+\s*)\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return value ? String(value) : "";
    });
  } catch {
    return entity?.metadata?.name || "";
  }
};

/**
 * The underlying component that is rendered in the form for the `EnhancedEntityPicker`
 * field extension.
 *
 * @public
 */
export const EnhancedEntityPicker = (props: EnhancedEntityPickerProps) => {
  const {
    onChange,
    schema: { title = "Entity", description = "An entity from the catalog" },
    required,
    uiSchema,
    rawErrors,
    formData,
    formContext,
    idSchema,
    errors,
  } = props;

  const catalogFilter = buildCatalogFilter(uiSchema);
  const defaultKind = uiSchema["ui:options"]?.defaultKind;
  const defaultNamespace =
    uiSchema["ui:options"]?.defaultNamespace || undefined;
  const isDisabled = uiSchema?.["ui:disabled"] ?? false;

  // Enhanced options
  const displayFormat = uiSchema["ui:options"]?.displayFormat;
  const hiddenEntityRef = uiSchema["ui:options"]?.hiddenEntityRef;

  const catalogApi = useApi(catalogApiRef);
  const entityPresentationApi = useApi(entityPresentationApiRef);

  const { value: entities, loading } = useAsync(async () => {
    const fields = [
      "kind",
      "metadata.account_id",
      "metadata.name",
      "metadata.namespace",
      "metadata.title",
      "metadata.description",
      "spec.profile.displayName",
      "spec.profile.email",
      "spec.type",
    ];
    const { items } = await catalogApi.getEntities(
      catalogFilter
        ? { filter: catalogFilter, fields }
        : { filter: undefined, fields }
    );

    const entityRefToPresentationMap = new Map<
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

    return { catalogEntities: items, entityRefToPresentationMap };
  });

  const allowArbitraryValues =
    uiSchema["ui:options"]?.allowArbitraryValues ?? true;

  const getLabel = useCallback(
    (freeSoloValue: string) => {
      try {
        // Will throw if defaultKind or defaultNamespace are not set
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
      // ref can either be a string from free solo entry or Entity object
      if (typeof ref === "string") {
        if (!ref) {
          // if ref does not exist: pass 'undefined' to trigger validation for required value
          onChange(undefined);
          return;
        }

        // Add to default in namespace, etc.
        let entityRef = ref;
        try {
          // Attempt to parse the entity ref into its full form
          entityRef = stringifyEntityRef(
            parseEntityRef(ref as string, {
              defaultKind,
              defaultNamespace,
            })
          );
        } catch (err) {
          // If the passed value isn't an entity ref, do nothing.
        }
        onChange(entityRef);
      } else if (reason === "blur" || reason === "create-option") {
        // We need to check against formData here as that's the previous value for this field.
        if (formData !== ref || allowArbitraryValues) {
          onChange(entityRef);
        }
      } else if (ref) {
        // Enhanced logic: Store display value if displayFormat is specified
        if (displayFormat) {
          const displayValue = formatDisplayValue(displayFormat, ref);
          onChange(displayValue);

          // Store entity reference in hidden field if specified
          if (hiddenEntityRef && formContext.formData) {
            try {
              const entityRef = stringifyEntityRef(ref);
              formContext.formData[hiddenEntityRef] = entityRef;
            } catch (error) {
              console.warn("Failed to store entity reference:", error);
            }
          }
        } else {
          // Original logic: Store entity reference
          onChange(stringifyEntityRef(ref));
        }
      } else {
        // We need to check against formData here as that's the previous value for this field.
        if (formData !== ref || allowArbitraryValues) {
          onChange(entityRef);
        }
      }
    },
    [
      onChange,
      formData,
      formContext,
      defaultKind,
      defaultNamespace,
      allowArbitraryValues,
      displayFormat,
      hiddenEntityRef,
    ]
  );

  // Enhanced selectedEntity logic to handle both entity refs and display values
  const selectedEntity = (() => {
    if (!formData || !entities?.catalogEntities?.length) {
      return undefined;
    }

    // Try to find by entity reference first (original logic)
    const entityByRef = entities.catalogEntities.find(
      (e) => stringifyEntityRef(e) === formData
    );
    if (entityByRef) return entityByRef;

    // If displayFormat is used, try to find by display value
    if (displayFormat) {
      const entityByDisplay = entities.catalogEntities.find((e) => {
        const displayValue = formatDisplayValue(displayFormat, e);
        return displayValue === formData;
      });
      if (entityByDisplay) return entityByDisplay;
    }

    // Fallback to original logic
    return allowArbitraryValues && formData ? getLabel(formData) : "";
  })();

  useEffect(() => {
    if (
      required &&
      !allowArbitraryValues &&
      entities?.catalogEntities?.length === 1 &&
      selectedEntity === ""
    ) {
      const singleEntity = entities.catalogEntities[0];
      if (displayFormat) {
        const displayValue = formatDisplayValue(displayFormat, singleEntity);
        onChange(displayValue);

        if (hiddenEntityRef && formContext.formData) {
          formContext.formData[hiddenEntityRef] =
            stringifyEntityRef(singleEntity);
        }
      } else {
        onChange(stringifyEntityRef(singleEntity));
      }
    }
  }, [
    entities,
    onChange,
    selectedEntity,
    required,
    allowArbitraryValues,
    displayFormat,
    hiddenEntityRef,
    formContext,
  ]);

  const t = useTranslationRef(scaffolderTranslationRef);

  const filterOptions = createFilterOptions<Entity>({
    stringify: (option) => {
      const ref = stringifyEntityRef(option);
      const entityRefPresentation = entities?.entityRefToPresentationMap.get(
        stringifyEntityRef(option)
      );
      const primaryTitle = entityRefPresentation?.primaryTitle!;

      // Enhanced filtering: also consider display format
      if (displayFormat) {
        const displayValue = formatDisplayValue(displayFormat, option);
        return `${ref} ${primaryTitle} ${displayValue}`;
      }

      return `${ref} ${primaryTitle}`;
    },
  });

  return (
    <ScaffolderField
      rawErrors={rawErrors}
      rawDescription={uiSchema["ui:description"] ?? description}
      required={required}
      disabled={isDisabled}
      errors={errors}
    >
      <Autocomplete
        disabled={
          isDisabled ||
          (required &&
            !allowArbitraryValues &&
            entities?.catalogEntities?.length === 1)
        }
        value={selectedEntity}
        loading={loading}
        onChange={onSelect}
        options={entities?.catalogEntities || []}
        getOptionLabel={(option) => {
          // option can be a string due to freeSolo: true - see MUI docs for more details
          if (typeof option === "string") {
            return getLabel(option);
          }

          // Enhanced logic: Use display format if specified
          if (displayFormat) {
            return formatDisplayValue(displayFormat, option);
          }

          // Original logic
          return entities?.entityRefToPresentationMap.get(
            stringifyEntityRef(option)
          )?.primaryTitle!;
        }}
        filterOptions={filterOptions}
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
            {displayFormat ? (
              <span>{formatDisplayValue(displayFormat, option)}</span>
            ) : (
              <EntityDisplayName entityRef={option} />
            )}
          </li>
        )}
        ListboxComponent={VirtualizedListbox}
      />
    </ScaffolderField>
  );
};

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
  return value ? value.toString() : "";
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
): Exclude<EntityFilterQuery, Array<any>> | undefined {
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
 * If `allowedKinds` is specified in the `uiSchema`, it is converted to a `EntityFilterQuery`.
 * If both are specified, both are returned.
 * If `allowedKinds` is specified and `catalogFilter` is not specified, `allowedKinds` is converted to a `EntityFilterQuery` and returned.
 *
 * @param uiSchema The `uiSchema` of an `EnhancedEntityPicker` component.
 * @returns An `EntityFilterQuery` based on the `uiSchema` or undefined if neither `catalogFilter` nor `allowedKinds` are specified.
 */
function buildCatalogFilter(
  uiSchema: EnhancedEntityPickerUiOptions["uiSchema"]
): EntityFilterQuery | undefined {
  const allowedKinds = uiSchema["ui:options"]?.allowedKinds;

  const catalogFilter: EntityPickerFilterQuery | undefined =
    uiSchema["ui:options"]?.catalogFilter ||
    (allowedKinds && { kind: allowedKinds });

  if (!catalogFilter) {
    return undefined;
  }

  if (Array.isArray(catalogFilter)) {
    return catalogFilter.map(convertSchemaFiltersToQuery);
  }

  return convertSchemaFiltersToQuery(catalogFilter);
}
