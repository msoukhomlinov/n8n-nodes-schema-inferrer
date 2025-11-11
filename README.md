# n8n-nodes-schema-inferrer

An n8n community node for inferring JSON schemas from sample data using `quicktype-core`.

## Features

- **Create Schema**: Generate JSON Schema from one or multiple input JSON data items
  - Automatically merges multiple samples into a unified schema
  - Uses `quicktype-core` for robust schema inference
- **Generate SQL DDL**: Convert JSON schemas to SQL CREATE TABLE statements
  - Supports multiple database types (PostgreSQL, MySQL, MariaDB, SQLite3, MSSQL, Oracle, CockroachDB)
  - Intelligent type mapping from JSON Schema to SQL column types
  - Automatic primary key detection or manual specification
  - Handles nullable/required fields and nested objects/arrays

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

### Generate SQL DDL

The "Generate SQL DDL" operation converts a JSON schema to SQL CREATE TABLE statements.

**Input** (from previous Schema Inferrer node or any node with a schema):

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "id": { "type": "integer" },
      "name": { "type": "string" },
      "email": { "type": "string", "format": "email" },
      "age": { "type": "integer" },
      "active": { "type": "boolean" }
    },
    "required": ["id", "name", "email", "age"]
  }
}
```

**Configuration**:
- Database Type: PostgreSQL
- Table Name: users
- Auto-detect Primary Key: true (will detect "id" field)

**Output**:

```json
{
  "sql": "create table \"users\" (\"id\" serial primary key, \"name\" varchar(255) not null, \"email\" varchar(255) not null, \"age\" integer not null, \"active\" boolean)",
  "tableName": "users",
  "databaseType": "pg"
}
```

The generated SQL can then be executed against your database or saved for later use.

#### Supported Database Types

- **PostgreSQL**: Uses `serial` for auto-increment, `jsonb` for JSON data
- **MySQL/MariaDB**: Uses `int` auto_increment, `json` for JSON data
- **SQLite3**: Uses `integer` auto-increment, `text` for JSON data
- **MSSQL**: Uses `int identity`, `nvarchar(max)` for JSON data
- **Oracle**: Uses `number`, `clob` for JSON data
- **CockroachDB**: PostgreSQL-compatible syntax

#### Type Mapping

| JSON Schema Type | SQL Column Type | Notes |
|-----------------|-----------------|-------|
| string | varchar(255) | Uses `text` for long strings |
| integer | integer/serial | `serial` for primary keys |
| number | decimal(10,2) | Configurable precision |
| boolean | boolean | Database-specific |
| array/object | jsonb/json/text | Database-specific JSON support |
| string (format: uuid) | uuid | Native UUID type where supported |
| string (format: date-time) | timestamp | Native timestamp type |
| string (format: email) | varchar(255) | Standard string with validation |

## License

Apache-2.0
