import type { INodeProperties } from 'n8n-workflow';

export const outputFormatting: INodeProperties = {
  displayName: 'Output Formatting',
  name: 'outputFormatting',
  type: 'collection',
  placeholder: 'Add Formatting Option',
  default: {},
  description: 'Control the formatting and structure of the generated schema',
  displayOptions: {
    show: {
      operation: ['create'],
    },
  },
  options: [
    {
      displayName: 'Alphabetize Properties',
      name: 'alphabetizeProperties',
      type: 'boolean',
      default: false,
      description: 'Alphabetically sort properties in the generated schema',
    },
    {
      displayName: 'Indentation',
      name: 'indentation',
      type: 'number',
      typeOptions: {
        minValue: 0,
        maxValue: 8,
      },
      default: 2,
      description: 'Number of spaces for indentation in the generated schema',
    },
    {
      displayName: 'Leading Comments',
      name: 'leadingComments',
      type: 'string',
      typeOptions: {
        rows: 3,
      },
      default: '',
      description: 'Comments to add at the top of the schema (one per line)',
    },
  ],
};


