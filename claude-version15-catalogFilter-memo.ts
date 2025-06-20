import React, { useEffect, useState, useCallback, useMemo } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { Entity, stringifyEntityRef } from "@backstage/catalog-model";
import { FieldExtensionComponentProps } from "@backstage/plugin-scaffolder-react";
import { useNotify } from '../hooks/use-notify';

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
      uniqueIdentifierField?: string;
      catalogFilter?: CatalogFilter;
      placeholder?: string;
      hiddenFieldName?: string;
    }
  > {}

// Helper function to safely extract nested properties
const getNestedValue = (obj: any, path: string): string => {
  try {
    const keys = path.split(".");
    let value = obj;

    for (const key of keys) {
      value = value?.[key];
      if (value === undefined || value === null) return "";
    }

    return String(value || "");
  } catch {
    return "";
  }
};

// Convert template strings with {{ }} placeholders into display text
const formatDisplayValue = (template: string, entity: Entity): string => {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expression) => {
    const trimmed = expression.trim();

    // Handle fallback syntax: "property1 || property2"
    if (trimmed.includes(" || ")) {
      const paths = trimmed.split(" || ").map((p) => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        if (value) return value;
      }
      return "";
    }

    return getNestedValue(entity, trimmed);
  });
};

export const EnhancedEntityPicker = ({
  formData,
  onChange,
  schema,
  uiSchema,
  rawErrors,
  disabled,
  formContext,
}: EnhancedEntityPickerProps) => {
  const { notify } = useNotify();
  const catalogApi = useApi(catalogApiRef);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  // Extract all uiSchema accesses to satisfy ESLint
  const uiOptions = uiSchema?.["ui:options"];
  const catalogFilterFromSchema = uiOptions?.catalogFilter;
  
  // ✅ useMemo is correct here - maintains referential equality to prevent unnecessary API calls
  const catalogFilter = useMemo(() => {
    const filter = catalogFilterFromSchema;

    if (
      !filter ||
      typeof filter !== "object" ||
      Object.keys(filter).length === 0
    ) {
      return { kind: "Template" }; // Safe default
    }

    return filter;
  }, [catalogFilterFromSchema]);

  const hiddenFieldName = uiOptions?.hiddenFieldName || "selectedEntityName";

  const displayTemplate = uiOptions?.displayEntityFieldAfterFormatting || "{{ metadata.title || metadata.name }}";

  const uniqueIdentifierField = uiOptions?.uniqueIdentifierField || "metadata.name";

  const placeholder = uiOptions?.placeholder || "Select an entity...";

  // Fetch entities from Backstage catalog
  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const filter: any = {};
      
      if (catalogFilter.kind) filter.kind = catalogFilter.kind;
      if (catalogFilter.type) filter["spec.type"] = catalogFilter.type;

      Object.keys(catalogFilter).forEach((key) => {
        if (key !== "kind" && key !== "type") {
          filter[key] = catalogFilter[key];
        }
      });

      const response = await catalogApi.getEntities({ filter });
      setEntities(response.items);
    } catch (error) {
      const err = error as Error;
      notify({
        severity: 'error',
        error: new Error(`Failed to get entities - ${err.message}`),
      });
      setEntities([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [catalogApi, catalogFilter, notify]); // Added notify dependency

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  // Sync selected entity with form data
  useEffect(() => {
    if (formData && entities.length > 0) {
      const found = entities.find((entity) => {
        const displayValue = formatDisplayValue(displayTemplate, entity);
        return displayValue === formData;
      });
      setSelectedEntity(found || null);
    } else {
      setSelectedEntity(null);
    }
  }, [formData, entities, displayTemplate]);

  // Handle user selection
  const handleChange = (event: any, newValue: Entity | null) => {
    if (newValue) {
      const displayValue = formatDisplayValue(displayTemplate, newValue);
      const uniqueValue = getNestedValue(newValue, uniqueIdentifierField);

      onChange(displayValue); // Main field (visible on review)
      setSelectedEntity(newValue);

      // Store entity ID in hidden field for backend
      if (formContext?.formData) {
        formContext.formData[hiddenFieldName] = uniqueValue;
      }
    } else {
      onChange("");
      setSelectedEntity(null);
      if (formContext?.formData) {
        formContext.formData[hiddenFieldName] = "";
      }
    }
  };

  // Prepare options for dropdown
  const displayOptions = entities
    .map((entity) => ({
      entity,
      displayText: formatDisplayValue(displayTemplate, entity),
      uniqueValue: getNestedValue(entity, uniqueIdentifierField),
      entityRef: stringifyEntityRef(entity),
    }))
    .filter((option) => option.displayText && option.displayText.trim() !== "");

  const currentSelection = selectedEntity
    ? displayOptions.find(
        (opt) =>
          stringifyEntityRef(opt.entity) === stringifyEntityRef(selectedEntity)
      ) || null
    : null;

  return (
    <Box>
      <Autocomplete
        options={displayOptions}
        getOptionLabel={(option) => option.displayText}
        value={currentSelection}
        onChange={(event, newValue) => handleChange(event, newValue?.entity || null)}
        loading={loading}
        disabled={disabled}
        isOptionEqualToValue={(option, value) => option.entityRef === value.entityRef}
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
            <Box sx={{ fontWeight: "medium" }}>{option.displayText}</Box>
          </Box>
        )}
      />

      {process.env.NODE_ENV === "development" && (
        <Box sx={{ mt: 1, p: 1, bgcolor: "grey.50", fontSize: "11px" }}>
          <strong>Debug:</strong> {displayOptions.length} options |
          Filter: {JSON.stringify(catalogFilter)} |
          Hidden Field: {hiddenFieldName}
          {selectedEntity && (
            <>
              <br />Selected: {formatDisplayValue(displayTemplate, selectedEntity)} |
              Entity ID: {getNestedValue(selectedEntity, uniqueIdentifierField)}
            </>
          )}
        </Box>
      )}
    </Box>
  );
};


