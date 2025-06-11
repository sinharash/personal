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

// Map to store entity data by reference
const entityDataStore = new Map<string, Entity>();

export const EnhancedEntityPicker: React.FC<EntityPickerProps> = (props) => {
  const { onChange, schema, required, uiSchema } = props;
  const catalogApi = useApi(catalogApiRef);
  const [loading, setLoading] = useState<boolean>(true);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [displayValue, setDisplayValue] = useState<string>("");

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

      // Store the entity for later retrieval if needed
      const entityName = newValue.metadata.name;
      entityDataStore.set(entityName, newValue);

      // For debugging
      console.debug("Selected entity:", newValue);
      console.debug("Formatted value:", formattedValue);
      console.debug("Entity reference:", entityName);

      // Store for UI display
      setDisplayValue(formattedValue);

      // CRITICAL: Just return the entity name, which is a primitive string
      // This ensures it passes form validation while still being useful for the action
      onChange(entityName);
    } else {
      setDisplayValue("");
      onChange(undefined);
    }
  };

  return (
    <Autocomplete
      loading={loading}
      options={entities}
      getOptionLabel={(option: Entity | string) => {
        if (typeof option === "string") {
          // Try to find the entity by name and format it
          const entity = entities.find((e) => e.metadata.name === option);
          return entity ? formatEntityDisplay(entity) : option;
        }
        return formatEntityDisplay(option);
      }}
      renderOption={(props, option: Entity) => (
        <li {...props}>{formatEntityDisplay(option)}</li>
      )}
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
          value={displayValue} // Show the formatted display value
        />
      )}
      fullWidth
    />
  );
};
