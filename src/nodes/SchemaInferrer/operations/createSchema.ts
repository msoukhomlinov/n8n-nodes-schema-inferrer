import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { quicktype, InputData, jsonInputForTargetLanguage } from 'quicktype-core';

interface JsonSchema {
  required?: string[];
  properties?: Record<string, unknown>;
  definitions?: Record<string, JsonSchema>;
  $ref?: string;
  [key: string]: unknown;
}

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
    const schema = JSON.parse(schemaString) as JsonSchema;

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

    if (minimiseOutput && !includeDefinitions) {
      if (schema.definitions) {
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


