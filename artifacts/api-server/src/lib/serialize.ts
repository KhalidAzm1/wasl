/** Converts Date fields (and nested Date fields) to ISO strings for JSON/zod validation. */
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
