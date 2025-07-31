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

import React, { useCallback, useEffect, forwardRef, useContext } from "react";
import {
  TextField,
  Autocomplete,
  createFilterOptions,
  ListSubheader,
  useMediaQuery,
  useTheme,
  Box,
  FormControl,
  FormHelperText,
  Typography,
} from "@mui/material";
import { AutocompleteChangeReason } from "@mui/material/Autocomplete";
import { VariableSizeList, ListChildComponentProps } from "react-window";
import useAsync from "react-use/esm/useAsync";
import { makeStyles } from "@mui/styles";
import { FieldProps, FieldValidation } from "@rjsf/utils";
import { z } from "zod";

// ==================== Types & Interfaces ====================

// Entity types (from @backstage/catalog-model)
export interface Entity {
  apiVersion: string;
  kind: string;
  metadata: {
    namespace?: string;
    name: string;
    title?: string;
    description?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    tags?: string[];
    uid?: string;
    etag?: string;
    generation?: number;
  };
  spec?: any;
  status?: any;
  relations?: Array<{
    type: string;
    targetRef: string;
  }>;
}

// From @backstage/catalog-client
export type EntityFilterQuery = {
  [key: string]: string | string[] | symbol | { exists: boolean };
};

export const CATALOG_FILTER_EXISTS = Symbol("CATALOG_FILTER_EXISTS");

// Entity ref presentation
export interface EntityRefPresentationSnapshot {
  entityRef: string;
  primaryTitle?: string;
  secondaryTitle?: string;
  description?: string;
}

// Schema types
export type EntityPickerFilterQueryValue =
  | string
  | string[]
  | { exists: boolean };

export type EntityPickerFilterQuery = {
  [key: string]: EntityPickerFilterQueryValue;
};

export interface EntityPickerUiOptions {
  allowArbitraryValues?: boolean;
  catalogFilter?: EntityPickerFilterQuery | EntityPickerFilterQuery[];
  allowedKinds?: string[];
  defaultKind?: string;
  defaultNamespace?: string;
}

export interface EntityPickerFieldProps {
  allowedKinds?: string[];
}

export type EntityPickerFieldValue = string;

export type EntityPickerProps = FieldProps<
  EntityPickerFieldValue,
  EntityPickerUiOptions,
  EntityPickerFieldProps
>;

// ==================== Entity Ref Functions ====================

export function parseEntityRef(
  entityRef: string,
  context?: { defaultKind?: string; defaultNamespace?: string }
): { kind: string; namespace: string; name: string } {
  const match = entityRef.match(/^(?:([^:]+):)?(?:([^/]+)\/)?(.+)$/);
  if (!match) {
    throw new Error(`Invalid entity reference: ${entityRef}`);
  }
  const [, kind, namespace, name] = match;
  return {
    kind: kind || context?.defaultKind || "Component",
    namespace: namespace || context?.defaultNamespace || "default",
    name,
  };
}

export function stringifyEntityRef(
  entity: Entity | { kind?: string; namespace?: string; name: string }
): string {
  let kind;
  let namespace;
  let name;

  if ("metadata" in entity) {
    kind = entity.kind;
    namespace = entity.metadata.namespace;
    name = entity.metadata.name;
  } else {
    kind = entity.kind;
    namespace = entity.namespace;
    name = entity.name;
  }

  return `${kind || "Component"}:${namespace || "default"}/${name}`;
}

// ==================== makeFieldSchemaFromZod ====================
export function makeFieldSchemaFromZod(
  fieldSchema: z.ZodSchema,
  uiOptionsSchema?: z.ZodSchema
) {
  return {
    schema: fieldSchema,
    uiSchema: uiOptionsSchema,
  };
}

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

// ==================== API Context ====================

// Simplified API context for standalone usage
const ApiContext = React.createContext<{
  catalogApi?: any;
  entityPresentationApi?: any;
  translationApi?: any;
}>({});

export const catalogApiRef = Symbol("catalogApiRef");
export const entityPresentationApiRef = Symbol("entityPresentationApiRef");
export const scaffolderTranslationRef = Symbol("scaffolderTranslationRef");

