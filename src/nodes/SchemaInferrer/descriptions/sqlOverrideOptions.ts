import type { INodeProperties } from 'n8n-workflow';

export const sqlOverrideOptions: INodeProperties = {
	displayName: 'Override Options',
	name: 'sqlOverrideOptions',
	type: 'collection',
	placeholder: 'Add Override Option',
	default: {},
	description: 'Override schema field types before SQL generation using rules',
	displayOptions: {
		show: {
			operation: ['generateSqlDdl'],
		},
	},
	options: [
		{
			displayName: 'Quick Rules',
			name: 'overrideRulesText',
			type: 'string',
			typeOptions: {
				multipleLine: true,
			},
			default: '',
			description:
				'Comma-separated rules. Exact match: fieldName->newType, Partial match: *fieldName*->newType',
			placeholder:
				'id->uuid, *created*->date-time, description->text',
		},
		{
			displayName: 'Advanced Rules',
			name: 'overrideRules',
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: true,
			},
			default: {},
			options: [
				{
					name: 'rule',
					displayName: 'Rule',
					values: [
						{
							displayName: 'Field Name',
							name: 'fieldName',
							type: 'string',
							default: '',
							description: 'Field name to match (e.g. id, email, createdAt)',
							placeholder: 'id',
						},
						{
							displayName: 'Match Type',
							name: 'matchType',
							type: 'options',
							default: 'exact',
							options: [
								{ name: 'Exact', value: 'exact' },
								{ name: 'Partial', value: 'partial' },
							],
							description: 'Whether to match the exact field name or any field containing the text',
						},
						{
							displayName: 'New Type',
							name: 'newType',
							type: 'options',
							default: 'string',
							options: [
								{ name: 'String', value: 'string' },
								{ name: 'Number', value: 'number' },
								{ name: 'Integer', value: 'integer' },
								{ name: 'Boolean', value: 'boolean' },
								{ name: 'Object', value: 'object' },
								{ name: 'Array', value: 'array' },
								{ name: 'Null', value: 'null' },
								{ name: 'UUID', value: 'uuid' },
								{ name: 'Date-Time', value: 'date-time' },
								{ name: 'Date', value: 'date' },
								{ name: 'Time', value: 'time' },
								{ name: 'JSON', value: 'json' },
								{ name: 'JSONB', value: 'jsonb' },
								{ name: 'Text', value: 'text' },
							],
						},
					],
				},
			],
		},
	],
};


