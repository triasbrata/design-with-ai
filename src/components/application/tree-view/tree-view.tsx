import { useState, useCallback, type ReactNode, type MouseEvent, type ComponentPropsWithRef } from "react";
import { cx } from "@/utils/cx";

/* ── Types ── */

export interface TreeItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Expanded icon shown when open */
  iconOpen?: ReactNode;
  children?: TreeItem[];
  /** Additional metadata stored on the item */
  meta?: Record<string, unknown>;
}

export interface TreeViewProps<T extends TreeItem = TreeItem> {
  items: T[];
  /** Called when an item is clicked */
  onSelect?: (item: T, path: number[]) => void;
  /** Currently selected item id */
  selectedId?: string;
  /** Expanded item ids (controlled) */
  expandedIds?: Set<string>;
  /** Called when expand/collapse toggles */
  onExpandedChange?: (ids: Set<string>) => void;
  /** Called on right-click */
  onContextMenu?: (e: MouseEvent, item: T, path: number[]) => void;
  /** Called on double-click */
  onDoubleClick?: (item: T, path: number[]) => void;
  /** Render a custom label (overrides item.label) */
  renderLabel?: (item: T, path: number[], expanded: boolean) => ReactNode;
  /** Render actions after label */
  renderActions?: (item: T, path: number[], expanded: boolean) => ReactNode;
  /** Render content below item when expanded */
  renderContent?: (item: T, path: number[], expanded: boolean) => ReactNode;
  /** Indent per level in px */
  indent?: number;
  /** Additional class */
  className?: string;
  /** Size variant */
  size?: "sm" | "md";
  /** Show chevron icon even when no children */
  showChevronAlways?: boolean;
}

/* ── Icons ── */

function ChevronRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function ChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

/* ── Component ── */

export function TreeView<T extends TreeItem = TreeItem>({
  items,
  onSelect,
  selectedId,
  expandedIds: controlledExpanded,
  onExpandedChange,
  onContextMenu,
  onDoubleClick,
  renderLabel,
  renderActions,
  renderContent,
  indent = 16,
  className,
  size = "md",
  showChevronAlways,
}: TreeViewProps<T>) {
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(new Set());
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(expanded);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (!isControlled) setInternalExpanded(next);
      onExpandedChange?.(next);
    },
    [expanded, isControlled, onExpandedChange],
  );

  const sizeClass = size === "sm" ? "text-xs py-1" : "text-sm py-1.5";

  function renderItem(item: T, path: number[], level: number): ReactNode {
    const isExpanded = expanded.has(item.id);
    const isSelected = item.id === selectedId;
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.id} data-tree-item={item.id}>
        <div
          className={cx(
            "group/tree-item flex items-center gap-1 cursor-pointer rounded-md transition-colors duration-100 hover:bg-primary_hover",
            isSelected && "bg-primary_hover font-semibold text-brand-solid",
            sizeClass,
          )}
          style={{ paddingLeft: level * indent + 4 }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(item, path);
            if (hasChildren || showChevronAlways) toggle(item.id);
          }}
          onContextMenu={(e) => onContextMenu?.(e, item, path)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onDoubleClick?.(item, path);
          }}
        >
          {/* Chevron */}
          <span
            className="shrink-0 flex items-center text-tertiary"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren || showChevronAlways) toggle(item.id);
            }}
          >
            {(hasChildren || showChevronAlways) && (
              isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
            )}
          </span>

          {/* Icon */}
          {(isExpanded && item.iconOpen ? item.iconOpen : item.icon) && (
            <span className="shrink-0 flex items-center text-tertiary">
              {isExpanded && item.iconOpen ? item.iconOpen : item.icon}
            </span>
          )}

          {/* Label */}
          <span className="flex-1 min-w-0 truncate">
            {renderLabel ? renderLabel(item, path, isExpanded) : (
              <span title={item.label.length > 30 ? item.label : undefined}>{item.label}</span>
            )}
          </span>

          {/* Actions */}
          {renderActions?.(item, path, isExpanded)}
        </div>

        {/* Expanded content / children */}
        {isExpanded && (
          <div data-tree-children={item.id}>
            {renderContent?.(item, path, isExpanded)}
            {item.children?.map((child, i) => renderItem(child as T, [...path, i], level + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-caid="application/tree-view" className={cx("flex flex-col gap-0.5", className)}>
      {items.map((item, i) => renderItem(item, [i], 0))}
    </div>
  );
}

/* ── Sub-components ── */

export function TreeGroup({ children, className, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <div className={cx("flex flex-col gap-0.5", className)} {...props}>
      {children}
    </div>
  );
}
TreeGroup.displayName = "TreeGroup";

export interface TreeLabelProps extends ComponentPropsWithRef<"span"> {
  children: ReactNode;
}

export function TreeLabel({ children, className, ...props }: TreeLabelProps) {
  return (
    <span className={cx("text-sm font-medium text-secondary", className)} {...props}>
      {children}
    </span>
  );
}
TreeLabel.displayName = "TreeLabel";

export interface TreeSeparatorProps {
  label?: string;
  className?: string;
}

export function TreeSeparator({ label, className }: TreeSeparatorProps) {
  return (
    <div className={cx("px-2 pt-4 pb-1 text-xs font-semibold text-tertiary uppercase tracking-wider", className)}>
      {label}
    </div>
  );
}
TreeSeparator.displayName = "TreeSeparator";

export function TreeSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-1 p-2", className)} data-caid="tree-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 animate-pulse">
          <div className="size-3 rounded bg-secondary/20" />
          <div className="h-3 rounded bg-secondary/20" style={{ width: `${60 + Math.random() * 30}%` }} />
        </div>
      ))}
    </div>
  );
}
TreeSkeleton.displayName = "TreeSkeleton";
