import type { INodeProperties } from 'n8n-workflow';

export const databaseType: INodeProperties = {
  displayName: 'Database Type',
  name: 'databaseType',
  type: 'options',
  options: [
    {
      name: 'PostgreSQL',
      value: 'pg',
    },
    {
      name: 'MySQL',
      value: 'mysql2',
    },
    {
      name: 'MariaDB',
      value: 'mysql2',
    },
    {
      name: 'SQLite3',
      value: 'sqlite3',
    },
    {
      name: 'MSSQL',
      value: 'mssql',
    },
    {
      name: 'Oracle',
      value: 'oracledb',
    },
    {
      name: 'CockroachDB',
      value: 'cockroachdb',
    },
  ],
  default: 'pg',
  description: 'The database type to generate SQL for',
  displayOptions: {
    show: {
      operation: ['generateSqlDdl'],
    },
  },
};

export const tableName: INodeProperties = {
  displayName: 'Table Name',
  name: 'tableName',
  type: 'string',
  default: 'my_table',
  required: true,
  description: 'The name of the table to create',
  displayOptions: {
    show: {
      operation: ['generateSqlDdl'],
    },
  },
};

export const primaryKeyOptions: INodeProperties = {
  displayName: 'Primary Key Options',
  name: 'primaryKeyOptions',
  type: 'collection',
  placeholder: 'Add Primary Key Option',
  default: {},
  description: 'Configure primary key detection and specification',
  displayOptions: {
    show: {
      operation: ['generateSqlDdl'],
    },
  },
  options: [
    {
      displayName: 'Auto-Detect Primary Key',
      name: 'autoDetectPrimaryKey',
      type: 'boolean',
      default: true,
      description: 'Automatically detect fields named "id" (case-insensitive) as primary keys',
    },
    {
      displayName: 'Primary Key Fields',
      name: 'primaryKeyFields',
      type: 'string',
      default: '',
      description:
        'Comma-separated list of field names to use as primary keys (overrides auto-detection)',
      placeholder: 'e.g., id, user_id',
    },
  ],
};


