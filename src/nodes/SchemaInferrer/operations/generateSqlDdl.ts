import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import knex from 'knex';

interface JsonSchema {
  required?: string[];
  properties?: Record<string, unknown>;
  definitions?: Record<string, JsonSchema>;
  $ref?: string;
  type?: string | string[];
  anyOf?: Array<Record<string, unknown>>;
  oneOf?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

type JsonType = 
  | 'string' 
  | 'number' 
  | 'integer' 
  | 'boolean' 
  | 'object' 
  | 'array' 
  | 'null'
  | 'uuid'
  | 'date-time'
  | 'date'
  | 'time'
  | 'json'
  | 'jsonb'
  | 'text';

interface OverrideRule {
  fieldName: string;
  matchType: 'exact' | 'partial' | 'prefix' | 'suffix';
  newType: JsonType;
}

function lowercaseSchemaProperties(schema: JsonSchema): void {
  // Transform properties keys to lowercase
  if (schema.properties) {
    const newProperties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      newProperties[key.toLowerCase()] = value;
    }
    schema.properties = newProperties;
    
    // Update required array to match lowercased keys
    if (schema.required && Array.isArray(schema.required)) {
      schema.required = schema.required.map((field) => field.toLowerCase());
    }
  }
  
  // Recursively process definitions
  if (schema.definitions) {
    for (const definitionKey of Object.keys(schema.definitions)) {
      lowercaseSchemaProperties(schema.definitions[definitionKey]);
    }
  }
  
  // Recursively process nested objects in properties
  if (schema.properties) {
    for (const value of Object.values(schema.properties)) {
      if (value && typeof value === 'object') {
        const propSchema = value as JsonSchema;
        if (propSchema.properties || propSchema.items) {
          lowercaseSchemaProperties(propSchema);
        }
        // Handle array items
        if (propSchema.items && typeof propSchema.items === 'object') {
          const itemsSchema = propSchema.items as JsonSchema;
          if (itemsSchema.properties) {
            lowercaseSchemaProperties(itemsSchema);
          }
        }
      }
    }
  }
}

function sanitizeColumnName(
  name: string,
  lowercaseAllFields: boolean,
  quoteIdentifiers: boolean,
): string {
  let sanitized = name.trim();
  
  // Apply lowercasing if enabled
  if (lowercaseAllFields) {
    sanitized = sanitized.toLowerCase();
  }
  
  // If quoting is enabled, minimal sanitization (just trim)
  if (quoteIdentifiers) {
    return sanitized;
  }
  
  // Otherwise, sanitize for SQL portability
  sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '_');
  // Collapse multiple underscores
  sanitized = sanitized.replace(/_+/g, '_');
  // Ensure starts with letter or underscore
  if (sanitized.length > 0 && !/^[a-zA-Z_]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }
  
  return sanitized;
}

function normaliseType(t: string): JsonType | null {
  const lower = t.trim().toLowerCase();
  const map: Record<string, JsonType> = {
    string: 'string',
    str: 'string',
    number: 'number',
    num: 'number',
    float: 'number',
    double: 'number',
    decimal: 'number',
    integer: 'integer',
    int: 'integer',
    boolean: 'boolean',
    bool: 'boolean',
    object: 'object',
    obj: 'object',
    array: 'array',
    arr: 'array',
    null: 'null',
    uuid: 'uuid',
    'date-time': 'date-time',
    datetime: 'date-time',
    timestamp: 'date-time',
    date: 'date',
    time: 'time',
    json: 'json',
    jsonb: 'jsonb',
    text: 'text',
  };
  return map[lower] || null;
}

