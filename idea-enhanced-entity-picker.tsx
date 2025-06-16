// enhanced-entity-picker-auto.tsx

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

// Enhanced formatting that automatically includes metadata.name if missing
const createEnhancedTemplate = (originalTemplate: string): string => {
  // Check if template already includes metadata.name
  if (originalTemplate.includes("metadata.name")) {
    return originalTemplate;
  }
  
  // Add metadata.name as hidden prefix with special separator
  return `${{ metadata.name }}___HIDDEN_SEPARATOR___${originalTemplate}`;
};

// Format entity display for user (visible portion only)
const formatEntityDisplay = (template: string, entity: Entity): string => {
  return template.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    const value = trimmedPath.split(".").reduce((obj: any, key: string) => {
      return obj && obj[key] !== undefined ? obj[key] : "";
    }, entity);
    return value || "";
  });
};

// Format entity for internal processing (includes hidden metadata.name)
const formatEnhancedEntityDisplay = (enhancedTemplate: string, entity: Entity): string => {
  const fullValue = formatEntityDisplay(enhancedTemplate, entity);
  return fullValue;
};

// Extract visible portion for user display
const extractVisibleDisplay = (enhancedValue: string): string => {
  if (enhancedValue.includes("___HIDDEN_SEPARATOR___")) {
    return enhancedValue.split("___HIDDEN_SEPARATOR___")[1];
  }
  return enhancedValue;
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
  const originalDisplayTemplate =
    uiSchema?.["ui:options"]?.displayEntityFieldAfterFormatting ||
    "${{ metadata.name }}";
  
  // Create enhanced template that guarantees metadata.name is included
  const enhancedDisplayTemplate = createEnhancedTemplate(originalDisplayTemplate);
  
  const catalogFilter = uiSchema?.["ui:options"]?.catalogFilter || {};
  const placeholder =
    uiSchema?.["ui:options"]?.placeholder || "Select an entity...";

  // Determine if we're in "auto-enhancement" mode
  const isAutoEnhanced = !originalDisplayTemplate.includes("metadata.name");

  // Fetch entities from catalog
  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const filter: any = {};

      if (catalogFilter.kind) {
        filter.kind = catalogFilter.kind;
      }
      if (catalogFilter.type) {
        filter["spec.type"] = catalogFilter.type;
      }

      Object.keys(catalogFilter).forEach((key) => {
        if (key !== "kind" && key !== "type") {
          filter[key] = catalogFilter[key];
        }
      });

      const response = await catalogApi.getEntities({ filter });
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
        const enhancedValue = formatEnhancedEntityDisplay(enhancedDisplayTemplate, entity);
        return enhancedValue === formData;
      });
      setSelectedEntity(found || null);
    } else {
      setSelectedEntity(null);
    }
  }, [formData, entities, enhancedDisplayTemplate]);

  const handleChange = (event: any, newValue: Entity | null) => {
    if (newValue) {
      // Always store the enhanced value (includes metadata.name for action processing)
      const enhancedValue = formatEnhancedEntityDisplay(enhancedDisplayTemplate, newValue);
      
      // Store enhanced value that action can parse
      onChange(enhancedValue);
      setSelectedEntity(newValue);

      // Debug information
      if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
        window.enhancedEntityPickerDebug = window.enhancedEntityPickerDebug || {};
        const fieldName = schema.title?.toLowerCase().replace(/\s+/g, "") || "entity";
        
        window.enhancedEntityPickerDebug[fieldName] = {
          userSeesDisplay: extractVisibleDisplay(enhancedValue),
          enhancedValue: enhancedValue,
          originalTemplate: originalDisplayTemplate,
          enhancedTemplate: enhancedDisplayTemplate,
          isAutoEnhanced: isAutoEnhanced,
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

  // Create display options
  const displayOptions = entities
    .map((entity) => ({
      entity,
      // User sees the visible portion only
      displayText: isAutoEnhanced 
        ? formatEntityDisplay(originalDisplayTemplate, entity)
        : extractVisibleDisplay(formatEnhancedEntityDisplay(enhancedDisplayTemplate, entity)),
      enhancedValue: formatEnhancedEntityDisplay(enhancedDisplayTemplate, entity),
      entityId: entity.metadata.uid || `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`,
    }))
    .filter(
      (option, index, array) =>
        array.findIndex((item) => item.entityId === option.entityId) === index
    )
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
            variant="outlined"
            fullWidth
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Box>
              <Box sx={{ fontWeight: "medium" }}>{option.displayText}</Box>
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
          <div>Mode: {isAutoEnhanced ? "Auto-Enhanced" : "Manual"}</div>
          <div>Options: {displayOptions.length}</div>
          {selectedEntity && (
            <div style={{ marginTop: "4px" }}>
              <div>👤 User Sees: "{extractVisibleDisplay(formatEnhancedEntityDisplay(enhancedDisplayTemplate, selectedEntity))}"</div>
              <div>🔧 Enhanced Value: "{formatEnhancedEntityDisplay(enhancedDisplayTemplate, selectedEntity)}"</div>
              <div>📋 Original Template: "{originalDisplayTemplate}"</div>
              <div>🎯 Enhanced Template: "{enhancedDisplayTemplate}"</div>
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