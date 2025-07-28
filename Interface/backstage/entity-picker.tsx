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

// Define the catalog filter interface for better type safety
interface CatalogFilterOptions {
  kind?: string | string[];
  type?: string | string[];
  [key: string]: string | string[] | number | boolean | undefined;
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
  catalogFilter: CatalogFilterOptions
): EntityFilterQuery => {
  const query: EntityFilterQuery = {};

  if (!catalogFilter || typeof catalogFilter !== "object") {
    return query;
  }

  // Handle kind filter
  if (catalogFilter.kind) {
    query.kind = catalogFilter.kind;
  }

  // Handle type filter (goes to spec.type)
  if (catalogFilter.type) {
    query["spec.type"] = catalogFilter.type;
  }

  // Handle other filters
  Object.entries(catalogFilter).forEach(([key, value]) => {
    if (key !== "kind" && key !== "type" && value !== undefined) {
      query[key] = value;
    }
  });

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
    ...restProps
  } = props;

  const catalogApi = useApi(catalogApiRef);
  const [inputValue, setInputValue] = useState("");

  // Extract UI options with proper defaults and type safety
  const uiOptions = uiSchema["ui:options"] || {};
  const {
    displayEntityFieldAfterFormatting,
    catalogFilter = {} as CatalogFilterOptions,
    uniqueIdentifierField = "metadata.name",
    defaultKind = "Component",
    defaultNamespace = "default",
    allowArbitraryValues = true,
    hiddenFieldName,
    placeholder = "Select an entity...",
  } = uiOptions;

  // Build entity filter query with type safety
  const filterQuery = useMemo(() => {
    return buildFilterQuery(catalogFilter);
  }, [catalogFilter]);

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
        return entityRef === formData || customRef === formData;
      }) || null
    );
  }, [formData, entities, uniqueIdentifierField]);

  // Enhanced onChange handler
  const handleChange = useCallback(
    async (event: React.SyntheticEvent, value: Entity | null) => {
      if (!value) {
        onChange("");
        return;
      }

      // Determine the value to store based on uniqueIdentifierField
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
          formContext.formData[hiddenFieldName] = stringifyEntityRef(value);
        } catch (error) {
          console.warn("Failed to store entity reference:", error);
        }
      }
    },
    [onChange, uniqueIdentifierField, hiddenFieldName, formContext]
  );

  // Handle input change for free text input
  const handleInputChange = useCallback(
    (event: React.SyntheticEvent, value: string) => {
      setInputValue(value);

      if (
        allowArbitraryValues &&
        value &&
        !entities.find(
          (e) =>
            formatDisplayValue(displayEntityFieldAfterFormatting || "", e) ===
            value
        )
      ) {
        onChange(value);
      }
    },
    [
      allowArbitraryValues,
      entities,
      displayEntityFieldAfterFormatting,
      onChange,
    ]
  );

  // Custom option label formatter
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

  return (
    <Autocomplete
      options={entities}
      value={selectedEntity}
      onChange={handleChange}
      onInputChange={handleInputChange}
      getOptionLabel={getOptionLabel}
      loading={loading}
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
        <li {...props}>
          <EntityDisplayName entityRef={stringifyEntityRef(entity)} />
        </li>
      )}
    />
  );
};
