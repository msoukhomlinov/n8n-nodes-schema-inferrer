import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { quicktype, InputData, jsonInputForTargetLanguage } from 'quicktype-core';
import knex from 'knex';
import { schemaInferrerNodeProperties } from './index.js';

/**
 * JSON Schema structure for the inferred schema
 */
interface JsonSchema {
  required?: string[];
  properties?: Record<string, unknown>;
  definitions?: Record<string, JsonSchema>;
  $ref?: string;
  [key: string]: unknown;
}

/**
 * Helper function to match field names based on matching options
 * @param requiredField - The field name from the CSV input
 * @param propertyName - The property name from the schema
 * @param useSubstring - Whether to use substring matching
 * @param caseInsensitive - Whether to ignore case
 * @returns true if the property matches the required field
 */
function matchesField(
  requiredField: string,
  propertyName: string,
  useSubstring: boolean,
  caseInsensitive: boolean,
): boolean {
  let fieldToMatch = requiredField;
  let propToMatch = propertyName;

  if (caseInsensitive) {
    fieldToMatch = fieldToMatch.toLowerCase();
    propToMatch = propToMatch.toLowerCase();
  }

  if (useSubstring) {
    return propToMatch.includes(fieldToMatch);
  }

  return fieldToMatch === propToMatch;
}

/**
 * Recursively clear all required arrays in a schema and its definitions
 * @param schema - The schema object to process
 */
function clearAllRequiredFields(schema: JsonSchema): void {
  // Clear required array at current level
  if (schema.required) {
    schema.required = [];
  }

  // Recursively process definitions
  if (schema.definitions) {
    for (const definitionKey of Object.keys(schema.definitions)) {
      clearAllRequiredFields(schema.definitions[definitionKey]);
    }
  }
}

/**
 * Recursively set required fields in a schema and its definitions
 * @param schema - The schema object to process
 * @param requiredFieldNames - Array of field names to mark as required
 * @param useSubstring - Whether to use substring matching
 * @param caseInsensitive - Whether to ignore case
 */
function setRequiredFields(
  schema: JsonSchema,
  requiredFieldNames: string[],
  useSubstring: boolean,
  caseInsensitive: boolean,
): void {
  // Process properties at current level
  if (schema.properties) {
    const matchedProperties: string[] = [];
    const propertyNames = Object.keys(schema.properties);

    for (const requiredField of requiredFieldNames) {
      for (const propertyName of propertyNames) {
        if (matchesField(requiredField, propertyName, useSubstring, caseInsensitive)) {
          if (!matchedProperties.includes(propertyName)) {
            matchedProperties.push(propertyName);
          }
        }
      }
    }

    // Set the required array with matched properties
    if (matchedProperties.length > 0) {
      schema.required = matchedProperties;
    }
  }

  // Recursively process definitions
  if (schema.definitions) {
    for (const definitionKey of Object.keys(schema.definitions)) {
      setRequiredFields(
        schema.definitions[definitionKey],
        requiredFieldNames,
        useSubstring,
        caseInsensitive,
      );
    }
  }
}

export class SchemaInferrer implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Schema Inferrer',
    name: 'schemaInferrer',
    group: ['transform'],
    version: 1,
    description: 'Infer JSON schema from one or multiple input JSON data items',
    defaults: {
      name: 'Schema Inferrer',
    },
    inputs: ['main'],
    outputs: ['main'],
    icon: 'file:schema-inferrer.svg',
    properties: schemaInferrerNodeProperties,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const operation = this.getNodeParameter('operation', 0);

    switch (operation) {
      case 'create':
        return await createSchema(this);
      case 'generateSqlDdl':
        return await generateSqlDdl(this);
      default:
        throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
    }
  }
}

/**
 * Create a JSON schema from one or more input JSON data items
 */
