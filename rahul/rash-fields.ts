// enhanced-entity-picker-fields.ts
// Additional fields that users might want to use in displayFormat

export const ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS = [
  // Common metadata fields
  "metadata.annotations",
  "metadata.labels",
  "metadata.tags",
  "metadata.uid",
  "metadata.etag",

  // User entity specific fields
  "spec.profile.picture",
  "spec.profile.department",
  "spec.memberOf",

  // Component entity specific fields
  "spec.owner",
  "spec.lifecycle",
  "spec.system",
  "spec.subcomponentOf",
  "spec.providesApis",
  "spec.consumesApis",
  "spec.dependsOn",

  // System entity specific fields
  "spec.domain",
  "spec.owner",

  // Resource entity specific fields
  "spec.owner",
  "spec.dependsOn",
  "spec.dependencyOf",

  // API entity specific fields
  "spec.definition",
  "spec.owner",

  // Group entity specific fields
  "spec.type",
  "spec.profile",
  "spec.parent",
  "spec.children",
  "spec.members",

  // Domain entity specific fields
  "spec.owner",

  // Location entity specific fields
  "spec.targets",
  "spec.target",

  // Common spec fields that might be used across entities
  "spec.profile.displayName",
  "spec.profile.email",
  "spec.profile.picture",

  // Relations (if you want to support them in displayFormat)
  "relations",
];

// You can organize by entity type if you prefer:
export const USER_FIELDS = [
  "spec.profile.picture",
  "spec.profile.department",
  "spec.memberOf",
];

export const COMPONENT_FIELDS = [
  "spec.owner",
  "spec.lifecycle",
  "spec.system",
  "spec.subcomponentOf",
  "spec.providesApis",
  "spec.consumesApis",
  "spec.dependsOn",
];

export const SYSTEM_FIELDS = ["spec.domain", "spec.owner"];

// Or keep it simple with one comprehensive array
export default ENHANCED_ENTITY_PICKER_ADDITIONAL_FIELDS;
