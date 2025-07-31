/*
 * Copyright 2021 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FieldProps, FieldValidation } from "@rjsf/utils";
import { z } from "zod";
import { makeFieldSchemaFromZod } from "@backstage/plugin-scaffolder";
import { parseEntityRef } from "@backstage/catalog-model";

/**
 * EntityPickerFilterQueryValue can be either a string, array of strings, or an object
 * with an 'exists' property of type boolean (e.g., {exists: true}).
 * @public
 */
export type EntityPickerFilterQueryValue =
  | string
  | string[]
  | { exists: boolean };

/**
 * Represents a filter query for the EntityPicker component, with keys as filter names
 * and values as EntityPickerFilterQueryValue.
 * @public
 */
export type EntityPickerFilterQuery = {
  [key: string]: EntityPickerFilterQueryValue;
};

/**
 * The input props that can be specified under `ui:options` for the
 * `EntityPicker` field extension.
 *
 * @public
 */
export interface EntityPickerUiOptions {
  /**
   * Whether to allow arbitrary user input. Defaults to true.
   *
   * @remarks
   *
   * This field allows you to decide whether someone can enter an arbitrary value in the EntityPicker.
   * Set to false if you only want to allow existing entities to be selected.
   * @default true
   */
  allowArbitraryValues?: boolean;

  /**
   * The filter options for the catalog API; use this over the deprecated allowedKinds
   *
   * @remarks
   *
   * This field can be used to filter the entities that the EntityPicker shows; see {@link https://backstage.io/docs/reference/catalog-client.entityfilteroptions}
   */
  catalogFilter?: EntityPickerFilterQuery | EntityPickerFilterQuery[];

  /**
   * @deprecated Specify an array of allowed kinds. Use catalogFilter instead.
   */
  allowedKinds?: string[];

  /**
   * The default kind to use. Defaults to 'Component'.
   * @default 'Component'
   */
  defaultKind?: string;

  /**
   * The namespace to default to if none is specified in the entity reference.
   * @default 'default'
   */
  defaultNamespace?: string;
}

/**
 * The properties that can be specified at the field level for the `EntityPicker` field extension.
 * @public
 */
export interface EntityPickerFieldProps {
  /**
   * @deprecated Moved to ui:options
   */
  allowedKinds?: string[];
}

/**
 * The type of the field value for the `EntityPicker` field extension.
 * @public
 */
export type EntityPickerFieldValue = string;

/**
 * The props that are passed to the `EntityPicker` component.
 * @public
 */
export type EntityPickerProps = FieldProps<
  EntityPickerFieldValue,
  EntityPickerUiOptions,
  EntityPickerFieldProps
>;

/**
 * The schema for the `EntityPicker` field extension.
 * @public
 */
export const EntityPickerSchema = makeFieldSchemaFromZod(
  z.string(),
  z.object({
    allowArbitraryValues: z
      .boolean()
      .optional()
      .describe("Whether to allow arbitrary user input. Defaults to true."),
    catalogFilter: z
      .union([
        z.record(
          z.union([
            z.string(),
            z.array(z.string()),
            z.object({ exists: z.boolean() }),
          ])
        ),
        z.array(
          z.record(
            z.union([
              z.string(),
              z.array(z.string()),
              z.object({ exists: z.boolean() }),
            ])
          )
        ),
      ])
      .optional()
      .describe("The filter options to pass into the catalog-client"),
    defaultKind: z
      .string()
      .optional()
      .describe("The default kind to use (defaults to Component)"),
    defaultNamespace: z
      .string()
      .optional()
      .describe(
        "The namespace to default to if none is specified (defaults to default)"
      ),
  })
);

export const validateEntityPickerValidation = (
  value: string,
  validation: FieldValidation
) => {
  if (!value || value === "") {
    return;
  }

  try {
    parseEntityRef(value);
  } catch {
    validation.addError(`"${value}" is not a valid entity reference`);
  }
};
