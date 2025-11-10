# n8n-nodes-schema-inferrer

An n8n community node for inferring JSON schemas from sample data using `quicktype-core`.

## Features

- Generate JSON Schema from one or multiple input JSON data items
- Automatically merges multiple samples into a unified schema
- Uses `quicktype-core` for robust schema inference

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
2. Connect it to a node that outputs JSON data (one or multiple items).
3. Execute the node to generate the inferred JSON Schema from all input items.

The node will automatically process all input items and merge them into a single unified JSON schema.

### Example

**Input JSON Items** (from previous node)

Item 1:
```json
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30,
  "active": true
}
```

Item 2:
```json
{
  "id": "456",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "age": 25
}
```

**Output JSON Schema** (single item)

```json
{
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string" },
      "email": { "type": "string" },
      "age": { "type": "integer" },
      "active": { "type": "boolean" }
    },
    "required": ["id", "name", "email", "age"]
  }
}
```

Note: The schema merges all input items, so properties that appear in all items will be marked as required, while optional properties (like `active` in the example above) may be marked as optional depending on their presence across samples.

## License

Apache-2.0
