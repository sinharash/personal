Okay, this is a fantastic set of requirements that will make your EnhancedEntityPicker much more powerful and developer-friendly! You want developers to define a template string for how entity options are displayed, see that exact formatted string on the review page, and still have control over sending the underlying entity reference (or other parts of the entity) to backend steps.

This makes perfect sense. We can achieve this by making your EnhancedEntityPicker manage an object as its formData rather than just a string. This object can hold both the display string and the necessary reference.

Here's the plan:

1. Modify Template YAML to Use an Object Parameter
Your secondaryOwner parameter will change from type: string to type: object.

# Notice the v1beta3 version
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
# some metadata about the template itself
metadata:
  name: create-workspace
  title: Test Action template
  description: scaffolder v1beta3 template demo
spec:
  owner: backstage/techdocs-core
  type: service

  # these are the steps which are rendered in the frontend with the form input
  parameters:
    - title: workspace information
      required:
        - secondaryOwner # This now refers to the object
      properties:
        secondaryOwner:
          title: Secondary Owner
          type: object # <-- CHANGED: Parameter is now an object
          description: please choose secondary owner
          ui:field: EnhancedEntityPicker
          ui:options:
            # Renamed for clarity, this is your template string
            displayFormat: "${spec.profile.displayName} (${metadata.name})" # <-- EXAMPLE TEMPLATE
            catalogFilter:
              - kind: User
          # Properties of the object our picker will manage
          # These aren't directly filled by the user but by the picker's logic
          # They also help define the schema for the review step.
          properties:
            displayValue: # Stores the formatted string for display and review
              type: string
            entityRef: # Stores the actual entity reference
              type: string
            # You could add more here if needed, e.g., specific entity fields
            # selectedName: { type: string }

  # here's the steps that are executed in series in the scaffolder backend
  steps:
    - id: log-current-selection
      name: Log Selected Owner Data
      action: debug:log # This helps you see what's being sent
      input:
        message: "Secondary Owner Parameter Object: ${{ parameters.secondaryOwner }}"
        # You can access parts of it:
        # displayString: ${{ parameters.secondaryOwner.displayValue }}
        # actualRef: ${{ parameters.secondaryOwner.entityRef }}

    - id: fetch-user
      name: Fetch User Entity
      action: catalog:fetch
      input:
        entityRef: ${{ parameters.secondaryOwner.entityRef }} # <-- USING THE .entityRef PART

        Okay, this is a fantastic set of requirements that will make your EnhancedEntityPicker much more powerful and developer-friendly! You want developers to define a template string for how entity options are displayed, see that exact formatted string on the review page, and still have control over sending the underlying entity reference (or other parts of the entity) to backend steps.

This makes perfect sense. We can achieve this by making your EnhancedEntityPicker manage an object as its formData rather than just a string. This object can hold both the display string and the necessary reference.

Here's the plan:

1. Modify Template YAML to Use an Object Parameter
Your secondaryOwner parameter will change from type: string to type: object.

YAML

# Notice the v1beta3 version
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
# some metadata about the template itself
metadata:
  name: create-workspace
  title: Test Action template
  description: scaffolder v1beta3 template demo
spec:
  owner: backstage/techdocs-core
  type: service

  # these are the steps which are rendered in the frontend with the form input
  parameters:
    - title: workspace information
      required:
        - secondaryOwner # This now refers to the object
      properties:
        secondaryOwner:
          title: Secondary Owner
          type: object # <-- CHANGED: Parameter is now an object
          description: please choose secondary owner
          ui:field: EnhancedEntityPicker
          ui:options:
            # Renamed for clarity, this is your template string
            displayFormat: "${spec.profile.displayName} (${metadata.name})" # <-- EXAMPLE TEMPLATE
            catalogFilter:
              - kind: User
          # Properties of the object our picker will manage
          # These aren't directly filled by the user but by the picker's logic
          # They also help define the schema for the review step.
          properties:
            displayValue: # Stores the formatted string for display and review
              type: string
            entityRef: # Stores the actual entity reference
              type: string
            # You could add more here if needed, e.g., specific entity fields
            # selectedName: { type: string }

  # here's the steps that are executed in series in the scaffolder backend
  steps:
    - id: log-current-selection
      name: Log Selected Owner Data
      action: debug:log # This helps you see what's being sent
      input:
        message: "Secondary Owner Parameter Object: ${{ parameters.secondaryOwner }}"
        # You can access parts of it:
        # displayString: ${{ parameters.secondaryOwner.displayValue }}
        # actualRef: ${{ parameters.secondaryOwner.entityRef }}

    - id: fetch-user
      name: Fetch User Entity
      action: catalog:fetch
      input:
        entityRef: ${{ parameters.secondaryOwner.entityRef }} # <-- USING THE .entityRef PART
