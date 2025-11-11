import type { INodeProperties } from 'n8n-workflow';

export const operationProperty: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  options: [
    {
      name: 'Create Schema',
      value: 'create',
      description: 'Infer JSON schema from one or more input JSON data items',
    },
    {
      name: 'Generate SQL DDL',
      value: 'generateSqlDdl',
      description: 'Generate SQL CREATE TABLE statement from a JSON schema',
    },
  ],
  default: 'create',
};


