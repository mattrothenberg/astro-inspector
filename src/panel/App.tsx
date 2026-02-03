import { useState, useEffect, useCallback, useMemo } from "react";
import type { TreeNode } from "../types";
import { TreeNodeItem } from "./components/TreeNodeItem";
import { DetailsPane } from "./components/DetailsPane";
import { Toolbar } from "./components/Toolbar";
import "./styles.css";

/** Recursively check if a node or any descendant is an island */
function hasIslandDescendant(node: TreeNode): boolean {
  if (node.isAstroIsland) return true;
  return node.children.some(hasIslandDescendant);
}

/** Collect all node IDs that lead to islands (for auto-expand) */
function collectExpandedNodes(node: TreeNode, result: Set<string>): void {
  result.add(node.id);
  for (const child of node.children) {
    if (hasIslandDescendant(child)) {
      collectExpandedNodes(child, result);
    }
  }
}

/** Script injected into the page to build the component tree */
function buildTreeInPage() {
  let nodeId = 0;

  interface TreeNodeData {
    id: string;
    tagName: string;
    isAstroIsland: boolean;
    componentName?: string;
    clientDirective?: string;
    props?: Record<string, unknown>;
    framework?: string;
    children: TreeNodeData[];
    depth: number;
    path: string;
  }

  function buildTree(element: Element, depth = 0, path = ""): TreeNodeData {
    const tagName = element.tagName.toLowerCase();
    const isIsland = tagName === "astro-island";

    let componentName: string | undefined;
    let clientDirective: string | undefined;
    let props: Record<string, unknown> | undefined;
    let framework: string | undefined;

    if (isIsland) {
      clientDirective = element.getAttribute("client") || "load";

      // Get component name from opts attribute
      const opts = element.getAttribute("opts");
      if (opts) {
        try {
          componentName = JSON.parse(opts).name;
        } catch {}
      }

      // Fallback: extract from component-url
      if (!componentName) {
        const url = element.getAttribute("component-url") || "";
        const match = url.match(/\/([^/]+?)(?:\.[^.]+)?$/);
        componentName = match?.[1] || "Island";
      }

      // Parse props
      const propsAttr = element.getAttribute("props");
      if (propsAttr && propsAttr !== "{}") {
        try {
          props = JSON.parse(propsAttr);
        } catch {}
      }

      // Detect framework from renderer-url
      const renderer = element.getAttribute("renderer-url") || "";
      if (renderer.includes("react") || renderer.includes("client.C")) {
        framework = "React";
      } else if (renderer.includes("vue")) {
        framework = "Vue";
      } else if (renderer.includes("svelte")) {
        framework = "Svelte";
      } else if (renderer.includes("solid")) {
        framework = "Solid";
      } else if (renderer.includes("preact")) {
        framework = "Preact";
      }
    }

    const node: TreeNodeData = {
      id: `node-${nodeId++}`,
      tagName,
      isAstroIsland: isIsland,
      componentName,
      clientDirective,
      props,
      framework,
      children: [],
      depth,
      path,
    };

    Array.from(element.children).forEach((child, i) => {
      node.children.push(
        buildTree(child, depth + 1, path ? `${path}.${i}` : `${i}`),
      );
    });

    return node;
  }

  return buildTree(document.body, 0, "");
}

export function App() {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [showIslandsOnly, setShowIslandsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTree = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const tabId = chrome.devtools.inspectedWindow.tabId;
      if (!tabId) {
        setError("No inspected tab found");
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: buildTreeInPage,
      });

      const treeData = results?.[0]?.result as TreeNode | undefined;
      if (!treeData) {
        setError("Failed to get component tree from page");
        return;
      }

      setTree(treeData);

      // Auto-expand nodes that lead to islands
      const expanded = new Set<string>();
      collectExpandedNodes(treeData, expanded);
      setExpandedNodes(expanded);
    } catch (err) {
      setError(
        `Could not connect to the page: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!tree) return;
    const all = new Set<string>();
    const collect = (node: TreeNode) => {
      all.add(node.id);
      node.children.forEach(collect);
    };
    collect(tree);
    setExpandedNodes(all);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  /** Filter tree to show only islands and their ancestors */
  const filteredTree = useMemo(() => {
    if (!tree) return null;
    if (!showIslandsOnly) return tree;

    function filter(node: TreeNode): TreeNode | null {
      if (node.isAstroIsland) {
        return {
          ...node,
          children: node.children
            .map(filter)
            .filter((c): c is TreeNode => c !== null),
        };
      }

      const filteredChildren = node.children
        .map(filter)
        .filter((c): c is TreeNode => c !== null);
      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }

      return null;
    }

    return filter(tree);
  }, [tree, showIslandsOnly]);

  return (
    <div className="app">
      <Toolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showIslandsOnly={showIslandsOnly}
        onToggleIslandsOnly={() => setShowIslandsOnly((v) => !v)}
        onRefresh={fetchTree}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />
      <div className="main-content">
        <div className="tree-panel">
          {isLoading && (
            <div className="loading">Loading component tree...</div>
          )}
          {error && <div className="error">{error}</div>}
          {!isLoading && !error && filteredTree && (
            <div className="tree-view">
              <TreeNodeItem
                node={filteredTree}
                selectedNode={selectedNode}
                expandedNodes={expandedNodes}
                searchQuery={searchQuery}
                onSelectNode={setSelectedNode}
                onToggleNode={toggleNode}
              />
            </div>
          )}
          {!isLoading && !error && !filteredTree && (
            <div className="empty">No Astro components found on this page.</div>
          )}
        </div>
        <div className="details-panel">
          <DetailsPane node={selectedNode} />
        </div>
      </div>
    </div>
  );
}
