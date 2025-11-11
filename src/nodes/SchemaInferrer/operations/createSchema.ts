import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { quicktype, InputData, jsonInputForTargetLanguage } from 'quicktype-core';

interface JsonSchema {
  required?: string[];
  type?: string | string[];
  properties?: Record<string, unknown>;
  items?: unknown;
  definitions?: Record<string, JsonSchema>;
  $ref?: string;
  [key: string]: unknown;
}

type JsonType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

type OverrideRule = {
  fieldName: string;
  matchType: 'exact' | 'partial';
  newType: JsonType;
};

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

function clearAllRequiredFields(schema: JsonSchema): void {
  if (schema.required) {
    schema.required = [];
  }
  if (schema.definitions) {
    for (const definitionKey of Object.keys(schema.definitions)) {
      clearAllRequiredFields(schema.definitions[definitionKey]);
    }
  }
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

function setRequiredFields(
  schema: JsonSchema,
  requiredFieldNames: string[],
  useSubstring: boolean,
  caseInsensitive: boolean,
  mergeWithExisting: boolean,
): void {
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
    if (matchedProperties.length > 0) {
      if (mergeWithExisting && Array.isArray(schema.required) && schema.required.length > 0) {
        const set = new Set<string>(schema.required);
        for (const name of matchedProperties) set.add(name);
        schema.required = Array.from(set);
      } else {
        schema.required = matchedProperties;
      }
    }
  }
  if (schema.definitions) {
    for (const definitionKey of Object.keys(schema.definitions)) {
      setRequiredFields(
        schema.definitions[definitionKey],
        requiredFieldNames,
        useSubstring,
        caseInsensitive,
        mergeWithExisting,
      );
    }
  }
}

