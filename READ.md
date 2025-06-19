# 🚀 EnhancedEntityPicker

A beautiful, user-friendly entity picker for Backstage Scaffolder templates that transforms complex entity references into clean, readable selections.

## ✨ What It Does

**For Users:**

- See friendly names like "John Doe - Engineering" instead of technical IDs
- Searchable dropdown with beautiful formatting
- Clean review page without technical clutter

**For Developers:**

- Get clean entity references for backend processing
- No custom backend actions needed
- Works with any entity type (User, Group, Component, etc.)
- Integrates seamlessly with standard Backstage patterns

## 🎯 The Problem It Solves

**Before:**

```yaml
# Users see technical entity references
selectedUser: "user:default/john.doe"
```

**After:**

```yaml
# Users see beautiful, readable names
selectedUser: "John Doe - Engineering"
# Technical details hidden but accessible
```

## 📦 Installation

### 1. Add the Component

Create the component file:

```
packages/app/src/scaffolder/EnhancedEntityPicker/EnhancedEntityPicker.tsx
```

### 2. Register the Field Extension

In your `packages/app/src/App.tsx`:

```typescript
import { EnhancedEntityPicker } from "./scaffolder/EnhancedEntityPicker/EnhancedEntityPicker";
import { createScaffolderFieldExtension } from "@backstage/plugin-scaffolder-react";

const enhancedEntityPickerExtension = createScaffolderFieldExtension({
  name: "EnhancedEntityPicker",
  component: EnhancedEntityPicker,
});

// Add to your scaffolder field extensions
const scaffolderFieldExtensions = [
  enhancedEntityPickerExtension,
  // ... other extensions
];
```

## 🎨 Basic Usage

### Simple User Selection

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: user-picker-example
  title: "User Selection Example"
spec:
  parameters:
    - title: "👥 Select Team Member"
      required:
        - selectedUser
      properties:
        selectedUser:
          title: Choose User
          type: string
          ui:field: EnhancedEntityPicker
          ui:options:
            catalogFilter:
              kind: User
            placeholder: "🔍 Select a team member..."

        # Hidden field for entity ID
        selectedUserEntityName:
          type: string
          ui:widget: hidden
          ui:backstage:
            review:
              show: false

  steps:
    # Direct catalog:fetch - no custom action needed!
    - id: fetch-user
      name: "📋 Get User Details"
      action: catalog:fetch
      input:
        entityRef: "user:default/${{ parameters.selectedUserEntityName }}"

    - id: show-result
      name: "✅ Show Result"
      action: debug:log
      input:
        message: |
          Selected: ${{ parameters.selectedUser }}
          Email: ${{ steps['fetch-user'].output.entity.spec.profile.email }}
```

## ⚙️ Configuration Options

### `ui:options` Parameters

| Option                              | Type   | Default                                     | Description                                  |
| ----------------------------------- | ------ | ------------------------------------------- | -------------------------------------------- |
| `displayEntityFieldAfterFormatting` | string | `"{{ metadata.title \|\| metadata.name }}"` | Template for how entities appear in dropdown |
| `uniqueIdentifierField`             | string | `"metadata.name"`                           | Entity property to use as unique identifier  |
| `catalogFilter`                     | object | `{}`                                        | Filter criteria for catalog entities         |
| `placeholder`                       | string | `"Select an entity..."`                     | Placeholder text for empty dropdown          |
| `hiddenFieldName`                   | string | `"selectedUserEntityName"`                  | Name of hidden field to store entity ID      |

### Display Templates

Use `{{ }}` syntax to format entity display:

```yaml
# Show title and department
displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.department }}"

# Show name with fallback
displayEntityFieldAfterFormatting: "{{ metadata.title || metadata.name }}"

# Show component with type
displayEntityFieldAfterFormatting: "{{ metadata.title }} ({{ spec.type }})"

