import React, { useCallback, useMemo } from "react";
import {
  EntityPicker,
  EntityPickerProps,
} from "@backstage/plugin-catalog-react";
import { Entity } from "@backstage/catalog-model";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";

// Interface for catalog filter
interface CatalogFilter {
  kind?: string;
  type?: string;
  [key: string]: any;
}

// Enhanced props that extend the original EntityPicker props
interface EnhancedEntityPickerProps
  extends Omit<FieldExtensionComponentProps<string>, "onChange"> {
  displayEntityFieldAfterFormatting?: string;
  uniqueIdentifierField?: string;
  catalogFilter?: CatalogFilter;
  placeholder?: string;
  hiddenFieldName?: string;
}

// Utility function to get nested value from object
const getNestedValue = (obj: any, path: string): string => {
  try {
    const keys = path.split(".");
    let value = obj;
    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        return "";
      }
    }
    return value || "";
  } catch {
    return "";
  }
};

// Function to format display value based on template
const formatDisplayValue = (template: string, entity: Entity): string => {
  if (!template) return "";

  try {
    const trimmed = template.trim();

    // Handle fallback syntax: "property1 || property2"
    if (trimmed.includes(" || ")) {
      const paths = trimmed.split(" || ").map((p) => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        if (value !== undefined && value !== null && value !== "") {
          return String(value);
        }
      }
      return "";
    }

    // Handle template replacement: "{{ metadata.name }}"
    return trimmed.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return String(value);
    });
  } catch {
    return "";
  }
};

export const EnhancedEntityPicker = (props: EnhancedEntityPickerProps) => {
  const {
    displayEntityFieldAfterFormatting,
    uniqueIdentifierField = "metadata.name",
    catalogFilter,
    placeholder = "Select an entity...",
    hiddenFieldName,
    formContext,
    formData,
    onChange,
    ...rest
  } = props;

  const catalogApi = useApi(catalogApiRef);

  // Enhanced onChange handler that stores additional entity information
  const handleChange = useCallback(
    async (entityRef: string) => {
      // Call the original onChange
      onChange(entityRef);

      // If we have a hidden field name and form context, store the full entity data
      if (hiddenFieldName && formContext?.formData && entityRef) {
        try {
          // Parse the entity reference to get the entity
          // EntityRef format is usually: [kind:][namespace/]name
          const parts = entityRef.split(":");
          const kind = parts.length > 1 ? parts[0] : "Component";
          const namespaceName = parts.length > 1 ? parts[1] : parts[0];

          const [namespace, name] = namespaceName.includes("/")
            ? namespaceName.split("/")
            : ["default", namespaceName];

          // Fetch the full entity
          const entity = await catalogApi.getEntityByRef({
            kind,
            namespace,
            name,
          });

          if (entity) {
            // Store the entity reference in the hidden field
            formContext.formData[hiddenFieldName] = entityRef;
          }
        } catch (error) {
          console.error("Failed to fetch entity details:", error);
        }
      }
    },
    [onChange, hiddenFieldName, formContext, catalogApi]
  );

  // Create catalogFilter for EntityPicker
  const entityPickerCatalogFilter = useMemo(() => {
    if (!catalogFilter) return undefined;

    const filter: Record<string, string | string[]> = {};

    // Add standard filters
    if (catalogFilter.kind) filter.kind = catalogFilter.kind;
    if (catalogFilter.type) filter["spec.type"] = catalogFilter.type;

    // Add any additional custom filters from configuration
    Object.keys(catalogFilter).forEach((key) => {
      if (key !== "kind" && key !== "type") {
        filter[key] = catalogFilter[key];
      }
    });

    return filter;
  }, [catalogFilter]);

  // Custom label formatting function
  const formatEntityLabel = useCallback(
    (entity: Entity) => {
      if (displayEntityFieldAfterFormatting) {
        const formatted = formatDisplayValue(
          displayEntityFieldAfterFormatting,
          entity
        );
        if (formatted) return formatted;
      }

      // Fallback to default formatting
      return entity.metadata.title || entity.metadata.name;
    },
    [displayEntityFieldAfterFormatting]
  );

  // Enhanced EntityPicker props
  const enhancedProps: EntityPickerProps = {
    ...rest,
    catalogFilter: entityPickerCatalogFilter,
    FormHelperTextProps: rest.formHelperTextProps,
    placeholder,
    onChange: handleChange,
    value: formData || "",
    // Custom label formatter
    getOptionLabel: formatEntityLabel,
    // Custom entity reference formatter
    getEntityRef: (entity: Entity) => {
      if (uniqueIdentifierField && uniqueIdentifierField !== "metadata.name") {
        const customRef = getNestedValue(entity, uniqueIdentifierField);
        if (customRef) return customRef;
      }

      // Default entity reference format
      const { kind, metadata } = entity;
      const { namespace = "default", name } = metadata;
      return `${kind.toLowerCase()}:${namespace}/${name}`;
    },
  };

  return <EntityPicker {...enhancedProps} />;
};

// Export for use in software templates
export default EnhancedEntityPicker;
