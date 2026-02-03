import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { TreeNode } from "../types";
import { TreeNodeItem } from "./components/TreeNodeItem";
import { DetailsPane } from "./components/DetailsPane";
import { Toolbar } from "./components/Toolbar";
import { scrollToElement } from "./utils/highlighter";
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

/** Flatten the visible tree into a list for keyboard navigation */
function flattenVisibleTree(
  node: TreeNode,
  expandedNodes: Set<string>,
  result: TreeNode[] = [],
): TreeNode[] {
  result.push(node);
  if (expandedNodes.has(node.id)) {
    for (const child of node.children) {
      flattenVisibleTree(child, expandedNodes, result);
    }
  }
  return result;
}

/** Find parent node in tree */
function findParent(
  root: TreeNode,
  targetId: string,
  parent: TreeNode | null = null,
): TreeNode | null {
  if (root.id === targetId) return parent;
  for (const child of root.children) {
    const found = findParent(child, targetId, root);
    if (found !== null) return found;
  }
  return null;
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

  /** Flattened list of visible nodes for keyboard navigation */
  const visibleNodes = useMemo(() => {
    if (!filteredTree) return [];
    return flattenVisibleTree(filteredTree, expandedNodes);
  }, [filteredTree, expandedNodes]);

  const treeRef = useRef<HTMLDivElement>(null);

  /** Handle keyboard navigation */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!filteredTree || visibleNodes.length === 0) return;

      const currentIndex = selectedNode
        ? visibleNodes.findIndex((n) => n.id === selectedNode.id)
        : -1;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, visibleNodes.length - 1);
          const nextNode = visibleNodes[nextIndex];
          if (nextNode) {
            setSelectedNode(nextNode);
            scrollToElement(nextNode.path);
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          const prevNode = visibleNodes[prevIndex];
          if (prevNode) {
            setSelectedNode(prevNode);
            scrollToElement(prevNode.path);
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (selectedNode) {
            if (
              !expandedNodes.has(selectedNode.id) &&
              selectedNode.children.length > 0
            ) {
              // Expand if collapsed and has children
              toggleNode(selectedNode.id);
            } else if (
              selectedNode.children.length > 0 &&
              expandedNodes.has(selectedNode.id)
            ) {
              // Move to first child if expanded
              const firstChild = selectedNode.children[0];
              setSelectedNode(firstChild);
              scrollToElement(firstChild.path);
            }
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (selectedNode) {
            if (
              expandedNodes.has(selectedNode.id) &&
              selectedNode.children.length > 0
            ) {
              // Collapse if expanded
              toggleNode(selectedNode.id);
            } else {
              // Move to parent
              const parent = findParent(filteredTree, selectedNode.id);
              if (parent) {
                setSelectedNode(parent);
                scrollToElement(parent.path);
              }
            }
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (selectedNode) {
            scrollToElement(selectedNode.path);
          }
          break;
        }
      }
    },
    [filteredTree, visibleNodes, selectedNode, expandedNodes, toggleNode],
  );

  /** Handle node selection with scroll */
  const handleSelectNode = useCallback((node: TreeNode) => {
    setSelectedNode(node);
    scrollToElement(node.path);
  }, []);

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
        <div
          className="tree-panel"
          ref={treeRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
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
                onSelectNode={handleSelectNode}
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
