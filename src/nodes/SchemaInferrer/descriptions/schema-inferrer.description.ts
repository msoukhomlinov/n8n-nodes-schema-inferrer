import type { INodeProperties } from 'n8n-workflow';
import { operationProperty } from './operation.js';
import { createNotice, sqlDdlNotice } from './notices.js';
import {
  prepareForDatabaseNotice,
  prepareForDatabaseSchema,
  prepareForDatabaseOptions,
} from './prepareForDatabaseOptions.js';
import { requiredFieldOptions } from './requiredFieldOptions.js';
import { inferenceOptions } from './inferenceOptions.js';
import { overrideOptions } from './overrideOptions.js';
import { outputFormatting } from './outputFormatting.js';
import { databaseType, tableName, primaryKeyOptions, generateTopupQuery } from './sqlOptions.js';
import { sqlOverrideOptions } from './sqlOverrideOptions.js';
import { minimiseOutput, includeDefinitions } from './outputSizeOptions.js';
import { namingOptionsCreate, namingOptionsSqlDdl } from './namingOptions.js';

export const debugMode: INodeProperties = {
  displayName: 'Debug Mode',
  name: 'debugMode',
  type: 'boolean',
  default: false,
  description: 'Enable debug output on each execution result',
};

export const inputSource: INodeProperties = {
  displayName: 'Input Source',
  name: 'inputSource',
  type: 'options',
  options: [
    {
      name: 'Connected Input',
      value: 'connectedInput',
      description: 'Use items from the directly connected node',
    },
    {
      name: 'Another Node',
      value: 'namedNode',
      description: 'Pull items from a specific earlier node by name',
    },
  ],
  default: 'connectedInput',
  description: 'Which node to read input items from',
};

export const sourceNodeName: INodeProperties = {
  displayName: 'Items Expression',
  name: 'sourceNodeName',
  type: 'string',
  default: '',
  placeholder: "={{ $('Node Name').all() }}",
  displayOptions: {
    show: {
      inputSource: ['namedNode'],
    },
  },
  description:
    "Must be an n8n expression that returns items from another node.<br/>" +
    "<b>All items:</b> <code>={{ $('Node Name').all() }}</code><br/>" +
    "<b>First item only:</b> <code>={{ $('Node Name').first() }}</code><br/>" +
    "<b>Last item only:</b> <code>={{ $('Node Name').last() }}</code>",
};

export const schemaInferrerNodeProperties = [
  operationProperty,
  inputSource,
  sourceNodeName,
  createNotice,
  requiredFieldOptions,
  inferenceOptions,
  overrideOptions,
  outputFormatting,
  namingOptionsCreate,
  minimiseOutput,
  includeDefinitions,
  sqlDdlNotice,
  databaseType,
  tableName,
  primaryKeyOptions,
  generateTopupQuery,
  sqlOverrideOptions,
  namingOptionsSqlDdl,
  prepareForDatabaseNotice,
  prepareForDatabaseSchema,
  prepareForDatabaseOptions,
  debugMode,
] satisfies INodeProperties[];


