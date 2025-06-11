import React, { useState, useEffect } from "react";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { TextField, Autocomplete } from "@mui/material";
import { Entity } from "@backstage/catalog-model";

// Type definitions for the UI Schema options
interface EntityPickerUiOptions {
  catalogFilter?: {
    kind?: string;
    [key: string]: string | undefined;
  };
  displayEntityFieldAfterFormatting?: string;
}

// Type for the component props from the scaffolder
export interface EntityPickerProps {
  onChange: (value: any) => void;
  schema: {
    title?: string;
    description?: string;
  };
  required?: boolean;
  uiSchema?: {
    "ui:options"?: EntityPickerUiOptions;
  };
  formData?: any;
}

// Special formatted string that contains entity reference
// Format: __entity-ref::{entityRef}::__display::{displayValue}
const createEntityRefString = (
  entityRef: string,
  displayValue: string
): string => {
  return `__entity-ref::${entityRef}::__display::${displayValue}`;
};

// Extract display value from the special formatted string
const extractDisplayValue = (value: string): string => {
  const match = value.match(/__display::(.*)$/);
  return match ? match[1] : value;
};

export const EnhancedEntityPicker: React.FC<EntityPickerProps> = (props) => {
  const { onChange, schema, required, uiSchema } = props;
  const catalogApi = useApi(catalogApiRef);
  const [loading, setLoading] = useState<boolean>(true);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  // Get options from uiSchema
  const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
  const displayFormat =
    uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
    "${entity.metadata.name}";

  // Function to format entity data according to the template
  const formatEntityDisplay = (entity: Entity | null): string => {
    if (!entity) return "";

    let formatted = displayFormat;
    // Match patterns like ${{ metadata.name }}
    const regex = /\$\{\{\s*([^}]+)\s*\}\}/g;

    return formatted.replace(regex, (match, path) => {
      // Traverse the entity object based on the path
      const properties = path.trim().split(".");
      let value: any = entity;

      for (const prop of properties) {
        if (value && value[prop] !== undefined) {
          value = value[prop];
        } else {
          return ""; // Property not found
        }
      }

      return value !== null && value !== undefined ? value.toString() : "";
    });
  };

  // Fetch entities based on the filter
  useEffect(() => {
    const fetchEntities = async () => {
      setLoading(true);
      try {
        const filter: Record<string, string> = {};

        // Add kind filter if specified
        if (catalogFilter.kind) {
          filter.kind = catalogFilter.kind;
        }

        // Add any additional filters
        Object.entries(catalogFilter).forEach(([key, value]) => {
          if (key !== "kind" && value) {
            filter[key] = value;
          }
        });

        const response = await catalogApi.getEntities({
          filter: [filter],
        });

        setEntities(response.items);
      } catch (error) {
        console.error("Error fetching entities:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();
  }, [catalogApi, catalogFilter]);

  // Handle selection change
  const handleChange = (
    _event: React.SyntheticEvent,
    newValue: Entity | null
  ) => {
    setSelectedEntity(newValue);

    if (newValue) {
      // Format the display value
      const formattedValue = formatEntityDisplay(newValue);

      // Create a special string format that embeds both the entity reference
      // and the display value, while still being a valid string for form validation
      const entityRef = newValue.metadata.name;
      const specialValue = createEntityRefString(entityRef, formattedValue);

      // Return the special formatted string
      onChange(specialValue);
    } else {
      onChange(undefined);
    }
  };

  // Custom render function to show only the display part in the UI
  const renderOption = (
    props: React.HTMLAttributes<HTMLLIElement>,
    option: Entity
  ) => {
    return <li {...props}>{formatEntityDisplay(option)}</li>;
  };

  // Extract display value from the current value (if it's our special format)
  const getOptionLabel = (option: Entity | string) => {
    if (typeof option === "string") {
      return extractDisplayValue(option);
    }
    return formatEntityDisplay(option);
  };

  return (
    <Autocomplete
      loading={loading}
      options={entities}
      getOptionLabel={getOptionLabel as any}
      renderOption={renderOption}
      onChange={handleChange}
      value={selectedEntity}
      renderInput={(params) => (
        <TextField
          {...params}
          label={schema.title}
          required={required}
          helperText={schema.description}
          variant="outlined"
          fullWidth
        />
      )}
      fullWidth
    />
  );
};
