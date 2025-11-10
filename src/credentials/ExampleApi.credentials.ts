import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class ExampleApi implements ICredentialType {
  name = 'exampleApi';
  displayName = 'Example API';
  documentationUrl = 'https://docs.n8n.io/integrations/creating-nodes/';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.example.com',
      required: true,
    },
  ];

  // Optional: simple live test metadata (n8n uses this to test credentials)
  test = {
    request: {
      method: 'GET' as const,
      url: '={{$credentials.baseUrl}}/status',
      headers: {
        Authorization: 'Bearer {{$credentials.apiKey}}',
      },
    },
  };
}

