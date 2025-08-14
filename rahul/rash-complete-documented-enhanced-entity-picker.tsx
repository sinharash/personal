import {
  Entity,
  parseEntityRef,
  stringifyEntityRef,
} from "@backstage/catalog-model";
import { CatalogApi, useApi } from "@backstage/plugin-catalog-react";
import { useCallback, useEffect, useState } from "react";
import { CATALOG_FILTER_EXISTS } from "@backstage/catalog-client";
import useAsync from "react-use/lib/useAsync";
import TextField from "@mui/material/TextField";
import Autocomplete, {
  autocompleteClasses,
  AutocompleteChangeReason,
  createFilterOptions,
} from "@mui/material/Autocomplete";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { EntityPresentationSnapshot } from "../../../common/schema";
import { VirtualizedListbox } from "./VirtualizedListbox";
import { EntityPickerFilterQueryValue } from "../../../common/types";
import { ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS } from "./ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS";

// Add this helper function to check if enhanced features are being used
const isUsingEnhancedFeatures = (
  displayFormat?: string,
  hiddenEntityRef?: boolean
): boolean => {
  return !!(displayFormat || hiddenEntityRef);
};

// convertToString function - only apply when displayFormat is specified
function convertToString(
  value: ExcludeEntityFilterQuery,
  ArrayMap?: any,
  string?: string
): string | symbol {
  // Only apply custom conversion if displayFormat is specified
  if (!string) {
    // When no displayFormat, return the value as-is (this maintains original behavior)
    return typeof value === "string" ? value : String(value);
  }

  if (typeof value === "object" && value.exists) {
    return CATALOG_FILTER_EXISTS;
  }
  return value?.toString();
}

// Enhanced getNestedValue to handle arrays and objects
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;

  // Handle array notation like paths[0].url
  const pathParts = path.split(/[\.\[\]]+/).filter(Boolean);

  return pathParts.reduce((current, key) => {
    if (current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = parseInt(key);
      return isNaN(index) ? undefined : current[index];
    }
    return current[key];
  }, obj);
};

// formatDisplayValue function to handle displayFormat
const formatDisplayValue = (
  template: string,
  entity: Entity,
  entityRef: EntityRefPresentation
): string => {
  if (!template) {
    return entityRef.entityRef;
  }

  // Replace template variables with actual values
  let result = template;

  // Match patterns like {{metadata.name}} or {{spec.profile.displayName}}
  const placeholderRegex = /\{\{([^}]+)\}\}/g;

  result = result.replace(placeholderRegex, (match, path) => {
    const trimmedPath = path.trim();
    const value = getNestedValue(entity, trimmedPath);
    return value !== undefined ? String(value) : match;
  });

  // If no replacements were made, return the original entityRef
  if (result === template) {
    return entityRef.entityRef;
  }

  return result;
};

// EntityRefToPresentation component
const EntityRefToPresentation = new Map<
  string,
  EntityRefPresentationSnapshot
>();

// Type definitions
type ExcludeEntityFilterQuery =
  | string
  | {
      exists?: boolean | undefined;
    };

interface EntityRefPresentation {
  id: string;
  value: string;
  description?: string;
  loading: boolean;
  primaryTitle?: string;
  entityRef: string;
}