export function useApi(apiRef: symbol) {
  const apis = useContext(ApiContext);

  if (apiRef === catalogApiRef) {
    return (
      apis.catalogApi || {
        getEntities: async (request?: {
          filter?: EntityFilterQuery;
          fields?: string[];
        }) => {
          // This should be replaced with actual catalog API implementation
          console.warn(
            "Using mock catalog API - replace with actual implementation"
          );
          return { items: [] };
        },
      }
    );
  }

  if (apiRef === entityPresentationApiRef) {
    return (
      apis.entityPresentationApi || {
        forEntity: (entity: Entity) => ({
          promise: Promise.resolve({
            entityRef: stringifyEntityRef(entity),
            primaryTitle: entity.metadata.title || entity.metadata.name,
            secondaryTitle: `${entity.kind} | ${
              entity.metadata.namespace || "default"
            }`,
            description: entity.metadata.description,
          } as EntityRefPresentationSnapshot),
        }),
      }
    );
  }

  return null;
}

export function useTranslationRef(ref: symbol) {
  const translations: Record<string, string> = {
    "fields.entityPicker.title": "Entity",
    "fields.entityPicker.description": "Select an entity",
  };

  return {
    t: (key: string) => translations[key] || key,
  };
}

// ==================== EntityDisplayName Component ====================

export const EntityDisplayName: React.FC<{ entityRef: Entity | string }> = ({
  entityRef,
}) => {
  const entityPresentationApi = useApi(entityPresentationApiRef);
  const [presentation, setPresentation] =
    React.useState<EntityRefPresentationSnapshot | null>(null);

  React.useEffect(() => {
    if (typeof entityRef === "string") {
      setPresentation({
        entityRef,
        primaryTitle: entityRef,
      });
    } else {
      entityPresentationApi.forEntity(entityRef).promise.then(setPresentation);
    }
  }, [entityRef, entityPresentationApi]);

  if (!presentation) {
    return (
      <span>
        {typeof entityRef === "string"
          ? entityRef
          : stringifyEntityRef(entityRef)}
      </span>
    );
  }

  return (
    <Box>
      <Typography component="span">{presentation.primaryTitle}</Typography>
      {presentation.secondaryTitle && (
        <Typography
          component="span"
          variant="caption"
          sx={{ ml: 1, color: "text.secondary" }}
        >
          {presentation.secondaryTitle}
        </Typography>
      )}
    </Box>
  );
};

// ==================== VirtualizedListbox Component ====================
const LISTBOX_PADDING = 8;

function renderRow(props: ListChildComponentProps) {
  const { data, index, style } = props;
  const dataSet = data[index];
  const inlineStyle = {
    ...style,
    top: (style.top as number) + LISTBOX_PADDING,
  };

  if ("group" in dataSet) {
    return (
      <ListSubheader key={dataSet.key} component="div" style={inlineStyle}>
        {dataSet.group}
      </ListSubheader>
    );
  }

  return React.cloneElement(dataSet, {
    style: inlineStyle,
  });
}

const OuterElementContext = React.createContext({});

const OuterElementType = forwardRef<HTMLDivElement>((props, ref) => {
  const outerProps = useContext(OuterElementContext);
  return <div ref={ref} {...props} {...outerProps} />;
});

function useResetCache(data: any) {
  const ref = React.useRef<VariableSizeList>(null);
  React.useEffect(() => {
    if (ref.current != null) {
      ref.current.resetAfterIndex(0, true);
    }
  }, [data]);
  return ref;
}

export const VirtualizedListbox = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLElement>
>(function VirtualizedListbox(props, ref) {
  const { children, ...other } = props;
  const itemData = React.Children.toArray(children);
  const theme = useTheme();
  const smUp = useMediaQuery(theme.breakpoints.up("sm"), {
    noSsr: true,
  });
  const itemCount = itemData.length;
  const itemSize = smUp ? 36 : 48;

  const getChildSize = (child: React.ReactNode) => {
    if (React.isValidElement(child) && child.type === ListSubheader) {
      return 48;
    }
    return itemSize;
  };

  const getHeight = () => {
    if (itemCount > 8) {
      return 8 * itemSize;
    }
    return itemData.map(getChildSize).reduce((a, b) => a + b, 0);
  };

  const gridRef = useResetCache(itemCount);

  return (
    <div ref={ref}>
      <OuterElementContext.Provider value={other}>
        <VariableSizeList
          itemData={itemData}
          height={getHeight() + 2 * LISTBOX_PADDING}
          width="100%"
          ref={gridRef}
          outerElementType={OuterElementType}
          innerElementType="ul"
          itemSize={(index) => getChildSize(itemData[index])}
          overscanCount={5}
          itemCount={itemCount}
        >
          {renderRow}
        </VariableSizeList>
      </OuterElementContext.Provider>
    </div>
  );
});

