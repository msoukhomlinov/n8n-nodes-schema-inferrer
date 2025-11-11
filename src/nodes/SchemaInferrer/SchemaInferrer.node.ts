import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { schemaInferrerNodeProperties } from './index.js';
import { createSchema } from './operations/createSchema.js';
import { generateSqlDdl } from './operations/generateSqlDdl.js';

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
    usableAsTool: true,
    credentials: [
      {
        name: 'schemaInferrerConfig',
        required: false,
      },
    ],
    properties: schemaInferrerNodeProperties,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const creds = await this.getCredentials('schemaInferrerConfig').catch(() => undefined);
    const enableDebug =
      creds && typeof (creds as Record<string, unknown>).enableDebug === 'boolean'
        ? ((creds as Record<string, unknown>).enableDebug as boolean)
        : false;
    const operation = this.getNodeParameter('operation', 0, 'create');

    switch (operation) {
      case 'create':
        return createSchema(this, enableDebug);
      case 'generateSqlDdl':
        return generateSqlDdl(this, enableDebug);
      default:
        throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
    }
  }
}
