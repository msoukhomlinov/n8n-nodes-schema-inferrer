# Changelog

All notable changes to n8n-nodes-schema-inferrer will be documented in this file.

## [0.3.0] - 2025-11-11

### Added
- Naming Options: Lowercase All Fields (Create, DDL) and Quote Identifiers (DDL), both default off.

### Changed
- DDL can quote identifiers per dialect to preserve case/special characters.

### Fixed
- sanitizeColumnName no longer forces lowercase; follows toggle.
- Primary key matching now compares sanitized names consistently.

### Docs
- README updated for naming and quoting options with examples.


## [0.2.0] - 2025-11-11

### Added

- Quick Rules wildcard support in SQL DDL generation:
  - Contains: `*part*->type`
  - Prefix: `pre*->type`
  - Suffix: `*suf->type`
- Overrides now applied to properties inside `schema.definitions` as well as root `properties`
- Updated UI help text to document wildcard patterns
- Updated README with wildcard documentation and examples

### Changed

- Enhanced matching logic for overrides (first match still wins)
- Improved consistency of override application across nested schemas

## [0.1.0] - 2025-11-11

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
