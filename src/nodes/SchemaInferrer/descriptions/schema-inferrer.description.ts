import type { INodeProperties } from 'n8n-workflow';
import { operationProperty } from './operation.js';
import { createNotice, sqlDdlNotice } from './notices.js';
import { requiredFieldOptions } from './requiredFieldOptions.js';
import { inferenceOptions } from './inferenceOptions.js';
import { outputFormatting } from './outputFormatting.js';
import { databaseType, tableName, primaryKeyOptions } from './sqlOptions.js';
import { minimiseOutput, includeDefinitions } from './outputSizeOptions.js';

export const schemaInferrerNodeProperties = [
  operationProperty,
  createNotice,
  requiredFieldOptions,
  inferenceOptions,
  outputFormatting,
  minimiseOutput,
  includeDefinitions,
  sqlDdlNotice,
  databaseType,
  tableName,
  primaryKeyOptions,
] satisfies INodeProperties[];


