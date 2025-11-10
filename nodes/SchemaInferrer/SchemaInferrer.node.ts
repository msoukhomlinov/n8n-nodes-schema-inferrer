import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { inferSchema } from '@jsonhero/schema-infer';
import { compile } from 'json-schema-to-typescript';
import { SchemaInferrerNodeError } from './SchemaInferrerNodeError';

export class SchemaInferrer implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Schema Inferrer',
    name: 'schemaInferrer',
    icon: { light: 'file:schema-inferrer.svg', dark: 'file:schema-inferrer.dark.svg' },
    group: ['transform'],
    version: 1,
    description: 'Infer JSON schemas from sample data with optional TypeScript and PostgreSQL DDL generation',
    defaults: {
      name: 'Schema Inferrer',
    },
    inputs: ['main'],
    outputs: ['main'],
    usableAsTool: true,
    properties: [
      {
        displayName: 'JSON Input',
        name: 'jsonInput',
        type: 'string',
        typeOptions: {
          rows: 10,
        },
        default: '',
        placeholder: 'Enter sample JSON data to infer schema from',
        description: 'Sample JSON data (object or array) to infer the schema from',
        required: true,
      },
      {
        displayName: 'Schema Format',
        name: 'schemaFormat',
        type: 'options',
        options: [
          {
            name: 'JSON Schema',
            value: 'json',
          },
          {
            name: 'TypeScript',
            value: 'typescript',
          },
        ],
        default: 'json',
        description: 'The format for the generated schema',
      },
      {
        displayName: 'Null Handling',
        name: 'nullHandling',
        type: 'options',
        options: [
          {
            name: 'Nullable',
            value: 'nullable',
          },
          {
            name: 'Required',
            value: 'required',
          },
        ],
        default: 'nullable',
        description: 'How to handle null values in the schema',
      },
      {
        displayName: 'Type Strictness',
        name: 'typeStrictness',
        type: 'options',
        options: [
          {
            name: 'Strict',
            value: 'strict',
          },
          {
            name: 'Loose',
            value: 'loose',
          },
        ],
        default: 'loose',
        description: 'How strictly to enforce types in the schema',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const jsonInput = this.getNodeParameter('jsonInput', itemIndex, '') as string;
        const schemaFormat = this.getNodeParameter('schemaFormat', itemIndex, 'json') as string;
        const nullHandling = this.getNodeParameter('nullHandling', itemIndex, 'nullable') as string;
        const typeStrictness = this.getNodeParameter('typeStrictness', itemIndex, 'loose') as string;

        // Parse and validate JSON input
        let parsedInput: unknown;
        try {
          parsedInput = JSON.parse(jsonInput);
        } catch (error) {
          throw new SchemaInferrerNodeError(
            this.getNode(),
            `Invalid JSON input: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { itemIndex, cause: error },
          );
        }

        // Infer schema using @jsonhero/schema-infer
        const inference = inferSchema(parsedInput);
        const jsonSchema = inference.toJSONSchema() as Record<string, unknown>;

        // Prepare output data
        const outputData: INodeExecutionData = {
          json: {
            jsonSchema,
          },
          pairedItem: {
            item: itemIndex,
          },
        };

        // Generate TypeScript if requested
        if (schemaFormat === 'typescript') {
          try {
            const typescriptCode = await compile(jsonSchema, 'InferredSchema', {
              bannerComment: '',
              style: {
                singleQuote: true,
                tabWidth: 2,
                useTabs: false,
              },
            });
            outputData.json.typescript = typescriptCode;
          } catch (error) {
            throw new SchemaInferrerNodeError(
              this.getNode(),
              `Failed to generate TypeScript: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { itemIndex, cause: error },
            );
          }
        }

        // Add format indicator
        outputData.json.format = schemaFormat;
        outputData.json.nullHandling = nullHandling;
        outputData.json.typeStrictness = typeStrictness;

        returnData.push(outputData);
      } catch (error: unknown) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error instanceof Error ? error.message : 'Unknown error occurred',
            },
            pairedItem: {
              item: itemIndex,
            },
          });
        } else {
          if (error instanceof SchemaInferrerNodeError) {
            error.context.itemIndex = itemIndex;
            throw error;
          }
          if (error instanceof Error && 'context' in error) {
            (error as { context: { itemIndex?: number } }).context.itemIndex = itemIndex;
            throw error;
          }
          throw new SchemaInferrerNodeError(this.getNode(), error instanceof Error ? error.message : 'Unknown error', {
            itemIndex,
            cause: error,
          });
        }
      }
    }

    return [returnData];
  }
}
