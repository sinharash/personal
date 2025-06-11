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

// Store display values by combined format for consistent UI rendering
const displayValueByFormat = new Map<string, string>();

export const EnhancedEntityPicker: React.FC<EntityPickerProps> = (props) => {
  const { onChange, schema, required, uiSchema, formData } = props;
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

  // Function to create a special format that combines display value and entity reference
  const createCombinedFormat = (display: string, entityRef: string): string => {
    // Format: display---REF:entityRef
    // We use a format that's unlikely to appear in normal text
    const combined = `${display}---REF:${entityRef}`;

    // Store the display value for this combined format
    displayValueByFormat.set(combined, display);

    return combined;
  };

  // Function to extract entity reference from combined format
  const extractEntityRef = (value: string): string | undefined => {
    if (!value || !value.includes("---REF:")) return undefined;

    const parts = value.split("---REF:");
    if (parts.length >= 2) {
      return parts[1];
    }

    return undefined;
  };

  // Function to extract display value from combined format
  const extractDisplayValue = (value: string): string => {
    // First check our cache
    if (displayValueByFormat.has(value)) {
      return displayValueByFormat.get(value) || "";
    }

    // Otherwise parse it
    if (!value || !value.includes("---REF:")) return value;

    const parts = value.split("---REF:");
    if (parts.length >= 1) {
      return parts[0];
    }

    return value;
  };

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

  // Initialize component state from formData (for review stage)
  useEffect(() => {
    if (formData && typeof formData === "string") {
      // Extract the display value for rendering
      const display = extractDisplayValue(formData);
      setDisplayValue(display);

      // If we have entities loaded, try to find the selected entity
      if (entities.length > 0) {
        const entityRef = extractEntityRef(formData);
        if (entityRef) {
          const found = entities.find(
            (e) => stringifyEntityRef(e) === entityRef
          );
          if (found) {
            setSelectedEntity(found);
          }
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
      setDisplayValue(formattedValue);

      // Get the entity reference string
      const entityRef = stringifyEntityRef(newValue);

      // Create the combined format string
      const combinedValue = createCombinedFormat(formattedValue, entityRef);

      // For debugging
      console.debug("Selected entity:", newValue);
      console.debug("Formatted display:", formattedValue);
      console.debug("Entity reference:", entityRef);
      console.debug("Combined value:", combinedValue);

      // Return the combined value
      onChange(combinedValue);
    } else {
      setDisplayValue("");
      onChange(undefined);
    }
  };

  // Custom render option function
  const renderOption = (
    props: React.HTMLAttributes<HTMLLIElement>,
    option: Entity
  ) => {
    return <li {...props}>{formatEntityDisplay(option)}</li>;
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
        value: displayValue,
      }}
    />
  );

  return (
    <Autocomplete
      loading={loading}
      options={entities}
      getOptionLabel={(option: Entity | string) => {
        if (typeof option === "string") {
          return extractDisplayValue(option);
        }
        return formatEntityDisplay(option);
      }}
      renderOption={renderOption}
      onChange={handleChange}
      value={selectedEntity}
      renderInput={renderInput}
      fullWidth
    />
  );
};
