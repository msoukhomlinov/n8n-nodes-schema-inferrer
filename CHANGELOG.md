# Changelog

All notable changes to this project will be documented in this file.

## [1.0.2] - 2026-02-19

### Fixed
- Package installation failure: `n8n-workflow` declared as `peerDependency` caused npm 7+ to auto-install it nested under the community node, resulting in a version mismatch and missing `dist/cjs/index.js` at runtime. Removed from `peerDependencies`; now only in `devDependencies` for local build/typecheck.

## [1.0.1] - 2026-02-19

### Fixed
- Package installation failure caused by `n8n-workflow` being declared as a `dependency` instead of a `peerDependency`, which produced a nested `ast-types` module conflict on install.
- Quick Rules text areas in Override Options (Create Schema and SQL DDL) were rendering as single-line inputs due to invalid `multipleLine` typeOption; corrected to `rows: 4`.

### Changed
- `n8n-workflow` moved to `peerDependencies` (runtime) and `devDependencies` (build/typecheck). No longer bundled with the package.
- Debug mode moved from a separate Credential (`SchemaInferrerConfig`) to a **Debug Mode** toggle directly on the node. Existing workflows using the credential will need to enable the toggle on the node instead.
- `inputs`/`outputs` updated to use `NodeConnectionTypes.Main` constant instead of the `'main'` string literal.
- Debug logging in the Prepare for Database operation now uses `context.logger` instead of `console.log`/`console.warn`.

### Removed
- `SchemaInferrerConfig` credential type — no longer needed.

## [1.0.0] - 2025-01-01

### Added
- **Generate Column Topup Query** option in SQL DDL operation: generates `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements alongside the `CREATE TABLE` output. Supports PostgreSQL, MySQL/MariaDB, MSSQL, Oracle, CockroachDB, and SQLite.

### Changed
- Database type dropdown simplified.
- `mapJsonSchemaTypeToKnex` and `processSchemaProperties` updated to support both CREATE and ALTER TABLE contexts.
- Primary key constraints now handled correctly for non-integer columns in topup SQL.

## [0.5.0] - 2024-12-01

### Added
- **Prepare for Database** operation: serializes nested objects and arrays to JSON strings based on schema, for compatibility with PostgreSQL JSONB/JSON columns.

### Fixed
- `$ref` reference resolution in schemas.
- Array-wrapped schema input handling.

## [0.4.1] - 2024-11-01

### Fixed
- SQL DDL generation: `$ref` references in properties now resolved correctly when **Minimise Output Size** is disabled.

## [0.4.0] - 2024-10-01

### Added
- **Preserve Nullability on Type Override** option in SQL DDL override rules: retains original nullable union when changing a field type.

## [0.3.0] - 2024-09-01

### Added
- **Naming Options** for SQL DDL: lowercase fields and quote identifiers.
- Wildcard prefix/suffix support (`pre*`, `*suf`) in SQL DDL quick override rules.

### Fixed
- Override rules now applied consistently across all definitions in the schema.
