import React, { useCallback, useMemo, useEffect, useState } from "react";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
import { useApi } from "@backstage/core-plugin-api";
import {
  catalogApiRef,
  EntityDisplayName,
} from "@backstage/plugin-catalog-react";
import {
  Entity,
  stringifyEntityRef,
  parseEntityRef,
} from "@backstage/catalog-model";
import { TextField, Autocomplete } from "@material-ui/core";
import useAsync from "react-use/esm/useAsync";

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

// Utility functions
const getNestedValue = (obj: any, path: string): any => {
  try {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  } catch {
    return undefined;
  }
};

const formatDisplayValue = (template: string, entity: Entity): string => {
  if (!template || !entity)
    return entity?.metadata?.title || entity?.metadata?.name || "";

  try {
    // Handle fallback syntax: "property1 || property2"
    if (template.includes(" || ")) {
      const paths = template.split(" || ").map((p) => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        if (value) return String(value);
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

  // Extract UI options
  const uiOptions = uiSchema["ui:options"] || {};
  const {
    displayEntityFieldAfterFormatting,
    catalogFilter = {},
    uniqueIdentifierField = "metadata.name",
    defaultKind = "Component",
    defaultNamespace = "default",
    allowArbitraryValues = true,
    hiddenFieldName,
    placeholder = "Select an entity...",
  } = uiOptions;

  // Build entity filter query
  const filterQuery = useMemo(() => {
    const query: any = {};

    // Add kind filter
    if (catalogFilter.kind) {
      query.kind = catalogFilter.kind;
    }

    // Add type filter
    if (catalogFilter.type) {
      query["spec.type"] = catalogFilter.type;
    }

    // Add any other filters
    Object.keys(catalogFilter).forEach((key) => {
      if (key !== "kind" && key !== "type") {
        query[key] = catalogFilter[key];
      }
    });

    return query;
  }, [catalogFilter]);

  // Fetch entities from catalog
  const { value: entities = [], loading } = useAsync(async () => {
    try {
      const response = await catalogApi.getEntities({
        filter: filterQuery,
      });
      return response.items;
    } catch (error) {
      console.error("Failed to fetch entities:", error);
      return [];
    }
  }, [catalogApi, filterQuery]);

  // Find selected entity
  const selectedEntity = useMemo(() => {
    if (!formData || !entities.length) return null;

    return entities.find((entity) => {
      const entityRef = stringifyEntityRef(entity);
      const customRef = getNestedValue(entity, uniqueIdentifierField);
      return entityRef === formData || customRef === formData;
    });
  }, [formData, entities, uniqueIdentifierField]);

  // Enhanced onChange handler
  const handleChange = useCallback(
    async (event: any, value: Entity | null) => {
      if (!value) {
        onChange("");
        return;
      }

      // Determine the value to store based on uniqueIdentifierField
      let entityValue: string;
      if (uniqueIdentifierField !== "metadata.name") {
        const customValue = getNestedValue(value, uniqueIdentifierField);
        entityValue = customValue || stringifyEntityRef(value);
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
    (event: any, value: string) => {
      setInputValue(value);

      if (
        allowArbitraryValues &&
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
    (option: Entity) => {
      if (displayEntityFieldAfterFormatting) {
        return formatDisplayValue(displayEntityFieldAfterFormatting, option);
      }
      return option.metadata.title || option.metadata.name;
    },
    [displayEntityFieldAfterFormatting]
  );

  return (
    <Autocomplete
      {...restProps}
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
      renderOption={(entity) => (
        <div>
          <EntityDisplayName entityRef={stringifyEntityRef(entity)} />
        </div>
      )}
    />
  );
};
