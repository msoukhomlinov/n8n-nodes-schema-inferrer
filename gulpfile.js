const { src, dest } = require('gulp');

function copyAssets() {
  return src('nodes/SchemaInferrer/*.svg')
    .pipe(dest('dist/nodes/SchemaInferrer'));
}

exports.copyAssets = copyAssets;
exports.default = copyAssets;

