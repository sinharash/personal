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
import { TextField, Autocomplete, createFilterOptions } from "@mui/material";
import type { AutocompleteChangeReason } from "@mui/material";
import { useCallback, useEffect } from "react";
import useAsync from "react-use/esm/useAsync";
import {
  EntityPickerFilterQueryValue,
  EnhancedEntityPickerProps,
  EnhancedEntityPickerUiOptions,
  EntityPickerFilterQuery,
} from "./enhanced-schema";
import { VirtualizedListbox } from "../VirtualizedListbox";
import { useTranslationRef } from "@backstage/core-plugin-api/alpha";
import { scaffolderTranslationRef } from "../../../translation";
import { ScaffolderField } from "@backstage/plugin-scaffolder-react/alpha";

export { EnhancedEntityPickerSchema } from "./enhanced-schema";
import { ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS } from "./enhanced-entity-picker-fields";

const convertToString = (value: any): string => {
  if (value === null || value === undefined) return "";

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};
// Utility functions for display formatting
// Enhanced getNestedValue to handle arrays and objects
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;

  try {
    return path.split(".").reduce((current, key) => {
      if (current === null || current === undefined) return undefined;

      if (!isNaN(Number(key)) && Array.isArray(current)) {
        return current[Number(key)];
      }

      return current[key];
    }, obj);
  } catch (err) {
    return undefined;
  }
};

// convert template strings with {{ }} placeholders into display text
// const formatDisplayValue = (template: string, entity: Entity): string => {
//   if (!template || !entity) {
//     return entity?.metadata?.title || entity?.metadata?.name || "";
//   }

//   try {
//     // Handle fallback syntax: "property1 || property2"
//     if (template.includes(" || ")) {
//       const paths = template.split(" || ").map((p) => p.trim());
//       for (const path of paths) {
//         const value = getNestedValue(entity, path);
//         const stringValue = convertToString(value);
//         if (stringValue && stringValue.trim()) return stringValue;
//         // if (value && String(value).trim()) return String(value);
//       }
//       return "";
//     }

//     // Handle template syntax: "{{ property }}"
//     return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
//       const value = getNestedValue(entity, expression.trim());
//       return convertToString(value);
//     });
//   } catch {
//     return entity?.metadata?.name || "";
//   }
// };
/**
 * 
 * @param template With this change, you get a much more intuitive and flexible syntax:
Examples:

Simple: "{{ metadata.name }}"
With text: "Name: {{ metadata.name }}"
With fallback: "{{ metadata.title || metadata.name }}"
Complex: "{{ metadata.name || metadata.title }} ({{ spec.profile.email || spec.email || 'no email' }})"
Mixed: "User: {{ spec.profile.displayName || metadata.name }} - Type: {{ spec.type }}"

This way:

Everything uses the same {{ }} syntax
Fallback is intuitive - just use || inside the braces
You can mix fallback and non-fallback in the same template
It's more flexible - each placeholder can have its own fallback logic

What do you think? This would make the template syntax much more consistent and powerful.RetryClaude can make mistakes. Please double-check responses.Research Opus 4.1
 * @param entity 
 * @returns 
 */