Yaml:
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: simplified-entity-picker
  title: "✨ Simplified Entity Picker - Clean & Direct"
  description: "Beautiful UX with direct catalog:fetch - no unnecessary complexity"
spec:
  owner: platform-team
  type: service

  parameters:
    - title: "👥 Select User"
      required:
        - selectedUser
      properties:
        selectedUser:
          title: Choose User
          type: string
          ui:field: EnhancedEntityPicker
          ui:options:
            # 🎨 Beautiful display template
            displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.department }}"
            # 🔑 Store metadata.name in hidden field
            uniqueIdentifierField: "metadata.name"
            hiddenFieldName: "selectedUserEntityName"
            catalogFilter:
              kind: User
            placeholder: "🔍 Select a team member..."
        
        # 🫥 Hidden field - user never sees this
        selectedUserEntityName:
          type: string
          ui:widget: hidden
          ui:backstage:
            review:
              show: false

  steps:
    # 🎯 STEP 1: Direct catalog:fetch (no custom action needed!)
    - id: fetch-user
      name: "📋 Fetch User Details"
      action: catalog:fetch
      input:
        # 🚀 Developer directly constructs entityRef - simple & transparent!
        entityRef: "user:default/${{ parameters.selectedUserEntityName }}"

    # 🎉 STEP 2: Show it works
    - id: show-success
      name: "✅ Show Success"
      action: debug:log
      input:
        message: |
          🎉 SIMPLIFIED SUCCESS!
          
          👤 What User Saw: "${{ parameters.selectedUser }}"
          🔑 Hidden Entity Name: ${{ parameters.selectedUserEntityName }}
          📋 EntityRef Used: "user:default/${{ parameters.selectedUserEntityName }}"
          
          📊 Full User Details:
          - 👤 Name: ${{ steps['fetch-user'].output.entity.metadata.name }}
          - 📧 Email: ${{ steps['fetch-user'].output.entity.spec.profile.email }}
          - 🏢 Department: ${{ steps['fetch-user'].output.entity.spec.profile.department }}
          
          ✨ Much simpler architecture!

# 🔧 EXAMPLES: Works with any entity type - just change the entityRef!

# 👥 For Groups:
# entityRef: "group:default/${{ parameters.selectedGroupEntityName }}"

# 🧩 For Components:  
# entityRef: "component:default/${{ parameters.selectedComponentEntityName }}"

# 🌍 For different namespaces:
# entityRef: "user:production/${{ parameters.selectedUserEntityName }}"

# 🎯 For Systems:
# entityRef: "system:platform/${{ parameters.selectedSystemEntityName }}"

