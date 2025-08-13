// Simple getNestedValue with basic array support
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;

  try {
    return path.split(".").reduce((current, key) => {
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

// Simple formatDisplayValue - just convert to string, that's it
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
        const stringValue = convertToString(value);
        if (stringValue && stringValue.trim()) return stringValue;
      }
      return "";
    }

    // Handle template syntax: "{{ property }}"
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return convertToString(value);
    });
  } catch {
    return entity?.metadata?.name || "";
  }
};

// Super simple conversion - just basic cases
const convertToString = (value: any): string => {
  if (value === null || value === undefined) return "";

  // If it's an array, join with commas - that's it
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  // If it's an object, just stringify it (user can be more specific if needed)
  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  // Everything else, just convert to string
  return String(value);
};

// Usage examples for your YAML - user controls exactly what they want:
/*
# Get all admins as comma-separated string
displayFormat: "{{ metadata.admins }}"
# Result: "email1@domain.com, email2@domain.com, email3@domain.com"

# Get first admin only (user specifies index)
displayFormat: "{{ metadata.admins.0 }}"  
# Result: "email1@domain.com"

# Get second admin
displayFormat: "{{ metadata.admins.1 }}"
# Result: "email2@domain.com"

# User can be specific about what they want from objects
displayFormat: "{{ relations.0.type }}" 
# Gets type from first relation

# Or if they want the whole object (will be JSON)
displayFormat: "{{ relations.0 }}"
# Gets first relation as JSON string
*/
