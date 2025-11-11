import type { INodeProperties } from 'n8n-workflow';
import { operationProperty } from './operation.js';
import { createNotice, sqlDdlNotice } from './notices.js';
import { requiredFieldOptions } from './requiredFieldOptions.js';
import { inferenceOptions } from './inferenceOptions.js';
import { overrideOptions } from './overrideOptions.js';
import { outputFormatting } from './outputFormatting.js';
import { databaseType, tableName, primaryKeyOptions } from './sqlOptions.js';
import { sqlOverrideOptions } from './sqlOverrideOptions.js';
import { minimiseOutput, includeDefinitions } from './outputSizeOptions.js';

export const schemaInferrerNodeProperties = [
  operationProperty,
  createNotice,
  requiredFieldOptions,
  inferenceOptions,
  overrideOptions,
  outputFormatting,
  minimiseOutput,
  includeDefinitions,
  sqlDdlNotice,
  databaseType,
  tableName,
  primaryKeyOptions,
  sqlOverrideOptions,
] satisfies INodeProperties[];


