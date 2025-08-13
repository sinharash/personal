// Enhanced getNestedValue to handle arrays and objects better
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  try {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  } catch {
    return undefined;
  }
};

// Enhanced formatDisplayValue to handle arrays, objects, and complex data structures
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
        const stringValue = convertValueToString(value);
        if (stringValue && stringValue.trim()) return stringValue;
      }
      return "";
    }

    // Handle template syntax: "{{ property }}"
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
      const value = getNestedValue(entity, expression.trim());
      return convertValueToString(value);
    });
  } catch {
    return entity?.metadata?.name || "";
  }
};

// Helper function to convert any value type to display string
const convertValueToString = (value: any): string => {
  if (value === null || value === undefined) {
    return "";
  }

  // Handle arrays (like metadata.admins)
  if (Array.isArray(value)) {
    // For arrays of strings (like admins), join with commas
    if (value.length > 0 && typeof value[0] === "string") {
      return value.join(", ");
    }

    // For arrays of objects, try to extract meaningful info
    if (value.length > 0 && typeof value[0] === "object") {
      return value
        .map((item) => {
          // If object has 'name' or 'title' property, use that
          if (item.name) return item.name;
          if (item.title) return item.title;
          if (item.type) return item.type;
          // Otherwise convert to string
          return JSON.stringify(item);
        })
        .join(", ");
    }

    // For other arrays, just join
    return value.join(", ");
  }

  // Handle objects (like relations)
  if (typeof value === "object") {
    // For relation objects, try to extract useful info
    if (value.type) {
      return value.type;
    }
    if (value.targetRef) {
      return value.targetRef;
    }
    if (value.name) {
      return value.name;
    }
    if (value.title) {
      return value.title;
    }

    // For other objects, show first few key-value pairs
    const entries = Object.entries(value).slice(0, 2);
    return entries.map(([k, v]) => `${k}:${v}`).join(", ");
  }

  // Handle primitives (string, number, boolean)
  return String(value);
};

// You can also add specific array/object accessors for common patterns:
// Example usage in YAML:
// displayFormat: "{{ metadata.admins }} - {{ metadata.tags }}"
// This will now show: "email1@domain.com, email2@domain.com - tag1, tag2"

// For more specific array access, you can also support index notation:
// Enhanced getNestedValue with array index support
const getNestedValueWithIndex = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;

  try {
    const parts = path.split(".");
    let current = obj;

    for (const part of parts) {
      // Handle array index notation like admins[0]
      if (part.includes("[") && part.includes("]")) {
        const arrayName = part.substring(0, part.indexOf("["));
        const indexStr = part.substring(
          part.indexOf("[") + 1,
          part.indexOf("]")
        );
        const index = parseInt(indexStr, 10);

        current = current?.[arrayName];
        if (Array.isArray(current) && !isNaN(index)) {
          current = current[index];
        }
      } else {
        current = current?.[part];
      }

      if (current === undefined) break;
    }

    return current;
  } catch {
    return undefined;
  }
};

// Usage examples for your YAML:
/*
# Display all admins
displayFormat: "{{ metadata.admins }}"
# Result: "email1@domain.com, email2@domain.com, email3@domain.com"

# Display first admin only  
displayFormat: "{{ metadata.admins[0] }}"
# Result: "email1@domain.com"

# Display account_id and first admin
displayFormat: "{{ metadata.account_id }} - {{ metadata.admins[0] }}"
# Result: "992328931290 - anudeep.neelam.vahbys@statefarm.com"

# Display all tags
displayFormat: "{{ metadata.tags }}"  
# Result: "prod"

# Handle relations (if they exist)
displayFormat: "{{ relations }}"
# Will show relation type or meaningful object representation
*/
