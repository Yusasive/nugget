import { Transform } from 'class-transformer';

/**
 * Query-string booleans arrive as the literal strings "true"/"false" (or
 * are absent) — `@Type(() => Boolean)` alone coerces any non-empty string
 * (including "false") to `true`, so this maps the two accepted spellings
 * explicitly and leaves anything else for `@IsBoolean()` to reject.
 */
export function ParseOptionalBoolean() {
  return Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  });
}