const formatDisplayValue = (template: string, entity: Entity): string => {
  if (!template || !entity) {
    return entity?.metadata?.title || entity?.metadata?.name || "";
  }

  try {
    // Handle template syntax: "{{ property }}" with support for fallback inside
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const expr = expression.trim();

      // Check if this expression contains fallback syntax (||)
      if (expr.includes("||")) {
        // Handle fallback: try each option until we find a non-empty value
        const paths = expr.split("||").map((p: string) => p.trim());
        for (const path of paths) {
          const value = getNestedValue(entity, path);
          const stringValue = convertToString(value);
          if (stringValue && stringValue.trim()) {
            return stringValue;
          }
        }
        return ""; // Return empty if no fallback has a value
      } else {
        const value = getNestedValue(entity, expr);
        return convertToString(value);
      }
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
    const baseFields = [
      "kind",
      "metadata.name",
      "metadata.namespace",
      "metadata.title",
      "metadata.description",
      "spec.profile.displayName",
      "spec.profile.email",
      "spec.type",
    ];

    const allFields = [
      ...baseFields,
      ...ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS,
    ];

    const { items } = await catalogApi.getEntities(
      catalogFilter
        ? { filter: catalogFilter, fields: allFields }
        : { filter: undefined, fields: allFields }
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
      if (typeof ref !== "string") {
        if (!ref) {
          // if ref does not exist: pass 'undefined' to trigger validation for required value
          onChange(undefined);
          return;
        }

        // Enhanced logic: Store display value if displayFormat is specified
        if (displayFormat) {
          const displayValue = formatDisplayValue(displayFormat, ref);
          onChange(displayValue);

          // Store entity reference in hidden field if specified
          if (hiddenEntityRef && formContext?.formData) {
            const entityRef = stringifyEntityRef(ref);
            formContext.formData[hiddenEntityRef] = entityRef;
          }
        } else {
          // Original logic: Store entity reference
          onChange(stringifyEntityRef(ref));
        }
      } else {
        if (reason === "blur" || reason === "createOption") {
          // Add in default namespace, etc.
          let entityRef = ref;
          try {
            // Attempt to parse the entity ref into it's full form.
            entityRef = stringifyEntityRef(
              parseEntityRef(ref as string, {
                defaultKind,
                defaultNamespace,
              })
            );
          } catch (err) {
            // If the passed in value isn't an entity ref, do nothing.
          }
          // We need to check against formData here as that's the previous value for this field.
          if (formData !== ref || allowArbitraryValues) {
            onChange(entityRef);
          }
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
    if (!formData || !entities?.catalogEntities.length) {
      return allowArbitraryValues && formData ? getLabel(formData) : "";
    }

    // Try to find by entity reference first (original logic)
    const entityByRef = entities.catalogEntities.find(
      (e: Entity) => stringifyEntityRef(e) === formData
    );
    if (entityByRef) return entityByRef;

    // If displayFormat is used, try to find by display value
    if (displayFormat) {
      const entityByDisplay = entities.catalogEntities.find((e: Entity) => {
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
      entities?.catalogEntities.length === 1 &&
      selectedEntity === ""
    ) {
      const singleEntity = entities.catalogEntities[0];
      if (displayFormat) {
        const displayValue = formatDisplayValue(displayFormat, singleEntity);
        onChange(displayValue);

        if (hiddenEntityRef && formContext?.formData) {
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
            entities?.catalogEntities.length === 1)
        }
        id={idSchema?.$id}
        value={selectedEntity}
        loading={loading}
        onChange={onSelect}
        options={entities?.catalogEntities || []}
        getOptionLabel={(option) => {
          if (typeof option === "string") {
            return option;
          } else if (displayFormat) {
            return formatDisplayValue(displayFormat, option);
          }
          return (
            entities?.entityRefToPresentation.get(stringifyEntityRef(option))
              ?.entityRef || stringifyEntityRef(option)
          );
        }}
        // getOptionLabel={(option) =>
        //   // option can be a string due to freeSolo.
        //   typeof option === "string"
        //     ? option
        //     : displayFormat
        //     ? formatDisplayValue(displayFormat, option)
        //     : entities?.entityRefToPresentation.get(stringifyEntityRef(option))
        //         ?.entityRef!
        // }
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
        renderOption={(renderProps, option) => (
          <li {...renderProps}>
            {displayFormat ? (
              <span>{formatDisplayValue(displayFormat, option)}</span>
            ) : (
              <EntityDisplayName entityRef={option} />
            )}
          </li>
        )}
        filterOptions={createFilterOptions<Entity>({
          stringify: (option) =>
            displayFormat
              ? formatDisplayValue(displayFormat, option)
              : entities?.entityRefToPresentation.get(
                  stringifyEntityRef(option)
                )?.primaryTitle!,
        })}
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
 * @param uiSchema The `uiSchema` of an `EnhancedEntityPicker` component.
 * @returns An `EntityFilterQuery` based on the `uiSchema`, or `undefined` if `catalogFilter` is not specified in the `uiSchema`.
 */
function buildCatalogFilter(
  uiSchema: EnhancedEntityPickerProps["uiSchema"]
): EntityFilterQuery | undefined {
  const allowedKinds = uiSchema["ui:options"]?.allowedKinds;

  const catalogFilter:
    | EnhancedEntityPickerUiOptions["catalogFilter"]
    | undefined =
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


>>>>>>>>>>

suggested change:

/**
 * Extract field paths from a displayFormat template
 * Example: "{{ metadata.name }} - {{ spec.owner }}" -> ['metadata.name', 'spec.owner']
 */
const extractFieldsFromTemplate = (template: string): string[] => {
  if (!template) return [];
  
  const fields = new Set<string>();
  const regex = /\{\{\s*([^}]+)\s*\}\}/g;
  let match;
  
  while ((match = regex.exec(template)) !== null) {
    const expression = match[1];
    // Handle fallback syntax: "metadata.title || metadata.name"
    if (expression.includes('||')) {
      const paths = expression.split('||').map(p => p.trim());
      paths.forEach(path => {
        // Only add if it looks like a field path (not a literal string)
        if (!path.startsWith("'") && !path.startsWith('"')) {
          fields.add(path);
        }
      });
    } else {
      const path = expression.trim();
      if (!path.startsWith("'") && !path.startsWith('"')) {
        fields.add(path);
      }
    }
  }
  
  return Array.from(fields);
};

// Then in your component, replace the static field list with dynamic extraction:

const { value: entities, loading } = useAsync(async () => {
  const baseFields = [
    "kind",
    "metadata.name",
    "metadata.namespace",
    "metadata.title",
    "metadata.description",
    "spec.profile.displayName",
    "spec.profile.email",
    "spec.type",
  ];

  // Dynamically extract fields from displayFormat template
  const templateFields = displayFormat ? extractFieldsFromTemplate(displayFormat) : [];
  
  // Combine base fields with template fields (remove duplicates)
  const allFields = [...new Set([...baseFields, ...templateFields])];

  const { items } = await catalogApi.getEntities(
    catalogFilter
      ? { filter: catalogFilter, fields: allFields }
      : { filter: undefined, fields: allFields }
  );

  // ... rest of the code
}, [catalogFilter, displayFormat]); // Add displayFormat as dependency

another change linter complained: 
const extractFieldsFromTemplate = (template: string): string[] => {
  if (!template) return [];
  
  const fields = new Set<string>();
  const regex = /\{\{\s*([^}]+)\s*\}\}/g;
  let match = regex.exec(template);  // Move initial assignment outside
  
  while (match !== null) {  // Now just checking, not assigning
    const expression = match[1];
    // Handle fallback syntax: "metadata.title || metadata.name"
    if (expression.includes('||')) {
      const paths = expression.split('||').map((p: string) => p.trim());
      paths.forEach(path => {
        // Only add if it is a field path (not a literal string)
        if (!path.startsWith("'") && !path.startsWith('"')) {
          fields.add(path);
        }
      });
    } else {
      const path = expression.trim();
      if (!path.startsWith("'") && !path.startsWith('"')) {
        fields.add(path);
      }
    }
    match = regex.exec(template);  // Move assignment to end of loop
  }
  
  return Array.from(fields);
};