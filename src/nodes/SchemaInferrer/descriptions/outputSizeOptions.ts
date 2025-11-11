import type { INodeProperties } from 'n8n-workflow';

export const minimiseOutput: INodeProperties = {
  displayName: 'Minimise Output Size',
  name: 'minimiseOutput',
  type: 'boolean',
  default: true,
  description:
    'When enabled, trims non-essential parts of the schema to keep results small for previews',
  displayOptions: {
    show: {
      operation: ['create'],
    },
  },
};

export const includeDefinitions: INodeProperties = {
  displayName: 'Include Definitions',
  name: 'includeDefinitions',
  type: 'boolean',
  default: false,
  description:
    'Include schema definitions. Disable to omit the definitions block for smaller outputs',
  displayOptions: {
    show: {
      operation: ['create'],
    },
  },
};


