import type { TreeNode } from "../../types";

interface DetailsPaneProps {
  node: TreeNode | null;
}

export function DetailsPane({ node }: DetailsPaneProps) {
  if (!node) {
    return (
      <div className="details-pane empty">
        <p>Select a component to view details</p>
      </div>
    );
  }

  return (
    <div className="details-pane">
      <h3 className="details-title">
        {node.isAstroIsland ? node.componentName || "Island" : node.tagName}
      </h3>

      {node.isAstroIsland && (
        <>
          <section className="details-section">
            <h4>Type</h4>
            <div className="details-value island-type">Astro Island</div>
          </section>

          {node.clientDirective && (
            <section className="details-section">
              <h4>Client Directive</h4>
              <div className="details-value">
                <code>client:{node.clientDirective}</code>
              </div>
              <p className="directive-description">
                {getDirectiveDescription(node.clientDirective)}
              </p>
            </section>
          )}

          {node.framework && (
            <section className="details-section">
              <h4>Framework</h4>
              <div className="details-value">{node.framework}</div>
            </section>
          )}

          {node.bundleSize !== undefined && (
            <section className="details-section">
              <h4>Bundle Size</h4>
              <div className="details-value">
                <code>{formatBytes(node.bundleSize)}</code>
              </div>
            </section>
          )}

          {node.componentUrl && (
            <section className="details-section">
              <h4>Component URL</h4>
              <div className="details-value component-url">
                <code>{node.componentUrl}</code>
              </div>
            </section>
          )}

          {node.props && Object.keys(node.props).length > 0 && (
            <section className="details-section">
              <h4>Props</h4>
              <pre className="props-display">
                {JSON.stringify(node.props, null, 2)}
              </pre>
            </section>
          )}
        </>
      )}

      {!node.isAstroIsland && (
        <section className="details-section">
          <h4>Type</h4>
          <div className="details-value">HTML Element</div>
        </section>
      )}

      <section className="details-section">
        <h4>Children</h4>
        <div className="details-value">
          {node.children.length} direct children
        </div>
      </section>
    </div>
  );
}

/**
 * Get a description for each client directive
 */
function getDirectiveDescription(directive: string): string {
  const descriptions: Record<string, string> = {
    load: "Hydrates immediately on page load",
    idle: "Hydrates when the browser is idle",
    visible: "Hydrates when the component enters the viewport",
    media: "Hydrates when a CSS media query is matched",
    only: "Skips server-side rendering, only renders on the client",
  };
  return descriptions[directive] || "Custom hydration strategy";
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
