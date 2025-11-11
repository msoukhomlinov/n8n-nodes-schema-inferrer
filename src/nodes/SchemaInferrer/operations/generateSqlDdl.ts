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

function sanitizeColumnName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
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
): void {
  if (!schema.properties) {
    throw new Error('Schema has no properties to convert');
  }
  const requiredFields = schema.required || [];
  const properties = schema.properties as Record<string, Record<string, unknown>>;
  for (const [propertyName, propertyDef] of Object.entries(properties)) {
    const sanitizedName = sanitizeColumnName(propertyName);
    const isPrimaryKey = primaryKeyFields.includes(propertyName);
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

function convertSchemaToSql(
  schema: JsonSchema,
  tableName: string,
  databaseType: string,
  primaryKeyFields: string[],
): string {
  const knexInstance = knex({
    client: databaseType === 'cockroachdb' ? 'pg' : databaseType,
    connection: {
      host: 'localhost',
      user: 'user',
      password: 'password',
      database: 'database',
    },
  });
  try {
    const builder = knexInstance.schema.createTable(tableName, (table) => {
      processSchemaProperties(schema, table, databaseType, primaryKeyFields);
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
  const propertiesInfo = findSchemaProperties(effectiveRoot);
  if (!propertiesInfo) {
    throw new NodeOperationError(
      context.getNode(),
      'Schema must have at least one property to generate SQL. Check that the schema has a "properties" object at the root level or in "definitions".',
    );
  }
  schema = propertiesInfo.sourceSchema;
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
  } else if (autoDetectPrimaryKey) {
    const propertyNames = Object.keys(propertiesInfo.properties);
    for (const propName of propertyNames) {
      if (propName.toLowerCase() === 'id') {
        primaryKeyFields.push(propName);
        break;
      }
    }
  }
  try {
    const sql = convertSchemaToSql(schema, tableName, databaseType, primaryKeyFields);
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


