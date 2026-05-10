export declare function summarizeSavedArtifact(raw: string): {
    title: string;
    summary: string;
};
export declare function extractMarkdownSection(markdown: string, heading: string): string;
export declare function extractMarkdownHeading(markdown: string): string | null;
export declare function normalizeMarkdownListItems(section: string): string[];
export declare function sectionToList(section: string): string[];
export declare function summarizeContextPieces(pieces: string[], emptyMessage: string): string;
export declare function markdownCell(value: unknown): string;
export declare function markdownTableCell(value: string): string;
export declare function renderBulletList(items: string[] | undefined, fallback?: string): string;
export declare function normalizeTextContent(content: string): string;
