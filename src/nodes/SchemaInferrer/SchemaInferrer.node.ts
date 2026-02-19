import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { schemaInferrerNodeProperties } from './index.js';
import { createSchema } from './operations/createSchema.js';
import { generateSqlDdl } from './operations/generateSqlDdl.js';
import { prepareForDatabase } from './operations/prepareForDatabase.js';

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
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    icon: 'file:schema-inferrer.svg',
    usableAsTool: true,
    properties: schemaInferrerNodeProperties,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const enableDebug = this.getNodeParameter('debugMode', 0, false) as boolean;
    const operation = this.getNodeParameter('operation', 0, 'create');

    switch (operation) {
      case 'create':
        return createSchema(this, enableDebug);
      case 'generateSqlDdl':
        return generateSqlDdl(this, enableDebug);
      case 'prepareForDatabase':
        return prepareForDatabase(this, enableDebug);
      default:
        throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
    }
  }
}
