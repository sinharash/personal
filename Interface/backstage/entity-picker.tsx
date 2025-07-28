import React, { useCallback, useMemo, useState } from "react";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
import { useApi } from "@backstage/core-plugin-api";
import {
  catalogApiRef,
  EntityDisplayName,
} from "@backstage/plugin-catalog-react";
import { Entity, stringifyEntityRef } from "@backstage/catalog-model";
import { TextField, Autocomplete } from "@mui/material";
import useAsync from "react-use/esm/useAsync";
import { EntityFilterQuery } from "@backstage/catalog-client";

// Define the catalog filter interface to match EntityFilterQuery requirements
interface CatalogFilterOptions {
  kind?: string | string[];
  type?: string | string[];
  "metadata.namespace"?: string | string[];
  "metadata.name"?: string | string[];
  "spec.type"?: string | string[];
  "spec.lifecycle"?: string | string[];
  [key: string]: string | string[] | undefined;
}

// Schema definition for the field extension
export const EnhancedEntityPickerSchema = {
  uiOptions: {
    type: "object",
    properties: {
      displayEntityFieldAfterFormatting: {
        type: "string",
        description:
          'Template for displaying entity names (e.g., "{{ metadata.title }} - {{ spec.profile.email }}")',
      },
      catalogFilter: {
        type: "object",
        description: "Filter entities by kind, type, or other properties",
      },
      uniqueIdentifierField: {
        type: "string",
        description:
          "Field to use as unique identifier (default: metadata.name)",
      },
      defaultKind: {
        type: "string",
        description: "Default entity kind",
      },
      defaultNamespace: {
        type: "string",
        description: "Default entity namespace",
      },
      allowArbitraryValues: {
        type: "boolean",
        description: "Allow arbitrary user input",
      },
      hiddenFieldName: {
        type: "string",
        description: "Name of hidden field to store full entity reference",
      },
      placeholder: {
        type: "string",
        description: "Placeholder text for the input field",
      },
    },
  },
  returnValue: {
    type: "string",
  },
};

// Utility functions with better type safety
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

const formatDisplayValue = (template: string, entity: Entity): string => {
  if (!template || !entity) {
    return entity?.metadata?.title || entity?.metadata?.name || "";
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
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return value ? String(value) : "";
    });
  } catch {
    return entity?.metadata?.name || "";
  }
};

// Build filter query with proper type safety
const buildFilterQuery = (
  catalogFilter: Record<string, any> | null | undefined,
  defaultKind?: string,
  defaultNamespace?: string
): EntityFilterQuery => {
  const query: EntityFilterQuery = {};

  // Add default kind if provided and no kind in catalogFilter
  if (defaultKind && (!catalogFilter || !catalogFilter.kind)) {
    query.kind = defaultKind;
  }

  // Add default namespace if provided
  if (defaultNamespace) {
    query["metadata.namespace"] = defaultNamespace;
  }

  // Handle catalogFilter if it exists and is an object
  if (catalogFilter && typeof catalogFilter === "object") {
    // Handle known filter fields with proper type conversion
    const filterEntries = Object.entries(catalogFilter);

    for (const [key, value] of filterEntries) {
      if (value === undefined || value === null) continue;

      // Convert value to proper type for EntityFilterQuery
      let filterValue: string | string[];

      if (Array.isArray(value)) {
        filterValue = value.map((v) => String(v));
      } else {
        filterValue = String(value);
      }

      // Map common filter keys
      switch (key) {
        case "kind":
          query.kind = filterValue;
          break;
        case "type":
          query["spec.type"] = filterValue;
          break;
        case "namespace":
          query["metadata.namespace"] = filterValue;
          break;
        default:
          // For other keys, use them as-is if they're valid EntityFilterQuery keys
          if (
            key.includes(".") ||
            [
              "kind",
              "metadata.namespace",
              "metadata.name",
              "spec.type",
              "spec.lifecycle",
            ].includes(key)
          ) {
            (query as any)[key] = filterValue;
          }
          break;
      }
    }
  }

  return query;
};

/**
 * Enhanced EntityPicker field extension that provides:
 * - Custom display formatting for entities
 * - Flexible catalog filtering
 * - Hidden field storage for entity references
 * - Full compatibility with scaffolder templates
 */