// ==================== ScaffolderField Component ====================
const useStyles = makeStyles((theme: any) => ({
  markdownDescription: {
    fontSize: theme.typography.caption.fontSize,
    margin: 0,
    color: theme.palette.text.secondary,
    "& :first-child": {
      margin: 0,
      marginTop: "3px",
    },
  },
}));

interface ScaffolderFieldProps {
  rawDescription?: string;
  errors?: React.ReactElement;
  rawErrors?: string[];
  help?: React.ReactElement;
  rawHelp?: string;
  required?: boolean;
  disabled?: boolean;
  displayLabel?: boolean;
  children: React.ReactNode;
}

const MarkdownContent: React.FC<{ content: string; className?: string }> = ({
  content,
  className,
}) => {
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: content }} />
  );
};

export const ScaffolderField: React.FC<ScaffolderFieldProps> = (props) => {
  const {
    children,
    rawErrors,
    rawDescription,
    errors,
    rawHelp,
    help,
    disabled,
    displayLabel = true,
  } = props;
  const classes = useStyles();

  const showDescription = !!(rawDescription && displayLabel);

  return (
    <FormControl
      fullWidth
      error={!!rawErrors?.length || !!errors}
      disabled={disabled}
      margin="normal"
    >
      {children}
      {showDescription && (
        <MarkdownContent
          content={rawDescription!}
          className={classes.markdownDescription}
        />
      )}
      {(rawHelp || help) && (
        <FormHelperText>
          {!rawHelp && help}
          {!!rawHelp && (
            <MarkdownContent
              content={rawHelp}
              className={classes.markdownDescription}
            />
          )}
        </FormHelperText>
      )}
      {(rawErrors || errors) && (
        <FormHelperText error>
          {!rawErrors && errors}
          {!!rawErrors && (
            <>
              {rawErrors.map((error, i) => (
                <span key={i}>{error}</span>
              ))}
            </>
          )}
        </FormHelperText>
      )}
    </FormControl>
  );
};

// ==================== Helper Functions ====================

function convertOpsValues(
  value: Exclude<EntityPickerFilterQueryValue, Array<any>>
): string | symbol {
  if (typeof value === "object" && value.exists) {
    return CATALOG_FILTER_EXISTS;
  }
  return value?.toString();
}

