// EnhancedEntityPicker.tsx - Fully fixed version with no TypeScript errors
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
import { useApi } from "@backstage/core-plugin-api";
import {
  catalogApiRef,
  EntityDisplayName,
  entityPresentationApiRef,
} from "@backstage/plugin-catalog-react";
import {
  Entity,
  stringifyEntityRef,
  DEFAULT_NAMESPACE,
} from "@backstage/catalog-model";
import {
  TextField,
  Autocomplete,
  createFilterOptions,
  AutocompleteRenderOptionState,
} from "@mui/material";
import {
  EntityFilterQuery,
  CATALOG_FILTER_EXISTS,
} from "@backstage/catalog-client";

// Simple VirtualizedListbox
const VirtualizedListbox = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLElement>
>(function VirtualizedListbox(props, ref) {
  const { children, ...other } = props;
  return (
    <div ref={ref} {...other}>
      <div style={{ maxHeight: "400px", overflow: "auto" }}>{children}</div>
    </div>
  );
});

// Schema definition
export const EnhancedEntityPickerSchema = {
  namedSchemas: {},
  fieldSchema: {
    schema: {
      type: "string",
    },
    uiSchema: {
      type: "object",
      properties: {
        "ui:options": {
          type: "object",
          properties: {
            allowedKinds: {
              type: "array",
              items: { type: "string" },
              description: "DEPRECATED: Use catalogFilter instead",
            },
            catalogFilter: {
              type: "object",
              description: "Filter for entities",
              additionalProperties: true,
            },
            defaultKind: {
              type: "string",
              description: "Default entity kind",
            },
            defaultNamespace: {
              type: "string",
              description: "Default namespace for entities",
            },
            allowArbitraryValues: {
              type: "boolean",
              description: "Whether to allow arbitrary user input",
              default: true,
            },
            defaultEntityRef: {
              type: "string",
              description: "Default entity reference to select",
            },
            displayEntityFieldAfterFormatting: {
              type: "string",
              description: "Template for displaying entity names",
            },
            uniqueIdentifierField: {
              type: "string",
              description: "Field to use as unique identifier",
              default: "metadata.name",
            },
            hiddenFieldName: {
              type: "string",
              description:
                "Name of hidden field to store full entity reference",
            },
            placeholder: {
              type: "string",
              description: "Placeholder text for the input field",
            },
          },
        },
      },
    },
  },
  output: {
    type: "string",
    description: "The selected entity reference or display value",
  },
};

// Type definitions
interface UIOptions {
  allowedKinds?: string[];
  catalogFilter?: any; // Using any to avoid complex type issues
  defaultKind?: string;
  defaultNamespace?: string;
  allowArbitraryValues?: boolean;
  defaultEntityRef?: string;
  displayEntityFieldAfterFormatting?: string;
  uniqueIdentifierField?: string;
  hiddenFieldName?: string;
  placeholder?: string;
}

// Utility functions
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
    if (template.includes(" || ")) {
      const paths = template.split(" || ").map((p) => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        if (value && String(value).trim()) return String(value);
      }
      return entity?.metadata?.name || "";
    }

    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return value ? String(value) : "";
    });
  } catch {
    return entity?.metadata?.name || "";
  }
};

// Build filter query - now returns proper EntityFilterQuery type
const buildFilterQuery = (
  uiOptions: UIOptions
): EntityFilterQuery | undefined => {
  const { catalogFilter, allowedKinds } = uiOptions;

  if (catalogFilter) {
    if (Array.isArray(catalogFilter)) {
      // Handle array of filters - just use first one
      return catalogFilter[0] as EntityFilterQuery;
    }

    // Convert catalog filter to EntityFilterQuery
    const query: EntityFilterQuery = {};

    Object.entries(catalogFilter).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      // Handle special 'exists' case
      if (typeof value === "object" && value.exists === true) {
        query[key] = CATALOG_FILTER_EXISTS;
      } else if (typeof value === "string" || Array.isArray(value)) {
        query[key] = value;
      } else if (typeof value === "boolean") {
        // Convert boolean to string for the filter
        query[key] = String(value);
      }
    });

    return query;
  }

  if (allowedKinds) {
    return { kind: allowedKinds };
  }

  return undefined;
};

