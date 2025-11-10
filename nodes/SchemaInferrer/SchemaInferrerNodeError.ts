import type { INode } from 'n8n-workflow';

type ErrorLevel = 'info' | 'warning' | 'error';

export interface SchemaInferrerNodeErrorContext {
  itemIndex?: number;
  metadata?: Record<string, unknown>;
}

export interface SchemaInferrerNodeErrorOptions extends SchemaInferrerNodeErrorContext {
  description?: string;
  level?: ErrorLevel;
  cause?: unknown;
}

/**
 * Lightweight replacement for n8n's NodeOperationError that only includes the
 * pieces this community node relies on. Keeping the shape similar ensures n8n
 * can surface the error details without depending on the runtime helpers from
 * n8n-workflow.
 */
export class SchemaInferrerNodeError extends Error {
  override name = 'NodeOperationError';

  context: SchemaInferrerNodeErrorContext;

  description?: string;

  level: ErrorLevel;

  node: INode;

  constructor(node: INode, message: string, options: SchemaInferrerNodeErrorOptions = {}) {
    super(message);
    this.node = node;
    this.context = {
      itemIndex: options.itemIndex,
      metadata: options.metadata,
    };
    this.description = options.description;
    this.level = options.level ?? 'warning';
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}