Key YAML Changes:

secondaryOwner.type is now object.
secondaryOwner.properties defines the sub-fields (displayValue, entityRef) that your EnhancedEntityPicker will populate.
ui:options.displayEntityField is renamed to displayFormat to better reflect it's a template.
The catalog:fetch step now uses ${{ parameters.secondaryOwner.entityRef }}.
A debug:log step is added to show you the content of parameters.secondaryOwner during execution.

Update EnhancedEntityPicker.tsx
Now, let's modify your React component:

a. Update CustomEntityPickerUiOptions:

export interface CustomEntityPickerUiOptions extends StandardEntityPickerUiOptions {
    /**
     * A template string to format the display of the entity.
     * Placeholders like ${path.to.field} will be replaced with entity values.
     * Example: "${spec.profile.displayName} (${metadata.name})"
     */
    displayFormat?: string; // Renamed from displayEntityField
    // secondaryDisplayEntityField is already removed as per your request
  }

  Create a Robust formatEntityDisplay Helper:
This function will parse your template string.

// Helper to format entity display using a template string
const formatEntityDisplay = (
    entity: Entity | undefined, // Entity can be undefined if no selection or arbitrary value
    templateString: string | undefined,
    defaultText: string // Fallback text if entity or template is missing, or for arbitrary strings
  ): string => {
    if (typeof entity === 'string') { // Handle arbitrary string values directly
      return entity;
    }
    if (!entity || !templateString) {
      return defaultText;
    }
  
    let result = templateString;
    // Regex to find all placeholders like ${path.to.field} or ${metadata.annotations['anno.key']}
    const placeholders = templateString.match(/\$\{(.+?)\}/g);
  
    if (placeholders) {
      for (const placeholder of placeholders) {
        // Extracts 'path.to.field' from '${path.to.field}'
        const path = placeholder.substring(2, placeholder.length - 1);
        const value = get(entity, path); // Safely get the value using lodash's get
  
        // Replace placeholder with its value, or an empty string if value is null/undefined
        result = result.replace(placeholder, value !== undefined && value !== null ? String(value) : '');
      }
    }
    return result.trim() || defaultText; // Trim and provide fallback if result is empty
  };

  Modify the Main EnhancedEntityPicker Component:
  The FieldExtensionComponentProps and formData will now handle an object.
  
