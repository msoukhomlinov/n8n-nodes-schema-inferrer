# Changelog

All notable changes to n8n-nodes-schema-inferrer will be documented in this file.

## [0.1.0] - 2025-01-XX

### Added

- Initial release of Schema Inferrer node
- JSON Schema inference from sample JSON data using `@jsonhero/schema-infer`
- TypeScript type definition generation from inferred schemas
- Configuration options for schema format selection (JSON Schema or TypeScript)
- Null handling configuration (Nullable, Required)
- Type strictness options (Strict, Loose)
- Support for nested object structures
- Support for array inference with optional field detection
- Comprehensive error handling with helpful error messages

### Features

- **Schema Inference**: Automatically generates JSON Schema (draft 2020-12) from sample JSON input
- **TypeScript Generation**: Converts JSON Schema to TypeScript type definitions
- **Flexible Configuration**: Options for customising schema generation
