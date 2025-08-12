// Add this helper function at the top of your file
// Extracts field paths from displayFormat template
const extractFieldsFromDisplayFormat = (displayFormat?: string): string[] => {
  if (!displayFormat) return [];

  const fields = new Set<string>();

  // Extract fields from {{ field.path }} syntax
  const templateMatches = displayFormat.match(/\{\{\s*([^}]+)\s*\}\}/g);
  if (templateMatches) {
    templateMatches.forEach((match) => {
      const field = match.replace(/\{\{\s*|\s*\}\}/g, "").trim();
      fields.add(field);
    });
  }

  // Extract fields from fallback syntax: field1 || field2 || field3
  if (displayFormat.includes(" || ")) {
    const fallbackFields = displayFormat.split(" || ").map((f) => f.trim());
    fallbackFields.forEach((field) => {
      // Skip if it contains template syntax (already handled above)
      if (!field.includes("{{")) {
        fields.add(field);
      }
    });
  }

  return Array.from(fields);
};

// Replace your existing fields array and catalogApi call (lines 111-122) with:
const { value: entities, loading } = useAsync(async () => {
  // Base fields array - keep for performance (same as original EntityPicker intent)
  const baseFields = [
    "kind",
    "metadata.account_id",
    "metadata.name",
    "metadata.namespace",
    "metadata.title",
    "metadata.description",
    "spec.profile.displayName",
    "spec.profile.email",
    "spec.type",
  ];

  // Dynamically add fields needed for displayFormat
  const displayFormatFields = extractFieldsFromDisplayFormat(displayFormat);

  // Combine base fields with displayFormat fields (remove duplicates)
  const allFields = [...new Set([...baseFields, ...displayFormatFields])];

  // Use combined fields for API call
  const { items } = await catalogApi.getEntities(
    catalogFilter
      ? { filter: catalogFilter, fields: allFields }
      : { filter: undefined, fields: allFields }
  );

  // Rest of your existing code stays exactly the same...
  const entityRefToPresentation = new Map<
    string,
    EntityRefPresentationSnapshot
  >();

  await Promise.all(
    items.map(async (item) => {
      const presentation = await entityPresentationApi.forEntity(item).promise;
      return [stringifyEntityRef(item), presentation] as [
        string,
        EntityRefPresentationSnapshot
      ];
    })
  ).then((entries) => {
    entries.forEach(([ref, presentation]) => {
      entityRefToPresentation.set(ref, presentation);
    });
  });

  return { catalogEntities: items, entityRefToPresentation };
}, [catalogFilter, displayFormat]); // Add displayFormat to dependencies

// Add helper functions for displayFormat processing:
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  try {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  } catch {
    return undefined;
  }
};

const formatDisplayValue = (template: string, entity: Entity): string => {
  if (!template || !entity) {
    return entity?.metadata?.title || entity?.metadata?.name || "";
  }

  try {
    // Handle fallback syntax: "property1 || property2"
    if (template.includes(" || ")) {
      const paths = template.split(" || ").map((p) => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        if (value && String(value).trim()) return String(value);
      }
      return "";
    }

    // Handle template syntax: "{{ property }}"
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return value ? String(value) : "";
    });
  } catch {
    return entity?.metadata?.name || "";
  }
};

// OPTIONAL: Move base fields to external file if you prefer
// Create: enhanced-entity-picker-fields.ts
/*
export const ENHANCED_ENTITY_PICKER_BASE_FIELDS = [
  'kind',
  'metadata.account_id',
  'metadata.name',
  'metadata.namespace', 
  'metadata.title',
  'metadata.description',
  'spec.profile.displayName',
  'spec.profile.email',
  'spec.type',
];
*/

// Then import and use:
// import { ENHANCED_ENTITY_PICKER_BASE_FIELDS } from './enhanced-entity-picker-fields';
// const baseFields = ENHANCED_ENTITY_PICKER_BASE_FIELDS;
