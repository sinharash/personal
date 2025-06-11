import React, { useEffect, useState, useCallback } from "react";
import { Autocomplete, TextField, Box, Chip } from "@mui/material";
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
      multiple?: boolean;
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

// Helper to create entity reference string
const getEntityRef = (entity: Entity): string => {
  return `${entity.kind.toLowerCase()}:${
    entity.metadata.namespace || "default"
  }/${entity.metadata.name}`;
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

  // Find the currently selected entity based on formData (entityRef)
  useEffect(() => {
    if (formData && entities.length > 0) {
      const found = entities.find(
        (entity) => getEntityRef(entity) === formData
      );
      setSelectedEntity(found || null);
    } else {
      setSelectedEntity(null);
    }
  }, [formData, entities]);

  const handleChange = (event: any, newValue: Entity | null) => {
    if (newValue) {
      // Store the entityRef (like standard EntityPicker)
      const entityRef = getEntityRef(newValue);
      onChange(entityRef);
      setSelectedEntity(newValue);
    } else {
      onChange("");
      setSelectedEntity(null);
    }
  };

  // Create display options
  const displayOptions = entities.map((entity) => ({
    entity,
    displayText: formatEntityDisplay(displayTemplate, entity),
    entityRef: getEntityRef(entity),
  }));

  // Find current selection for display
  const currentSelection = selectedEntity
    ? displayOptions.find((opt) => opt.entity === selectedEntity) || null
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
          option.entityRef === value.entityRef
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
              <Box sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                {option.entity.metadata.description || option.entityRef}
              </Box>
            </Box>
          </Box>
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              variant="outlined"
              label={option.displayText}
              {...getTagProps({ index })}
              key={option.entityRef}
            />
          ))
        }
      />

      {/* Debug information - shows what gets stored vs displayed */}
      {selectedEntity && process.env.NODE_ENV === "development" && (
        <Box sx={{ mt: 2, p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
          <strong>Debug Info:</strong>
          <pre style={{ fontSize: "12px", overflow: "auto", marginTop: "8px" }}>
            {`Stored in form: ${getEntityRef(selectedEntity)}
Displayed to user: ${formatEntityDisplay(displayTemplate, selectedEntity)}

Available in YAML steps:
parameters.${schema.title?.toLowerCase().replace(/\s+/g, "")} = "${getEntityRef(
              selectedEntity
            )}"

With template functions (if implemented):
$\{{ entities[parameters.${schema.title
              ?.toLowerCase()
              .replace(/\s+/g, "")}].metadata.name }}
$\{{ entities[parameters.${schema.title
              ?.toLowerCase()
              .replace(/\s+/g, "")}].spec.profile.email }}`}
          </pre>
        </Box>
      )}
    </Box>
  );
};
