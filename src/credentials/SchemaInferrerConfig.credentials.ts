import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class SchemaInferrerConfig implements ICredentialType {
  name = 'schemaInferrerConfig';
  displayName = 'Schema Inferrer Configuration';
  documentationUrl = 'https://docs.n8n.io/integrations/creating-nodes/';
  properties: INodeProperties[] = [
    {
      displayName: 'Enable Debug Mode',
      name: 'enableDebug',
      type: 'boolean',
      default: false,
      required: false,
      description: 'Enable debug logging for schema inference operations',
    },
  ];
}

