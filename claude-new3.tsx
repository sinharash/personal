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

// Create a custom object that will display only the display value
// but still preserve the entity reference
class FormattedEntityRef extends String {
  private readonly entityRef: string;

  constructor(displayValue: string, entityRef: string) {
    // Pass the display value to the String constructor
    // This ensures the string behaves like the display value
    super(displayValue);

    // Store the entity reference
    this.entityRef = entityRef;
  }

  // This is used when the object is serialized to JSON
  // It's what gets stored in the form data
  toJSON(): any {
    // Store as a special JSON object
    return {
      display: String(this),
      entityRef: this.entityRef,
      // Include a field that helps us identify this format
      __type: "FormattedEntityRef",
    };
  }

  // Get the entity reference (for use in code)
  getEntityRef(): string {
    return this.entityRef;
  }
}

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

  // Check if a value is our special format
  const isFormattedEntityRef = (value: any): boolean => {
    return (
      value &&
      typeof value === "object" &&
      value.__type === "FormattedEntityRef" &&
      typeof value.display === "string" &&
      typeof value.entityRef === "string"
    );
  };

  // Extract display value and entity ref from a value
  const extractParts = (
    value: any
  ): { display: string; entityRef: string | undefined } => {
    if (isFormattedEntityRef(value)) {
      return {
        display: value.display,
        entityRef: value.entityRef,
      };
    }

    // If it's a string with our legacy format
    if (typeof value === "string" && value.includes("---REF:")) {
      const parts = value.split("---REF:");
      return {
        display: parts[0],
        entityRef: parts[1],
      };
    }

    // Default case - just return the value as display
    return {
      display: String(value || ""),
      entityRef: undefined,
    };
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
    if (formData) {
      const { display, entityRef } = extractParts(formData);

      // Set the display value
      setDisplayValue(display);

      // Find the selected entity if we have an entity reference
      if (entityRef && entities.length > 0) {
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
      setDisplayValue(formattedValue);

      // Get the entity reference string
      const entityRef = stringifyEntityRef(newValue);

      // Create a special string-like object that will display correctly
      const formattedEntityRef = new FormattedEntityRef(
        formattedValue,
        entityRef
      );

      // For debugging
      console.debug("Selected entity:", newValue);
      console.debug("Formatted display:", formattedValue);
      console.debug("Entity reference:", entityRef);
      console.debug("Formatted entity ref:", formattedEntityRef);
      console.debug("JSON representation:", JSON.stringify(formattedEntityRef));

      // Return the formatted entity reference
      onChange(formattedEntityRef);
    } else {
      setDisplayValue("");
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
          return extractParts(option).display;
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
