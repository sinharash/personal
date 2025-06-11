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

// Enhanced entity value with custom toString method
class EnhancedEntityValue {
  public readonly entityRef: string;
  public readonly displayValue: string;
  public readonly entity: Entity;

  constructor(entity: Entity, displayValue: string) {
    this.entity = entity;
    this.entityRef = entity.metadata.name;
    this.displayValue = displayValue;
  }

  // This is what will show in the review stage
  toString(): string {
    return this.displayValue;
  }

  // These methods allow the object to be serialized correctly
  toJSON(): string {
    return this.entityRef;
  }
}

export const EnhancedEntityPicker: React.FC<EntityPickerProps> = (props) => {
  const { onChange, schema, required, uiSchema, formData } = props;
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

    return formatted.replace(regex, (_match, path) => {
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

      // Create custom object with toString method
      const enhancedValue = new EnhancedEntityValue(newValue, formattedValue);

      // This will both display nicely and serialize to the entity reference
      onChange(enhancedValue);
    } else {
      onChange(undefined);
    }
  };

  // This properly handles displaying the value
  const getOptionLabel = (option: any): string => {
    if (option instanceof EnhancedEntityValue) {
      return option.displayValue;
    } else if (typeof option === "string") {
      return option;
    } else if (option) {
      return formatEntityDisplay(option);
    }
    return "";
  };

  return (
    <Autocomplete
      loading={loading}
      options={entities}
      getOptionLabel={getOptionLabel}
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
