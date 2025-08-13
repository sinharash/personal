// At the top of your EnhancedEntityPicker file, add this import:
import { ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS } from "./enhanced-entity-picker-fields";

// Replace your lines 111-122 with this simple change:
const { value: entities, loading } = useAsync(async () => {
  // Your base fields (keep exactly as they were)
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

  // Combine with additional fields for comprehensive displayFormat support
  const allFields = [
    ...baseFields,
    ...ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS,
  ];

  // Use combined fields - no more dynamic changes, no re-renders
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
}, [catalogFilter]); // Remove displayFormat from dependency array to stop re-renders

// Add the helper functions for displayFormat (these don't cause re-renders):
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
    if (template.includes(" || ")) {
      const paths = template.split(" || ").map((p) => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        if (value && String(value).trim()) return String(value);
      }
      return "";
    }

    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return value ? String(value) : "";
    });
  } catch {
    return entity?.metadata?.name || "";
  }
};
