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
      exposeEntityData?: boolean;
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

// Global storage for entity data that can be accessed across the app
declare global {
  interface Window {
    backstageEntityData?: { [key: string]: Entity };
  }
}

export const EnhancedEntityPicker = ({
  formData,
  onChange,
  schema,
  uiSchema,
  rawErrors,
  disabled,
  name,
  formContext,
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
  const exposeEntityData = uiSchema?.["ui:options"]?.exposeEntityData !== false; // Default to true

  // Get field name for data storage
  const fieldName =
    name || schema.title?.replace(/\s+/g, "").toLowerCase() || "entity";

  // Initialize global entity data storage
  useEffect(() => {
    if (typeof window !== "undefined" && !window.backstageEntityData) {
      window.backstageEntityData = {};
    }
  }, []);

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

  // Find the currently selected entity based on formData
  useEffect(() => {
    if (formData && entities.length > 0) {
      const found = entities.find((entity) => {
        const formattedDisplay = formatEntityDisplay(displayTemplate, entity);
        return formattedDisplay === formData;
      });
      setSelectedEntity(found || null);
    }
  }, [formData, entities, displayTemplate]);

  const handleChange = (event: any, newValue: Entity | null) => {
    if (newValue) {
      const formattedDisplay = formatEntityDisplay(displayTemplate, newValue);

      // Store the formatted display value as the main form data
      onChange(formattedDisplay);

      // Store full entity data globally for template access
      if (exposeEntityData && typeof window !== "undefined") {
        window.backstageEntityData = window.backstageEntityData || {};
        window.backstageEntityData[fieldName] = newValue;

        // Also store in sessionStorage as backup
        try {
          sessionStorage.setItem(
            `entityData_${fieldName}`,
            JSON.stringify(newValue)
          );
        } catch (e) {
          // Ignore storage errors
        }
      }

      setSelectedEntity(newValue);
    } else {
      onChange("");
      setSelectedEntity(null);

      // Clear stored data
      if (typeof window !== "undefined" && window.backstageEntityData) {
        delete window.backstageEntityData[fieldName];
      }
      try {
        sessionStorage.removeItem(`entityData_${fieldName}`);
      } catch (e) {
        // Ignore storage errors
      }
    }
  };

  // Format entities for display in autocomplete
  const formattedEntities = entities.map((entity) => ({
    entity,
    displayText: formatEntityDisplay(displayTemplate, entity),
  }));

  return (
    <Box>
      <Autocomplete
        options={formattedEntities}
        getOptionLabel={(option) => option.displayText}
        value={
          formattedEntities.find((item) => item.entity === selectedEntity) ||
          null
        }
        onChange={(event, newValue) =>
          handleChange(event, newValue?.entity || null)
        }
        loading={loading}
        disabled={disabled}
        isOptionEqualToValue={(option, value) =>
          option.entity.metadata.uid === value.entity.metadata.uid
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
                {option.entity.metadata.description ||
                  `${option.entity.kind}:${option.entity.metadata.namespace}/${option.entity.metadata.name}`}
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
              key={option.entity.metadata.uid}
            />
          ))
        }
      />

      {/* Hidden fields to expose entity data for YAML access */}
      {selectedEntity && exposeEntityData && (
        <>
          <input
            type="hidden"
            name={`${fieldName}_entityRef`}
            value={`${selectedEntity.kind.toLowerCase()}:${
              selectedEntity.metadata.namespace || "default"
            }/${selectedEntity.metadata.name}`}
          />
          <input
            type="hidden"
            name={`${fieldName}_name`}
            value={selectedEntity.metadata.name}
          />
          <input
            type="hidden"
            name={`${fieldName}_kind`}
            value={selectedEntity.kind}
          />
          <input
            type="hidden"
            name={`${fieldName}_namespace`}
            value={selectedEntity.metadata.namespace || "default"}
          />
          <input
            type="hidden"
            name={`${fieldName}_email`}
            value={selectedEntity.spec?.profile?.email || ""}
          />
          <input
            type="hidden"
            name={`${fieldName}_displayName`}
            value={
              selectedEntity.spec?.profile?.displayName ||
              selectedEntity.metadata.name
            }
          />
          <input
            type="hidden"
            name={`${fieldName}_department`}
            value={selectedEntity.spec?.profile?.department || ""}
          />
          <input
            type="hidden"
            name={`${fieldName}_title`}
            value={selectedEntity.spec?.profile?.title || ""}
          />
          <input
            type="hidden"
            name={`${fieldName}_uid`}
            value={selectedEntity.metadata.uid || ""}
          />
        </>
      )}

      {/* Debug information - remove in production */}
      {selectedEntity && process.env.NODE_ENV === "development" && (
        <Box sx={{ mt: 2, p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
          <strong>Debug - Available in YAML as:</strong>
          <pre style={{ fontSize: "12px", overflow: "auto" }}>
            {`parameters.${fieldName}                    = "${formatEntityDisplay(
              displayTemplate,
              selectedEntity
            )}"
parameters.${fieldName}_name               = "${selectedEntity.metadata.name}"  
parameters.${fieldName}_email              = "${
              selectedEntity.spec?.profile?.email || ""
            }"
parameters.${fieldName}_entityRef          = "${selectedEntity.kind.toLowerCase()}:${
              selectedEntity.metadata.namespace || "default"
            }/${selectedEntity.metadata.name}"
parameters.${fieldName}_kind               = "${selectedEntity.kind}"
parameters.${fieldName}_namespace          = "${
              selectedEntity.metadata.namespace || "default"
            }"
parameters.${fieldName}_displayName        = "${
              selectedEntity.spec?.profile?.displayName ||
              selectedEntity.metadata.name
            }"
parameters.${fieldName}_department         = "${
              selectedEntity.spec?.profile?.department || ""
            }"
parameters.${fieldName}_title              = "${
              selectedEntity.spec?.profile?.title || ""
            }"
parameters.${fieldName}_uid                = "${
              selectedEntity.metadata.uid || ""
            }"`}
          </pre>
        </Box>
      )}
    </Box>
  );
};
