import type { INodeProperties } from 'n8n-workflow';

export const createNotice: INodeProperties = {
  displayName:
    'This node automatically infers a JSON schema from all input items. Connect data to the input and execute to generate the schema.',
  name: 'notice',
  type: 'notice',
  default: '',
  displayOptions: {
    show: {
      operation: ['create'],
    },
  },
};

export const sqlDdlNotice: INodeProperties = {
  displayName:
    'This operation converts a JSON schema from the input to a SQL CREATE TABLE statement. The input must contain a "schema" property.',
  name: 'sqlDdlNotice',
  type: 'notice',
  default: '',
  displayOptions: {
    show: {
      operation: ['generateSqlDdl'],
    },
  },
};