# Custom format with multiple fields
displayEntityFieldAfterFormatting: "{{ metadata.title }} | {{ spec.profile.team }} | {{ metadata.namespace }}"
```

## 📋 Entity Type Examples

### 👥 Users

```yaml
selectedUser:
  title: Choose User
  type: string
  ui:field: EnhancedEntityPicker
  ui:options:
    displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.department }}"
    catalogFilter:
      kind: User
    hiddenFieldName: "selectedUserEntityName"

selectedUserEntityName:
  type: string
  ui:widget: hidden
  ui:backstage:
    review:
      show: false

# Usage in steps:
entityRef: "user:default/${{ parameters.selectedUserEntityName }}"
```

### 👨‍👩‍👧‍👦 Groups

```yaml
selectedGroup:
  title: Choose Team
  type: string
  ui:field: EnhancedEntityPicker
  ui:options:
    displayEntityFieldAfterFormatting: "{{ metadata.title }} ({{ spec.type }})"
    catalogFilter:
      kind: Group
    hiddenFieldName: "selectedGroupEntityName"

selectedGroupEntityName:
  type: string
  ui:widget: hidden
  ui:backstage:
    review:
      show: false

# Usage in steps:
entityRef: "group:default/${{ parameters.selectedGroupEntityName }}"
```

### 🧩 Components

```yaml
selectedComponent:
  title: Choose Component
  type: string
  ui:field: EnhancedEntityPicker
  ui:options:
    displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.type }}"
    catalogFilter:
      kind: Component
      # Optional: filter by component type
      spec.type: service
    hiddenFieldName: "selectedComponentEntityName"

selectedComponentEntityName:
  type: string
  ui:widget: hidden
  ui:backstage:
    review:
      show: false

# Usage in steps:
entityRef: "component:default/${{ parameters.selectedComponentEntityName }}"
```

### 🌍 Different Namespaces

```yaml
selectedProdUser:
  title: Choose Production User
  type: string
  ui:field: EnhancedEntityPicker
  ui:options:
    displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.role }}"
    catalogFilter:
      kind: User
      metadata.namespace: production
    hiddenFieldName: "selectedProdUserEntityName"

selectedProdUserEntityName:
  type: string
  ui:widget: hidden
  ui:backstage:
    review:
      show: false

# Usage in steps:
entityRef: "user:production/${{ parameters.selectedProdUserEntityName }}"
```

## 🔧 Advanced Examples

### Multiple Entity Selection

```yaml
parameters:
  - title: "👥 Team Setup"
    properties:
      # Owner selection
      projectOwner:
        title: Project Owner
        type: string
        ui:field: EnhancedEntityPicker
        ui:options:
          displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.role }}"
          catalogFilter:
            kind: User
            spec.profile.role: tech-lead
          hiddenFieldName: "projectOwnerEntityName"

      # Team selection
      developmentTeam:
        title: Development Team
        type: string
        ui:field: EnhancedEntityPicker
        ui:options:
          displayEntityFieldAfterFormatting: "{{ metadata.title }} ({{ spec.memberCount }} members)"
          catalogFilter:
            kind: Group
            spec.type: team
          hiddenFieldName: "developmentTeamEntityName"

      # Component selection
      baseComponent:
        title: Base Component
        type: string
        ui:field: EnhancedEntityPicker
        ui:options:
          displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.type }}"
          catalogFilter:
            kind: Component
            spec.type: library
          hiddenFieldName: "baseComponentEntityName"

      # Hidden fields
      projectOwnerEntityName:
        type: string
        ui:widget: hidden
        ui:backstage:
          review:
            show: false

      developmentTeamEntityName:
        type: string
        ui:widget: hidden
        ui:backstage:
          review:
            show: false

      baseComponentEntityName:
        type: string
        ui:widget: hidden
        ui:backstage:
          review:
            show: false