function parseOverrideRules(text: string): OverrideRule[] {
  if (!text || !text.trim()) return [];
  const rules: OverrideRule[] = [];
  const tokens = text.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
  for (const token of tokens) {
    // Formats supported:
    // - fieldName->newType (exact)
    // - *fieldName*->newType (partial contains)
    // - *suffix->newType   (suffix match)
    // - prefix*->newType   (prefix match)
    const arrowIdx = token.indexOf('->');
    if (arrowIdx === -1) continue;
    
    const leftPart = token.slice(0, arrowIdx).trim();
    const rightPart = token.slice(arrowIdx + 2).trim();
    
    const newType = normaliseType(rightPart);
    if (!newType) continue;
    
    let fieldName = leftPart;
    let matchType: 'exact' | 'partial' | 'prefix' | 'suffix' = 'exact';
    
    // Determine wildcard style
    const startsWithAsterisk = leftPart.startsWith('*');
    const endsWithAsterisk = leftPart.endsWith('*');
    if (startsWithAsterisk && endsWithAsterisk && leftPart.length > 2) {
      // *contains*
      fieldName = leftPart.slice(1, -1);
      matchType = 'partial';
    } else if (startsWithAsterisk && leftPart.length > 1) {
      // *suffix
      fieldName = leftPart.slice(1);
      matchType = 'suffix';
    } else if (endsWithAsterisk && leftPart.length > 1) {
      // prefix*
      fieldName = leftPart.slice(0, -1);
      matchType = 'prefix';
    }
    
    if (!fieldName) continue;
    
    rules.push({
      fieldName,
      matchType,
      newType,
    });
  }
  return rules;
}

function walkSchema(
  schema: JsonSchema,
  onField: (path: string, node: Record<string, unknown>) => void,
  currentPath = '',
): void {
  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      const dotPath = currentPath ? `${currentPath}.${key}` : key;
      const propNode = value as Record<string, unknown>;
      onField(dotPath, propNode);
      const propType = propNode.type;
      if (propType === 'object' && propNode.properties) {
        walkSchema(propNode as JsonSchema, onField, dotPath);
      } else if (propType === 'array' && propNode.items) {
        const items = propNode.items as Record<string, unknown>;
        if (items.type === 'object' && items.properties) {
          walkSchema(items as JsonSchema, onField, dotPath);
        }
      }
    }
  }
}

function applyOverrides(schema: JsonSchema, rules: OverrideRule[]): void {
  if (rules.length === 0) return;
  const appliedFields = new Set<string>();
  const formatTypes: JsonType[] = ['uuid', 'date-time', 'date', 'time'];
  const sqlSpecificTypes: JsonType[] = ['json', 'jsonb', 'text'];
  
  const matchesFieldName = (
    fieldName: string,
    ruleName: string,
    matchType: 'exact' | 'partial' | 'prefix' | 'suffix',
  ): boolean => {
    switch (matchType) {
      case 'exact':
        return fieldName === ruleName;
      case 'partial':
        return fieldName.includes(ruleName);
      case 'prefix':
        return fieldName.startsWith(ruleName);
      case 'suffix':
        return fieldName.endsWith(ruleName);
      default:
        return fieldName === ruleName;
    }
  };
  
  const applyToSchema = (target: JsonSchema): void => {
    walkSchema(target, (path, node) => {
      if (appliedFields.has(path)) return;
      
      // Extract just the field name (last part of path) for matching
      const fieldName = path.split('.').pop() || path;
      
      for (const rule of rules) {
        if (matchesFieldName(fieldName, rule.fieldName, rule.matchType)) {
          // Clear existing format if we're changing the type
          if (node.format) {
            delete node.format;
          }
          
          // Set format for format-based types
          if (formatTypes.includes(rule.newType)) {
            node.type = 'string';
            node.format = rule.newType;
          } else if (sqlSpecificTypes.includes(rule.newType)) {
            // For SQL-specific types like json/jsonb/text, set the base type
            if (rule.newType === 'json' || rule.newType === 'jsonb') {
              node.type = 'object';
              node.format = rule.newType;
            } else if (rule.newType === 'text') {
              node.type = 'string';
              node.format = 'text';
            }
          } else {
            // Standard JSON Schema types
            node.type = rule.newType;
          }
          
          appliedFields.add(path);
          break; // Apply first matching rule only
        }
      }
    });
  };

  // Apply to root schema
  applyToSchema(schema);
  // Also apply to definitions, if present
  if (schema.definitions) {
    for (const def of Object.values(schema.definitions)) {
      applyToSchema(def);
    }
  }
}