// Define the shape of the object this component will manage for its formData
interface EnhancedPickerFormObject {
    displayValue?: string;
    entityRef?: string;
    // You could add other extracted fields here if needed
    // arbitraryValue?: string; // If you need to distinguish selected entity from arbitrary
  }
  
  export const EnhancedEntityPicker: React.FC<
    FieldExtensionComponentProps<EnhancedPickerFormObject | undefined, CustomEntityPickerUiOptions>
  > = (props) => {
    const {
      schema, // schema for the object parameter itself
      uiSchema,
      formData, // Will be an object like { displayValue: "...", entityRef: "..." } or undefined
      onChange,
      rawErrors,
      required,
      disabled,
    } = props;
  
    // ... (useState for inputValue, fetchedEntities, loading, error remains the same)
    // ... (catalogApi remains the same)
  
    const {
      catalogFilter,
      allowedKinds = (schema.properties?.entityRef as any)?.allowedKinds as string[] | undefined, // Try to get from sub-schema if defined
      defaultKind = options?.defaultKind || "Component",
      allowArbitraryValues = options?.allowArbitraryValues || false,
      // Use 'displayFormat' from ui:options, provide a default simple template
      displayFormat = options?.displayFormat || "${metadata.name}",
    } = options || {};
  
    // ... (useEffect for fetching entities remains largely the same)
    // Dependency array: [catalogFilter, allowedKinds, defaultKind]
  
    // Find the selected entity object based on formData.entityRef
    const selectedEntity = useMemo(() => {
      if (!formData?.entityRef) return null;
      try {
        const searchRef = parseEntityRef(formData.entityRef);
        return (
          fetchedEntities.find(
            (entity) =>
              entity.kind.toLowerCase() === searchRef.kind.toLowerCase() &&
              entity.metadata.name.toLowerCase() === searchRef.name.toLowerCase() &&
              (searchRef.namespace?.toLowerCase() || "default") ===
                (entity.metadata.namespace?.toLowerCase() || "default")
          ) || null
        );
      } catch {
        return null;
      }
    }, [formData?.entityRef, fetchedEntities]);
  
    const handleAutocompleteChange = (
      _event: React.ChangeEvent<{}>,
      value: Entity | string | null // Value from Autocomplete can be Entity object or arbitrary string
    ) => {
      if (typeof value === "string") { // Arbitrary value selected/entered
        if (allowArbitraryValues) {
          // For arbitrary values, the displayValue is the value itself, entityRef is undefined
          onChange({ displayValue: value, entityRef: undefined });
        } else {
          onChange(undefined); // Or handle as an invalid selection if arbitrary not allowed
        }
      } else if (value) { // Entity object selected
        const entityRef = stringifyEntityRef(value);
        const displayValue = formatEntityDisplay(value, displayFormat, humanizeEntityRef(value));
        onChange({ displayValue, entityRef });
      } else { // Cleared
        onChange(undefined); // Or onChange({ displayValue: undefined, entityRef: undefined });
      }
    };
  
    const getOptionLabel = (option: Entity | string): string => {
      // This function is crucial for what Autocomplete displays in the input field
      // once an item is selected, and as the default text in the dropdown if no renderOption.
      if (typeof option === 'string') {
          return option; // For arbitrary strings
      }
      // For entity objects, always use the displayFormat
      return formatEntityDisplay(option, displayFormat, humanizeEntityRef(option));
    };
  
    const renderOption = (
      liProps: React.HTMLAttributes<HTMLLIElement>, // MUI v5 passes props for the <li> first
      option: Entity | string
    ) => {
      // `option` here is an item from the `fetchedEntities` list or an arbitrary string
      const displayString = formatEntityDisplay(option, displayFormat, typeof option === 'string' ? option : humanizeEntityRef(option));
  
      return (
        <li {...liProps}>
          <Box> {/* Or any other structure you prefer */}
            <Typography variant="body1">{displayString}</Typography>
          </Box>
        </li>
      );
    };
  
    // Determine the value for Autocomplete:
    // It should be the Entity object if a ref is selected and found,
    // or the arbitrary string if that's the case.
    const autocompleteValue = useMemo(() => {
      if (selectedEntity) {
        return selectedEntity;
      }
      if (allowArbitraryValues && formData?.displayValue && !formData.entityRef) {
        // If it's an arbitrary value stored
        return formData.displayValue;
      }
      return null; // Default to null if nothing is appropriately selected/set
    }, [selectedEntity, formData, allowArbitraryValues]);
  
  
    return (
      <Autocomplete
        fullWidth
        value={autocompleteValue} // This should be an Entity object, a string (for arbitrary), or null
        inputValue={inputValue}
        onInputChange={(_event, newInputValue) => {
          setInputValue(newInputValue);
        }}
        onChange={handleAutocompleteChange}
        options={fetchedEntities} // Keep options simple, freeSolo handles arbitrary values
        getOptionLabel={getOptionLabel} // Crucial for display in input and for filtering
        renderOption={renderOption} // For custom rendering in the dropdown
        loading={loading}
        disabled={disabled}
        freeSolo={allowArbitraryValues}
        isOptionEqualToValue={(option, val) => {
          // `option` is from `fetchedEntities` (Entity) or an arbitrary string from input
          // `val` is the current `autocompleteValue` (Entity, string, or null)
          if (typeof option === 'string' && typeof val === 'string') return option === val;
          if (option && val && typeof option !== 'string' && typeof val !== 'string') {
            // Both are Entity objects (or should be if val is not null)
            return stringifyEntityRef(option as Entity) === stringifyEntityRef(val as Entity);
          }
          return false;
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            // The main label comes from the object parameter's title
            label={uiSchema['ui:title'] || schema.title || "Select Entity"}
            margin="normal"
            required={required}
            error={rawErrors && rawErrors.length > 0 && !!rawErrors[0]} // Check if rawErrors[0] has content
            // Helper text should ideally point to errors on sub-properties if any,
            // or general field description. RJSF handles this if schema is well-defined.
            helperText={
              (rawErrors && rawErrors[0]) || // This might be an object error
              uiSchema['ui:description'] || schema.description ||
              (error && `Error loading entities: ${error.message}`)
            }
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress color="inherit" size={20} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
    );
  };
  Okay, this is a fantastic set of requirements that will make your EnhancedEntityPicker much more powerful and developer-friendly! You want developers to define a template string for how entity options are displayed, see that exact formatted string on the review page, and still have control over sending the underlying entity reference (or other parts of the entity) to backend steps.

This makes perfect sense. We can achieve this by making your EnhancedEntityPicker manage an object as its formData rather than just a string. This object can hold both the display string and the necessary reference.

Here's the plan:

1. Modify Template YAML to Use an Object Parameter
Your secondaryOwner parameter will change from type: string to type: object.

YAML

# Notice the v1beta3 version
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
# some metadata about the template itself
metadata:
  name: create-workspace
  title: Test Action template
  description: scaffolder v1beta3 template demo
spec:
  owner: backstage/techdocs-core
  type: service

  # these are the steps which are rendered in the frontend with the form input
  parameters:
    - title: workspace information
      required:
        - secondaryOwner # This now refers to the object
      properties:
        secondaryOwner:
          title: Secondary Owner
          type: object # <-- CHANGED: Parameter is now an object
          description: please choose secondary owner
          ui:field: EnhancedEntityPicker
          ui:options:
            # Renamed for clarity, this is your template string
            displayFormat: "${spec.profile.displayName} (${metadata.name})" # <-- EXAMPLE TEMPLATE
            catalogFilter:
              - kind: User
          # Properties of the object our picker will manage
          # These aren't directly filled by the user but by the picker's logic
          # They also help define the schema for the review step.
          properties:
            displayValue: # Stores the formatted string for display and review
              type: string
            entityRef: # Stores the actual entity reference
              type: string
            # You could add more here if needed, e.g., specific entity fields
            # selectedName: { type: string }

  # here's the steps that are executed in series in the scaffolder backend
  steps:
    - id: log-current-selection
      name: Log Selected Owner Data
      action: debug:log # This helps you see what's being sent
      input:
        message: "Secondary Owner Parameter Object: ${{ parameters.secondaryOwner }}"
        # You can access parts of it:
        # displayString: ${{ parameters.secondaryOwner.displayValue }}
        # actualRef: ${{ parameters.secondaryOwner.entityRef }}

    - id: fetch-user
      name: Fetch User Entity
      action: catalog:fetch
      input:
        entityRef: ${{ parameters.secondaryOwner.entityRef }} # <-- USING THE .entityRef PART
Key YAML Changes:

secondaryOwner.type is now object.
secondaryOwner.properties defines the sub-fields (displayValue, entityRef) that your EnhancedEntityPicker will populate.
ui:options.displayEntityField is renamed to displayFormat to better reflect it's a template.
The catalog:fetch step now uses ${{ parameters.secondaryOwner.entityRef }}.
A debug:log step is added to show you the content of parameters.secondaryOwner during execution.
2. Update EnhancedEntityPicker.tsx
Now, let's modify your React component:

a. Update CustomEntityPickerUiOptions:

TypeScript

export interface CustomEntityPickerUiOptions extends StandardEntityPickerUiOptions {
  /**
   * A template string to format the display of the entity.
   * Placeholders like ${path.to.field} will be replaced with entity values.
   * Example: "${spec.profile.displayName} (${metadata.name})"
   */
  displayFormat?: string; // Renamed from displayEntityField
  // secondaryDisplayEntityField is already removed as per your request
}
b. Create a Robust formatEntityDisplay Helper:
This function will parse your template string.

TypeScript

// Helper to format entity display using a template string
const formatEntityDisplay = (
  entity: Entity | undefined, // Entity can be undefined if no selection or arbitrary value
  templateString: string | undefined,
  defaultText: string // Fallback text if entity or template is missing, or for arbitrary strings
): string => {
  if (typeof entity === 'string') { // Handle arbitrary string values directly
    return entity;
  }
  if (!entity || !templateString) {
    return defaultText;
  }

  let result = templateString;
  // Regex to find all placeholders like ${path.to.field} or ${metadata.annotations['anno.key']}
  const placeholders = templateString.match(/\$\{(.+?)\}/g);

  if (placeholders) {
    for (const placeholder of placeholders) {
      // Extracts 'path.to.field' from '${path.to.field}'
      const path = placeholder.substring(2, placeholder.length - 1);
      const value = get(entity, path); // Safely get the value using lodash's get

      // Replace placeholder with its value, or an empty string if value is null/undefined
      result = result.replace(placeholder, value !== undefined && value !== null ? String(value) : '');
    }
  }
  return result.trim() || defaultText; // Trim and provide fallback if result is empty
};
c. Modify the Main EnhancedEntityPicker Component:
The FieldExtensionComponentProps and formData will now handle an object.

TypeScript

// Define the shape of the object this component will manage for its formData
interface EnhancedPickerFormObject {
  displayValue?: string;
  entityRef?: string;
  // You could add other extracted fields here if needed
  // arbitraryValue?: string; // If you need to distinguish selected entity from arbitrary
}

export const EnhancedEntityPicker: React.FC<
  FieldExtensionComponentProps<EnhancedPickerFormObject | undefined, CustomEntityPickerUiOptions>
> = (props) => {
  const {
    schema, // schema for the object parameter itself
    uiSchema,
    formData, // Will be an object like { displayValue: "...", entityRef: "..." } or undefined
    onChange,
    rawErrors,
    required,
    disabled,
  } = props;

  // ... (useState for inputValue, fetchedEntities, loading, error remains the same)
  // ... (catalogApi remains the same)

  const {
    catalogFilter,
    allowedKinds = (schema.properties?.entityRef as any)?.allowedKinds as string[] | undefined, // Try to get from sub-schema if defined
    defaultKind = options?.defaultKind || "Component",
    allowArbitraryValues = options?.allowArbitraryValues || false,
    // Use 'displayFormat' from ui:options, provide a default simple template
    displayFormat = options?.displayFormat || "${metadata.name}",
  } = options || {};

  // ... (useEffect for fetching entities remains largely the same)
  // Dependency array: [catalogFilter, allowedKinds, defaultKind]

  // Find the selected entity object based on formData.entityRef
  const selectedEntity = useMemo(() => {
    if (!formData?.entityRef) return null;
    try {
      const searchRef = parseEntityRef(formData.entityRef);
      return (
        fetchedEntities.find(
          (entity) =>
            entity.kind.toLowerCase() === searchRef.kind.toLowerCase() &&
            entity.metadata.name.toLowerCase() === searchRef.name.toLowerCase() &&
            (searchRef.namespace?.toLowerCase() || "default") ===
              (entity.metadata.namespace?.toLowerCase() || "default")
        ) || null
      );
    } catch {
      return null;
    }
  }, [formData?.entityRef, fetchedEntities]);

  const handleAutocompleteChange = (
    _event: React.ChangeEvent<{}>,
    value: Entity | string | null // Value from Autocomplete can be Entity object or arbitrary string
  ) => {
    if (typeof value === "string") { // Arbitrary value selected/entered
      if (allowArbitraryValues) {
        // For arbitrary values, the displayValue is the value itself, entityRef is undefined
        onChange({ displayValue: value, entityRef: undefined });
      } else {
        onChange(undefined); // Or handle as an invalid selection if arbitrary not allowed
      }
    } else if (value) { // Entity object selected
      const entityRef = stringifyEntityRef(value);
      const displayValue = formatEntityDisplay(value, displayFormat, humanizeEntityRef(value));
      onChange({ displayValue, entityRef });
    } else { // Cleared
      onChange(undefined); // Or onChange({ displayValue: undefined, entityRef: undefined });
    }
  };

  const getOptionLabel = (option: Entity | string): string => {
    // This function is crucial for what Autocomplete displays in the input field
    // once an item is selected, and as the default text in the dropdown if no renderOption.
    if (typeof option === 'string') {
        return option; // For arbitrary strings
    }
    // For entity objects, always use the displayFormat
    return formatEntityDisplay(option, displayFormat, humanizeEntityRef(option));
  };

  const renderOption = (
    liProps: React.HTMLAttributes<HTMLLIElement>, // MUI v5 passes props for the <li> first
    option: Entity | string
  ) => {
    // `option` here is an item from the `fetchedEntities` list or an arbitrary string
    const displayString = formatEntityDisplay(option, displayFormat, typeof option === 'string' ? option : humanizeEntityRef(option));

    return (
      <li {...liProps}>
        <Box> {/* Or any other structure you prefer */}
          <Typography variant="body1">{displayString}</Typography>
        </Box>
      </li>
    );
  };

  // Determine the value for Autocomplete:
  // It should be the Entity object if a ref is selected and found,
  // or the arbitrary string if that's the case.
  const autocompleteValue = useMemo(() => {
    if (selectedEntity) {
      return selectedEntity;
    }
    if (allowArbitraryValues && formData?.displayValue && !formData.entityRef) {
      // If it's an arbitrary value stored
      return formData.displayValue;
    }
    return null; // Default to null if nothing is appropriately selected/set
  }, [selectedEntity, formData, allowArbitraryValues]);


  return (
    <Autocomplete
      fullWidth
      value={autocompleteValue} // This should be an Entity object, a string (for arbitrary), or null
      inputValue={inputValue}
      onInputChange={(_event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      onChange={handleAutocompleteChange}
      options={fetchedEntities} // Keep options simple, freeSolo handles arbitrary values
      getOptionLabel={getOptionLabel} // Crucial for display in input and for filtering
      renderOption={renderOption} // For custom rendering in the dropdown
      loading={loading}
      disabled={disabled}
      freeSolo={allowArbitraryValues}
      isOptionEqualToValue={(option, val) => {
        // `option` is from `fetchedEntities` (Entity) or an arbitrary string from input
        // `val` is the current `autocompleteValue` (Entity, string, or null)
        if (typeof option === 'string' && typeof val === 'string') return option === val;
        if (option && val && typeof option !== 'string' && typeof val !== 'string') {
          // Both are Entity objects (or should be if val is not null)
          return stringifyEntityRef(option as Entity) === stringifyEntityRef(val as Entity);
        }
        return false;
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          // The main label comes from the object parameter's title
          label={uiSchema['ui:title'] || schema.title || "Select Entity"}
          margin="normal"
          required={required}
          error={rawErrors && rawErrors.length > 0 && !!rawErrors[0]} // Check if rawErrors[0] has content
          // Helper text should ideally point to errors on sub-properties if any,
          // or general field description. RJSF handles this if schema is well-defined.
          helperText={
            (rawErrors && rawErrors[0]) || // This might be an object error
            uiSchema['ui:description'] || schema.description ||
            (error && `Error loading entities: ${error.message}`)
          }
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};
Explanation of Key Changes in the Component:

EnhancedPickerFormObject: Defines the structure of the object your component will handle ({ displayValue?: string, entityRef?: string }).
FieldExtensionComponentProps: Now typed with this object.
formData: Will be an instance of EnhancedPickerFormObject or undefined.
displayFormat ui:option: Used instead of displayEntityField.
formatEntityDisplay function: This new helper parses your template string (e.g., ${spec.profile.displayName} (${metadata.name})) and populates it with data from the entity.

handleAutocompleteChange:
When an Entity is selected, it now calls onChange with an object: { displayValue: /*formatted string*/, entityRef: /*entity ref string*/ }.
For arbitrary string values (if allowArbitraryValues is true), it calls onChange with { displayValue: /*the string*/, entityRef: undefined }.
getOptionLabel: Crucially, this now always uses formatEntityDisplay for entity objects. This ensures that when an option is selected, the Autocomplete input field displays your nicely formatted string. It also helps Autocomplete with its internal filtering if the user types.
renderOption: Also uses formatEntityDisplay to render items in the dropdown list, ensuring consistency.
selectedEntity: Now derived from formData?.entityRef.
autocompleteValue: This new memoized value determines what's passed to Autocomplete's value prop. It's either the selectedEntity object (if an entity is chosen) or the arbitrary displayValue string (if allowArbitraryValues is true and an arbitrary value is in formData). This mapping is important because Autocomplete works best when its value prop is one of the objects from its options list, or a primitive if freeSolo is used with string options.
isOptionEqualToValue: Updated to correctly compare entity objects (based on their refs) or strings.
renderInput label and helperText: Now uses uiSchema['ui:title'] and uiSchema['ui:description'] which are standard for RJSF fields, falling back to schema.title or schema.description. This is good practice when your ui:field is attached to an object.

How this achieves your goals:

Templated Display String: The displayFormat option and formatEntityDisplay function give developers full control over the display using template strings like ${spec.profile.displayName} (${metadata.name}).
WYSIWYG on Review:
Because onChange now sets formData to an object like { displayValue: "Formatted Name (id)", entityRef: "user:default/id" }, the displayValue field will contain the formatted string.
The Scaffolder's review step, when rendering an object parameter, will typically show its properties. So, users will see displayValue: "Formatted Name (id)" and entityRef: "user:default/id". This gives them the formatted string for review.

The Autocomplete input field itself will also show this formatted string thanks to the updated getOptionLabel and autocompleteValue logic.
Control Over Submitted Value & Seeing Output:
The parameters.secondaryOwner in your template steps will be the complete object ({ displayValue: "...", entityRef: "..." }).
You have full control to use the part you need, e.g., ${{ parameters.secondaryOwner.entityRef }} for backend actions.
The debug:log step message: "Secondary Owner Parameter Object: ${{ parameters.secondaryOwner }}" will clearly show you the entire object (including displayValue and entityRef) that is being "sent" (made available to subsequent steps).

this is approach provides a good balance of rich display, WYSIWYG on the review step (by exposing the displayValue), and precise control over the data (entityRef) used in backend steps.

ok, got it, So I kept renderOptions for now. here is backstage software template which I am using, currently I have only this filed but in future I am going to bring many other fileds. # Notice the v1beta3 version

apiVersion: scaffolder.backstage.io/v1beta3

kind: Template

# some metadata about the template itself

metadata:

name: create-workspace

title: Test Action template

description: scaffolder v1beta3 template demo

spec:

owner: backstage/techdocs-core

type: service



# these are the steps which are rendered in the frontend with the form input

parameters:

- title: workspace information

required:

- secondaryOwner

properties:

secondaryOwner:

title: Secondary Owner

type: string

description: please choose secondary owner

ui:field: EnhancedEntityPicker

ui:options:

displayEntityField: spec.profile.displayName

catalogFilter:

- kind: User



# here's the steps that are executed in series in the scaffolder backend

steps:

- id: fetch-user

name: Fetch User Entity

action: catalog:fetch

input:

entityRef: ${{ parameters.secondaryOnwer }}

what I want is : displayEntityField in ui:options, developer should be able to populate the data the way they want to , lets say I want filed to have drop down options like : ${spec.profile.displayName} (${metadata.alias}) , so have developer full control to make up thse options the way the want to, once I click on review from software template then data should be apperearing to user exactly the one what I had in the input filed (whatever I have selected) without getting like user:default..... . Currently I have no endpoint ready , so I also want to see once I reviewed the data and when I click on create then may be have output in the software template yaml for now to see what data will be send? did I make sense? even hidden filed if you think we need , still should be fine, want to have proper control with ui:option what data user sees in the filed and same needs to be seen when click on review and when click on create then developer should have full control what want to send to the endpoint using yaml




Show thinking
