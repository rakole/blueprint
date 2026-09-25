export {};

declare global {
  namespace JSX {
    type Element = {kind: "element"; tag: string; props: Record<string, unknown>};
    interface IntrinsicElements {
      form: Record<string, unknown>;
      label: Record<string, unknown>;
      input: Record<string, unknown>;
      button: Record<string, unknown>;
      section: Record<string, unknown>;
      h2: Record<string, unknown>;
      p: Record<string, unknown>;
    }
  }
}
