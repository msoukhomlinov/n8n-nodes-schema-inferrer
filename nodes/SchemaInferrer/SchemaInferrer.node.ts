import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

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
    properties: [],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    return [items];
  }
}