function convertSchemaFiltersToQuery(
  schemaFilters: EntityPickerFilterQuery
): Exclude<EntityFilterQuery, Array<any>> {
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

function buildCatalogFilter(
  uiSchema: EntityPickerProps["uiSchema"]
): EntityFilterQuery | undefined {
  const allowedKinds = uiSchema?.["ui:options"]?.allowedKinds;

  const catalogFilter: EntityPickerUiOptions["catalogFilter"] | undefined =
    uiSchema?.["ui:options"]?.catalogFilter ||
    (allowedKinds && { kind: allowedKinds });

  if (!catalogFilter) {
    return undefined;
  }

  if (Array.isArray(catalogFilter)) {
    return catalogFilter.map(convertSchemaFiltersToQuery) as any;
  }

  return convertSchemaFiltersToQuery(catalogFilter);
}

// ==================== EntityPicker Component ====================

export const EntityPicker = (props: EntityPickerProps) => {
  const { t } = useTranslationRef(scaffolderTranslationRef);
  const {
    onChange,
    schema: {
      title = t("fields.entityPicker.title"),
      description = t("fields.entityPicker.description"),
    },
    required,
    uiSchema,
    rawErrors,
    formData,
    idSchema,
    errors,
  } = props;
  const catalogFilter = buildCatalogFilter(uiSchema);
  const defaultKind = uiSchema?.["ui:options"]?.defaultKind;
  const defaultNamespace =
    uiSchema?.["ui:options"]?.defaultNamespace || undefined;
  const isDisabled = uiSchema?.["ui:disabled"] ?? false;

  const catalogApi = useApi(catalogApiRef);
  const entityPresentationApi = useApi(entityPresentationApiRef);

  const { value: entities, loading } = useAsync(async () => {
    const fields = [
      "kind",
      "metadata.name",
      "metadata.namespace",
      "metadata.title",
      "metadata.description",
      "spec.profile.displayName",
      "spec.type",
    ];
    const { items } = await catalogApi.getEntities(
      catalogFilter
        ? { filter: catalogFilter, fields }
        : { filter: undefined, fields }
    );

    const entityRefToPresentation = new Map<
      string,
      EntityRefPresentationSnapshot
    >(
      await Promise.all(
        items.map(async (item) => {
          const presentation = await entityPresentationApi.forEntity(item)
            .promise;
          return [stringifyEntityRef(item), presentation] as [
            string,
            EntityRefPresentationSnapshot
          ];
        })
      )
    );

    return { catalogEntities: items, entityRefToPresentation };
  });

  const allowArbitraryValues =
    uiSchema?.["ui:options"]?.allowArbitraryValues ?? true;

  const getLabel = useCallback(
    (freeSoloValue: string) => {
      try {
        const parsedRef = parseEntityRef(freeSoloValue, {
          defaultKind,
          defaultNamespace,
        });

        return stringifyEntityRef(parsedRef);
      } catch (err) {
        return freeSoloValue;
      }
    },
    [defaultKind, defaultNamespace]
  );

  const onSelect = useCallback(
    (_: any, ref: string | Entity | null, reason: AutocompleteChangeReason) => {
      if (typeof ref !== "string") {
        onChange(ref ? stringifyEntityRef(ref as Entity) : undefined);
      } else {
        if (reason === "blur" || reason === "create-option") {
          let entityRef = ref;
          try {
            entityRef = stringifyEntityRef(
              parseEntityRef(ref as string, {
                defaultKind,
                defaultNamespace,
              })
            );
          } catch (err) {
            // If the passed in value isn't an entity ref, do nothing.
          }
          if (formData !== ref || allowArbitraryValues) {
            onChange(entityRef);
          }
        }
      }
    },
    [onChange, formData, defaultKind, defaultNamespace, allowArbitraryValues]
  );

  const selectedEntity =
    entities?.catalogEntities.find((e) => stringifyEntityRef(e) === formData) ??
    (allowArbitraryValues && formData ? getLabel(formData) : "");

  useEffect(() => {
    if (
      required &&
      !allowArbitraryValues &&
      entities?.catalogEntities.length === 1 &&
      selectedEntity === ""
    ) {
      onChange(stringifyEntityRef(entities.catalogEntities[0]));
    }
  }, [entities, onChange, selectedEntity, required, allowArbitraryValues]);

  return (
    <ScaffolderField
      rawErrors={rawErrors}
      rawDescription={uiSchema?.["ui:description"] ?? description}
      required={required}
      disabled={isDisabled}
      errors={errors}
    >
      <Autocomplete
        disabled={
          isDisabled ||
          (required &&
            !allowArbitraryValues &&
            entities?.catalogEntities.length === 1)
        }
        id={idSchema?.$id}
        value={selectedEntity}
        loading={loading}
        onChange={onSelect}
        options={entities?.catalogEntities || []}
        getOptionLabel={(option) =>
          typeof option === "string"
            ? option
            : entities?.entityRefToPresentation.get(stringifyEntityRef(option))
                ?.entityRef!
        }
        autoSelect
        freeSolo={allowArbitraryValues}
        renderInput={(params) => (
          <TextField
            {...params}
            label={title}
            margin="dense"
            variant="outlined"
            required={required}
            disabled={isDisabled}
            InputProps={params.InputProps}
          />
        )}
        renderOption={(props, option) => (
          <li {...props}>
            <EntityDisplayName entityRef={option} />
          </li>
        )}
        filterOptions={createFilterOptions<Entity>({
          stringify: (option) =>
            entities?.entityRefToPresentation.get(stringifyEntityRef(option))
              ?.primaryTitle!,
        })}
        ListboxComponent={VirtualizedListbox as any}
      />
    </ScaffolderField>
  );
};

// Export enhanced version
export const EnhancedEntityPicker = EntityPicker;

// ==================== API Provider Component ====================
export const EntityPickerApiProvider: React.FC<{
  children: React.ReactNode;
  catalogApi: any;
  entityPresentationApi?: any;
}> = ({ children, catalogApi, entityPresentationApi }) => {
  return (
    <ApiContext.Provider value={{ catalogApi, entityPresentationApi }}>
      {children}
    </ApiContext.Provider>
  );
};