function validateTableName(tableName: string): boolean {
  if (!tableName || tableName.trim().length === 0) {
    throw new Error('Table name cannot be empty');
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error(
      'Table name must start with a letter or underscore and contain only letters, numbers, and underscores',
    );
  }
  return true;
}

function mapJsonSchemaTypeToKnex(
  property: Record<string, unknown>,
  columnName: string,
  table: knex.Knex.CreateTableBuilder,
  databaseType: string,
): knex.Knex.ColumnBuilder {
  const type = property.type as string | string[] | undefined;
  const format = property.format as string | undefined;
  let actualType: string;
  if (Array.isArray(type)) {
    actualType = type.find((t) => t !== 'null') || 'string';
  } else {
    actualType = type || 'string';
  }
  if (format) {
    switch (format) {
      case 'uuid':
        if (databaseType === 'pg' || databaseType === 'cockroachdb') {
          return table.specificType(columnName, 'uuid');
        }
        if (databaseType === 'mssql') {
          return table.specificType(columnName, 'uniqueidentifier');
        }
        if (databaseType === 'mysql2') {
          return table.specificType(columnName, 'char(36)');
        }
        if (databaseType === 'oracledb') {
          return table.specificType(columnName, 'char(36)');
        }
        return table.specificType(columnName, 'text');
      case 'date-time':
        if (databaseType === 'pg' || databaseType === 'cockroachdb') {
          return table.specificType(columnName, 'timestamptz');
        }
        if (databaseType === 'mssql') {
          return table.specificType(columnName, 'datetimeoffset');
        }
        return table.dateTime(columnName);
      case 'date':
        return table.date(columnName);
      case 'time':
        return table.time(columnName);
      case 'text':
        return table.text(columnName);
      case 'json':
        if (databaseType === 'mysql2') {
          return table.json(columnName);
        }
        if (databaseType === 'pg' || databaseType === 'cockroachdb') {
          return table.jsonb(columnName);
        }
        if (databaseType === 'mssql') {
          return table.specificType(columnName, 'nvarchar(max)');
        }
        if (databaseType === 'oracledb') {
          return table.specificType(columnName, 'clob');
        }
        return table.text(columnName);
      case 'jsonb':
        if (databaseType === 'pg' || databaseType === 'cockroachdb') {
          return table.jsonb(columnName);
        }
        if (databaseType === 'mysql2') {
          return table.json(columnName);
        }
        if (databaseType === 'mssql') {
          return table.specificType(columnName, 'nvarchar(max)');
        }
        if (databaseType === 'oracledb') {
          return table.specificType(columnName, 'clob');
        }
        return table.text(columnName);
      case 'email':
      case 'uri':
      case 'hostname':
        return table.string(columnName, 255);
      default:
        break;
    }
  }
  switch (actualType) {
    case 'string': {
      const maxLength = property.maxLength as number | undefined;
      if (maxLength && maxLength <= 255) {
        return table.string(columnName, maxLength);
      } else if (maxLength && maxLength > 255) {
        return table.text(columnName);
      }
      return table.string(columnName, 255);
    }
    case 'integer':
      return table.integer(columnName);
    case 'number':
      return table.decimal(columnName, 10, 2);
    case 'boolean':
      return table.boolean(columnName);
    case 'array':
      if (databaseType === 'pg' || databaseType === 'cockroachdb') {
        return table.jsonb(columnName);
      } else if (databaseType === 'mysql2') {
        return table.json(columnName);
      } else if (databaseType === 'mssql') {
        return table.specificType(columnName, 'nvarchar(max)');
      } else if (databaseType === 'oracledb') {
        return table.specificType(columnName, 'clob');
      }
      return table.text(columnName);
    case 'object':
      if (databaseType === 'pg' || databaseType === 'cockroachdb') {
        return table.jsonb(columnName);
      } else if (databaseType === 'mysql2') {
        return table.json(columnName);
      } else if (databaseType === 'mssql') {
        return table.specificType(columnName, 'nvarchar(max)');
      } else if (databaseType === 'oracledb') {
        return table.specificType(columnName, 'clob');
      }
      return table.text(columnName);
    default:
      return table.string(columnName, 255);
  }
}

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

