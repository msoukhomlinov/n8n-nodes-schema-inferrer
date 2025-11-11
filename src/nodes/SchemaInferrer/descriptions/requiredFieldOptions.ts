import type { INodeProperties } from 'n8n-workflow';

export const requiredFieldOptions: INodeProperties = {
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
      displayName: 'Override Inferred Required',
      name: 'overrideInferredRequired',
      type: 'boolean',
      default: false,
      description:
        'If enabled, clear any inferred required fields and apply only the specified fields',
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
      description:
        'When enabled, matches field names that contain the specified text (e.g., "name" matches "firstName", "lastName")',
    },
    {
      displayName: 'Case Insensitive Matching',
      name: 'caseInsensitiveMatching',
      type: 'boolean',
      default: false,
      description:
        'When enabled, ignores case when matching field names (e.g., "Name" matches "name")',
    },
  ],
};


