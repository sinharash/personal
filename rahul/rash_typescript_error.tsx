// Fix 1: onChange function (around line 210)
// Replace the problematic onChange call with:
const displayValue = formatDisplayValue(displayFormat, ref);
onChange(displayValue);

// Fix 2: Avoid nested ternary expressions (around line 315-320)
// Replace the nested ternary with if-else blocks:
getOptionLabel={(option) => {
  if (typeof option === 'string') {
    if (displayFormat) {
      return option; // For string options when displayFormat is used
    }
    return entities?.entityRefToPresentation.get(option)?.primaryTitle || option;
  } else {
    if (displayFormat) {
      return formatDisplayValue(displayFormat, option); // Use custom display format
    }
    return entities?.entityRefToPresentation.get(stringifyEntityRef(option))?.primaryTitle || 
           stringifyEntityRef(option);
  }
}}

// Fix 3: Variable naming conflict with 'props' 
// In your renderOption function (around line 335-340), rename the props parameter:
renderOption={(renderProps, option) => (
  <li {...renderProps}>
    {displayFormat ? (
      <span>{formatDisplayValue(displayFormat, option)}</span>
    ) : (
      <EntityDisplayName entityRef={option} />
    )}
  </li>
)}

// Fix 4: Make sure your helper functions are properly defined before use:
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  
  try {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      
      // Handle array index like admins.0, admins.1
      if (!isNaN(Number(key)) && Array.isArray(current)) {
        return current[Number(key)];
      }
      
      return current[key];
    }, obj);
  } catch {
    return undefined;
  }
};

const convertToString = (value: any): string => {
  if (value === null || value === undefined) return '';
  
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
};

const formatDisplayValue = (template: string, entity: Entity): string => {
  if (!template || !entity) {
    return entity?.metadata?.title || entity?.metadata?.name || '';
  }

  try {
    if (template.includes(' || ')) {
      const paths = template.split(' || ').map(p => p.trim());
      for (const path of paths) {
        const value = getNestedValue(entity, path);
        const stringValue = convertToString(value);
        if (stringValue && stringValue.trim()) return stringValue;
      }
      return '';
    }

    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return convertToString(value);
    });
  } catch {
    return entity?.metadata?.name || '';
  }
};