async function createSchema(context: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = context.getInputData();

  if (items.length === 0) {
    throw new Error('No input data provided. Please provide at least one JSON item.');
  }

  // Collect all JSON samples from input items
  const jsonSamples: string[] = [];
  for (const item of items) {
    const jsonData = item.json ?? {};
    // Convert JSON object to string for quicktype
    const jsonString = JSON.stringify(jsonData);
    jsonSamples.push(jsonString);
  }

  try {
    // Create JSON input for schema target language
    const jsonInput = jsonInputForTargetLanguage('schema');

    // Add all samples to the input (they will be merged into one unified schema)
    await jsonInput.addSource({
      name: 'Root',
      samples: jsonSamples,
    });

    // Create input data and add the JSON input
    const inputData = new InputData();
    inputData.addInput(jsonInput);

    // Read inference options with defaults
    const inferenceOptionsRaw = context.getNodeParameter('inferenceOptions', 0, {}) as {
      inferMaps?: boolean;
      inferEnums?: boolean;
      inferDateTimes?: boolean;
      inferUuids?: boolean;
      inferBoolStrings?: boolean;
      inferIntegerStrings?: boolean;
    };

    // Apply defaults for inference options (quicktype-core defaults are all true)
    const inferenceOptions = {
      inferMaps: inferenceOptionsRaw.inferMaps ?? true,
      inferEnums: inferenceOptionsRaw.inferEnums ?? true,
      inferDateTimes: inferenceOptionsRaw.inferDateTimes ?? true,
      inferUuids: inferenceOptionsRaw.inferUuids ?? true,
      inferBoolStrings: inferenceOptionsRaw.inferBoolStrings ?? true,
      inferIntegerStrings: inferenceOptionsRaw.inferIntegerStrings ?? true,
    };

    // Read output formatting options with defaults
    const outputFormattingRaw = context.getNodeParameter('outputFormatting', 0, {}) as {
      alphabetizeProperties?: boolean;
      indentation?: number;
      leadingComments?: string;
    };

    // Apply defaults for output formatting options
    const outputFormatting = {
      alphabetizeProperties: outputFormattingRaw.alphabetizeProperties ?? false,
      indentation: outputFormattingRaw.indentation ?? 2,
      leadingComments: outputFormattingRaw.leadingComments ?? '',
    };

    // Build quicktype options object
    const quicktypeOptions: {
      inputData: InputData;
      lang: 'schema';
      inferMaps: boolean;
      inferEnums: boolean;
      inferDateTimes: boolean;
      inferUuids: boolean;
      inferBoolStrings: boolean;
      inferIntegerStrings: boolean;
      alphabetizeProperties: boolean;
      indentation: string;
      leadingComments?: string[];
    } = {
      inputData,
      lang: 'schema' as const,
      inferMaps: inferenceOptions.inferMaps,
      inferEnums: inferenceOptions.inferEnums,
      inferDateTimes: inferenceOptions.inferDateTimes,
      inferUuids: inferenceOptions.inferUuids,
      inferBoolStrings: inferenceOptions.inferBoolStrings,
      inferIntegerStrings: inferenceOptions.inferIntegerStrings,
      alphabetizeProperties: outputFormatting.alphabetizeProperties,
      indentation: ' '.repeat(outputFormatting.indentation),
    };

    // Add leading comments if provided
    if (outputFormatting.leadingComments && outputFormatting.leadingComments.trim()) {
      // Split by newlines and filter out empty lines
      quicktypeOptions.leadingComments = outputFormatting.leadingComments
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    }

    // Generate JSON schema using quicktype
    const { lines } = await quicktype(quicktypeOptions);

    // Join lines to get the schema string and parse it to JSON
    const schemaString = lines.join('\n');
    const schema = JSON.parse(schemaString) as JsonSchema;

    // Process required fields configuration
    const requiredFieldOptionsRaw = context.getNodeParameter('requiredFieldOptions', 0, {}) as {
      requiredFields?: string;
      useSubstringMatching?: boolean;
      caseInsensitiveMatching?: boolean;
    };
    const requiredFields = requiredFieldOptionsRaw.requiredFields ?? '';
    const useSubstringMatching = requiredFieldOptionsRaw.useSubstringMatching ?? false;
    const caseInsensitiveMatching = requiredFieldOptionsRaw.caseInsensitiveMatching ?? false;

    // Clear all required arrays throughout the schema (including nested definitions)
    clearAllRequiredFields(schema);

    // Process required fields if provided
    if (requiredFields && requiredFields.trim()) {
      const requiredFieldNames = requiredFields
        .split(',')
        .map((field) => field.trim())
        .filter((field) => field.length > 0);

      // Set required fields recursively throughout the schema
      setRequiredFields(schema, requiredFieldNames, useSubstringMatching, caseInsensitiveMatching);
    }

    // Return the schema as a single output item
    return [[{ json: { schema } }]];
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to infer JSON schema: ${error.message}`);
    }
    throw new Error('Failed to infer JSON schema: Unknown error');
  }
}

/**
 * Sanitize a column name to be SQL-safe
 * @param name - The column name to sanitize
 * @returns Sanitized column name
 */
function sanitizeColumnName(name: string): string {
  // Replace spaces and special characters with underscores
  return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

/**
 * Validate a table name
 * @param tableName - The table name to validate
 * @returns true if valid
 * @throws Error if invalid
 */
function validateTableName(tableName: string): boolean {
  if (!tableName || tableName.trim().length === 0) {
    throw new Error('Table name cannot be empty');
  }
  // Check for SQL injection patterns and invalid characters
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error(
      'Table name must start with a letter or underscore and contain only letters, numbers, and underscores',
    );
  }
  return true;
}

/**
 * Map JSON Schema type to Knex column type
 * @param property - The JSON Schema property definition
 * @param columnName - The name of the column
 * @param table - The Knex table builder
 * @param databaseType - The database type
 * @returns The Knex column builder
 */
function mapJsonSchemaTypeToKnex(
  property: Record<string, unknown>,
  columnName: string,
  table: knex.Knex.CreateTableBuilder,
  databaseType: string,
): knex.Knex.ColumnBuilder {
  const type = property.type as string | string[] | undefined;
  const format = property.format as string | undefined;

  // Handle union types (e.g., ["string", "null"])
  let actualType: string;
  if (Array.isArray(type)) {
    // Find the first non-null type
    actualType = type.find((t) => t !== 'null') || 'string';
  } else {
    actualType = type || 'string';
  }

  // Handle based on format first
  if (format) {
    switch (format) {
      case 'uuid':
        if (databaseType === 'pg' || databaseType === 'cockroachdb') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return table.specificType(columnName, 'uuid');
        }
        if (databaseType === 'mssql') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return table.specificType(columnName, 'uniqueidentifier');
        }
        if (databaseType === 'mysql2') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return table.specificType(columnName, 'char(36)');
        }
        if (databaseType === 'oracledb') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return table.specificType(columnName, 'char(36)');
        }
        // sqlite and others
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.specificType(columnName, 'text');
      case 'date-time':
        if (databaseType === 'pg' || databaseType === 'cockroachdb') {
          // timestamptz on Postgres/Cockroach
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return table.specificType(columnName, 'timestamptz');
        }
        if (databaseType === 'mssql') {
          // DATETIMEOFFSET on MSSQL via specificType for better TZ semantics
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return table.specificType(columnName, 'datetimeoffset');
        }
        // MySQL/MariaDB/SQLite -> DATETIME
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.dateTime(columnName);
      case 'date':
        // date without time
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.date(columnName);
      case 'time':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.time(columnName);
      case 'email':
      case 'uri':
      case 'hostname':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.string(columnName, 255);
      default:
        break;
    }
  }

  // Handle based on type
  switch (actualType) {
    case 'string':
      {
        // Check if there's a maxLength constraint
        const maxLength = property.maxLength as number | undefined;
        if (maxLength && maxLength <= 255) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return table.string(columnName, maxLength);
        } else if (maxLength && maxLength > 255) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return table.text(columnName);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.string(columnName, 255);
      }

    case 'integer':
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return table.integer(columnName);

    case 'number':
      // Check if there's precision info
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return table.decimal(columnName, 10, 2);

    case 'boolean':
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return table.boolean(columnName);

    case 'array':
      // Use appropriate JSON type based on database
      if (databaseType === 'pg' || databaseType === 'cockroachdb') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.jsonb(columnName);
      } else if (databaseType === 'mysql2') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.json(columnName);
      } else if (databaseType === 'mssql') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.specificType(columnName, 'nvarchar(max)');
      } else if (databaseType === 'oracledb') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.specificType(columnName, 'clob');
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return table.text(columnName);

    case 'object':
      // Use appropriate JSON type based on database
      if (databaseType === 'pg' || databaseType === 'cockroachdb') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.jsonb(columnName);
      } else if (databaseType === 'mysql2') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.json(columnName);
      } else if (databaseType === 'mssql') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.specificType(columnName, 'nvarchar(max)');
      } else if (databaseType === 'oracledb') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return table.specificType(columnName, 'clob');
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return table.text(columnName);

    default:
      // Default to string for unknown types
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return table.string(columnName, 255);
  }
}

/**
 * Determine if a schema property explicitly allows null values
 */
function schemaAllowsNull(property: Record<string, unknown>): boolean {
  const type = property.type as string | string[] | undefined;
  if (type === 'null') return true;
  if (Array.isArray(type) && type.includes('null')) return true;

  const anyOf = property.anyOf as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(anyOf) && anyOf.some((alt) => alt.type === 'null')) return true;

  const oneOf = property.oneOf as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(oneOf) && oneOf.some((alt) => alt.type === 'null')) return true;

  return false;
}

/**
 * Process schema properties and build Knex table definition
 * @param schema - The JSON Schema to process
 * @param table - The Knex table builder
 * @param databaseType - The database type
 * @param primaryKeyFields - Array of primary key field names
 */
function processSchemaProperties(
  schema: JsonSchema,
  table: knex.Knex.CreateTableBuilder,
  databaseType: string,
  primaryKeyFields: string[],
): void {
  if (!schema.properties) {
    throw new Error('Schema has no properties to convert');
  }

  const requiredFields = schema.required || [];
  const properties = schema.properties as Record<string, Record<string, unknown>>;

  for (const [propertyName, propertyDef] of Object.entries(properties)) {
    const sanitizedName = sanitizeColumnName(propertyName);
    const isPrimaryKey = primaryKeyFields.includes(propertyName);
    // If property explicitly allows null, treat it as nullable even if listed in required
    const listedRequired = requiredFields.includes(propertyName);
    const allowsNull = schemaAllowsNull(propertyDef);
    const isRequired = listedRequired && !allowsNull;

    // Check if this is an integer primary key that should use increments
    if (isPrimaryKey && propertyDef.type === 'integer') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      table.increments(sanitizedName).primary();
    } else {
      // Map the type and create the column
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const column = mapJsonSchemaTypeToKnex(propertyDef, sanitizedName, table, databaseType);

      // Apply constraints
      if (isPrimaryKey) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        column.primary();
      }
      if (isRequired && !isPrimaryKey) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        column.notNullable();
      }
    }
  }
}

/**
 * Convert JSON Schema to SQL DDL using Knex
 * @param schema - The JSON Schema to convert
 * @param tableName - The name of the table
 * @param databaseType - The database type
 * @param primaryKeyFields - Array of primary key field names
 * @returns The SQL CREATE TABLE statement
 */
function convertSchemaToSql(
  schema: JsonSchema,
  tableName: string,
  databaseType: string,
  primaryKeyFields: string[],
): string {
  // Initialize Knex with the selected database client
  // We need a dummy connection config even though we're only using toSQL()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const knexInstance = knex({
    client: databaseType,
    connection: {
      // Dummy connection - won't be used for toSQL()
      host: 'localhost',
      user: 'user',
      password: 'password',
      database: 'database',
    },
  });

  try {
    // Build the CREATE TABLE statement
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const builder = knexInstance.schema.createTable(tableName, (table) => {
      processSchemaProperties(schema, table, databaseType, primaryKeyFields);
    });

    // Get the SQL string
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const sqlArray = builder.toSQL();

    // toSQL() returns an array of query objects
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (sqlArray.length === 0) {
      throw new Error('Failed to generate SQL: No queries generated');
    }

    // Return the SQL string from the first query
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return sqlArray[0].sql;
  } finally {
    // Clean up the Knex instance
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    knexInstance.destroy();
  }
}

/**
 * Find schema properties from root or definitions
 * @param schema - The JSON Schema to search
 * @returns Object with properties and the schema they came from, or null if not found
 */
function findSchemaProperties(schema: JsonSchema): {
  properties: Record<string, Record<string, unknown>>;
  sourceSchema: JsonSchema;
} | null {
  // Check root level properties first
  if (schema.properties && Object.keys(schema.properties).length > 0) {
    return {
      properties: schema.properties as Record<string, Record<string, unknown>>,
      sourceSchema: schema,
    };
  }

  // Check definitions for properties
  if (schema.definitions) {
    for (const [, defSchema] of Object.entries(schema.definitions)) {
      if (defSchema.properties && Object.keys(defSchema.properties).length > 0) {
        return {
          properties: defSchema.properties as Record<string, Record<string, unknown>>,
          sourceSchema: defSchema,
        };
      }
    }
  }

  return null;
}

/**
 * Resolve a local $ref like "#/definitions/Name" against the root schema
 */
function resolveLocalRef(ref: string, root: JsonSchema): JsonSchema | null {
  if (!ref.startsWith('#/')) return null;
  const path = ref.slice(2).split('/'); // remove "#/" then split
  let current: unknown = root;
  for (const segment of path) {
    if (typeof current !== 'object' || current === null) return null;
    const obj = current as Record<string, unknown>;
    current = obj[segment];
  }
  if (isJsonSchema(current)) {
    // Attach original definitions so nested $ref can still resolve
    if (!current.definitions && root.definitions) {
      current.definitions = root.definitions;
    }
    return current;
  }
  return null;
}

function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null;
}

function isRefSchema(value: JsonSchema): value is JsonSchema & { $ref: string } {
  return typeof value.$ref === 'string' && value.$ref.length > 0;
}

/**
 * Follow $ref chains to return the final referenced schema
 */
function dereferenceSchema(schema: JsonSchema, root: JsonSchema): JsonSchema {
  let current: JsonSchema = schema;
  // Follow $ref if present
  const visited = new Set<JsonSchema>();
  while (current && typeof current === 'object' && isRefSchema(current) && !visited.has(current)) {
    visited.add(current);
    const ref = current.$ref;
    const resolved = resolveLocalRef(ref, root);
    if (!resolved) break;
    current = { ...resolved, definitions: resolved.definitions ?? root.definitions };
  }
  // Ensure definitions are preserved
  if (current && typeof current === 'object' && !current.definitions && root.definitions) {
    current.definitions = root.definitions;
  }
  return current;
}

/**
 * Get the effective root object schema:
 * - Resolve root-level $ref
 * - If the resulting object has a single object property (possibly via $ref), flatten to that
 */
function getEffectiveRootObjectSchema(root: JsonSchema): JsonSchema {
  let effective = dereferenceSchema(root, root);

  // If effective has no properties, try to find via definitions (fallback)
  if (!effective.properties && effective.definitions) {
    const info = findSchemaProperties(effective);
    if (info) {
      effective = info.sourceSchema;
    }
  }

  if (effective.properties) {
    const keys = Object.keys(effective.properties);
    if (keys.length === 1) {
      const onlyKey = keys[0];
      const onlyProp = (effective.properties as Record<string, JsonSchema>)[onlyKey];
      // Resolve $ref if present on the only property
      const resolvedOnlyProp = dereferenceSchema(onlyProp, effective);
      const resolvedType = resolvedOnlyProp.type as string | string[] | undefined;
      const isObjectType =
        resolvedOnlyProp.properties ||
        resolvedType === 'object' ||
        Array.isArray(resolvedType) && resolvedType.includes('object');
      if (isObjectType && resolvedOnlyProp.properties) {
        // Flatten: use the properties and required of the referenced object
        return {
          properties: resolvedOnlyProp.properties,
          required: resolvedOnlyProp.required || [],
          definitions: effective.definitions,
        };
      }
    }
  }

  return effective;
}

/**
 * Generate SQL DDL from a JSON schema
 */
async function generateSqlDdl(context: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  // Satisfy lint rule requiring at least one await in async function
  await Promise.resolve();
  const items = context.getInputData();

  if (items.length === 0) {
    throw new NodeOperationError(
      context.getNode(),
      'No input data provided. Please provide a JSON schema.',
    );
  }

  // Get the first item (we only process one schema at a time)
  const item = items[0];

  // Extract schema from input - try item.json.schema first, then item.json directly
  let schema = (item.json.schema as JsonSchema | undefined) || (item.json as JsonSchema | undefined);

  if (!schema) {
    throw new NodeOperationError(
      context.getNode(),
      'Input must contain a "schema" property or be a valid JSON Schema object.',
    );
  }

  // Resolve $ref and flatten single-object roots (e.g., attributes)
  const effectiveRoot = getEffectiveRootObjectSchema(schema);

  // Ensure we have properties to process
  const propertiesInfo = findSchemaProperties(effectiveRoot);
  if (!propertiesInfo) {
    throw new NodeOperationError(
      context.getNode(),
      'Schema must have at least one property to generate SQL. Check that the schema has a "properties" object at the root level or in "definitions".',
    );
  }
  // Use the effective schema that contains properties
  schema = propertiesInfo.sourceSchema;

  // Get configuration parameters
  const databaseType = context.getNodeParameter('databaseType', 0) as string;
  const tableName = context.getNodeParameter('tableName', 0) as string;

  // Validate table name
  try {
    validateTableName(tableName);
  } catch (error) {
    if (error instanceof Error) {
      throw new NodeOperationError(context.getNode(), `Invalid table name: ${error.message}`);
    }
    throw error;
  }

  // Get primary key options
  const primaryKeyOptionsRaw = context.getNodeParameter('primaryKeyOptions', 0, {}) as {
    autoDetectPrimaryKey?: boolean;
    primaryKeyFields?: string;
  };

  const autoDetectPrimaryKey = primaryKeyOptionsRaw.autoDetectPrimaryKey ?? true;
  const primaryKeyFieldsInput = primaryKeyOptionsRaw.primaryKeyFields ?? '';

  // Determine primary key fields
  let primaryKeyFields: string[] = [];

  if (primaryKeyFieldsInput && primaryKeyFieldsInput.trim()) {
    // User specified primary key fields
    primaryKeyFields = primaryKeyFieldsInput
      .split(',')
      .map((field) => field.trim())
      .filter((field) => field.length > 0);
  } else if (autoDetectPrimaryKey) {
    // Auto-detect "id" field (case-insensitive) from the found properties
    const propertyNames = Object.keys(propertiesInfo.properties);

    for (const propName of propertyNames) {
      if (propName.toLowerCase() === 'id') {
        primaryKeyFields.push(propName);
        break;
      }
    }
  }

  // Warn if schema has definitions (we only process root schema)
  if (schema.definitions && Object.keys(schema.definitions).length > 0) {
    // Note: In a real implementation, you might want to log this warning
    // For now, we'll just proceed with the root schema
  }

  try {
    // Convert schema to SQL
    const sql = convertSchemaToSql(schema, tableName, databaseType, primaryKeyFields);

    // Return the result
    return [
      [
        {
          json: {
            sql,
            tableName,
            databaseType,
          },
        },
      ],
    ];
  } catch (error) {
    if (error instanceof Error) {
      throw new NodeOperationError(
        context.getNode(),
        `Failed to generate SQL DDL: ${error.message}`,
      );
    }
    throw new NodeOperationError(context.getNode(), 'Failed to generate SQL DDL: Unknown error');
  }
}