function processSchemaProperties(
  schema: JsonSchema,
  table: knex.Knex.CreateTableBuilder,
  databaseType: string,
  primaryKeyFields: string[],
  lowercaseAllFields: boolean,
  quoteIdentifiers: boolean,
): void {
  if (!schema.properties) {
    throw new Error('Schema has no properties to convert');
  }
  const requiredFields = schema.required || [];
  const properties = schema.properties as Record<string, Record<string, unknown>>;
  
  // Sanitize primary key fields for comparison
  const sanitizedPrimaryKeyFields = primaryKeyFields.map((field) =>
    sanitizeColumnName(field, lowercaseAllFields, quoteIdentifiers),
  );
  
  for (const [propertyName, propertyDef] of Object.entries(properties)) {
    const sanitizedName = sanitizeColumnName(propertyName, lowercaseAllFields, quoteIdentifiers);
    // Compare sanitized names for primary key matching
    const isPrimaryKey = sanitizedPrimaryKeyFields.includes(sanitizedName);
    const listedRequired = requiredFields.includes(propertyName);
    const allowsNull = schemaAllowsNull(propertyDef);
    const isRequired = listedRequired && !allowsNull;
    const propType = (propertyDef as { type?: unknown }).type;
    if (isPrimaryKey && propType === 'integer') {
      table.increments(sanitizedName).primary();
    } else {
      const column = mapJsonSchemaTypeToKnex(propertyDef, sanitizedName, table, databaseType);
      if (isPrimaryKey) {
        column.primary();
      }
      if (isRequired && !isPrimaryKey) {
        column.notNullable();
      }
    }
  }
}

function getWrapIdentifier(
  databaseType: string,
  quoteIdentifiers: boolean,
): ((identifier: string) => string) | undefined {
  if (!quoteIdentifiers) {
    return undefined;
  }
  
  return (identifier: string): string => {
    switch (databaseType) {
      case 'pg':
      case 'cockroachdb':
        // PostgreSQL: double quotes, escape inner quotes by doubling
        return `"${identifier.replace(/"/g, '""')}"`;
      case 'mysql2':
      case 'sqlite3':
        // MySQL/SQLite: backticks, escape inner backticks by doubling
        return `\`${identifier.replace(/`/g, '``')}\``;
      case 'mssql':
        // MSSQL: square brackets, escape inner brackets by doubling
        return `[${identifier.replace(/\[/g, '[[').replace(/\]/g, ']]')}]`;
      case 'oracledb':
        // Oracle: double quotes, escape inner quotes by doubling
        return `"${identifier.replace(/"/g, '""')}"`;
      default:
        // Default to double quotes
        return `"${identifier.replace(/"/g, '""')}"`;
    }
  };
}

function convertSchemaToSql(
  schema: JsonSchema,
  tableName: string,
  databaseType: string,
  primaryKeyFields: string[],
  lowercaseAllFields: boolean,
  quoteIdentifiers: boolean,
): string {
  const wrapIdentifier = getWrapIdentifier(databaseType, quoteIdentifiers);
  const knexConfig: knex.Knex.Config = {
    client: databaseType === 'cockroachdb' ? 'pg' : databaseType,
    connection: {
      host: 'localhost',
      user: 'user',
      password: 'password',
      database: 'database',
    },
  };
  
  if (wrapIdentifier) {
    knexConfig.wrapIdentifier = wrapIdentifier;
  }
  
  const knexInstance = knex(knexConfig);
  try {
    const sanitizedTableName = quoteIdentifiers
      ? tableName
      : sanitizeColumnName(tableName, lowercaseAllFields, false);
    const builder = knexInstance.schema.createTable(sanitizedTableName, (table) => {
      processSchemaProperties(
        schema,
        table,
        databaseType,
        primaryKeyFields,
        lowercaseAllFields,
        quoteIdentifiers,
      );
    });
    const sqlArray = builder.toSQL();
    if (sqlArray.length === 0) {
      throw new Error('Failed to generate SQL: No queries generated');
    }
    return sqlArray[0].sql;
  } finally {
    void knexInstance.destroy();
  }
}

