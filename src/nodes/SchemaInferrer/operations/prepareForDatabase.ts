import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  format?: string;
  definitions?: Record<string, JsonSchema>;
  $ref?: string;
  items?: JsonSchema;
}

/**
 * Resolve a $ref reference to its definition
 * Supports references like "#/definitions/Root"
 */
function resolveSchemaRef(schema: JsonSchema, ref: string): JsonSchema | null {
  // Handle references like "#/definitions/Root"
  if (ref.startsWith('#/definitions/')) {
    const definitionName = ref.substring('#/definitions/'.length);
    if (schema.definitions && schema.definitions[definitionName]) {
      return schema.definitions[definitionName];
    }
  }
  return null;
}

/**
 * Get the actual schema to work with, resolving $ref if present
 */
function getResolvedSchema(schema: JsonSchema): JsonSchema {
  // If there's a $ref at the root level, resolve it
  if (schema.$ref) {
    const resolved = resolveSchemaRef(schema, schema.$ref);
    if (resolved) {
      return resolved;
    }
  }
  return schema;
}

/**
 * Extract field names that should be serialized to JSON strings
 * based on their type in the schema (object or array)
 */
function extractJsonFieldsFromSchema(rootSchema: JsonSchema): Set<string> {
  const jsonFields = new Set<string>();

  // Resolve any root-level $ref
  const schema = getResolvedSchema(rootSchema);

  if (!schema.properties) {
    return jsonFields;
  }

  for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
    // Resolve $ref for this field if present
    const resolvedFieldSchema = fieldSchema.$ref
      ? resolveSchemaRef(rootSchema, fieldSchema.$ref) || fieldSchema
      : fieldSchema;

    // Handle union types (e.g., ["object", "null"])
    const types = Array.isArray(resolvedFieldSchema.type)
      ? resolvedFieldSchema.type
      : [resolvedFieldSchema.type];

    // Identify fields that are objects or arrays
    if (types.includes('object') || types.includes('array')) {
      jsonFields.add(fieldName);
    }

    // Also check for explicit json/jsonb format markers
    if (resolvedFieldSchema.format === 'json' || resolvedFieldSchema.format === 'jsonb') {
      jsonFields.add(fieldName);
    }
  }

  return jsonFields;
}

function isObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): boolean {
  return Array.isArray(value);
}

