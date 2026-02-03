import type { TreeNode } from "../../types";
import { highlightElement, clearHighlight } from "../utils/highlighter";

interface TreeNodeItemProps {
  node: TreeNode;
  selectedNode: TreeNode | null;
  expandedNodes: Set<string>;
  searchQuery: string;
  onSelectNode: (node: TreeNode) => void;
  onToggleNode: (nodeId: string) => void;
}

/**
 * Highlight matching text in the node label
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="highlight">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

export function TreeNodeItem({
  node,
  selectedNode,
  expandedNodes,
  searchQuery,
  onSelectNode,
  onToggleNode,
}: TreeNodeItemProps) {
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNode?.id === node.id;
  const hasChildren = node.children.length > 0;

  const displayName = node.isAstroIsland
    ? node.componentName || "Island"
    : node.tagName;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectNode(node);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleNode(node.id);
  };

  const handleMouseEnter = () => {
    highlightElement(node.path);
  };

  const handleMouseLeave = () => {
    clearHighlight();
  };

  return (
    <div className="tree-node">
      <div
        className={`tree-node-label ${isSelected ? "selected" : ""} ${
          node.isAstroIsland ? "island" : ""
        }`}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {hasChildren && (
          <button className="toggle-btn" onClick={handleToggle}>
            {isExpanded ? "▼" : "▶"}
          </button>
        )}
        {!hasChildren && <span className="toggle-placeholder" />}

        {node.isAstroIsland && <span className="island-badge">🏝️</span>}

        <span className="node-name">
          {node.isAstroIsland ? (
            <>
              {"<"}
              {highlightText(displayName, searchQuery)}
              {node.clientDirective && (
                <span className="client-directive">
                  {" "}
                  client:{node.clientDirective}
                </span>
              )}
              {" />"}
            </>
          ) : (
            <>
              {"<"}
              {highlightText(displayName, searchQuery)}
              {">"}
            </>
          )}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div className="tree-node-children">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              selectedNode={selectedNode}
              expandedNodes={expandedNodes}
              searchQuery={searchQuery}
              onSelectNode={onSelectNode}
              onToggleNode={onToggleNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
