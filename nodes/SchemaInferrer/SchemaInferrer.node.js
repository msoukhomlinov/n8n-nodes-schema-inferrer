import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { inferSchema } from '@jsonhero/schema-infer';
import { generateSQLFromJSONSchema } from 'json-schema-to-sql';
import { compile } from 'json-schema-to-typescript';
export class SchemaInferrer {
    constructor() {
        this.description = {
            displayName: 'Schema Inferrer',
            name: 'schemaInferrer',
            icon: { light: 'file:schema-inferrer.svg', dark: 'file:schema-inferrer.dark.svg' },
            group: ['transform'],
            version: 1,
            description: 'Infer JSON schemas from sample data with optional TypeScript and PostgreSQL DDL generation',
            defaults: {
                name: 'Schema Inferrer',
            },
            inputs: [NodeConnectionTypes.Main],
            outputs: [NodeConnectionTypes.Main],
            usableAsTool: true,
            properties: [
                {
                    displayName: 'JSON Input',
                    name: 'jsonInput',
                    type: 'string',
                    typeOptions: {
                        rows: 10,
                    },
                    default: '',
                    placeholder: 'Enter sample JSON data to infer schema from',
                    description: 'Sample JSON data (object or array) to infer the schema from',
                    required: true,
                },
                {
                    displayName: 'Schema Format',
                    name: 'schemaFormat',
                    type: 'options',
                    options: [
                        {
                            name: 'JSON Schema',
                            value: 'json',
                        },
                        {
                            name: 'TypeScript',
                            value: 'typescript',
                        },
                    ],
                    default: 'json',
                    description: 'The format for the generated schema',
                },
                {
                    displayName: 'Generate PostgreSQL DDL',
                    name: 'generatePostgres',
                    type: 'boolean',
                    default: false,
                    description: 'Whether to generate PostgreSQL DDL statements',
                },
                {
                    displayName: 'Table Naming',
                    name: 'tableNaming',
                    type: 'options',
                    options: [
                        {
                            name: 'Default',
                            value: 'default',
                        },
                        {
                            name: 'Snake Case',
                            value: 'snake_case',
                        },
                        {
                            name: 'Pascal Case',
                            value: 'PascalCase',
                        },
                    ],
                    default: 'default',
                    displayOptions: {
                        show: {
                            generatePostgres: [true],
                        },
                    },
                    description: 'Naming convention for generated table names',
                },
                {
                    displayName: 'Null Handling',
                    name: 'nullHandling',
                    type: 'options',
                    options: [
                        {
                            name: 'Nullable',
                            value: 'nullable',
                        },
                        {
                            name: 'Required',
                            value: 'required',
                        },
                    ],
                    default: 'nullable',
                    description: 'How to handle null values in the schema',
                },
                {
                    displayName: 'Type Strictness',
                    name: 'typeStrictness',
                    type: 'options',
                    options: [
                        {
                            name: 'Strict',
                            value: 'strict',
                        },
                        {
                            name: 'Loose',
                            value: 'loose',
                        },
                    ],
                    default: 'loose',
                    description: 'How strictly to enforce types in the schema',
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const jsonInput = this.getNodeParameter('jsonInput', itemIndex, '');
                const schemaFormat = this.getNodeParameter('schemaFormat', itemIndex, 'json');
                const generatePostgres = this.getNodeParameter('generatePostgres', itemIndex, false);
                const tableNaming = this.getNodeParameter('tableNaming', itemIndex, 'default');
                const nullHandling = this.getNodeParameter('nullHandling', itemIndex, 'nullable');
                const typeStrictness = this.getNodeParameter('typeStrictness', itemIndex, 'loose');
                // Parse and validate JSON input
                let parsedInput;
                try {
                    parsedInput = JSON.parse(jsonInput);
                }
                catch (error) {
                    throw new NodeOperationError(this.getNode(), `Invalid JSON input: ${error instanceof Error ? error.message : 'Unknown error'}`, { itemIndex });
                }
                // Infer schema using @jsonhero/schema-infer
                const inference = inferSchema(parsedInput);
                const jsonSchema = inference.toJSONSchema();
                // Prepare output data
                const outputData = {
                    json: {
                        jsonSchema,
                    },
                    pairedItem: {
                        item: itemIndex,
                    },
                };
                // Generate TypeScript if requested
                if (schemaFormat === 'typescript') {
                    try {
                        const typescriptCode = await compile(jsonSchema, 'InferredSchema', {
                            bannerComment: '',
                            style: {
                                singleQuote: true,
                                tabWidth: 2,
                                useTabs: false,
                            },
                        });
                        outputData.json.typescript = typescriptCode;
                    }
                    catch (error) {
                        throw new NodeOperationError(this.getNode(), `Failed to generate TypeScript: ${error instanceof Error ? error.message : 'Unknown error'}`, { itemIndex });
                    }
                }
                // Generate PostgreSQL DDL if requested
                if (generatePostgres) {
                    try {
                        // Prepare schema for SQL generation
                        // json-schema-to-sql expects a database schema format where top-level properties are table names
                        // If the inferred schema is an array, wrap it; if it's an object, use it as a table
                        let databaseSchema;
                        if (jsonSchema.type === 'array' && jsonSchema.items) {
                            // For arrays, create a table from the array items
                            databaseSchema = {
                                type: 'object',
                                properties: {
                                    data: jsonSchema.items,
                                },
                            };
                        }
                        else {
                            // For objects, use the schema directly as a table
                            databaseSchema = {
                                type: 'object',
                                properties: {
                                    data: jsonSchema,
                                },
                            };
                        }
                        const { queries, errors } = generateSQLFromJSONSchema(databaseSchema, 'pg');
                        if (errors && errors.length > 0) {
                            throw new NodeOperationError(this.getNode(), `PostgreSQL generation errors: ${errors.map((e) => e.message).join(', ')}`, { itemIndex });
                        }
                        // Apply table naming convention if needed
                        let sqlQueries = queries;
                        if (tableNaming === 'snake_case') {
                            sqlQueries = queries.map((query) => {
                                // Convert table names to snake_case
                                return query.replace(/"([^"]+)"/g, (_match, tableName) => {
                                    const snakeCase = tableName.replace(/([A-Z])/g, '_$1').toLowerCase();
                                    return `"${snakeCase}"`;
                                });
                            });
                        }
                        else if (tableNaming === 'PascalCase') {
                            sqlQueries = queries.map((query) => {
                                // Convert table names to PascalCase
                                return query.replace(/"([^"]+)"/g, (_match, tableName) => {
                                    const pascalCase = tableName
                                        .split('_')
                                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                        .join('');
                                    return `"${pascalCase}"`;
                                });
                            });
                        }
                        outputData.json.postgresql = {
                            queries: sqlQueries,
                            ddl: sqlQueries.join('\n\n'),
                        };
                    }
                    catch (error) {
                        throw new NodeOperationError(this.getNode(), `Failed to generate PostgreSQL DDL: ${error instanceof Error ? error.message : 'Unknown error'}`, { itemIndex });
                    }
                }
                // Add format indicator
                outputData.json.format = schemaFormat;
                outputData.json.nullHandling = nullHandling;
                outputData.json.typeStrictness = typeStrictness;
                returnData.push(outputData);
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: {
                            error: error instanceof Error ? error.message : 'Unknown error occurred',
                        },
                        pairedItem: {
                            item: itemIndex,
                        },
                    });
                }
                else {
                    if (error instanceof Error && 'context' in error) {
                        error.context.itemIndex = itemIndex;
                        throw error;
                    }
                    throw new NodeOperationError(this.getNode(), error, {
                        itemIndex,
                    });
                }
            }
        }
        return [returnData];
    }
}
