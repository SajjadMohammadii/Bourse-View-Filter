/** Filter-language syntax tree. Every node keeps its source span for error messages. */
export interface Span {
  start: number;
  end: number;
}

export type CompareOp = '>' | '>=' | '<' | '<=' | '=' | '!=';
export type ArithOp = '+' | '-' | '*' | '/' | '%' | '^';

export type Node =
  | ({ type: 'num'; value: number } & Span)
  | ({ type: 'str'; value: string } & Span)
  | ({ type: 'bool'; value: boolean } & Span)
  | ({ type: 'null' } & Span)
  | ({ type: 'field'; name: string } & Span)
  | ({ type: 'call'; name: string; args: Node[] } & Span)
  | ({ type: 'neg'; arg: Node } & Span)
  | ({ type: 'not'; arg: Node } & Span)
  | ({ type: 'arith'; op: ArithOp; left: Node; right: Node } & Span)
  | ({ type: 'logic'; op: 'AND' | 'OR'; left: Node; right: Node } & Span)
  | ({ type: 'compare'; op: CompareOp; left: Node; right: Node } & Span)
  | ({ type: 'in'; arg: Node; list: Node[]; negated: boolean } & Span)
  | ({ type: 'between'; arg: Node; low: Node; high: Node; negated: boolean } & Span)
  | ({ type: 'contains'; arg: Node; sub: Node } & Span)
  | ({ type: 'isnull'; arg: Node; negated: boolean } & Span);

export type NodeOf<T extends Node['type']> = Extract<Node, { type: T }>;
