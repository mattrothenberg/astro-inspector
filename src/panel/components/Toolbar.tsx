interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showIslandsOnly: boolean;
  onToggleIslandsOnly: () => void;
  onRefresh: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function Toolbar({
  searchQuery,
  onSearchChange,
  showIslandsOnly,
  onToggleIslandsOnly,
  onRefresh,
  onExpandAll,
  onCollapseAll,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button
          className="toolbar-btn"
          onClick={onRefresh}
          title="Refresh tree"
        >
          🔄
        </button>

        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => onSearchChange("")}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="toolbar-right">
        <button
          className="toolbar-btn"
          onClick={onExpandAll}
          title="Expand all"
        >
          ⊞
        </button>
        <button
          className="toolbar-btn"
          onClick={onCollapseAll}
          title="Collapse all"
        >
          ⊟
        </button>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={showIslandsOnly}
            onChange={onToggleIslandsOnly}
          />
          <span>Islands only</span>
        </label>
      </div>
    </div>
  );
}
