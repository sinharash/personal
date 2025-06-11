import React, { useState, useEffect } from "react";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { TextField, Autocomplete } from "@mui/material";
import { Entity, stringifyEntityRef } from "@backstage/catalog-model";

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

// Simple format: displayValue:::entityRef
// The triple colon separator is unlikely to appear in normal text
const SEPARATOR = ":::";

export const EnhancedEntityPicker: React.FC<EntityPickerProps> = (props) => {
  const { onChange, schema, required, uiSchema, formData } = props;
  const catalogApi = useApi(catalogApiRef);
  const [loading, setLoading] = useState<boolean>(true);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedDisplay, setSelectedDisplay] = useState<string>("");

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

  // Parse a combined value string into display and entityRef parts
  const parseValue = (
    value: string
  ): { display: string; entityRef: string } => {
    if (!value || !value.includes(SEPARATOR)) {
      return { display: value, entityRef: value };
    }

    const [display, entityRef] = value.split(SEPARATOR);
    return { display, entityRef };
  };

  // Initialize component state from formData (for review stage)
  useEffect(() => {
    if (formData) {
      const { display, entityRef } = parseValue(formData);

      // Set the display value for the input field
      setSelectedDisplay(display);

      // If we have entities loaded, try to find the selected entity
      if (entities.length > 0 && entityRef) {
        const found = entities.find((e) => stringifyEntityRef(e) === entityRef);
        if (found) {
          setSelectedEntity(found);
        }
      }
    }
  }, [formData, entities]);

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
      setSelectedDisplay(formattedValue);

      // Get the entity reference string
      const entityRef = stringifyEntityRef(newValue);

      // Create the combined value string: displayValue:::entityRef
      const combinedValue = `${formattedValue}${SEPARATOR}${entityRef}`;

      // For debugging
      console.debug("Selected entity:", newValue);
      console.debug("Formatted display:", formattedValue);
      console.debug("Entity reference:", entityRef);
      console.debug("Combined value:", combinedValue);

      // Return the combined value
      onChange(combinedValue);
    } else {
      setSelectedDisplay("");
      onChange(undefined);
    }
  };

  // Handle input rendering to ensure we always show the formatted display value
  const renderInput = (params: React.ComponentProps<typeof TextField>) => (
    <TextField
      {...params}
      label={schema.title}
      required={required}
      helperText={schema.description}
      variant="outlined"
      fullWidth
      // Override the input value to always show the formatted display
      inputProps={{
        ...params.inputProps,
        value: selectedDisplay,
      }}
    />
  );

  return (
    <Autocomplete
      loading={loading}
      options={entities}
      getOptionLabel={(option: Entity | string) => {
        if (typeof option === "string") {
          return parseValue(option).display;
        }
        return formatEntityDisplay(option);
      }}
      renderOption={(props, option: Entity) => (
        <li {...props}>{formatEntityDisplay(option)}</li>
      )}
      onChange={handleChange}
      value={selectedEntity}
      renderInput={renderInput}
      fullWidth
    />
  );
};
