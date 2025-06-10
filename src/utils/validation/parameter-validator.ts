export interface ValidationError {
  message: string;
  field?: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validates parameters against a JSON schema
 * @param params The parameters to validate
 * @param schema The JSON schema to validate against
 * @returns Validation result with errors if any
 */
export function validateToolParameters(
  params: Record<string, unknown>, 
  schema: any
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: []
  };

  // If no schema provided, skip validation
  if (!schema || !schema.properties) {
    return result;
  }

  // Validate required fields
  if (schema.required && Array.isArray(schema.required)) {
    for (const requiredField of schema.required) {
      if (!(requiredField in params) || params[requiredField] === undefined || params[requiredField] === null) {
        result.errors.push({
          message: `Missing required parameter: ${requiredField}`,
          field: requiredField,
          value: params[requiredField]
        });
        result.isValid = false;
      }
    }
  }

  // Validate each parameter against its schema
  for (const [paramName, paramValue] of Object.entries(params)) {
    const paramSchema = schema.properties[paramName];
    
    // Skip validation if parameter not defined in schema
    if (!paramSchema) {
      continue;
    }

    const paramErrors = validateParameter(paramName, paramValue, paramSchema);
    if (paramErrors.length > 0) {
      result.errors.push(...paramErrors);
      result.isValid = false;
    }
  }

  return result;
}

/**
 * Validates a single parameter against its schema definition
 */
function validateParameter(
  paramName: string, 
  value: unknown, 
  schema: any
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Skip validation for null/undefined if not required
  if (value === null || value === undefined) {
    return errors;
  }

  // Type validation
  if (schema.type) {
    const actualType = getValueType(value);
    if (actualType !== schema.type) {
      errors.push({
        message: `Parameter '${paramName}' must be of type ${schema.type}, got ${actualType}`,
        field: paramName,
        value: value
      });
      return errors; // Return early if type is wrong
    }
  }

  // String-specific validations
  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        message: `Parameter '${paramName}' must be at least ${schema.minLength} characters long`,
        field: paramName,
        value: value
      });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        message: `Parameter '${paramName}' must be at most ${schema.maxLength} characters long`,
        field: paramName,
        value: value
      });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({
        message: `Parameter '${paramName}' does not match required pattern`,
        field: paramName,
        value: value
      });
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        message: `Parameter '${paramName}' must be one of: ${schema.enum.join(', ')}`,
        field: paramName,
        value: value
      });
    }
  }

  // Number-specific validations
  if ((schema.type === 'number' || schema.type === 'integer') && typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        message: `Parameter '${paramName}' must be at least ${schema.minimum}`,
        field: paramName,
        value: value
      });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        message: `Parameter '${paramName}' must be at most ${schema.maximum}`,
        field: paramName,
        value: value
      });
    }
    if (schema.type === 'integer' && !Number.isInteger(value)) {
      errors.push({
        message: `Parameter '${paramName}' must be an integer`,
        field: paramName,
        value: value
      });
    }
  }

  // Array-specific validations
  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        message: `Parameter '${paramName}' must have at least ${schema.minItems} items`,
        field: paramName,
        value: value
      });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        message: `Parameter '${paramName}' must have at most ${schema.maxItems} items`,
        field: paramName,
        value: value
      });
    }
    
    // Validate array items if schema is provided
    if (schema.items) {
      value.forEach((item, index) => {
        const itemErrors = validateParameter(`${paramName}[${index}]`, item, schema.items);
        errors.push(...itemErrors);
      });
    }
  }

  // Object-specific validations
  if (schema.type === 'object' && typeof value === 'object' && value !== null) {
    const objValue = value as Record<string, unknown>;
    
    // Validate required properties
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in objValue) || objValue[requiredProp] === undefined) {
          errors.push({
            message: `Parameter '${paramName}.${requiredProp}' is required`,
            field: `${paramName}.${requiredProp}`,
            value: objValue[requiredProp]
          });
        }
      }
    }
    
    // Validate object properties
    if (schema.properties) {
      for (const [propName, propValue] of Object.entries(objValue)) {
        const propSchema = schema.properties[propName];
        if (propSchema) {
          const propErrors = validateParameter(`${paramName}.${propName}`, propValue, propSchema);
          errors.push(...propErrors);
        }
      }
    }
  }

  return errors;
}

/**
 * Gets the JSON schema type of a value
 */
function getValueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    // JSON Schema distinguishes between integer and number
    // Return 'integer' for whole numbers, 'number' for decimals
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  if (typeof value === 'string') return 'string';
  return 'unknown';
}

/**
 * Formats validation errors into a human-readable message
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return '';
  
  if (errors.length === 1) {
    return `Parameter validation error: ${errors[0].message}`;
  }
  
  const errorMessages = errors.map((error, index) => `${index + 1}. ${error.message}`);
  return `Parameter validation errors:\n${errorMessages.join('\n')}`;
} 