function isAlreadyJsonString(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Transform data by stringifying nested objects/arrays based on schema
 */
function stringifyNestedFields(
  data: IDataObject,
  fieldsToStringify: Set<string>,
  skipAlreadyStringified: boolean,
  prettyPrint: boolean,
): IDataObject {
  const result: IDataObject = {};

  for (const [key, value] of Object.entries(data)) {
    const shouldStringify = fieldsToStringify.has(key);

    if (shouldStringify && value !== null && value !== undefined) {
      // Skip if already a JSON string
      if (skipAlreadyStringified && isAlreadyJsonString(value)) {
        result[key] = value;
      }
      // Stringify objects and arrays
      else if (isObject(value) || isArray(value)) {
        result[key] = prettyPrint ? JSON.stringify(value, null, 2) : JSON.stringify(value);
      }
      // Leave other types as-is
      else {
        result[key] = value;
      }
    } else {
      // Field not in stringification list or is null/undefined
      result[key] = value;
    }
  }

  return result;
}

export function prepareForDatabase(
  context: IExecuteFunctions,
  enableDebug: boolean,
): INodeExecutionData[][] {
  const items = context.getInputData();

  if (items.length === 0) {
    throw new NodeOperationError(
      context.getNode(),
      'No input data provided. Please provide data items to prepare for database insertion.',
    );
  }

  // Get schema (required)
  let schemaInput = context.getNodeParameter('schema', 0) as IDataObject | string | IDataObject[];
  
  if (enableDebug) {
    // eslint-disable-next-line no-console
    console.log('Schema Inferrer (Prepare for Database): Raw schema input:', {
      type: typeof schemaInput,
      isArray: Array.isArray(schemaInput),
      isString: typeof schemaInput === 'string',
      isObject: typeof schemaInput === 'object' && !Array.isArray(schemaInput),
      isNull: schemaInput === null,
      isUndefined: schemaInput === undefined,
      keys: typeof schemaInput === 'object' && schemaInput !== null && !Array.isArray(schemaInput)
        ? Object.keys(schemaInput)
        : undefined,
      arrayLength: Array.isArray(schemaInput) ? schemaInput.length : undefined,
      firstItemKeys: Array.isArray(schemaInput) && schemaInput.length > 0
        ? Object.keys(schemaInput[0])
        : undefined,
      valuePreview: typeof schemaInput === 'string' 
        ? schemaInput.substring(0, 100) 
        : JSON.stringify(schemaInput).substring(0, 200),
    });
  }
  
  // Handle empty/invalid input
  if (!schemaInput || (typeof schemaInput === 'object' && Object.keys(schemaInput).length === 0)) {
    const message = 'Schema parameter is empty or invalid. Please provide a valid schema from the Create Schema operation.';
    if (enableDebug) {
      // eslint-disable-next-line no-console
      console.log(`Schema Inferrer (Prepare for Database): ${message}`);
    }
    throw new NodeOperationError(context.getNode(), message);
  }
  
  const prepareOptionsRaw = context.getNodeParameter('prepareOptions', 0, {}) as {
    skipAlreadyStringified?: boolean;
    prettyPrint?: boolean;
    strictMode?: boolean;
  };

  const skipAlreadyStringified = prepareOptionsRaw.skipAlreadyStringified ?? true;
  const prettyPrint = prepareOptionsRaw.prettyPrint ?? false;
  const strictMode = prepareOptionsRaw.strictMode ?? false;

  // Parse schema
  let schema: JsonSchema;

  // Handle array-wrapped schema (e.g., [{ "schema": {...} }])
  if (Array.isArray(schemaInput) && schemaInput.length > 0) {
    if (enableDebug) {
      // eslint-disable-next-line no-console
      console.log('Schema Inferrer (Prepare for Database): Schema is array-wrapped, extracting first item');
    }
    // Check if it's wrapped with a "schema" key
    if ('schema' in schemaInput[0]) {
      schemaInput = schemaInput[0].schema as IDataObject | string;
      if (enableDebug) {
        // eslint-disable-next-line no-console
        console.log('Schema Inferrer (Prepare for Database): Extracted from array[0].schema');
      }
    } else {
      schemaInput = schemaInput[0];
      if (enableDebug) {
        // eslint-disable-next-line no-console
        console.log('Schema Inferrer (Prepare for Database): Extracted from array[0]');
      }
    }
  }

  if (typeof schemaInput === 'string') {
    if (enableDebug) {
      // eslint-disable-next-line no-console
      console.log('Schema Inferrer (Prepare for Database): Parsing string schema, length:', schemaInput.length);
    }
    try {
      let parsed = JSON.parse(schemaInput) as IDataObject | IDataObject[];
      
      // If parsed result is an array, extract first item
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (enableDebug) {
          // eslint-disable-next-line no-console
          console.log('Schema Inferrer (Prepare for Database): Parsed string is an array, extracting first item');
        }
        parsed = parsed[0];
      }
      
      // Check if the parsed result has a 'schema' wrapper (from Create Schema output)
      if (typeof parsed === 'object' && parsed !== null && 'schema' in parsed && typeof parsed.schema === 'object') {
        schema = parsed.schema as JsonSchema;
        if (enableDebug) {
          // eslint-disable-next-line no-console
          console.log('Schema Inferrer (Prepare for Database): Extracted schema from parsed.schema wrapper');
        }
      } else {
        schema = parsed as JsonSchema;
      }
    } catch (error) {
      const message =
        'Invalid JSON schema provided. Please provide a valid JSON schema from the Create Schema operation.';
      if (strictMode) {
        throw new NodeOperationError(context.getNode(), message);
      } else {
        // eslint-disable-next-line no-console
        console.warn(`Schema Inferrer (Prepare for Database): ${message}`);
        // Pass through without transformation
        return [items];
      }
    }
  } else {
    // Check if the object has a 'schema' wrapper (from Create Schema output)
    if ('schema' in schemaInput && typeof schemaInput.schema === 'object') {
      schema = schemaInput.schema as JsonSchema;
      if (enableDebug) {
        // eslint-disable-next-line no-console
        console.log('Schema Inferrer (Prepare for Database): Extracted schema from object.schema wrapper');
      }
    } else {
      schema = schemaInput as JsonSchema;
      if (enableDebug) {
        // eslint-disable-next-line no-console
        console.log('Schema Inferrer (Prepare for Database): Using object schema directly, keys:', Object.keys(schemaInput));
      }
    }
  }

  if (enableDebug) {
    // eslint-disable-next-line no-console
    console.log('Schema Inferrer (Prepare for Database): Final schema structure:', {
      hasRef: !!schema.$ref,
      ref: schema.$ref,
      hasProperties: !!schema.properties,
      hasDefinitions: !!schema.definitions,
      definitionKeys: schema.definitions ? Object.keys(schema.definitions) : [],
      topLevelKeys: Object.keys(schema),
    });
  }

  // Extract fields that need stringification
  const fieldsToStringify = extractJsonFieldsFromSchema(schema);

  if (enableDebug) {
    // eslint-disable-next-line no-console
    console.log('Schema Inferrer (Prepare for Database): Fields to stringify:', Array.from(fieldsToStringify));
  }

  if (fieldsToStringify.size === 0 && enableDebug) {
    // eslint-disable-next-line no-console
    console.log(
      'Schema Inferrer (Prepare for Database): No object/array fields found in schema. Data will pass through unchanged.',
    );
  }

  // Transform each item
  const outputItems: INodeExecutionData[] = items.map((item) => ({
    json: stringifyNestedFields(
      item.json,
      fieldsToStringify,
      skipAlreadyStringified,
      prettyPrint,
    ),
    pairedItem: item.pairedItem,
  }));

  return [outputItems];
}

