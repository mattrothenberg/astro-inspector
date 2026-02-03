/**
 * Represents a node in the component tree
 */
export interface TreeNode {
  id: string;
  tagName: string;
  isAstroIsland: boolean;
  componentName?: string;
  clientDirective?: string;
  props?: Record<string, unknown>;
  framework?: string;
  children: TreeNode[];
  depth: number;
  /** Path to find this element in the DOM (e.g., "0.1.3.0") */
  path: string;
  /** URL to the component's JS bundle */
  componentUrl?: string;
  /** Size of the component's JS bundle in bytes */
  bundleSize?: number;
}