export const EnhancedEntityPicker = (props: EnhancedEntityPickerProps) => {
  const {
    schema: { title = "Entity", description = "An entity from the catalog" },
    uiSchema,
    rawErrors,
    formData,
    onChange,
    idSchema,
    required,
  } = props;

  const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {
    kind: ["Component", "Template"],
  };
  const defaultKind = uiSchema?.["ui:options"]?.defaultKind || "Component";
  const defaultNamespace =
    uiSchema?.["ui:options"]?.defaultNamespace || "default";
  const allowArbitraryValues =
    uiSchema?.["ui:options"]?.allowArbitraryValues ?? true;
  const displayFormat = uiSchema?.["ui:options"]?.displayFormat;
  const hiddenEntityRef = uiSchema?.["ui:options"]?.hiddenEntityRef;
  const catalogApi = useApi<CatalogApi>(catalogApiRef);

  // Check if we're using enhanced features
  const usingEnhancedFeatures = isUsingEnhancedFeatures(
    displayFormat,
    hiddenEntityRef
  );

  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState<EntityRefPresentation[]>([]);
  const [selectedEntity, setSelectedEntity] =
    useState<EntityRefPresentation | null>(null);
  const [hiddenFieldRef, setHiddenFieldRef] = useState<string>("");

  const filterOptions = createFilterOptions<EntityRefPresentation>({
    stringify: (option) => option.value,
  });

  const { loading, value: entities } = useAsync(async () => {
    const filterQuery = convertSchemaFiltersToQuery(catalogFilter);
    const response = await catalogApi.getEntities({
      filter: filterQuery,
    });
    return response.items;
  }, [catalogApi, catalogFilter]);

  useEffect(() => {
    if (!entities) {
      setOptions([]);
      return;
    }

    const newOptions = entities.map((entity) => {
      const entityRef = stringifyEntityRef(entity);
      const cached = EntityRefToPresentation.get(entityRef);

      if (cached) {
        return {
          ...cached,
          loading: false,
        };
      }

      const presentation = {
        id: entityRef,
        value: entity.metadata?.title || entity.metadata.name,
        description: entity.metadata?.description,
        loading: false,
        primaryTitle: entity.metadata?.title || entity.metadata.name,
        entityRef,
      };

      EntityRefToPresentation.set(entityRef, presentation);
      return presentation;
    });

    setOptions(newOptions);
  }, [entities]);

  const onSelect = useCallback(
    (
      _: React.SyntheticEvent,
      value: EntityRefPresentation | string | null,
      reason: AutocompleteChangeReason
    ) => {
      // Handle clear action
      if (reason === "clear") {
        onChange(undefined);
        setHiddenFieldRef("");
        return;
      }

      // Handle no value
      if (!value) {
        onChange(undefined);
        setHiddenFieldRef("");
        return;
      }

      // Handle string value (arbitrary input)
      if (typeof value === "string") {
        if (allowArbitraryValues) {
          const ref = parseEntityRef(value, { defaultKind, defaultNamespace });
          onChange(stringifyEntityRef(ref));
        }
        return;
      }

      // Handle entity selection with enhanced features
      if (usingEnhancedFeatures && hiddenEntityRef) {
        // Store entity reference in hidden field if specified
        setHiddenFieldRef(value.entityRef);

        // If displayFormat is specified, format the display value
        if (displayFormat && entities) {
          const entity = entities.find(
            (e) => stringifyEntityRef(e) === value.entityRef
          );
          if (entity) {
            const formattedValue = formatDisplayValue(
              displayFormat,
              entity,
              value
            );
            onChange(formattedValue);
          } else {
            onChange(value.entityRef);
          }
        } else {
          onChange(value.entityRef);
        }
      } else {
        // Original behavior - just pass the entityRef
        onChange(value.entityRef);
      }

      setSelectedEntity(value);
    },
    [
      onChange,
      formData,
      allowArbitraryValues,
      defaultKind,
      defaultNamespace,
      hiddenEntityRef,
      displayFormat,
      entities,
      usingEnhancedFeatures,
    ]
  );

  // Enhanced selectedEntity logic to handle both entity refs and display values
  const selectedEntityLogic = (() => {
    if (!formData || !entities?.catalogEntities?.length) {
      return allowArbitraryValues && formData ? getLabel(formData) : "";
    }

    // Try to find by entity reference first (original logic)
    const entityByRef = entities.catalogEntities.find(
      (e) => stringifyEntityRef(e) === formData
    );
    if (entityByRef) return entityByRef;

    // If displayFormat is used, try to find by display value
    if (usingEnhancedFeatures && displayFormat) {
      const entityByDisplay = entities.catalogEntities.find((e) => {
        const displayValue = formatDisplayValue(displayFormat, e, {
          entityRef: stringifyEntityRef(e),
        } as EntityRefPresentation);
        return displayValue === formData;
      });
      if (entityByDisplay) return entityByDisplay;
    }

    // Fallback to original logic
    return allowArbitraryValues && formData ? getLabel(formData) : "";
  })();

  // Only use enhanced display logic if displayFormat is specified
  const displayValue = (() => {
    if (!usingEnhancedFeatures || !displayFormat) {
      // Original behavior
      return (
        selectedEntity ||
        (formData ? options.find((o) => o.entityRef === formData) : null)
      );
    }

    // Enhanced behavior
    if (selectedEntity) {
      return selectedEntity;
    }

    if (formData && entities) {
      // Try to find entity by ref or display value
      const entity = entities.find((e) => {
        const entityRef = stringifyEntityRef(e);
        if (entityRef === formData) return true;

        const displayValue = formatDisplayValue(displayFormat, e, {
          entityRef,
        } as EntityRefPresentation);
        return displayValue === formData;
      });

      if (entity) {
        const entityRef = stringifyEntityRef(entity);
        return {
          id: entityRef,
          value: entity.metadata?.title || entity.metadata.name,
          description: entity.metadata?.description,
          loading: false,
          primaryTitle: entity.metadata?.title || entity.metadata.name,
          entityRef,
        };
      }
    }

    return null;
  })();

  return (
    <>
      <Autocomplete
        id={idSchema?.$id}
        value={displayValue}
        loading={loading}
        onChange={onSelect}
        options={options}
        filterOptions={filterOptions}
        freeSolo={allowArbitraryValues}
        renderInput={(params) => (
          <TextField
            {...params}
            label={title}
            margin="dense"
            variant="outlined"
            required={required}
            disabled={isDisabled}
            inputProps={params.InputProps}
            error={rawErrors?.length > 0}
            helperText={description || (rawErrors?.length > 0 && rawErrors[0])}
          />
        )}
        renderOption={(renderProps, option) => (
          <li {...renderProps}>
            {displayFormat ? (
              <span>{formatDisplayValue(displayFormat, option)}</span>
            ) : (
              <span>{option.entityRef}</span>
            )}
          </li>
        )}
        ListboxComponent={VirtualizedListbox}
      />
      {usingEnhancedFeatures && hiddenEntityRef && (
        <input type="hidden" value={hiddenFieldRef} />
      )}
    </>
  );
};

