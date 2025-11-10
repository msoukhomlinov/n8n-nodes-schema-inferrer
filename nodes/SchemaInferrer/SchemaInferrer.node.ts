import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { inferSchema } from '@jsonhero/schema-infer';

export class SchemaInferrer implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Schema Inferrer',
    name: 'schemaInferrer',
    icon: { light: 'file:schema-inferrer.svg', dark: 'file:schema-inferrer.dark.svg' },
    group: ['transform'],
    version: 1,
    description: 'Infer a JSON schema from sample JSON data',
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
        description: 'Sample JSON data to infer the schema from',
        required: true,
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const jsonInput = this.getNodeParameter('jsonInput', itemIndex, '') as string;

        let parsedInput: unknown;
        try {
          parsedInput = JSON.parse(jsonInput);
        } catch (error) {
          throw new NodeOperationError(this.getNode(), 'Invalid JSON input', { itemIndex });
        }

        const inference = inferSchema(parsedInput);
        const jsonSchema = inference.toJSONSchema() as Record<string, unknown>;

        returnData.push({
          json: {
            jsonSchema,
          },
          pairedItem: { item: itemIndex },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error instanceof Error ? error.message : 'Unknown error occurred',
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        if (error instanceof NodeOperationError) {
          throw error;
        }

        throw new NodeOperationError(this.getNode(), error instanceof Error ? error.message : 'Unknown error', {
          itemIndex,
        });
      }
    }

    return [returnData];
  }
}
