import React, { useEffect, useState } from "react";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { Entity } from "@backstage/catalog-model";
import {
  Autocomplete,
  TextField,
  CircularProgress,
  FormControl,
  FormHelperText,
} from "@mui/material";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
import { useAsync } from "react-use";
import templateString from "lodash/template";

/**
 * Props for the EnhancedEntityPicker component
 */
interface EnhancedEntityPickerProps extends FieldExtensionComponentProps<any> {
  uiOptions?: {
    catalogFilter?: {
      kind?: string;
      [key: string]: any;
    };
    displayEntityFieldAfterFormatting?: string;
  };
}

/**
 * A custom field extension that enhances the entity picker experience in Backstage
 * software templates with customizable display formatting.
 */
export const EnhancedEntityPicker = ({
  onChange,
  rawErrors,
  required,
  formData,
  disabled,
  readonly,
  uiOptions = {}, // Provide default empty object
}: EnhancedEntityPickerProps) => {
  const catalogApi = useApi(catalogApiRef);
  const [inputValue, setInputValue] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [displayValue, setDisplayValue] = useState<string>("");

  // Extract options from the UI schema with safe defaults
  const catalogFilter = uiOptions?.catalogFilter || {};
  const displayFormat =
    uiOptions?.displayEntityFieldAfterFormatting || "${metadata.name}";

  // Get entities from the catalog based on the filter
  const { value: entities, loading } = useAsync(async () => {
    const filter: Record<string, string> = {};

    // Process the catalog filter
    Object.entries(catalogFilter).forEach(([key, value]) => {
      if (value) {
        filter[key] = String(value);
      }
    });

    const { items } = await catalogApi.getEntities(filter);
    return items;
  }, [catalogApi, JSON.stringify(catalogFilter)]);

  // Format entity for display based on the template string
  const formatEntityDisplay = (entity: Entity): string => {
    try {
      const compiled = templateString(displayFormat);
      return compiled(entity);
    } catch (error) {
      console.error("Error formatting entity display:", error);
      return entity.metadata.name || "Unknown";
    }
  };

  // When formData changes (e.g., when loading a saved template)
  useEffect(() => {
    if (formData && entities) {
      // Try to find the entity that matches the saved formData
      const entity = entities.find((e) => {
        // This logic might need adjustment based on how you store the selected entity
        const entityRef = `${e.kind}:${e.metadata.namespace || "default"}/${
          e.metadata.name
        }`;
        return formData === entityRef || formData.entityRef === entityRef;
      });

      if (entity) {
        setSelectedEntity(entity);
        setDisplayValue(formatEntityDisplay(entity));
      }
    }
  }, [formData, entities, displayFormat]);

  return (
    <FormControl
      fullWidth
      error={rawErrors && rawErrors.length > 0}
      required={required}
    >
      <Autocomplete
        id="enhanced-entity-picker"
        value={selectedEntity}
        inputValue={inputValue}
        onChange={(_, newValue) => {
          setSelectedEntity(newValue);

          if (newValue) {
            // Format the display value
            const formatted = formatEntityDisplay(newValue);
            setDisplayValue(formatted);

            // Create the entity reference for internal use
            const entityRef = `${newValue.kind}:${
              newValue.metadata.namespace || "default"
            }/${newValue.metadata.name}`;

            // Store both the reference and the full entity for later use
            onChange({
              entityRef,
              formatted,
              // Store the entire entity for access in later steps
              entity: newValue,
            });
          } else {
            setDisplayValue("");
            onChange(undefined);
          }
        }}
        onInputChange={(_, newInputValue) => {
          setInputValue(newInputValue);
        }}
        options={entities || []}
        getOptionLabel={(option) => formatEntityDisplay(option)}
        loading={loading}
        disabled={disabled || readonly}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Select Entity"
            variant="outlined"
            error={rawErrors && rawErrors.length > 0}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <React.Fragment>
                  {loading ? (
                    <CircularProgress color="inherit" size={20} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </React.Fragment>
              ),
            }}
          />
        )}
      />
      {rawErrors && rawErrors.length > 0 && (
        <FormHelperText error>{rawErrors.join(", ")}</FormHelperText>
      )}

      {/* Display the selected value with custom formatting */}
      {displayValue && !inputValue && (
        <FormHelperText>Selected: {displayValue}</FormHelperText>
      )}
    </FormControl>
  );
};
