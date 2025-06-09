import { getIcon } from "obsidian";

/**
 * Validates if an icon name is a valid Lucide icon available in Obsidian
 * @param iconName The icon name to validate
 * @returns true if the icon is valid, false otherwise
 */
export function isValidLucideIcon(iconName: string): boolean {
  if (!iconName || typeof iconName !== 'string') {
    return false;
  }
  
  try {
    // Use Obsidian's getIcon function to check if icon exists
    const iconElement = getIcon(iconName);
    return iconElement !== null;
  } catch (error) {
    // If getIcon throws an error, the icon is invalid
    return false;
  }
}

/**
 * Gets validation result for an icon field
 * @param iconName The icon name to validate
 * @param fieldName The name of the field being validated (e.g., 'icon')
 * @param required Whether the icon field is required
 * @returns Validation result with error/warning information
 */
export function validateIconField(iconName: any, fieldName: string = 'icon', required: boolean = false): {
  isValid: boolean;
  issue?: {
    type: 'missing_required_field' | 'invalid_field_value';
    field: string;
    message: string;
    severity: 'error' | 'warning';
  };
} {
  // Check if icon is missing
  if (iconName === undefined || iconName === null || iconName === '') {
    if (required) {
      return {
        isValid: false,
        issue: {
          type: 'missing_required_field',
          field: fieldName,
          message: `Missing required field: ${fieldName}`,
          severity: 'error'
        }
      };
    }
    // Icon is optional and not provided - this is valid
    return { isValid: true };
  }
  
  // Check if icon is the correct type
  if (typeof iconName !== 'string') {
    return {
      isValid: false,
      issue: {
        type: 'invalid_field_value',
        field: fieldName,
        message: `${fieldName} must be a string`,
        severity: 'error'
      }
    };
  }
  
  // Check if icon is a valid Lucide icon
  if (!isValidLucideIcon(iconName)) {
    return {
      isValid: false,
      issue: {
        type: 'invalid_field_value',
        field: fieldName,
        message: `Invalid Lucide icon: "${iconName}". Please use a valid Lucide icon name from https://lucide.dev/icons/`,
        severity: 'error'
      }
    };
  }
  
  return { isValid: true };
}
