import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { quicktype, InputData, jsonInputForTargetLanguage } from 'quicktype-core';
import { schemaInferrerNodeProperties } from './index.js';

/**
 * JSON Schema structure for the inferred schema
 */
interface JsonSchema {
  required?: string[];
  properties?: Record<string, unknown>;
  definitions?: Record<string, JsonSchema>;
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
    const items = this.getInputData();

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

      // Generate JSON schema using quicktype
      const { lines } = await quicktype({
        inputData,
        lang: 'schema',
      });

      // Join lines to get the schema string and parse it to JSON
      const schemaString = lines.join('\n');
      const schema = JSON.parse(schemaString) as JsonSchema;

      // Process required fields configuration
      const requiredFields = this.getNodeParameter('requiredFields', 0, '') as string;
      const useSubstringMatching = this.getNodeParameter('useSubstringMatching', 0, false) as boolean;
      const caseInsensitiveMatching = this.getNodeParameter('caseInsensitiveMatching', 0, false) as boolean;

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
}

