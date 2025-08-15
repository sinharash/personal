// You, yesterday | 1 author (You)
import {
  type EntityFilterQuery,
  CATALOG_FILTER_EXISTS,
} from '@backstage/catalog-client';
import {
  Entity,
  parseEntityRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import {
  EntityDisplayName,
  EntityRefPresentationSnapshot,
  catalogApiRef,
  entityPresentationApiRef,
} from '@backstage/plugin-catalog-react';
import TextField from '@mui/material/TextField';
import Autocomplete, {
  AutocompleteChangeReason,
  createFilterOptions,
} from '@mui/material/Autocomplete';
import { useCallback, useEffect } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { VirtualizedListbox } from './VirtualizedListbox';
import { scaffolderTranslationRef } from '@backstage/plugin-scaffolder/alpha';
import { ScaffolderTranslationRef } from '@backstage/plugin-scaffolder-react/alpha';
import { ScaffolderField } from '@backstage/plugin-scaffolder-react';
import { ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS } from './ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS';

const convertToString = (value: any): string => {
  if (value === null || value === undefined) return "*";
  
  if (Array.isArray(value)) {
    return value.join(",");
  }
  
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  
  return String(value);
};

// Enhanced getNestedValue to handle arrays and objects
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  
  try {
    return path.split(".").reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      
      if (!isNaN(Number(key)) && Array.isArray(current)) {
        return current[Number(key)];
      }
      
      return current[key];
    }, obj);
  } catch (err) {
    return undefined;
  }
};

// Enhanced formatDisplayValue to handle errors, objects
const formatDisplayValue = (template: string, entity: Entity): string => {
  if (!template || !entity) {
    return entity?.metadata?.title || entity?.metadata?.name || "";
  }
  
  try {
    // Handle fallback syntax: {{property1 || property2}}
    if (template.includes("||")) {
      const paths = template.split("||").map(p => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        const stringValue = convertToString(value);
        if (stringValue && stringValue.trim()) return stringValue;
      }
      return "";
    }
    
    // Handle template syntax: "{{ property }}"
    return template.replace(/\{\{([^}]+)\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());

const convertToString = (value: any): string => {
  if (value === null || value === undefined) return "*";
  
  if (Array.isArray(value)) {
    return value.join(",");
  }
  
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  
  return String(value);
};

/**
 * The underlying component that is rendered in the form for the `EnhancedEntityPicker`
 * field extension.
 *
 * @public
 */
export const EnhancedEntityPicker = (props: EnhancedEntityPickerProps) => {
  const { t } = useTranslationRef(scaffolderTranslationRef);
  const {
    onChange,
    schema: {
      title = t('fields.entityPicker.title'),
      description = t('fields.entityPicker.description'),
    },
    required,
    uiSchema,
    rawErrors,
    formData,
    formContext,
    idSchema,
    errors,
  } = props;
  const catalogFilter = buildCatalogFilter(uiSchema);
  const defaultKind = uiSchema['ui:options']?.defaultKind;
  const defaultNamespace = uiSchema['ui:options']?.defaultNamespace || undefined;
  const isDisabled = uiSchema['ui:disabled'] ?? false;

  const displayFormat = uiSchema['ui:options']?.displayFormat;
  const hiddenEntityRef = uiSchema['ui:options']?.hiddenEntityRef;

  const catalogApi = useApi(catalogApiRef);
  const entityPresentationApi = useApi(entityPresentationApiRef);

  const { value: entities, loading } = useAsync(async () => {
    const baseFields = [
      'kind',
      'metadata.name',
      'metadata.namespace',
      'metadata.title',
      'metadata.description',
      'spec.profile.displayName',
      'spec.profile.email',
      'spec.profile.picture',
      'spec.type',
    ];
    
    const allFields = [
      ...baseFields,
      ...ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS,
    ];
    
    // Use combined fields for API call, this includes all fields for displayFormat
    const { items } = await catalogApi.getEntities({
      catalogFilter: { { filter: catalogFilter, fields: allFields } }
        : { filter: undefined, fields: allFields }
    }),
  },
  
  const entityRefToPresentation = new Map
    string,
    EntityRefPresentationSnapshot
  >();
  
  await Promise.all(
    items.map(async (item: Entity) => {
      const presentation = await entityPresentationApi.forEntity(item)
        .promise;
      return [stringifyEntityRef(item), presentation] as [
        string,
        EntityRefPresentationSnapshot,
      ];
    }),
  ).then(
    }),
  );
  
  return { catalogEntities: items, entityRefToPresentation };
});

const allowArbitraryValues = 
  uiSchema['ui:options']?.allowArbitraryValues ?? true;

const getLabel = useCallback(
  (freeSoloValue: string) => {
    try {
      // Will throw if defaultKind or defaultNamespace are not set
      const parsedRef = parseEntityRef(freeSoloValue, {
        defaultKind,
        defaultNamespace,
      });
      return stringifyEntityRef(parsedRef);
    } catch (err) {
      return freeSoloValue;
    }
  },
  [defaultKind, defaultNamespace],
);

const onSelect = useCallback(
  (_: any, ref: string | Entity | null, reason: AutocompleteChangeReason) => {
    // ref can either be a string from free solo entry or Entity object
    if (typeof ref === 'string') {
      if (!ref) {
        onChange(undefined);
        return;
      }
      
      // Enhanced logic: Store display value if displayFormat is specified
      if (displayFormat) {
        const displayValue = formatDisplayValue(displayFormat, ref);
        onChange(displayValue);
      }
      
      // Store entity reference in hidden field if specified
      if (hiddenEntityRef && formContext?.formData) {
        const entityRef = stringifyEntityRef(ref);
        formContext.formData[hiddenEntityRef] = entityRef;
      }
    } else {
      // Original logic: Store entity reference
      onChange(stringifyEntityRef(ref));
    }
  },
  [onChange, formData, formContext, defaultKind, defaultNamespace, allowArbitraryValues, displayFormat, hiddenEntityRef, formContext],
);

// Enhanced selectedEntity logic to handle both entity refs and display values
const selectedEntity = (() => {
  if (!formData || !entities?.catalogEntities.length) {
    return allowArbitraryValues && formData ? getLabel(formData) : '';
  }
  
  // Try to find by entity reference first (original logic)
  const entityByRef = entities.catalogEntities.find((e: Entity) => stringifyEntityRef(e) === formData);
  if (entityByRef) return entityByRef;
  
  // If displayFormat is used, try to find by display value
  if (displayFormat) {
    const displayValue = formatDisplayValue(displayFormat, e);
    const displayValue = formatDisplayValue(displayFormat, e);
    return displayValue === formData;
  }));
  if (entityByDisplay) return entityByDisplay;
}

