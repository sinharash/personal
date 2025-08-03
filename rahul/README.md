# Enhanced EntityPicker Component

This enhanced version of the EntityPicker component adds support for custom display formatting while maintaining backwards compatibility with the original EntityPicker.

## Key Features

- **Custom Display Formatting**: Use template syntax to format how entities are displayed
- **Backwards Compatible**: When no formatting options are specified, behaves exactly like the original EntityPicker
- **Flexible Templates**: Support for both template syntax (`{{ field }}`) and fallback syntax (`field1 || field2`)
- **Hidden Entity Reference**: Optionally store the full entity reference in a separate field

## MUI v5 Migration Notes

The EnhancedEntityPicker has been updated to use MUI v5 imports while Backstage core still uses Material-UI v4. This creates some considerations:

### Import Changes Made

```typescript
// FROM (Material-UI v4):
import TextField from '@material-ui/core/TextField';
import Autocomplete, {
  AutocompleteChangeReason,
  createFilterOptions,
} from '@material-ui/lab/Autocomplete';

// TO (MUI v5):
import { TextField, Autocomplete, createFilterOptions } from '@mui/material';
import type { AutocompleteChangeReason } from '@mui/material';
```

### Additional Changes Needed for Full MUI v5 Compatibility

1. **TextField `margin` prop**
   - Current: `margin="dense"` (line 313)
   - MUI v5: This prop is deprecated. Use `size="small"` for similar compact spacing
   - Impact: TextField will use default spacing instead of compact spacing

2. **Theme Compatibility**
   - Backstage provides a Material-UI v4 theme
   - MUI v5 components won't fully inherit these theme styles
   - Consider wrapping the component in a ThemeProvider with an MUI v5 theme

3. **Bundle Size Consideration**
   - Both Material-UI v4 and MUI v5 will be loaded
   - This increases the bundle size by ~300KB
   - Consider migrating all components together when Backstage migrates to MUI v5

4. **Style System Differences**
   - Material-UI v4 uses JSS for styling
   - MUI v5 uses Emotion
   - Potential for CSS specificity conflicts

### Recommended Migration Path

1. **Short Term** (Current Implementation)
   - Keep the minimal import changes only
   - Accept slight visual differences
   - Document any styling inconsistencies

2. **Medium Term**
   - Create a compatibility layer for theme translation
   - Update deprecated props like `margin="dense"`
   - Test thoroughly with different entity types

3. **Long Term**
   - Wait for Backstage to migrate to MUI v5
   - Migrate all components together
   - Remove compatibility layers

## Usage Example

```yaml
# Basic usage (backwards compatible)
myEntity:
  title: Select an Entity
  type: string
  ui:field: EnhancedEntityPicker
  ui:options:
    catalogFilter:
      kind: User

# With custom display formatting
myEntity:
  title: Select a User
  type: string
  ui:field: EnhancedEntityPicker
  ui:options:
    catalogFilter:
      kind: User
    displayFormat: "{{ metadata.title }} - {{ spec.profile.email }}"
    hiddenEntityRef: "selectedUserRef"
```

## Testing Considerations

When testing the enhanced component:

1. Verify backwards compatibility with existing templates
2. Test visual appearance against original EntityPicker
3. Confirm theme inheritance works as expected
4. Check bundle size impact in production builds
5. Test with various entity types and display formats

## Future Improvements

- Add support for custom renderOption templates
- Implement proper MUI v5 theme provider
- Add prop mapping for deprecated Material-UI v4 props
- Create automated migration tool for templates