steps:
  # Fetch all entities
  - id: fetch-owner
    name: "👤 Get Project Owner"
    action: catalog:fetch
    input:
      entityRef: "user:default/${{ parameters.projectOwnerEntityName }}"

  - id: fetch-team
    name: "👥 Get Development Team"
    action: catalog:fetch
    input:
      entityRef: "group:default/${{ parameters.developmentTeamEntityName }}"

  - id: fetch-component
    name: "🧩 Get Base Component"
    action: catalog:fetch
    input:
      entityRef: "component:default/${{ parameters.baseComponentEntityName }}"
```

### Conditional Entity Selection

```yaml
parameters:
  - title: "🎯 Project Type"
    properties:
      projectType:
        title: Project Type
        type: string
        enum:
          - frontend
          - backend
          - fullstack
        enumNames:
          - "🎨 Frontend"
          - "⚙️ Backend"
          - "🌐 Full Stack"

  - title: "👥 Team Selection"
    dependencies:
      projectType:
        oneOf:
          - properties:
              projectType:
                enum: [frontend]
              frontendLead:
                title: Frontend Lead
                type: string
                ui:field: EnhancedEntityPicker
                ui:options:
                  displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.skills }}"
                  catalogFilter:
                    kind: User
                    spec.profile.skills: frontend
                  hiddenFieldName: "frontendLeadEntityName"
              frontendLeadEntityName:
                type: string
                ui:widget: hidden
                ui:backstage:
                  review:
                    show: false
            required: [frontendLead]

          - properties:
              projectType:
                enum: [backend]
              backendLead:
                title: Backend Lead
                type: string
                ui:field: EnhancedEntityPicker
                ui:options:
                  displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.skills }}"
                  catalogFilter:
                    kind: User
                    spec.profile.skills: backend
                  hiddenFieldName: "backendLeadEntityName"
              backendLeadEntityName:
                type: string
                ui:widget: hidden
                ui:backstage:
                  review:
                    show: false
            required: [backendLead]
```

## 🎨 User Experience

### What Users See

**Form Step:**

- Beautiful dropdown with formatted entity names
- Search functionality
- Clean, professional interface

**Review Page:**

```
Choose User: John Doe - Engineering Department
Choose Team: Platform Team (8 members)
Choose Component: User Service - microservice
```

**What's Hidden:**

- Technical entity IDs
- Entity namespaces
- Complex entity references

### What Developers Get

```yaml
# In template steps, developers get clean entity references:
steps:
  - action: catalog:fetch
    input:
      entityRef: "user:default/${{ parameters.selectedUserEntityName }}"
      # Gets full entity object with all properties
```

## 🐛 Troubleshooting

### Common Issues

**1. "No options in dropdown"**

```yaml
# Check catalogFilter configuration
catalogFilter:
  kind: User # Ensure this matches entities in your catalog
```

**2. "Entity not found in steps"**

```yaml
# Ensure hidden field name matches
hiddenFieldName: "selectedUserEntityName" # In ui:options
selectedUserEntityName: # Hidden field name must match
```

**3. "Display template not working"**

```yaml
# Check entity properties exist
displayEntityFieldAfterFormatting: "{{ metadata.title || metadata.name }}"
# Use fallbacks for optional properties
```

### **❌ Hidden field shows technical details**

```yaml
# Ensure hidden field is properly masked
selectedUserEntityName:
  type: string
  ui:widget: hidden # Hide from form
  ui:backstage:
    review:
      show: false # Hide from review page
```

**5. "hiddenFieldName mismatch"**

```yaml
# ❌ WRONG: hiddenFieldName doesn't match actual field
selectedGroup:
  ui:options:
    hiddenFieldName: "selectedUserEntityName"  # Wrong!
selectedGroupEntityName:  # Actual field name
  ui:widget: hidden

# ✅ CORRECT: Names must match exactly
selectedGroup:
  ui:options:
    hiddenFieldName: "selectedGroupEntityName"  # Matches!
selectedGroupEntityName:
  ui:widget: hidden
```

**6. "Missing hiddenFieldName option"**

```yaml
# ❌ BAD: No hiddenFieldName specified
selectedGroup:
  ui:field: EnhancedEntityPicker
  # Missing: hiddenFieldName option!