// Extract UI options
const extractUIOptions = (uiSchema: any): UIOptions => {
  const options = uiSchema?.["ui:options"] || {};

  return {
    allowedKinds: options.allowedKinds,
    catalogFilter: options.catalogFilter,
    defaultKind: options.defaultKind || "Component",
    defaultNamespace: options.defaultNamespace || DEFAULT_NAMESPACE,
    allowArbitraryValues: options.allowArbitraryValues !== false,
    defaultEntityRef: options.defaultEntityRef,
    displayEntityFieldAfterFormatting:
      options.displayEntityFieldAfterFormatting,
    uniqueIdentifierField: options.uniqueIdentifierField || "metadata.name",
    hiddenFieldName: options.hiddenFieldName,
    placeholder: options.placeholder || "Select an entity...",
  };
};

/**
 * Enhanced EntityPicker Component
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
  const entityPresentationApi = useApi(entityPresentationApiRef);

  const [inputValue, setInputValue] = useState("");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityPresentations, setEntityPresentations] = useState<
    Map<string, string>
  >(new Map());

  // Extract UI options
  const {
    uniqueIdentifierField,
    allowArbitraryValues,
    hiddenFieldName,
    placeholder,
    displayEntityFieldAfterFormatting,
    defaultEntityRef,
  } = extractUIOptions(uiSchema);

  // Build filter query
  const filterQuery = useMemo(() => {
    return buildFilterQuery(extractUIOptions(uiSchema));
  }, [uiSchema]);

  // Fetch entities
  useEffect(() => {
    let cancelled = false;

    const fetchEntities = async () => {
      setLoading(true);
      try {
        const response = await catalogApi.getEntities({
          filter: filterQuery,
        });

        if (!cancelled) {
          setEntities(response.items || []);

          // Try to get entity presentations if API is available
          const entityRefs = response.items.map((e) => stringifyEntityRef(e));
          if (entityRefs.length > 0) {
            try {
              // Use the entityPresentationApi to get display names
              const presentationMap = new Map<string, string>();

              // Fetch presentations one by one or in batch if API supports it
              for (const entityRef of entityRefs) {
                try {
                  // Try to get the presentation for each entity
                  const snapshot = await entityPresentationApi
                    .forEntity(entityRef)
                    .promise();
                  if (snapshot?.primaryTitle) {
                    presentationMap.set(entityRef, snapshot.primaryTitle);
                  }
                } catch {
                  // If individual fetch fails, continue
                }
              }

              setEntityPresentations(presentationMap);
            } catch (error) {
              // Presentation API might not be available, that's OK
              console.debug("Entity presentation API not available:", error);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch entities:", error);
        if (!cancelled) {
          setEntities([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchEntities();

    return () => {
      cancelled = true;
    };
  }, [catalogApi, entityPresentationApi, filterQuery]);

  // Find selected entity
  const selectedEntity = useMemo(() => {
    if (!formData && !defaultEntityRef) return null;

    const searchValue = formData || defaultEntityRef;

    return (
      entities.find((entity) => {
        // Check display value
        if (displayEntityFieldAfterFormatting) {
          const displayValue = formatDisplayValue(
            displayEntityFieldAfterFormatting,
            entity
          );
          if (displayValue === searchValue) return true;
        }

        // Check entity reference
        const entityRef = stringifyEntityRef(entity);
        if (entityRef === searchValue) return true;

        // Check custom identifier
        const customRef = getNestedValue(entity, uniqueIdentifierField);
        if (customRef && String(customRef) === searchValue) return true;

        // Check presentation title
        const presentationTitle = entityPresentations.get(entityRef);
        if (presentationTitle === searchValue) return true;

        return false;
      }) || null
    );
  }, [
    formData,
    entities,
    displayEntityFieldAfterFormatting,
    uniqueIdentifierField,
    defaultEntityRef,
    entityPresentations,
  ]);

  // Handle selection change
  const handleChange = useCallback(
    (_event: React.SyntheticEvent, value: Entity | string | null) => {
      if (!value) {
        onChange("");
        if (hiddenFieldName && formContext?.formData) {
          delete formContext.formData[hiddenFieldName];
        }
        return;
      }

      // Handle string values
      if (typeof value === "string") {
        onChange(value);
        return;
      }

      // Handle Entity selection
      let displayValue: string;
      if (displayEntityFieldAfterFormatting) {
        displayValue = formatDisplayValue(
          displayEntityFieldAfterFormatting,
          value
        );
      } else {
        const entityRef = stringifyEntityRef(value);
        const presentationTitle = entityPresentations.get(entityRef);
        displayValue =
          presentationTitle || value.metadata.title || value.metadata.name;
      }

      onChange(displayValue);

      // Store entity reference in hidden field
      if (hiddenFieldName && formContext?.formData) {
        try {
          const entityRef = stringifyEntityRef(value);
          formContext.formData[hiddenFieldName] = entityRef;
        } catch (error) {
          console.warn("Failed to store entity reference:", error);
        }
      }
    },
    [
      onChange,
      displayEntityFieldAfterFormatting,
      hiddenFieldName,
      formContext,
      entityPresentations,
    ]
  );

  // Handle input change
  const handleInputChange = useCallback(
    (_event: React.SyntheticEvent, value: string, reason: string) => {
      setInputValue(value);

      if (allowArbitraryValues && value && reason === "input") {
        const matchesExistingEntity = entities.some((e) => {
          const displayValue = displayEntityFieldAfterFormatting
            ? formatDisplayValue(displayEntityFieldAfterFormatting, e)
            : entityPresentations.get(stringifyEntityRef(e)) ||
              e.metadata.title ||
              e.metadata.name;
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
      entityPresentations,
    ]
  );

  // Get display label
  const getOptionLabel = useCallback(
    (option: Entity | string) => {
      if (typeof option === "string") {
        return option;
      }

      if (displayEntityFieldAfterFormatting) {
        return formatDisplayValue(displayEntityFieldAfterFormatting, option);
      }

      const entityRef = stringifyEntityRef(option);
      const presentationTitle = entityPresentations.get(entityRef);
      return presentationTitle || option.metadata.title || option.metadata.name;
    },
    [displayEntityFieldAfterFormatting, entityPresentations]
  );

  // Filter options
  const filterOptions = useMemo(() => {
    return createFilterOptions<Entity | string>({
      stringify: (option) => {
        if (typeof option === "string") return option;
        return getOptionLabel(option);
      },
    });
  }, [getOptionLabel]);

  return (
    <Autocomplete<Entity | string, false, boolean, boolean>
      options={entities}
      value={selectedEntity}
      inputValue={inputValue}
      onChange={handleChange}
      onInputChange={handleInputChange}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={(option, value) => {
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
        return false;
      }}
      loading={loading}
      disabled={disabled}
      freeSolo={allowArbitraryValues}
      filterOptions={filterOptions}
      autoSelect
      ListboxComponent={VirtualizedListbox}
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
          fullWidth
        />
      )}
      renderOption={(
        props: React.HTMLAttributes<HTMLLIElement>,
        option: Entity | string,
        _state: AutocompleteRenderOptionState
      ) => {
        if (typeof option === "string") {
          return <li {...props}>{option}</li>;
        }

        const displayText = displayEntityFieldAfterFormatting
          ? formatDisplayValue(displayEntityFieldAfterFormatting, option)
          : undefined;

        return (
          <li {...props}>
            {displayText ? (
              <span>{displayText}</span>
            ) : (
              <EntityDisplayName entityRef={stringifyEntityRef(option)} />
            )}
          </li>
        );
      }}
    />
  );
};