export const EnhancedEntityPicker = (
  props: FieldExtensionComponentProps<string>
) => {
  const {
    onChange,
    schema: { title = "Entity", description },
    uiSchema,
    formData,
    formContext,
    required = false,
    rawErrors = [],
    disabled = false,
  } = props;

  const catalogApi = useApi(catalogApiRef);
  const [inputValue, setInputValue] = useState("");

  // Extract UI options with proper defaults and type safety
  const uiOptions = uiSchema["ui:options"] || {};
  const {
    displayEntityFieldAfterFormatting,
    catalogFilter,
    uniqueIdentifierField = "metadata.name",
    defaultKind = "Component",
    defaultNamespace = "default",
    allowArbitraryValues = true,
    hiddenFieldName,
    placeholder = "Select an entity...",
  } = uiOptions;

  // Build entity filter query with type safety
  const filterQuery = useMemo(() => {
    return buildFilterQuery(
      catalogFilter as Record<string, any> | null | undefined,
      defaultKind,
      defaultNamespace
    );
  }, [catalogFilter, defaultKind, defaultNamespace]);

  // Fetch entities from catalog
  const { value: entities = [], loading } = useAsync(async () => {
    try {
      const response = await catalogApi.getEntities({
        filter: filterQuery,
      });
      return response.items || [];
    } catch (error) {
      console.error("Failed to fetch entities:", error);
      return [];
    }
  }, [catalogApi, filterQuery]);

  // Find selected entity with null safety
  const selectedEntity = useMemo(() => {
    if (!formData || !entities.length) return null;

    return (
      entities.find((entity) => {
        const entityRef = stringifyEntityRef(entity);
        const customRef = getNestedValue(entity, uniqueIdentifierField);
        const customRefString = customRef ? String(customRef) : null;
        return entityRef === formData || customRefString === formData;
      }) || null
    );
  }, [formData, entities, uniqueIdentifierField]);

  // Enhanced onChange handler with correct MUI signature
  const handleChange = useCallback(
    (
      _event: React.SyntheticEvent,
      value: Entity | string | null,
      _reason: string
    ) => {
      if (!value) {
        onChange("");
        return;
      }

      // Handle string values (for freeSolo/arbitrary input)
      if (typeof value === "string") {
        onChange(value);
        return;
      }

      // Handle Entity objects
      let entityValue: string;
      if (uniqueIdentifierField !== "metadata.name") {
        const customValue = getNestedValue(value, uniqueIdentifierField);
        entityValue = customValue
          ? String(customValue)
          : stringifyEntityRef(value);
      } else {
        entityValue = stringifyEntityRef(value);
      }

      onChange(entityValue);

      // Store entity reference in hidden field if configured
      if (hiddenFieldName && formContext?.formData) {
        try {
          const entityRef = stringifyEntityRef(value);
          if (entityRef) {
            formContext.formData[hiddenFieldName] = entityRef;
          }
        } catch (error) {
          console.warn("Failed to store entity reference:", error);
        }
      }
    },
    [onChange, uniqueIdentifierField, hiddenFieldName, formContext]
  );

  // Handle input change for free text input with correct signature
  const handleInputChange = useCallback(
    (_event: React.SyntheticEvent, value: string, reason: string) => {
      setInputValue(value);

      if (allowArbitraryValues && value && reason === "input") {
        // Check if the input value matches any existing entity display value
        const matchesExistingEntity = entities.some((e) => {
          const displayValue = formatDisplayValue(
            displayEntityFieldAfterFormatting || "",
            e
          );
          return displayValue === value;
        });

        if (!matchesExistingEntity) {
          onChange(value);
        }
      }
    },
    [
      allowArbitraryValues,
      entities,
      displayEntityFieldAfterFormatting,
      onChange,
    ]
  );

  // Custom option label formatter with proper type handling
  const getOptionLabel = useCallback(
    (option: Entity | string) => {
      // Handle string values (for arbitrary input)
      if (typeof option === "string") {
        return option;
      }

      // Handle Entity objects
      if (displayEntityFieldAfterFormatting) {
        return formatDisplayValue(displayEntityFieldAfterFormatting, option);
      }
      return option.metadata.title || option.metadata.name;
    },
    [displayEntityFieldAfterFormatting]
  );

  // Determine if option is equal to value (for selection highlighting)
  const isOptionEqualToValue = useCallback(
    (option: Entity | string, value: Entity | string) => {
      if (typeof option === "string" && typeof value === "string") {
        return option === value;
      }
      if (typeof option === "object" && typeof value === "object") {
        return stringifyEntityRef(option) === stringifyEntityRef(value);
      }
      if (typeof option === "object" && typeof value === "string") {
        return (
          stringifyEntityRef(option) === value ||
          getOptionLabel(option) === value
        );
      }
      if (typeof option === "string" && typeof value === "object") {
        return (
          option === stringifyEntityRef(value) ||
          option === getOptionLabel(value)
        );
      }
      return false;
    },
    [getOptionLabel]
  );

  return (
    <Autocomplete<Entity | string, false, boolean, boolean>
      options={entities}
      value={selectedEntity}
      inputValue={inputValue}
      onChange={handleChange}
      onInputChange={handleInputChange}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
      loading={loading}
      disabled={disabled}
      freeSolo={allowArbitraryValues}
      renderInput={(params) => (
        <TextField
          {...params}
          label={title}
          helperText={description}
          placeholder={placeholder}
          required={required}
          error={rawErrors.length > 0}
          variant="outlined"
          margin="normal"
        />
      )}
      renderOption={(props, entity) => (
        <li
          {...props}
          key={typeof entity === "string" ? entity : stringifyEntityRef(entity)}
        >
          {typeof entity === "string" ? (
            entity
          ) : (
            <EntityDisplayName entityRef={stringifyEntityRef(entity)} />
          )}
        </li>
      )}
    />
  );
};
