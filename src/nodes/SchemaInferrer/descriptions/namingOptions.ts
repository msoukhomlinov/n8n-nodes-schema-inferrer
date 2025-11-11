import type { INodeProperties } from 'n8n-workflow';

export const namingOptionsCreate: INodeProperties = {
  displayName: 'Naming Options',
  name: 'namingOptions',
  type: 'collection',
  placeholder: 'Add Naming Option',
  default: {},
  description: 'Control how field names are handled in the generated schema',
  displayOptions: {
    show: {
      operation: ['create'],
    },
  },
  options: [
    {
      displayName: 'Lowercase All Fields',
      name: 'lowercaseAllFields',
      type: 'boolean',
      default: false,
      description: 'Convert all property names to lowercase in the schema',
    },
  ],
};

export const namingOptionsSqlDdl: INodeProperties = {
  displayName: 'Naming Options',
  name: 'namingOptions',
  type: 'collection',
  placeholder: 'Add Naming Option',
  default: {},
  description: 'Control how field names are handled in the generated SQL DDL',
  displayOptions: {
    show: {
      operation: ['generateSqlDdl'],
    },
  },
  options: [
    {
      displayName: 'Lowercase All Fields',
      name: 'lowercaseAllFields',
      type: 'boolean',
      default: false,
      description: 'Convert all property names to lowercase before generating SQL',
    },
    {
      displayName: 'Quote Identifiers',
      name: 'quoteIdentifiers',
      type: 'boolean',
      default: false,
      description: 'Quote table and column names in the generated SQL (preserves case and special characters)',
    },
  ],
};

