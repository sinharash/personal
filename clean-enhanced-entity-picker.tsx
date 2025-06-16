import React, { useEffect, useState, useCallback } from "react";
import { Autocomplete, TextField, Box } from "@mui/material";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { Entity } from "@backstage/catalog-model";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";

interface CatalogFilter {
  kind?: string;
  type?: string;
  [key: string]: any;
}

interface EnhancedEntityPickerProps
  extends FieldExtensionComponentProps<
    string,
    {
      displayEntityFieldAfterFormatting?: string;
      catalogFilter?: CatalogFilter;
      placeholder?: string;
    }
  > {}

// Formats the display of an entity based on a template string
// ( replace ${} expressions with entity data
const formatEntityDisplay = (template: string, entity: Entity): string => {
  return template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
    const trimmedPath = path.trim();

    // Handle nested object access like metadata.name, spec.profile.email
    const value = trimmedPath.split(".").reduce((obj: any, key: string) => {
      return obj && obj[key] !== undefined ? obj[key] : "";
    }, entity);

    return value || "";
  });
};

export const EnhancedEntityPicker = ({
  formData,
  onChange,
  schema,
  uiSchema,
  rawErrors,
  disabled,
}: EnhancedEntityPickerProps) => {
  const catalogApi = useApi(catalogApiRef);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  // Extract configuration from uiSchema
  const displayTemplate =
    uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
    "${{ metadata.name }}";
  const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
  const placeholder =
    uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

  // Fetch entities from catalog
  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const filter: any = {};

      // Apply catalog filter
      if (catalogFilter.kind) {
        filter.kind = catalogFilter.kind;
      }
      if (catalogFilter.type) {
        filter["spec.type"] = catalogFilter.type;
      }

      // Add any additional filters
      Object.keys(catalogFilter).forEach((key) => {
        if (key !== "kind" && key !== "type") {
          filter[key] = catalogFilter[key];
        }
      });

      const response = await catalogApi.getEntities({
        filter,
      });

      setEntities(response.items);
    } catch (error) {
      console.error("Error fetching entities:", error);
    } finally {
      setLoading(false);
    }
  }, [catalogApi, catalogFilter]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  // Find the currently selected entity based on formData (clean display format)
  useEffect(() => {
    if (formData && entities.length > 0) {
      const found = entities.find((entity) => {
        const displayValue = formatEntityDisplay(displayTemplate, entity);
        return displayValue === formData;
      });
      setSelectedEntity(found || null);
    } else {
      setSelectedEntity(null);
    }
  }, [formData, entities, displayTemplate]);

  const handleChange = (event: any, newValue: Entity | null) => {
    if (newValue) {
      const displayValue = formatEntityDisplay(displayTemplate, newValue);

      // Store ONLY the clean display format
      // This is what user sees everywhere: dropdown, field, review
      onChange(displayValue);
      setSelectedEntity(newValue);

      // Store entity data for debugging/development only
      if (
        typeof window !== "undefined" &&
        process.env.NODE_ENV === "development"
      ) {
        window.enhancedEntityPickerDebug =
          window.enhancedEntityPickerDebug || {};
        const fieldName =
          schema.title?.toLowerCase().replace(/\s+/g, "") || "entity";
        window.enhancedEntityPickerDebug[fieldName] = {
          displayValue,
          entityRef: `${newValue.kind.toLowerCase()}:${
            newValue.metadata.namespace || "default"
          }/${newValue.metadata.name}`,
          entity: newValue,
        };
      }
    } else {
      onChange("");
      setSelectedEntity(null);
    }
  };

  // Create display options with deduplication
  const displayOptions = entities
    .map((entity) => ({
      entity,
      displayText: formatEntityDisplay(displayTemplate, entity),
      entityId:
        entity.metadata.uid ||
        `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`,
    }))
    // Remove duplicates by entityId
    .filter(
      (option, index, array) =>
        array.findIndex((item) => item.entityId === option.entityId) === index
    )
    // Remove empty display texts
    .filter((option) => option.displayText && option.displayText.trim() !== "");

  // Find current selection
  const currentSelection = selectedEntity
    ? displayOptions.find(
        (opt) => opt.entity.metadata.uid === selectedEntity.metadata.uid
      ) || null
    : null;

  return (
    <Box>
      <Autocomplete
        options={displayOptions}
        getOptionLabel={(option) => option.displayText}
        value={currentSelection}
        onChange={(event, newValue) =>
          handleChange(event, newValue?.entity || null)
        }
        loading={loading}
        disabled={disabled}
        isOptionEqualToValue={(option, value) =>
          option.entityId === value.entityId
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={schema.title}
            placeholder={placeholder}
            error={!!rawErrors?.length}
            // helperText={rawErrors?.length ? rawErrors[0] : schema.description}
            variant="outlined"
            fullWidth
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Box>
              <Box sx={{ fontWeight: "medium" }}>{option.displayText}</Box>
              {/* Only show description if it exists, NO entityRef */}
              {/* {option.entity.metadata.description && (
                <Box sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                  {option.entity.metadata.description}
                </Box>
              )} */}
            </Box>
          </Box>
        )}
      />

      {/* Debug information - development only */}
      {process.env.NODE_ENV === "development" && (
        <Box
          sx={{
            mt: 1,
            p: 1,
            bgcolor: "grey.50",
            borderRadius: 1,
            fontSize: "11px",
          }}
        >
          <strong>Debug Info:</strong>
          <div>Dropdown Options: {displayOptions.length}</div>
          {selectedEntity && (
            <div style={{ marginTop: "4px" }}>
              <div>
                ✅ User sees: "
                {formatEntityDisplay(displayTemplate, selectedEntity)}"
              </div>
              <div>
                🔧 EntityRef: {selectedEntity.kind.toLowerCase()}:
                {selectedEntity.metadata.namespace || "default"}/
                {selectedEntity.metadata.name}
              </div>
            </div>
          )}
        </Box>
      )}
    </Box>
  );
};

// Global type declaration for debugging
declare global {
  interface Window {
    enhancedEntityPickerDebug?: { [key: string]: any };
  }
}
