export type NativeMarkdownDocument = {
    frontmatter: Record<string, unknown>;
    body: string;
};
export declare function parseNativeMarkdown(content: string, source?: string): NativeMarkdownDocument;
