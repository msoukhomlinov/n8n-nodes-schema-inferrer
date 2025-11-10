# n8n-nodes-schema-inferrer

An n8n community node for inferring JSON schemas from sample data.

## Features

- Generate JSON Schema from sample JSON data using `@jsonhero/schema-infer`

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

1. Add the "Schema Inferrer" node to your workflow.
2. Enter sample JSON data in the **JSON Input** field.
3. Execute the node to generate the inferred JSON Schema.

### Example

**Input JSON**

```json
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30,
  "active": true
}
```

**Output JSON Schema**

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

## License

MIT
