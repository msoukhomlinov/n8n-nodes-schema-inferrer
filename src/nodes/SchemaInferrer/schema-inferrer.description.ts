import type { INodeProperties } from 'n8n-workflow';

export const schemaInferrerNodeProperties: INodeProperties[] = [
  {
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
  },
  {
    displayName: 'This node automatically infers a JSON schema from all input items. Connect data to the input and execute to generate the schema.',
    name: 'notice',
    type: 'notice',
    default: '',
    displayOptions: {
      show: {
        operation: ['create'],
      },
    },
  },
  {
    displayName: 'Required Field Options',
    name: 'requiredFieldOptions',
    type: 'collection',
    placeholder: 'Add Required Field Option',
    default: {},
    description: 'Configure which fields should be marked as required in the generated schema',
    displayOptions: {
      show: {
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Required Fields',
        name: 'requiredFields',
        type: 'string',
        default: '',
        description: 'Comma-separated list of field names to mark as required in the generated schema',
        placeholder: 'e.g., id, name, email',
      },
      {
        displayName: 'Use Substring Matching',
        name: 'useSubstringMatching',
        type: 'boolean',
        default: false,
        description: 'When enabled, matches field names that contain the specified text (e.g., "name" matches "firstName", "lastName")',
      },
      {
        displayName: 'Case Insensitive Matching',
        name: 'caseInsensitiveMatching',
        type: 'boolean',
        default: false,
        description: 'When enabled, ignores case when matching field names (e.g., "Name" matches "name")',
      },
    ],
  },
  {
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
  },
  {
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
  },
  {
    displayName: 'This operation converts a JSON schema from the input to a SQL CREATE TABLE statement. The input must contain a "schema" property.',
    name: 'sqlDdlNotice',
    type: 'notice',
    default: '',
    displayOptions: {
      show: {
        operation: ['generateSqlDdl'],
      },
    },
  },
  {
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
  },
  {
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
  },
  {
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
        description: 'Comma-separated list of field names to use as primary keys (overrides auto-detection)',
        placeholder: 'e.g., id, user_id',
      },
    ],
  },
];
