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

  // Get field name for creating additional entity data fields
  const fieldName =
    name || schema.title?.toLowerCase().replace(/\s+/g, "") || "entity";

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

  // Find the currently selected entity based on formData (display format)
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

      // Store ONLY the clean display format as the main form value
      onChange(displayValue);
      setSelectedEntity(newValue);

      // Store entity data in a way that's accessible to templates but hidden from review
      // We'll use a custom approach that doesn't interfere with the form UI
      if (typeof window !== "undefined") {
        // Store in a global that templates can access via custom action if needed
        window.backstageEnhancedEntityData =
          window.backstageEnhancedEntityData || {};
        window.backstageEnhancedEntityData[fieldName] = {
          entityRef: `${newValue.kind.toLowerCase()}:${
            newValue.metadata.namespace || "default"
          }/${newValue.metadata.name}`,
          name: newValue.metadata.name,
          kind: newValue.kind,
          namespace: newValue.metadata.namespace || "default",
          email: newValue.spec?.profile?.email || "",
          displayName:
            newValue.spec?.profile?.displayName || newValue.metadata.name,
          department: newValue.spec?.profile?.department || "",
          title: newValue.spec?.profile?.title || "",
          uid: newValue.metadata.uid || "",
          fullEntity: newValue,
        };
      }
    } else {
      onChange("");
      setSelectedEntity(null);

      // Clear stored data
      if (typeof window !== "undefined" && window.backstageEnhancedEntityData) {
        delete window.backstageEnhancedEntityData[fieldName];
      }
    }
  };

  // Create ONLY the display options (no duplicates)
  const displayOptions = entities.map((entity) => ({
    entity,
    displayText: formatEntityDisplay(displayTemplate, entity),
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
      />

      {/* Debug information - shows what's stored */}
      {selectedEntity && process.env.NODE_ENV === "development" && (
        <Box sx={{ mt: 2, p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
          <strong>Debug Info:</strong>
          <pre style={{ fontSize: "12px", overflow: "auto", marginTop: "8px" }}>
            {`✅ What user sees in field/review:
parameters.${fieldName}: "${formatEntityDisplay(
              displayTemplate,
              selectedEntity
            )}"

🔧 Entity data available (via custom action):
- entityRef: ${selectedEntity.kind.toLowerCase()}:${
              selectedEntity.metadata.namespace || "default"
            }/${selectedEntity.metadata.name}
- name: ${selectedEntity.metadata.name}
- email: ${selectedEntity.spec?.profile?.email || "N/A"}
- department: ${selectedEntity.spec?.profile?.department || "N/A"}`}
          </pre>
        </Box>
      )}
    </Box>
  );
};

// Declare global type for TypeScript
declare global {
  interface Window {
    backstageEnhancedEntityData?: { [key: string]: any };
  }
}
