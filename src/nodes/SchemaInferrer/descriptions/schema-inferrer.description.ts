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

export const schemaInferrerNodeProperties = [
  operationProperty,
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


