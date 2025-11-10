import type { INodeProperties } from 'n8n-workflow';

export const schemaInferrerNodeProperties: INodeProperties[] = [
  {
    displayName: 'This node automatically infers a JSON schema from all input items. Connect data to the input and execute to generate the schema.',
    name: 'notice',
    type: 'notice',
    default: '',
  },
];
