import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { schemaInferrerNodeProperties } from './index.js';
import { createSchema } from './operations/createSchema.js';
import { generateSqlDdl } from './operations/generateSqlDdl.js';
import { prepareForDatabase } from './operations/prepareForDatabase.js';

function resolveSourceItems(
  context: IExecuteFunctions,
  enableDebug: boolean,
): INodeExecutionData[] {
  const inputSource = context.getNodeParameter('inputSource', 0, 'connectedInput') as string;

  if (inputSource !== 'namedNode') {
    return context.getInputData();
  }

  // getNodeParameter evaluates the expression before returning, so the value is already
  // an array (from .all()) or a single item (from .first() / .last()).
  const nodeParam = context.getNodeParameter('sourceNodeName', 0, '') as unknown;

  // Expression resolved to an array — e.g. ={{ $('Node').all() }}
  if (Array.isArray(nodeParam)) {
    if (enableDebug) {
      context.logger.debug(
        `Schema Inferrer: Using ${(nodeParam as INodeExecutionData[]).length} items from expression`,
      );
    }
    return nodeParam as INodeExecutionData[];
  }

  // Expression resolved to a single item — e.g. ={{ $('Node').last() }}
  if (nodeParam !== null && typeof nodeParam === 'object' && 'json' in (nodeParam as object)) {
    if (enableDebug) {
      context.logger.debug('Schema Inferrer: Using single item from expression');
    }
    return [nodeParam as INodeExecutionData];
  }

  // Not an evaluated expression — user likely entered a plain string
  throw new NodeOperationError(
    context.getNode(),
    "Items Expression must be an n8n expression returning items, e.g. ={{ $('Node Name').all() }}",
  );
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
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    icon: 'file:schema-inferrer.svg',
    usableAsTool: true,
    properties: schemaInferrerNodeProperties,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const enableDebug = this.getNodeParameter('debugMode', 0, false) as boolean;
    const operation = this.getNodeParameter('operation', 0, 'create');
    const items = resolveSourceItems(this, enableDebug);

    switch (operation) {
      case 'create':
        return createSchema(this, enableDebug, items);
      case 'generateSqlDdl':
        return generateSqlDdl(this, enableDebug, items);
      case 'prepareForDatabase':
        return prepareForDatabase(this, enableDebug, items);
      default:
        throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
    }
  }
}
