import type { INodeProperties } from 'n8n-workflow';

export const schemaInferrerNodeProperties: INodeProperties[] = [
  {
    displayName: 'This node automatically infers a JSON schema from all input items. Connect data to the input and execute to generate the schema.',
    name: 'notice',
    type: 'notice',
    default: '',
  },
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
];
