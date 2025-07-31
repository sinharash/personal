// EnhancedEntityPicker.tsx - Fixed version with all errors resolved
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
import { useApi } from "@backstage/core-plugin-api";
import {
  catalogApiRef,
  EntityDisplayName,
  entityPresentationApiRef,
  EntityRefPresentationSnapshot,
} from "@backstage/plugin-catalog-react";
import {
  Entity,
  stringifyEntityRef,
  parseEntityRef,
  DEFAULT_NAMESPACE,
} from "@backstage/catalog-model";
import { TextField, Autocomplete, createFilterOptions } from "@mui/material";
import {
  EntityFilterQuery,
  CATALOG_FILTER_EXISTS,
} from "@backstage/catalog-client";
import { useTranslationRef } from "@backstage/core-plugin-api/alpha";
import { scaffolderReactTranslationRef } from "@backstage/plugin-scaffolder-react/alpha";

// Import VirtualizedListbox (create a simple one for now)
const VirtualizedListbox = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLElement>
>(function VirtualizedListbox(props, ref) {
  const { children, ...other } = props;
  return (
    <div ref={ref} {...other}>
      <div
        style={{
          maxHeight: "400px",
          overflow: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
});

// Schema definition
export const EnhancedEntityPickerSchema = {
  uiOptions: {
    type: "object",
    properties: {
      // Original EntityPicker options
      allowedKinds: {
        type: "array",
        items: { type: "string" },
        description: "DEPRECATED: Use catalogFilter instead",
      },
      catalogFilter: {
        type: "object",
        description: "Filter entities by kind, type, or other properties",
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
      defaultEntityRef: {
        type: "string",
        description: "Default entity reference to select",
      },
      // Enhanced options
      displayEntityFieldAfterFormatting: {
        type: "string",
        description:
          'Template for displaying entity names (e.g., "{{ metadata.title }} - {{ spec.profile.email }}")',
      },
      uniqueIdentifierField: {
        type: "string",
        description:
          "Field to use as unique identifier (default: metadata.name)",
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

// Type definitions with proper types
interface EntityPickerFilterQueryValue {
  exists?: boolean;
  [key: string]: string | string[] | boolean | undefined;
}

interface EntityPickerFilterQuery {
  [key: string]: EntityPickerFilterQueryValue | EntityPickerFilterQueryValue[];
}

interface UIOptions {
  allowedKinds?: string[];
  catalogFilter?: EntityPickerFilterQuery | EntityPickerFilterQuery[];
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

// Convert special filter values (like {exists: true}) to symbols
function convertOpsValues(
  value: EntityPickerFilterQueryValue
): string | string[] | symbol | undefined {
  if (typeof value === "string" || Array.isArray(value)) {
    return value;
  }
  if (typeof value === "object" && value.exists) {
    return CATALOG_FILTER_EXISTS;
  }
  return undefined;
}

// Convert schema filters to API query format
function convertSchemaFiltersToQuery(
  schemaFilters: EntityPickerFilterQuery | EntityPickerFilterQuery[]
): EntityFilterQuery | EntityFilterQuery[] {
  if (Array.isArray(schemaFilters)) {
    return schemaFilters.map((filter) => convertSingleFilter(filter));
  }
  return convertSingleFilter(schemaFilters);
}

function convertSingleFilter(
  schemaFilter: EntityPickerFilterQuery
): EntityFilterQuery {
  const query: EntityFilterQuery = {};

  for (const [key, value] of Object.entries(schemaFilter)) {
    if (Array.isArray(value)) {
      query[key] = value;
    } else {
      const converted = convertOpsValues(value as EntityPickerFilterQueryValue);
      if (converted !== undefined) {
        query[key] = converted;
      }
    }
  }

  return query;
}

// Build filter query from UI options
const buildFilterQuery = (
  uiOptions: UIOptions
): EntityFilterQuery | EntityFilterQuery[] | undefined => {
  const { catalogFilter, allowedKinds } = uiOptions;

  if (catalogFilter) {
    return convertSchemaFiltersToQuery(catalogFilter);
  }

  if (allowedKinds) {
    return { kind: allowedKinds };
  }

  return undefined;
};

// Extract UI options safely
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
 * Enhanced EntityPicker - Drop-in replacement with additional features
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
  const { t } = useTranslationRef(scaffolderReactTranslationRef); // Fixed!

  const [inputValue, setInputValue] = useState("");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityRefToPresentation, setEntityRefToPresentation] = useState<
    Map<string, EntityRefPresentationSnapshot>
  >(new Map());

  // Extract and use translated strings
  const translatedTitle = title || t("fields.entityPicker.title");
  const translatedDescription =
    description || t("fields.entityPicker.description");

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

  // Fetch entities with presentation data
  useEffect(() => {
    let cancelled = false;

    const fetchEntities = async () => {
      setLoading(true);
      try {
        const response = await catalogApi.getEntities({
          filter: filterQuery as EntityFilterQuery, // Type assertion to fix type issue
        });

        if (!cancelled) {
          setEntities(response.items || []);

          // Fetch entity presentations for better display
          const entityRefs = response.items.map((e) => stringifyEntityRef(e));
          if (entityRefs.length > 0) {
            try {
              // Use refresh method instead of forceRefresh
              const presentations = await entityPresentationApi.refresh(
                entityRefs
              );
              const presentationMap = new Map<
                string,
                EntityRefPresentationSnapshot
              >();
              presentations.forEach(
                (presentation: EntityRefPresentationSnapshot) => {
                  presentationMap.set(presentation.entityRef, presentation);
                }
              );
              setEntityRefToPresentation(presentationMap);
            } catch (error) {
              console.warn("Failed to fetch entity presentations:", error);
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
        const presentation = entityRefToPresentation.get(entityRef);
        if (presentation?.primaryTitle === searchValue) return true;

        return false;
      }) || null
    );
  }, [
    formData,
    entities,
    displayEntityFieldAfterFormatting,
    uniqueIdentifierField,
    defaultEntityRef,
    entityRefToPresentation,
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

      // Handle string values (arbitrary input)
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
        // Try presentation API first
        const entityRef = stringifyEntityRef(value);
        const presentation = entityRefToPresentation.get(entityRef);
        displayValue =
          presentation?.primaryTitle ||
          value.metadata.title ||
          value.metadata.name;
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
      entityRefToPresentation,
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
            : entityRefToPresentation.get(stringifyEntityRef(e))
                ?.primaryTitle ||
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
      entityRefToPresentation,
    ]
  );

  // Get display label for an option
  const getOptionLabel = useCallback(
    (option: Entity | string) => {
      if (typeof option === "string") {
        return option;
      }

      // Use custom formatting if provided
      if (displayEntityFieldAfterFormatting) {
        return formatDisplayValue(displayEntityFieldAfterFormatting, option);
      }

      // Use presentation API
      const entityRef = stringifyEntityRef(option);
      const presentation = entityRefToPresentation.get(entityRef);
      if (presentation?.primaryTitle) {
        return presentation.primaryTitle;
      }

      // Fallback to title or name
      return option.metadata.title || option.metadata.name;
    },
    [displayEntityFieldAfterFormatting, entityRefToPresentation]
  );

  // Create filter options with proper string representation
  const filterOptions = useMemo(() => {
    return createFilterOptions<Entity | string>({
      stringify: (option) => {
        if (typeof option === "string") return option;
        return getOptionLabel(option);
      },
    });
  }, [getOptionLabel]);

  // Check if options are equal
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
      filterOptions={filterOptions}
      autoSelect
      ListboxComponent={VirtualizedListbox} // Added!
      renderInput={(params) => (
        <TextField
          {...params}
          label={translatedTitle}
          helperText={translatedDescription}
          placeholder={placeholder}
          required={required}
          error={rawErrors.length > 0}
          variant="outlined"
          margin="normal"
          fullWidth
        />
      )}
      renderOption={(props, option) => {
        if (typeof option === "string") {
          return (
            <li {...props} key={option}>
              {option}
            </li>
          );
        }

        const displayText = displayEntityFieldAfterFormatting
          ? formatDisplayValue(displayEntityFieldAfterFormatting, option)
          : undefined;

        return (
          <li {...props} key={stringifyEntityRef(option)}>
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
