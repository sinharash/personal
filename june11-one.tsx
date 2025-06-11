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

// Template engine to replace ${} expressions with entity data
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
      const entityRef = `${newValue.kind.toLowerCase()}:${
        newValue.metadata.namespace || "default"
      }/${newValue.metadata.name}`;

      // Store ONLY the clean display format as the main value
      // This is what user sees in field, review page, etc.
      onChange(displayValue);
      setSelectedEntity(newValue);

      // Store entityRef in a separate hidden field for template access
      // This won't show up in review but will be accessible in YAML
      const fieldName =
        schema.title?.toLowerCase().replace(/\s+/g, "") || "entity";

      // Use formContext to store entityRef in a hidden field
      if (formContext && formContext.formData) {
        formContext.formData[`${fieldName}EntityRef`] = entityRef;
      }

      // Also store in window for debugging
      if (typeof window !== "undefined") {
        window.enhancedEntityPickerData = window.enhancedEntityPickerData || {};
        window.enhancedEntityPickerData[fieldName] = {
          entityRef,
          entity: newValue,
        };
      }
    } else {
      onChange("");
      setSelectedEntity(null);

      // Clear stored data
      const fieldName =
        schema.title?.toLowerCase().replace(/\s+/g, "") || "entity";
      if (formContext && formContext.formData) {
        delete formContext.formData[`${fieldName}EntityRef`];
      }
    }
  };

  // Create display options - ONLY clean formatted options with deduplication
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
            helperText={rawErrors?.length ? rawErrors[0] : schema.description}
            variant="outlined"
            fullWidth
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Box>
              <Box sx={{ fontWeight: "medium" }}>{option.displayText}</Box>
              {/* Only show description if it exists, DON'T show entityRef */}
              {option.entity.metadata.description && (
                <Box sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                  {option.entity.metadata.description}
                </Box>
              )}
            </Box>
          </Box>
        )}
      />

      {/* Debug information */}
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
          <strong>Debug - Dropdown Options ({displayOptions.length}):</strong>
          <div
            style={{ maxHeight: "100px", overflow: "auto", marginTop: "4px" }}
          >
            {displayOptions.slice(0, 5).map((opt, idx) => (
              <div key={idx}>
                {idx + 1}. "{opt.displayText}"
              </div>
            ))}
            {displayOptions.length > 5 && (
              <div>... and {displayOptions.length - 5} more</div>
            )}
          </div>

          {selectedEntity && (
            <>
              <strong style={{ marginTop: "8px", display: "block" }}>
                Selected:
              </strong>
              <div>
                Display: "{formatEntityDisplay(displayTemplate, selectedEntity)}
                "
              </div>
              <div>
                EntityRef: {selectedEntity.kind.toLowerCase()}:
                {selectedEntity.metadata.namespace || "default"}/
                {selectedEntity.metadata.name}
              </div>

              <strong style={{ marginTop: "8px", display: "block" }}>
                Available in YAML:
              </strong>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "10px",
                  background: "#f0f0f0",
                  padding: "4px",
                  marginTop: "4px",
                }}
              >
                {`parameters.${
                  schema.title?.toLowerCase().replace(/\s+/g, "") || "entity"
                }: "${formatEntityDisplay(displayTemplate, selectedEntity)}"
parameters.${
                  schema.title?.toLowerCase().replace(/\s+/g, "") || "entity"
                }EntityRef: "${selectedEntity.kind.toLowerCase()}:${
                  selectedEntity.metadata.namespace || "default"
                }/${selectedEntity.metadata.name}"`}
              </div>
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

// Global type declaration
declare global {
  interface Window {
    enhancedEntityPickerData?: { [key: string]: any };
  }
}