/**
 * Converts a special `{exists: true}` value to the `CATALOG_FILTER_EXISTS` symbol.
 * This is only used when enhanced features are active.
 */
function convertOpsValues(
  value: ExcludeEntityFilterQuery,
  ArrayMap?: any
): string | symbol {
  // When no enhanced features, return value as-is
  if (!ArrayMap) {
    return typeof value === "string" ? value : String(value);
  }

  // Enhanced behavior
  return convertToString(value, ArrayMap, ArrayMap);
}

/**
 * Converts schema filters to entity filter query.
 * With the constant `CATALOG_FILTER_EXISTS`.
 * @param schemaFilters - An object containing schema filters with keys as filter names
 * and values as filter values.
 * @returns An object with the same keys as the input object, but with `{exists: true}` values
 * transformed to `CATALOG_FILTER_EXISTS` symbol.
 */
function convertSchemaFiltersToQuery(
  schemaFilters: EntityFilterQuery,
  ArrayMap?: any
): string | symbol {
  const query: EntityFilterQuery = {};
  for (const [key, value] of Object.entries(schemaFilters)) {
    if (Array.isArray(value)) {
      query[key] = value;
    } else if (value === "string") {
      query[key] = convertOpsValues(value);
    } else {
      query[key] = value;
    }
  }
  return query;
}

/**
 * Builds an `EntityFilterQuery` based on the `uiSchema` passed in.
 * If `catalogFilter` is specified in the `uiSchema`, it is converted to a `EntityFilterQuery`.
 * If `allowedKinds` is specified in the `uiSchema`, it is converted to a `EntityFilterQuery`.
 * @param uiSchema The `uiSchema` of an `EnhancedEntityPicker` component.
 * @returns An `EntityFilterQuery` based on the `uiSchema`, or `undefined` if `catalogFilter` is not specified in the `uiSchema`.
 */
function buildCatalogFilter(
  uiSchema: EnhancedEntityPickerProps["uiSchema"]
): EntityFilterQuery | undefined {
  const allowedKinds = uiSchema?.["ui:options"]?.["catalogFilter"] || undefined;
  const catalogFilter: EnhancedEntityPickerUiOptions["catalogFilter"] =
    uiSchema?.["ui:options"]?.catalogFilter ||
    (allowedKinds && { kind: allowedKinds });

  if (!catalogFilter) {
    return undefined;
  }

  if (Array.isArray(catalogFilter)) {
    return catalogFilter.map(convertSchemaFiltersToQuery);
  }

  return convertSchemaFiltersToQuery(catalogFilter);
}
