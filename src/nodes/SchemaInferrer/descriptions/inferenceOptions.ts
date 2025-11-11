import type { INodeProperties } from 'n8n-workflow';

export const inferenceOptions: INodeProperties = {
  displayName: 'Inference Options',
  name: 'inferenceOptions',
  type: 'collection',
  placeholder: 'Add Inference Option',
  default: {},
  description: 'Control how quicktype infers types from the input data',
  displayOptions: {
    show: {
      operation: ['create'],
    },
  },
  options: [
    {
      displayName: 'Infer Maps',
      name: 'inferMaps',
      type: 'boolean',
      default: true,
      description: 'Infer map/dictionary types from object structures',
    },
    {
      displayName: 'Infer Enums',
      name: 'inferEnums',
      type: 'boolean',
      default: true,
      description: 'Infer enum types from string values with limited variations',
    },
    {
      displayName: 'Infer Date/Time',
      name: 'inferDateTimes',
      type: 'boolean',
      default: true,
      description: 'Infer date/time types from string patterns',
    },
    {
      displayName: 'Infer UUIDs',
      name: 'inferUuids',
      type: 'boolean',
      default: true,
      description: 'Infer UUID types from string patterns',
    },
    {
      displayName: 'Infer Boolean Strings',
      name: 'inferBoolStrings',
      type: 'boolean',
      default: true,
      description: 'Infer boolean types from string representations ("true"/"false")',
    },
    {
      displayName: 'Infer Integer Strings',
      name: 'inferIntegerStrings',
      type: 'boolean',
      default: true,
      description: 'Infer integer types from string representations',
    },
  ],
};


