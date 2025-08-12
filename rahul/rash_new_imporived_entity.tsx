// Replace the static fields definition with dynamic field extraction
const useEntityFields = (entities: Entity[]) => {
  return useMemo(() => {
    const fieldSet = new Set<string>();
    
    // Base fields that are always available
    const baseFields = [
      'kind',
      'metadata.account_id',
      'metadata.name',
      'metadata.namespace',
      'metadata.title',
      'metadata.description',
      'spec.profile.displayName',
      'spec.profile.email',
      'spec.type'
    ];
    
    baseFields.forEach(field => fieldSet.add(field));
    
    // Dynamically extract fields from actual entity data
    entities.forEach(entity => {
      // Add all metadata fields
      if (entity.metadata) {
        Object.keys(entity.metadata).forEach(key => {
          fieldSet.add(`metadata.${key}`);
        });
        
        // Handle nested annotations
        if (entity.metadata.annotations) {
          Object.keys(entity.metadata.annotations).forEach(key => {
            fieldSet.add(`metadata.annotations.${key}`);
          });
        }
      }
      
      // Add all spec fields
      if (entity.spec) {
        const addSpecFields = (obj: any, prefix = 'spec') => {
          Object.keys(obj).forEach(key => {
            const fieldPath = `${prefix}.${key}`;
            fieldSet.add(fieldPath);
            
            // Handle nested objects (up to 3 levels deep to avoid infinite recursion)
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && prefix.split('.').length < 4) {
              addSpecFields(obj[key], fieldPath);
            }
          });
        };
        addSpecFields(entity.spec);
      }
    });
    
    return Array.from(fieldSet);
  }, [entities]);
};

// Enhanced getNestedValue function that handles any field path
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  
  try {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        return current[key];
      }
      return undefined;
    }, obj);
  } catch {
    return undefined;
  }
};

// Updated formatDisplayValue function
const formatDisplayValue = (template: string, entity: Entity, availableFields: string[]): string => {
  if (!template || !entity) {
    return entity?.metadata?.title || entity?.metadata?.name || '';
  }

  try {
    // Handle fallback syntax: "property1 || property2"
    if (template.includes(' || ')) {
      const paths = template.split(' || ').map(p => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        if (value && String(value).trim()) return String(value);
      }
      return '';
    }

    // Handle template syntax: "{{ property }}"
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return value ? String(value) : '';
    });
  } catch {
    return entity?.metadata?.name || '';
  }
};

// Updated main component logic
export const EnhancedEntityPicker = (props: EnhancedEntityPickerProps) => {
  // ... existing props destructuring and setup

  // Get dynamic fields based on loaded entities
  const dynamicFields = useEntityFields(items || []);

  const { value: entities, loading } = useAsync(async () => {
    const catalogFilter = buildCatalogFilter(uiSchema);
    const defaultKind = uiSchema['ui:options']?.defaultKind;
    const defaultNamespace = uiSchema['ui:options']?.defaultNamespace || undefined;
    const isDisabled = uiSchema['ui:disabled'] ?? false;

    // Enhanced options
    const displayFormat = uiSchema['ui:options']?.displayFormat;
    const hiddenEntityRef = uiSchema['ui:options']?.hiddenEntityRef;

    const catalogApi = useApi(catalogApiRef);
    const entityPresentationApi = useApi(entityPresentationApiRef);

    const { value: entities, loading } = useAsync(async () => {
      // Use dynamic fields instead of static field definition
      const { items } = await catalogApi.getEntities(
        catalogFilter
          ? { filter: catalogFilter, fields: dynamicFields }
          : { filter: undefined, fields: dynamicFields },
      );

      const entityRefToPresentation = new Map<
        string,
        EntityRefPresentationSnapshot
      >();

      await Promise.all(
        items.map(async item => {
          const presentation = await entityPresentationApi.forEntity(item)
            .promise;
          return [stringifyEntityRef(item), presentation] as [
            string,
            EntityRefPresentationSnapshot,
          ];
        }),
      ).then(
        entries => {
          entries.forEach(([ref, presentation]) => {
            entityRefToPresentation.set(ref, presentation);
          });
        },
      );

      return { catalogEntities: items, entityRefToPresentation };
    }, [catalogFilter, dynamicFields]);

    // ... rest of the component logic remains the same

    // Update the formatDisplayValue calls to use dynamic fields
    const selectedEntity = () => {
      if (!entityByRef) return entityByRef;
      
      // If displayFormat is used, try to find by display value
      if (displayFormat) {
        const entityByDisplay = entities.catalogEntities.find(e => {
          const displayValue = formatDisplayValue(displayFormat, e, dynamicFields);
          return displayValue === formData;
        });
        if (entityByDisplay) return entityByDisplay;
      }

      // Fallback to original logic
      return allowArbitraryValues && formData ? getLabel(formData) : '';
    };

    // ... rest of component implementation
  };

  // Rest of your component remains the same, just replace the static fields array usage
  // with dynamicFields wherever fields are referenced
};