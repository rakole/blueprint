import { parseDocument } from "yaml";

export type NativeMarkdownDocument = {
  frontmatter: Record<string, unknown>;
  body: string;
};

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function assertPlainValue(value: unknown, source: string, path: string): void {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPlainValue(item, source, `${path}[${index}]`));
    return;
  }

  if (typeof value !== "object") {
    throw new Error(`${source}: unsupported YAML value at ${path}`);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${source}: non-plain YAML object at ${path}`);
  }

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (UNSAFE_KEYS.has(key)) {
      throw new Error(`${source}: unsafe YAML key ${JSON.stringify(key)} at ${path}`);
    }
    assertPlainValue(item, source, `${path}.${key}`);
  }
}

export function parseNativeMarkdown(
  content: string,
  source = "native Markdown"
): NativeMarkdownDocument {
  const normalized = content.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error(`${source}: expected YAML frontmatter at the start of the file`);
  }

  const closing = normalized.indexOf("\n---", 4);
  if (closing === -1) {
    throw new Error(`${source}: missing closing YAML frontmatter delimiter`);
  }

  const delimiterEnd = closing + 4;
  const afterDelimiter = normalized.slice(delimiterEnd);
  if (afterDelimiter.length > 0 && !afterDelimiter.startsWith("\n")) {
    throw new Error(`${source}: closing YAML delimiter must occupy its own line`);
  }

  const yaml = normalized.slice(4, closing);
  const document = parseDocument(yaml, {
    prettyErrors: true,
    schema: "core",
    strict: true,
    uniqueKeys: true
  });

  if (document.errors.length > 0) {
    throw new Error(`${source}: invalid YAML frontmatter: ${document.errors.map((error) => error.message).join("; ")}`);
  }
  if (document.warnings.length > 0) {
    throw new Error(`${source}: unsupported YAML frontmatter: ${document.warnings.map((warning) => warning.message).join("; ")}`);
  }

  const frontmatter = document.toJS({ maxAliasCount: 0 }) as unknown;
  if (frontmatter === null || Array.isArray(frontmatter) || typeof frontmatter !== "object") {
    throw new Error(`${source}: YAML frontmatter must be a mapping`);
  }
  assertPlainValue(frontmatter, source, "frontmatter");

  return {
    frontmatter: frontmatter as Record<string, unknown>,
    body: afterDelimiter.startsWith("\n") ? afterDelimiter.slice(1) : ""
  };
}