export async function createSchema(
  context: IExecuteFunctions,
  enableDebug: boolean,
): Promise<INodeExecutionData[][]> {
  const items = context.getInputData();
  if (items.length === 0) {
    throw new NodeOperationError(
      context.getNode(),
      'No input data provided. Please provide at least one JSON item.',
    );
  }
  const jsonSamples: string[] = [];
  for (const item of items) {
    const jsonData = item.json ?? {};
    const jsonString = JSON.stringify(jsonData);
    jsonSamples.push(jsonString);
  }
  try {
    const jsonInput = jsonInputForTargetLanguage('schema');
    await jsonInput.addSource({
      name: 'Root',
      samples: jsonSamples,
    });
    const inputData = new InputData();
    inputData.addInput(jsonInput);
    const inferenceOptionsRaw = context.getNodeParameter('inferenceOptions', 0, {}) as {
      inferMaps?: boolean;
      inferEnums?: boolean;
      inferDateTimes?: boolean;
      inferUuids?: boolean;
      inferBoolStrings?: boolean;
      inferIntegerStrings?: boolean;
    };
    const inferenceOptions = {
      inferMaps: inferenceOptionsRaw.inferMaps ?? true,
      inferEnums: inferenceOptionsRaw.inferEnums ?? true,
      inferDateTimes: inferenceOptionsRaw.inferDateTimes ?? true,
      inferUuids: inferenceOptionsRaw.inferUuids ?? true,
      inferBoolStrings: inferenceOptionsRaw.inferBoolStrings ?? true,
      inferIntegerStrings: inferenceOptionsRaw.inferIntegerStrings ?? true,
    };
    const outputFormattingRaw = context.getNodeParameter('outputFormatting', 0, {}) as {
      alphabetizeProperties?: boolean;
      indentation?: number;
      leadingComments?: string;
    };
    const outputFormatting = {
      alphabetizeProperties: outputFormattingRaw.alphabetizeProperties ?? false,
      indentation: outputFormattingRaw.indentation ?? 2,
      leadingComments: outputFormattingRaw.leadingComments ?? '',
    };
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
    if (outputFormatting.leadingComments && outputFormatting.leadingComments.trim()) {
      quicktypeOptions.leadingComments = outputFormatting.leadingComments
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    }
    const { lines } = await quicktype(quicktypeOptions);
    const schemaString = lines.join('\n');
    let schema = JSON.parse(schemaString) as JsonSchema;

    // Apply lowercasing if enabled (before other transformations)
    const namingOptionsRaw = context.getNodeParameter('namingOptions', 0, {}) as {
      lowercaseAllFields?: boolean;
    };
    const lowercaseAllFields = namingOptionsRaw.lowercaseAllFields ?? false;
    if (lowercaseAllFields) {
      lowercaseSchemaProperties(schema);
    }

    const minimiseOutput = context.getNodeParameter('minimiseOutput', 0, true) as boolean;
    const includeDefinitions = context.getNodeParameter('includeDefinitions', 0, false) as boolean;
    const requiredFieldOptionsRaw = context.getNodeParameter('requiredFieldOptions', 0, {}) as {
      requiredFields?: string;
      useSubstringMatching?: boolean;
      caseInsensitiveMatching?: boolean;
      overrideInferredRequired?: boolean;
    };
    const requiredFields = requiredFieldOptionsRaw.requiredFields ?? '';
    const useSubstringMatching = requiredFieldOptionsRaw.useSubstringMatching ?? false;
    const caseInsensitiveMatching = requiredFieldOptionsRaw.caseInsensitiveMatching ?? false;
    const overrideInferredRequired = requiredFieldOptionsRaw.overrideInferredRequired ?? false;
    if (overrideInferredRequired) {
      clearAllRequiredFields(schema);
    }
    if (requiredFields && requiredFields.trim()) {
      const requiredFieldNames = requiredFields
        .split(',')
        .map((field) => field.trim())
        .filter((field) => field.length > 0);
      setRequiredFields(
        schema,
        requiredFieldNames,
        useSubstringMatching,
        caseInsensitiveMatching,
        !overrideInferredRequired,
      );
    }

    // --- Override rules: parse and apply ---
    const overrideOptionsRaw = context.getNodeParameter('overrideOptions', 0, {}) as {
      overrideRulesText?: string;
      overrideRules?: { rule?: Array<Record<string, unknown>> };
    };

    const normaliseType = (t: string | undefined): JsonType | undefined => {
      if (!t) return undefined;
      const lower = t.toLowerCase().trim();
      const map: Record<string, JsonType> = {
        string: 'string',
        str: 'string',
        number: 'number',
        float: 'number',
        double: 'number',
        integer: 'integer',
        int: 'integer',
        boolean: 'boolean',
        bool: 'boolean',
        object: 'object',
        obj: 'object',
        array: 'array',
        arr: 'array',
        null: 'null',
      };
      return map[lower];
    };

    const parseOverrideRules = (text: string | undefined): OverrideRule[] => {
      if (!text) return [];
      const rules: OverrideRule[] = [];
      const parts = text
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      for (const token of parts) {
        // Format: fieldName->newType (exact) or *fieldName*->newType (partial)
        const arrowIdx = token.indexOf('->');
        if (arrowIdx === -1) continue;
        
        const leftPart = token.slice(0, arrowIdx).trim();
        const rightPart = token.slice(arrowIdx + 2).trim();
        
        const newType = normaliseType(rightPart);
        if (!newType) continue;
        
        let fieldName = leftPart;
        let matchType: 'exact' | 'partial' = 'exact';
        
        // Check if field name is surrounded by asterisks for partial matching
        if (leftPart.startsWith('*') && leftPart.endsWith('*') && leftPart.length > 2) {
          fieldName = leftPart.slice(1, -1);
          matchType = 'partial';
        }
        
        if (!fieldName) continue;
        
        rules.push({
          fieldName,
          matchType,
          newType,
        });
      }
      return rules;
    };

    const advancedRulesFromParams = (): OverrideRule[] => {
      const out: OverrideRule[] = [];
      const coll = overrideOptionsRaw.overrideRules;
      const rows = coll && Array.isArray(coll.rule) ? coll.rule : [];
      for (const row of rows) {
        const fieldName = (row.fieldName as string | undefined)?.trim() || '';
        const matchType = (row.matchType as 'exact' | 'partial' | undefined) || 'exact';
        const newType = normaliseType(row.newType as string | undefined);
        
        if (!fieldName || !newType) continue;
        
        out.push({
          fieldName,
          matchType,
          newType,
        });
      }
      return out;
    };

    const getNodeTypes = (node: unknown): JsonType[] => {
      if (!node || typeof node !== 'object') return [];
      const t = (node as Record<string, unknown>).type;
      if (typeof t === 'string') return [t as JsonType];
      if (Array.isArray(t)) {
        return (t as unknown[])
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x as JsonType);
      }
      return [];
    };

    const setNodeType = (node: unknown, newType: JsonType): void => {
      if (!node || typeof node !== 'object') return;
      (node as Record<string, unknown>).type = newType;
    };

    const applyOverrides = (root: JsonSchema, rules: OverrideRule[]): void => {
      if (rules.length === 0) return;
      
      const isObjectNode = (n: unknown): n is JsonSchema => {
        if (!n || typeof n !== 'object') return false;
        const ts = getNodeTypes(n);
        return ts.includes('object') || (!!(n as JsonSchema).properties && !ts.includes('array'));
      };
      const isArrayNode = (n: unknown): boolean => {
        const ts = getNodeTypes(n);
        return ts.includes('array') || !!(n as JsonSchema).items;
      };

      const matchesFieldName = (fieldName: string, ruleName: string, matchType: 'exact' | 'partial'): boolean => {
        if (matchType === 'exact') {
          return fieldName === ruleName;
        }
        // Partial matching
        return fieldName.includes(ruleName);
      };

      const visit = (node: unknown, fieldName: string): void => {
        if (!node || typeof node !== 'object') return;
        
        // Check if current field name matches any rule
        if (fieldName) {
          for (const rule of rules) {
            if (matchesFieldName(fieldName, rule.fieldName, rule.matchType)) {
              setNodeType(node, rule.newType);
              break; // Apply first matching rule only
            }
          }
        }

        // Recurse into properties
        if (isObjectNode(node)) {
          const props = node.properties || {};
          for (const [key, child] of Object.entries(props)) {
            visit(child, key);
          }
        }
        
        // Recurse into array items
        if (isArrayNode(node)) {
          const items = (node as JsonSchema).items;
          if (items) {
            visit(items, '');
          }
        }
      };

      // Start from root
      visit(root, '');
    };

    const textRules = parseOverrideRules(overrideOptionsRaw.overrideRulesText ?? '');
    const advRules = advancedRulesFromParams();
    const combinedRules: OverrideRule[] = [...textRules, ...advRules];
    if (combinedRules.length > 0) {
      applyOverrides(schema, combinedRules);
    }

    // When minimising, ensure we don't remove definitions that are still referenced.
    const hasAnyRef = (node: unknown): boolean => {
      if (node === null || typeof node !== 'object') return false;
      const obj = node as Record<string, unknown>;
      if (typeof obj.$ref === 'string' && obj.$ref.startsWith('#/definitions/')) return true;
      for (const v of Object.values(obj)) {
        if (Array.isArray(v)) {
          for (const el of v) {
            if (hasAnyRef(el)) return true;
          }
        } else if (hasAnyRef(v)) {
          return true;
        }
      }
      return false;
    };

    if (minimiseOutput) {
      // Inline the root definition if the top-level schema is just a $ref
      if (
        typeof schema.$ref === 'string' &&
        schema.$ref.startsWith('#/definitions/') &&
        schema.definitions
      ) {
        const defName = schema.$ref.replace('#/definitions/', '');
        const rootDef = schema.definitions[defName];
        if (rootDef) {
          const keepDefinitions = includeDefinitions || hasAnyRef(rootDef);
          const inlined: JsonSchema = {
            $schema: (schema as Record<string, unknown>)['$schema'] as string | undefined,
            ...rootDef,
          };
          if (keepDefinitions) {
            inlined.definitions = schema.definitions;
          }
          schema = inlined;
        }
      }

      // Only drop definitions if nothing references them anymore
      if (!includeDefinitions && schema.definitions && !hasAnyRef(schema)) {
        delete schema.definitions;
      }
    }

    const capDebug = (value: unknown): unknown => {
      try {
        const MAX_BYTES = 10 * 1024; // ~10KB cap
        if (typeof value === 'string') {
          return value.length > MAX_BYTES ? `${value.slice(0, MAX_BYTES)}…[truncated]` : value;
        }
        if (Array.isArray(value)) {
          const json = JSON.stringify(value);
          if (json.length > MAX_BYTES) {
            // Reduce array until under cap
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
            // Shallowly trim object values
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

    const debugInfo = enableDebug
      ? {
          inputItemCount: items.length,
          quicktypeOptions: {
            inferMaps: inferenceOptions.inferMaps,
            inferEnums: inferenceOptions.inferEnums,
            inferDateTimes: inferenceOptions.inferDateTimes,
            inferUuids: inferenceOptions.inferUuids,
            inferBoolStrings: inferenceOptions.inferBoolStrings,
            inferIntegerStrings: inferenceOptions.inferIntegerStrings,
            alphabetizeProperties: outputFormatting.alphabetizeProperties,
            indentation: outputFormatting.indentation,
          },
          requiredFields: {
            overrideInferredRequired,
            useSubstringMatching,
            caseInsensitiveMatching,
            provided:
              requiredFields && requiredFields.trim()
                ? requiredFields
                    .split(',')
                    .map((f) => f.trim())
                    .filter((f) => f.length > 0)
                : [],
          },
        }
      : undefined;

    const json: IDataObject = { schema: schema as unknown as IDataObject };
    if (enableDebug && debugInfo) {
      json.debug = capDebug(debugInfo) as IDataObject;
    }
    return [[{ json }]];
  } catch (error) {
    if (error instanceof Error) {
      throw new NodeOperationError(
        context.getNode(),
        `Failed to infer JSON schema: ${error.message}`,
      );
    }
    throw new NodeOperationError(context.getNode(), 'Failed to infer JSON schema: Unknown error');
  }
}


