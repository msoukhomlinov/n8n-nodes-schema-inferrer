# n8n-nodes-schema-inferrer

An n8n community node for inferring JSON schemas from sample data with optional TypeScript type generation and PostgreSQL DDL output.

## Features

- **Schema Inference**: Automatically generate JSON Schema from sample JSON data using `@jsonhero/schema-infer`
- **TypeScript Generation**: Convert inferred schemas to TypeScript type definitions
- **Flexible Configuration**: Customise null handling and type strictness

## Installation

Install the package in your n8n instance:

```bash
npm install n8n-nodes-schema-inferrer
```

Or if you're using n8n's community nodes feature, add it to your `package.json`:

```json
{
  "dependencies": {
    "n8n-nodes-schema-inferrer": "^0.1.0"
  }
}
```

## Usage

### Basic Example

1. Add the "Schema Inferrer" node to your workflow
2. Enter sample JSON data in the "JSON Input" field:

```json
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30,
  "active": true
}
```

3. Select your desired schema format (JSON Schema or TypeScript)
4. Optionally enable PostgreSQL DDL generation
5. Execute the node to get the inferred schema

### Output Formats

#### JSON Schema Output

The node generates a standard JSON Schema (draft 2020-12) that can be used for validation:

```json
{
  "jsonSchema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string" },
      "email": { "type": "string", "format": "email" },
      "age": { "type": "integer" },
      "active": { "type": "boolean" }
    },
    "required": ["id", "name", "email", "age", "active"]
  }
}
```

#### TypeScript Output

When TypeScript format is selected, the node generates TypeScript type definitions:

```typescript
export interface InferredSchema {
  id: string;
  name: string;
  email: string;
  age: number;
  active: boolean;
}
```


## Configuration Options

### Schema Format

- **JSON Schema**: Standard JSON Schema format (default)
- **TypeScript**: TypeScript type definitions

### Null Handling

Controls how null values are handled in the schema:

- **Nullable**: Fields can be null (default)
- **Required**: Fields are marked as required

### Type Strictness

Determines how strictly types are enforced:

- **Strict**: More restrictive type checking
- **Loose**: More permissive type inference (default)

## Examples

### Example 1: Simple Object Schema

**Input:**
```json
{
  "userId": "abc123",
  "username": "johndoe",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**Output (JSON Schema):**
```json
{
  "type": "object",
  "properties": {
    "userId": { "type": "string" },
    "username": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["userId", "username", "createdAt"]
}
```

### Example 2: Array of Objects

**Input:**
```json
[
  { "id": 1, "name": "Item 1" },
  { "id": 2, "name": "Item 2", "description": "Optional field" }
]
```

The node infers that `description` is optional since it's not present in all items.

### Example 3: Nested Structures

**Input:**
```json
{
  "user": {
    "id": "123",
    "profile": {
      "name": "John",
      "email": "john@example.com"
    }
  }
}
```

Generates nested schema structures and, when PostgreSQL is enabled, creates appropriate foreign key relationships.

## Dependencies

- `@jsonhero/schema-infer`: Schema inference from JSON samples
- `json-schema-to-sql`: PostgreSQL DDL generation
- `json-schema-to-typescript`: TypeScript type generation

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the [MIT License](LICENSE).

## Resources

- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
- [JSON Schema Specification](https://json-schema.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