function findSchemaProperties(schema: JsonSchema): {
  properties: Record<string, Record<string, unknown>>;
  sourceSchema: JsonSchema;
} | null {
  if (schema.properties && Object.keys(schema.properties).length > 0) {
    return {
      properties: schema.properties as Record<string, Record<string, unknown>>,
      sourceSchema: schema,
    };
  }
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

function resolveLocalRef(ref: string, root: JsonSchema): JsonSchema | null {
  if (!ref.startsWith('#/')) return null;
  const path = ref.slice(2).split('/');
  let current: unknown = root;
  for (const segment of path) {
    if (typeof current !== 'object' || current === null) return null;
    const obj = current as Record<string, unknown>;
    current = obj[segment];
  }
  if (isJsonSchema(current)) {
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

function dereferenceSchema(schema: JsonSchema, root: JsonSchema): JsonSchema {
  let current: JsonSchema = schema;
  const visited = new Set<JsonSchema>();
  while (current && typeof current === 'object' && isRefSchema(current) && !visited.has(current)) {
    visited.add(current);
    const ref = current.$ref;
    const resolved = resolveLocalRef(ref, root);
    if (!resolved) break;
    current = { ...resolved, definitions: resolved.definitions ?? root.definitions };
  }
  if (current && typeof current === 'object' && !current.definitions && root.definitions) {
    current.definitions = root.definitions;
  }
  return current;
}

function getEffectiveRootObjectSchema(root: JsonSchema): JsonSchema {
  let effective = dereferenceSchema(root, root);
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
      const resolvedOnlyProp = dereferenceSchema(onlyProp, effective);
      const resolvedType = resolvedOnlyProp.type;
      const isObjectType =
        resolvedOnlyProp.properties ||
        resolvedType === 'object' ||
        (Array.isArray(resolvedType) && resolvedType.includes('object'));
      if (isObjectType && resolvedOnlyProp.properties) {
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

export function generateSqlDdl(
  context: IExecuteFunctions,
  enableDebug: boolean,
): INodeExecutionData[][] {
  const items = context.getInputData();
  if (items.length === 0) {
    throw new NodeOperationError(
      context.getNode(),
      'No input data provided. Please provide a JSON schema.',
    );
  }
  const item = items[0];
  let schema = (item.json.schema as JsonSchema | undefined) || (item.json as JsonSchema | undefined);
  if (!schema) {
    throw new NodeOperationError(
      context.getNode(),
      'Input must contain a "schema" property or be a valid JSON Schema object.',
    );
  }
  const effectiveRoot = getEffectiveRootObjectSchema(schema);
  let propertiesInfo = findSchemaProperties(effectiveRoot);
  if (!propertiesInfo) {
    throw new NodeOperationError(
      context.getNode(),
      'Schema must have at least one property to generate SQL. Check that the schema has a "properties" object at the root level or in "definitions".',
    );
  }
  schema = propertiesInfo.sourceSchema;
  
  // Get naming options
  const namingOptionsRaw = context.getNodeParameter('namingOptions', 0, {}) as {
    lowercaseAllFields?: boolean;
    quoteIdentifiers?: boolean;
  };
  const lowercaseAllFields = namingOptionsRaw.lowercaseAllFields ?? false;
  const quoteIdentifiers = namingOptionsRaw.quoteIdentifiers ?? false;
  
  // Apply lowercasing if enabled (before other processing)
  if (lowercaseAllFields) {
    lowercaseSchemaProperties(schema);
    // Re-find properties after lowercasing
    const updatedPropertiesInfo = findSchemaProperties(schema);
    if (updatedPropertiesInfo) {
      propertiesInfo = updatedPropertiesInfo;
      schema = propertiesInfo.sourceSchema;
    }
  }
  
  const databaseType = context.getNodeParameter('databaseType', 0) as string;
  const tableName = context.getNodeParameter('tableName', 0) as string;
  try {
    validateTableName(tableName);
  } catch (error) {
    if (error instanceof Error) {
      throw new NodeOperationError(context.getNode(), `Invalid table name: ${error.message}`);
    }
    throw error;
  }
  const primaryKeyOptionsRaw = context.getNodeParameter('primaryKeyOptions', 0, {}) as {
    autoDetectPrimaryKey?: boolean;
    primaryKeyFields?: string;
  };
  const autoDetectPrimaryKey = primaryKeyOptionsRaw.autoDetectPrimaryKey ?? true;
  const primaryKeyFieldsInput = primaryKeyOptionsRaw.primaryKeyFields ?? '';
  let primaryKeyFields: string[] = [];
  if (primaryKeyFieldsInput && primaryKeyFieldsInput.trim()) {
    primaryKeyFields = primaryKeyFieldsInput
      .split(',')
      .map((field) => field.trim())
      .filter((field) => field.length > 0);
    // Lowercase primary key fields if lowercasing is enabled
    if (lowercaseAllFields) {
      primaryKeyFields = primaryKeyFields.map((field) => field.toLowerCase());
    }
  } else if (autoDetectPrimaryKey) {
    const propertyNames = Object.keys(propertiesInfo.properties);
    for (const propName of propertyNames) {
      if (propName.toLowerCase() === 'id') {
        primaryKeyFields.push(propName);
        break;
      }
    }
  }

  const sqlOverrideOptionsRaw = context.getNodeParameter('sqlOverrideOptions', 0, {}) as {
    overrideRulesText?: string;
    overrideRules?: { rule?: Array<{ fieldName: string; matchType: 'exact' | 'partial'; newType: string }> };
  };
  const overrideRulesText = sqlOverrideOptionsRaw.overrideRulesText ?? '';
  const parsedRules = parseOverrideRules(overrideRulesText);
  const advancedRulesRaw = sqlOverrideOptionsRaw.overrideRules?.rule ?? [];
  const advancedRules: OverrideRule[] = advancedRulesRaw
    .filter((r) => {
      const fieldName = r.fieldName?.trim();
      const newType = normaliseType(r.newType);
      return fieldName && fieldName.length > 0 && newType !== null;
    })
    .map((r) => ({
      fieldName: r.fieldName.trim(),
      matchType: r.matchType || 'exact',
      newType: normaliseType(r.newType)!,
    }));
  const combinedRules = [...parsedRules, ...advancedRules];
  applyOverrides(schema, combinedRules);

  try {
    const sql = convertSchemaToSql(
      schema,
      tableName,
      databaseType,
      primaryKeyFields,
      lowercaseAllFields,
      quoteIdentifiers,
    );
    const capDebug = (value: unknown): unknown => {
      try {
        const MAX_BYTES = 10 * 1024;
        if (typeof value === 'string') {
          return value.length > MAX_BYTES ? `${value.slice(0, MAX_BYTES)}…[truncated]` : value;
        }
        if (Array.isArray(value)) {
          const json = JSON.stringify(value);
          if (json.length > MAX_BYTES) {
            const trimmed: unknown[] = [];
            for (const el of value) {
              trimmed.push(el);
              if (JSON.stringify(trimmed).length > MAX_BYTES) {
                trimmed.pop();
                break;
              }
            }
            return [...trimmed, '…[truncated]'];
          }
          return value;
        }
        if (typeof value === 'object' && value !== null) {
          const json = JSON.stringify(value);
          if (json.length > MAX_BYTES) {
            const result: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
              result[k] = capDebug(v);
              if (JSON.stringify(result).length > MAX_BYTES) {
                result[k] = '…[truncated]';
                break;
              }
            }
            return result;
          }
          return value;
        }
        return value;
      } catch {
        return value;
      }
    };
    const json: IDataObject = {
      sql,
      tableName,
      databaseType,
    };
    if (enableDebug) {
      json.debug = capDebug({
        effectiveRootHasProperties: !!schema.properties,
        primaryKeyFields,
        knexClientUsed: databaseType === 'cockroachdb' ? 'pg' : databaseType,
      }) as IDataObject;
    }
    return [[{ json }]];
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


