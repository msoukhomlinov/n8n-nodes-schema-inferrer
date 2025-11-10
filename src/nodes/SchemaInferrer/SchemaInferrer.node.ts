import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { quicktype, InputData, jsonInputForTargetLanguage } from 'quicktype-core';
import { schemaInferrerNodeProperties } from './index.js';

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
      const schema = JSON.parse(schemaString);

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