# Component will warn and fall back to "selectedEntityName"
# But your hidden field might be named differently!

# ✅ GOOD: Always specify hiddenFieldName
selectedGroup:
  ui:field: EnhancedEntityPicker
  ui:options:
    hiddenFieldName: "selectedGroupEntityName"  # Explicit!
```

### Debug Mode

In development, the component shows debug information:

```
🚀 Simplified Debug: 15 options
📋 Display Template: {{ metadata.title }} - {{ spec.profile.department }}
🔑 Hidden Field: selectedUserEntityName
✨ Mode: SIMPLIFIED (no custom action needed)
👤 Selected: John Doe - Engineering
🔑 Entity Name: john.doe (hidden)
```

## 🎯 Best Practices

### 1. Always Specify hiddenFieldName

```yaml
# ✅ ALWAYS provide hiddenFieldName - don't rely on defaults!
selectedUser:
  ui:field: EnhancedEntityPicker
  ui:options:
    hiddenFieldName: "selectedUserEntityName"  # Explicit and clear

selectedGroup:
  ui:field: EnhancedEntityPicker
  ui:options:
    hiddenFieldName: "selectedGroupEntityName"  # Different for each entity type

# ❌ BAD - relying on fallback (might not match your field names)
selectedUser:
  ui:field: EnhancedEntityPicker
  # Missing hiddenFieldName - component will guess!
```

### 2. Always Use Hidden Fields

```yaml
# ✅ Good
selectedUser:
  ui:field: EnhancedEntityPicker
selectedUserEntityName:
  ui:widget: hidden
  ui:backstage:
    review:
      show: false

# ❌ Bad - missing hidden field
selectedUser:
  ui:field: EnhancedEntityPicker
```

### 3. Provide Meaningful Display Templates

```yaml
# ✅ Good - informative
displayEntityFieldAfterFormatting: "{{ metadata.title }} - {{ spec.profile.department }}"

# ❌ Bad - not descriptive
displayEntityFieldAfterFormatting: "{{ metadata.name }}"
```

### 4. Use Appropriate Filters

```yaml
# ✅ Good - specific filtering
catalogFilter:
  kind: User
  spec.profile.role: developer

# ❌ Bad - too broad, might be slow
catalogFilter: {}
```

### 5. Handle Different Namespaces

```yaml
# ✅ Good - explicit namespace
entityRef: "user:production/${{ parameters.selectedUserEntityName }}"

# ✅ Also good - default namespace
entityRef: "user:default/${{ parameters.selectedUserEntityName }}"
```

## 🚀 Benefits

### For End Users

- ✅ **Beautiful UX** - See friendly names, not technical IDs
- ✅ **Searchable** - Easy to find entities in large catalogs
- ✅ **Clean Review** - Review page shows what they selected
- ✅ **No Training** - Intuitive interface

### For Developers

- ✅ **Simple Integration** - Drop into any template
- ✅ **No Backend Code** - Works with standard Backstage actions
- ✅ **Type Flexible** - Works with any entity type
- ✅ **Maintainable** - Clear, documented code

### For Organizations

- ✅ **Consistent UX** - Same experience across all templates
- ✅ **Reduced Support** - Less confusion about entity selection
- ✅ **Faster Adoption** - Users understand entity picker immediately
- ✅ **Developer Productivity** - Less time explaining technical concepts

## 📚 Related Documentation

- [Backstage Scaffolder](https://backstage.io/docs/features/software-templates/)
- [Custom Field Extensions](https://backstage.io/docs/features/software-templates/writing-custom-field-extensions)
- [Catalog API](https://backstage.io/docs/features/software-catalog/software-catalog-api)

## 🤝 Contributing

1. Follow existing code patterns
2. Add comments for complex logic
3. Update README for new features
4. Test with different entity types

## 📝 License

Same as your Backstage installation.

---

**Happy entity picking!** 🎉
