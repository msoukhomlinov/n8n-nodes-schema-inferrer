import type { INodeProperties } from 'n8n-workflow';

export const prepareForDatabaseNotice: INodeProperties = {
  displayName:
    'This operation prepares data for insertion into PostgreSQL JSONB/JSON columns. Use this before PostgreSQL Insert/Upsert operations when your data contains nested objects or arrays. The schema identifies which fields need JSON serialization.',
  name: 'prepareForDatabaseNotice',
  type: 'notice',
  default: '',
  displayOptions: {
    show: {
      operation: ['prepareForDatabase'],
    },
  },
};

export const prepareForDatabaseSchema: INodeProperties = {
  displayName: 'Schema',
  name: 'schema',
  type: 'json',
  required: true,
  default: '',
  description:
    'JSON schema to identify JSONB/JSON fields. Use output from "Create Schema" operation.',
  placeholder: "{{ $('Schema Inferrer').item.json.schema }}",
  displayOptions: {
    show: {
      operation: ['prepareForDatabase'],
    },
  },
};

export const prepareForDatabaseOptions: INodeProperties = {
  displayName: 'Options',
  name: 'prepareOptions',
  type: 'collection',
  placeholder: 'Add Option',
  default: {},
  description: 'Options for preparing data for database insertion',
  displayOptions: {
    show: {
      operation: ['prepareForDatabase'],
    },
  },
  options: [
    {
      displayName: 'Skip Already Stringified',
      name: 'skipAlreadyStringified',
      type: 'boolean',
      default: true,
      description:
        'Skip fields that are already valid JSON strings to avoid double-stringification',
    },
    {
      displayName: 'Pretty Print',
      name: 'prettyPrint',
      type: 'boolean',
      default: false,
      description: 'Format JSON strings with indentation (2 spaces) for readability',
    },
    {
      displayName: 'Strict Mode',
      name: 'strictMode',
      type: 'boolean',
      default: false,
      description:
        'Throw error if schema is missing or invalid, otherwise log warning and skip transformation',
    },
  ],
};