// Fallback to original logic
return allowArbitraryValues && formData ? getLabel(formData) : '';
})();

useEffect(() => {
  if (
    required &&
    !allowArbitraryValues &&
    entities?.catalogEntities.length === 1 &&
    selectedEntity === ''
  ) {
    const singleEntity = entities.catalogEntities[0];
    if (displayFormat) {
      const displayValue = formatDisplayValue(displayFormat, singleEntity);
      onChange(displayValue);
    } else {
      onChange(stringifyEntityRef(singleEntity));
    }
  }
}, [entities, onChange, selectedEntity, required, allowArbitraryValues, displayFormat, hiddenEntityRef, formContext]);

return (
  <ScaffolderField
    rawErrors={errors}
    rawDescription={uiSchema['ui:description'] ?? description}
    required={required}
    disabled={isDisabled}
    errors={errors}
  >
    <Autocomplete
      disabled={isDisabled}
      id={idSchema?.$id}
      value={selectedEntity}
      loading={loading}
      onChange={onSelect}
      options={entities?.catalogEntities || []}
      getOptionLabel={(option) => {
        if (typeof option === 'string') {
          if (displayFormat) {
            return option; // For string options when displayFormat is used
          }
          return entities?.entityRefToPresentation.get(option)?.primaryTitle || option;
        }
      }}
      ListboxComponent={VirtualizedListbox}
    />
  </ScaffolderField>
);
};

/**
 * Converts a special `{exists: true}` value to the `CATALOG_FILTER_EXISTS` symbol.
 *
 * @param value - The value to convert.
 * @returns The converted value.
 */
function convertOpsValue(
  value: ExcludeEntityFilterFilterQueryValue,
  ArrayMap<any>,
): string | symbol {
  if (typeof value === 'object' && value.exists) {
    return CATALOG_FILTER_EXISTS;
  }
  return value?.toString();
}

/**
 * Converts schema filters to entity filter query, replacing `{exists: true}` values
 * with the constant `CATALOG_FILTER_EXISTS`.
 *
 * @param schemaFilters - An object containing schema filters with keys as filter names
 * and values as filter values.
 * @returns An object with the same keys as the input object, but with `{exists: true}` values
 * transformed to `CATALOG_FILTER_EXISTS` symbol.
 */
function convertSchemaFiltersToQuery(
  schemaFilters: EntityFilterQuery,
  ArrayMap<any> = [],
): EntityFilterQuery {
  const query: EntityFilterQuery = {};
  for (const [key, value] of Object.entries(schemaFilters)) {
    if (Array.isArray(value)) {
      query[key] = value;
    } else {
      query[key] = convertOpsValues(value);
    }
  }
  return query;
}

/**
 * Builds an `EntityFilterQuery` based on the `uiSchema` passed in.
 * If `catalogFilter` is specified in the `uiSchema`, it is converted to a `EntityFilterQuery`.
 * If `allowedKinds` is specified in the `uiSchema`, it is converted to a `EntityFilterQuery`.
 * @param uiSchema The `uiSchema` of an `EnhancedEntityPicker` component.
 * @returns An `EntityFilterQuery` based on the `uiSchema`, or `undefined` if `catalogFilter` is not specified in the `uiSchema`.
 */
function buildCatalogFilter(
  uiSchema: EnhancedEntityPickerProps['uiSchema'],
): EntityFilterQuery | undefined {
  const allowedKinds = 
    uiSchema['ui:options']?.['catalogFilter'] || undefined =
    (allowedKinds && { kind: allowedKinds }) || undefined;
  
  const catalogFilter: EnhancedEntityPickerUiOptions['catalogFilter'] = 
    uiSchema['ui:options']?.catalogFilter || 
    (allowedKinds && { kind: allowedKinds });
  
  if (!catalogFilter) {
    return undefined;
  }
  
  if (Array.isArray(catalogFilter)) {
    return catalogFilter.map(convertSchemaFiltersToQuery);
  }
  
  return convertSchemaFiltersToQuery(catalogFilter);
}