// src/components/EnhancedEntityPicker/types.ts (example path)
import { Entity } from "@backstage/catalog-model";

/**
 * UI options for the standard EntityPicker.
 * You might need to grab the actual type from:
 * import { EntityPickerUiOptions as StandardEntityPickerUiOptions } from '@backstage/plugin-scaffolder-react/alpha';
 * or check its definition in the Backstage source if not directly exported.
 * For this example, we'll define the common ones.
 */
export interface StandardEntityPickerUiOptions {
  allowedKinds?: string[];
  defaultKind?: string;
  allowArbitraryValues?: boolean;
  catalogFilter?:
    | Record<string, string | string[] | { exists?: boolean }>
    | Record<string, string | string[] | { exists?: boolean }>[];
  defaultNamespace?: string | false;
}

// Your custom UI options
export interface EnhancedEntityPickerUiOptions
  extends StandardEntityPickerUiOptions {
  /**
   * Specifies the path within the entity object to use for display in the dropdown.
   * Defaults to 'metadata.name'.
   * Examples: 'metadata.title', 'spec.profile.displayName', 'metadata.annotations["custom.org/identifier"]'
   */
  displayEntityField?: string;

  /**
   * Optional: A secondary path to display alongside the primary display field in the dropdown.
   * Example: 'metadata.namespace' or 'spec.type'
   */
  secondaryDisplayEntityField?: string;
}
