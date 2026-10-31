"use client";

/**
 * Sidebar component adapted with Base UI's useRender, Framer Motion / Motion,
 * and Casagrande Industrial Telemetry Design System tokens.
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRender } from "@base-ui/react/use-render";
import {
  IconChevronRight,
} from "@tabler/icons-react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const WENSITY_STYLE_ID = "casagrande-sidebar-styles";
const WENSITY_STYLES = `
/* ── Sidebar nav: idle-hidden, visible while scrolling ─────── */
.sidebar-nav {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
.sidebar-nav::-webkit-scrollbar {
  width: 4px;
}
.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-nav::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 9999px;
  transition: background-color 0.45s ease;
}
.sidebar-nav.is-scrolling {
  scrollbar-color: rgba(52, 179, 68, 0.25) transparent;
}
.sidebar-nav.is-scrolling::-webkit-scrollbar-thumb {
  background-color: rgba(52, 179, 68, 0.35);
}
`;

if (typeof document !== "undefined" && !document.getElementById(WENSITY_STYLE_ID)) {
  const style = document.createElement("style");
  style.id = WENSITY_STYLE_ID;
  style.textContent = WENSITY_STYLES;
  document.head.appendChild(style);
}

/* ─── Types ─────────────────────────────────────────────────── */

export type SidebarVariant =
  | "default"
  | "collapsible"
  | "icon-rail"
  | "floating"
  | "resizable";

export interface SidebarProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "onChange"> {
  variant?: SidebarVariant;
  /** Controlled collapsed state (collapsible variant). */
  collapsed?: boolean;
  /** Initial collapsed state (uncontrolled). Default false. */
  defaultCollapsed?: boolean;
  /** Called when collapsed state changes. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Width in px when expanded. Default 270. */
  width?: number;
  /** Width in px when collapsed (icon-rail / collapsed collapsible). Default 68. */
  collapsedWidth?: number;
  /** Minimum width for resizable variant. Default 180. */
  minWidth?: number;
  /** Maximum width for resizable variant. Default 400. */
  maxWidth?: number;
  /** Accessible label for the navigation landmark. */
  "aria-label"?: string;
  children: React.ReactNode;
}

export type SidebarHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export type SidebarNavProps = React.HTMLAttributes<HTMLDivElement>;

export interface SidebarSectionProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Section heading. Fades out when the sidebar is collapsed. */
  label?: string;
}

export interface SidebarItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon shown in both expanded and collapsed states. */
  icon?: React.ReactNode;
  /** Marks the item as the current route. */
  active?: boolean;
  /** Renders as a link when provided. */
  href?: string;
  /** Opens in a new tab. */
  external?: boolean;
  /** Badge / count shown after the label. */
  badge?: React.ReactNode;
  asChild?: boolean;
}

export interface SidebarNestedProps {
  /** Icon for the nested group trigger. */
  icon?: React.ReactNode;
  /** Label for the nested group. */
  label: string;
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state. Default false. */
  defaultOpen?: boolean;
  /** Called when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Marks the group as containing the active item. */
  active?: boolean;
  children: React.ReactNode;
}

export type SidebarFooterProps = React.HTMLAttributes<HTMLDivElement>;

export interface SidebarToggleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children?:
    | React.ReactNode
    | ((state: { collapsed: boolean }) => React.ReactNode);
  /** Standalone: pass collapsed state when used outside a collapsible <Sidebar>. */
  collapsed?: boolean;
  /** Standalone: called when toggled. */
  onToggle?: () => void;
}

/* ─── Motion constants ──────────────────────────────────────── */

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

/* ─── Context ───────────────────────────────────────────────── */

type SidebarContextValue = {
  variant: SidebarVariant;
  collapsed: boolean;
  toggleCollapsed: () => void;
  navId: string;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebarContext() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx)
    throw new Error("Sidebar compound components must be used within <Sidebar>");
  return ctx;
}

/**
 * Reads the current sidebar state.
 */
export function useSidebar(): {
  variant: SidebarVariant;
  collapsed: boolean;
  toggleCollapsed: () => void;
} {
  const { variant, collapsed, toggleCollapsed } = useSidebarContext();
  return { variant, collapsed, toggleCollapsed };
}

/* ─── Resizable width hook ──────────────────────────────────── */

function useResizableWidth(initial: number, min: number, max: number) {
  const [width, setWidth] = React.useState(initial);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragState = React.useRef<{ startX: number; startWidth: number } | null>(
    null,
  );

  const clamp = React.useCallback(
    (value: number) => Math.min(max, Math.max(min, value)),
    [min, max],
  );

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = { startX: e.clientX, startWidth: width };
      setIsDragging(true);
    },
    [width],
  );

  React.useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!dragState.current) return;
      const delta = e.clientX - dragState.current.startX;
      setWidth(clamp(dragState.current.startWidth + delta));
    };

    const onPointerUp = () => {
      dragState.current = null;
      setIsDragging(false);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [isDragging, clamp]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 48 : 16;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setWidth((w) => clamp(w - step));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setWidth((w) => clamp(w + step));
      } else if (e.key === "Home") {
        e.preventDefault();
        setWidth(min);
      } else if (e.key === "End") {
        e.preventDefault();
        setWidth(max);
      }
    },
    [clamp, min, max],
  );

  const reset = React.useCallback(() => setWidth(initial), [initial]);

  return { width, isDragging, onPointerDown, onKeyDown, reset };
}

/* ─── Shared item styling ───────────────────────────────────── */

const itemBaseClasses = cn(
  "group/sidebar-item relative flex w-full items-center gap-3 rounded-lg px-3 py-2 min-h-[40px]",
  "text-[13px] font-medium leading-none outline-none select-none whitespace-nowrap cursor-pointer",
  "transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
  "focus-visible:ring-2 focus-visible:ring-[#34b344] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131923]",
  "disabled:pointer-events-none disabled:opacity-40",
);

const itemInactiveClasses = cn(
  "text-[#94a3b8]",
  "hover:text-white",
  "hover:bg-[#1c2432]/60",
);

const itemActiveClasses = "text-white font-semibold";

const activePillClasses = cn(
  "pointer-events-none absolute inset-0 rounded-lg",
  "bg-[#1c2432] border-l-[3px] border-[#34b344] shadow-[0_0_12px_rgba(52,179,68,0.18)]",
);

/* ─── <Sidebar> ─────────────────────────────────────────────── */

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  (
    {
      variant = "collapsible",
      collapsed: controlledCollapsed,
      defaultCollapsed = false,
      onCollapsedChange,
      width: widthProp = 270,
      collapsedWidth = 68,
      minWidth = 180,
      maxWidth = 400,
      className,
      children,
      "aria-label": ariaLabel = "Menu de Navegação Casagrande",
      style,
      ...props
    },
    ref,
  ) => {
    const reactId = React.useId();
    const prefersReducedMotion = useReducedMotion();
    const isCollapsible = variant === "collapsible";
    const isIconRail = variant === "icon-rail";
    const isResizable = variant === "resizable";

    const [internalCollapsed, setInternalCollapsed] =
      React.useState(defaultCollapsed);
    const isControlled = controlledCollapsed !== undefined;
    const collapsed = isIconRail
      ? true
      : isCollapsible
        ? isControlled
          ? controlledCollapsed
          : internalCollapsed
        : false;

    const toggleCollapsed = React.useCallback(() => {
      if (!isCollapsible) return;
      const next = !collapsed;
      if (!isControlled) setInternalCollapsed(next);
      onCollapsedChange?.(next);
    }, [isCollapsible, collapsed, isControlled, onCollapsedChange]);

    const resize = useResizableWidth(widthProp, minWidth, maxWidth);

    const effectiveWidth = collapsed
      ? collapsedWidth
      : isResizable
        ? resize.width
        : widthProp;

    const ctx = React.useMemo<SidebarContextValue>(
      () => ({
        variant,
        collapsed,
        toggleCollapsed,
        navId: `sidebar-${reactId}`,
      }),
      [variant, collapsed, toggleCollapsed, reactId],
    );

    return (
      <SidebarContext.Provider value={ctx}>
        <nav
          ref={ref}
          aria-label={ariaLabel}
          data-slot="sidebar"
          data-variant={variant}
          data-collapsed={collapsed ? "true" : "false"}
          data-dragging={resize.isDragging ? "true" : undefined}
          style={{
            ...style,
            width: effectiveWidth,
            flexShrink: 0,
            transition:
              resize.isDragging || prefersReducedMotion
                ? "none"
                : "width 240ms cubic-bezier(0.23,1,0.32,1)",
          }}
          className={cn(
            "relative isolate flex h-full flex-col overflow-hidden",
            "bg-[#131923] text-[#f1f5f9] border-r border-[#283548] select-none",
            variant === "floating"
              ? cn(
                  "m-3 h-[calc(100%-1.5rem)] rounded-xl",
                  "border border-[#283548]",
                  "bg-[#131923]",
                  "shadow-[0_4px_24px_rgba(0,0,0,0.45)]",
                )
              : "border-r border-[#283548]",
            resize.isDragging && "select-none",
            className,
          )}
          {...props}
        >
          {children}
          {isResizable && (
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label="Redimensionar menu lateral"
              aria-valuemin={minWidth}
              aria-valuemax={maxWidth}
              aria-valuenow={Math.round(resize.width)}
              data-slot="sidebar-resize-handle"
              onPointerDown={resize.onPointerDown}
              onKeyDown={resize.onKeyDown}
              onDoubleClick={resize.reset}
              className={cn(
                "absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize outline-none",
                "after:absolute after:inset-y-0 after:right-0 after:w-[2px]",
                "after:bg-transparent after:transition-colors after:duration-150",
                "hover:after:bg-[#34b344]/40",
                "focus-visible:after:bg-[#34b344]",
                resize.isDragging && "after:bg-[#34b344]",
              )}
            />
          )}
        </nav>
      </SidebarContext.Provider>
    );
  },
);
Sidebar.displayName = "Sidebar";

/* ─── Fading label (shared by item / nested / section) ──────── */

export function FadingLabel({
  show,
  className,
  children,
}: {
  show: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.12,
            ease: EASE_OUT,
          }}
          className={className}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/* ─── <SidebarHeader> ───────────────────────────────────────── */

export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  SidebarHeaderProps
>(({ className, children, ...props }, ref) => {
  const { collapsed } = useSidebarContext();

  return (
    <div
      ref={ref}
      data-slot="sidebar-header"
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "flex shrink-0 items-center bg-[#0c1017] border-b border-[#283548]",
        collapsed
          ? "h-14 justify-center px-0 py-3"
          : "h-14 gap-2.5 px-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
SidebarHeader.displayName = "SidebarHeader";

/* ─── <SidebarNav> ──────────────────────────────────────────── */

export const SidebarNav = React.forwardRef<HTMLDivElement, SidebarNavProps>(
  ({ className, children, ...props }, ref) => {
    const { navId } = useSidebarContext();
    return (
      <div
        ref={ref}
        id={navId}
        data-slot="sidebar-nav"
        className={cn(
          "sidebar-nav min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain py-2 px-2.5 space-y-1",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
SidebarNav.displayName = "SidebarNav";

/* ─── <SidebarSection> ──────────────────────────────────────── */

export const SidebarSection = React.forwardRef<
  HTMLDivElement,
  SidebarSectionProps
>(({ className, label, children, ...props }, ref) => {
  const { collapsed } = useSidebarContext();
  return (
    <div
      ref={ref}
      data-slot="sidebar-section"
      role="group"
      aria-label={label}
      className={cn("py-1", className)}
      {...props}
    >
      {label && (
        <div className="flex h-6 items-end px-3 pb-1">
          <FadingLabel
            show={!collapsed}
            className="text-[10px] font-bold font-tabular-data uppercase tracking-wider text-[#94a3b8] whitespace-nowrap"
          >
            {label}
          </FadingLabel>
        </div>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
});
SidebarSection.displayName = "SidebarSection";

/* ─── Active pill (glides between items) ────────────────────── */

function ActivePill({ navId }: { navId: string }) {
  const prefersReducedMotion = useReducedMotion();
  if (prefersReducedMotion) {
    return <span aria-hidden="true" className={activePillClasses} />;
  }
  return (
    <motion.span
      aria-hidden="true"
      layoutId={`${navId}-active-pill`}
      transition={{ type: "spring", stiffness: 480, damping: 38 }}
      className={activePillClasses}
    />
  );
}

/* ─── <SidebarItem> ─────────────────────────────────────────── */

export const SidebarItem = React.forwardRef<
  HTMLButtonElement,
  SidebarItemProps
>(
  (
    {
      className,
      icon,
      active = false,
      href,
      external = false,
      badge,
      asChild = false,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const { collapsed, navId } = useSidebarContext();
    const composedClassName = cn(
      itemBaseClasses,
      active ? itemActiveClasses : itemInactiveClasses,
      collapsed && "justify-center px-0 py-2.5",
      className,
    );
    const title =
      collapsed && typeof children === "string" ? children : undefined;

    const asChildElement =
      asChild && React.isValidElement(children) ? children : null;

    const asChildRendered = useRender({
      enabled: Boolean(asChildElement),
      ref: ref as React.Ref<HTMLElement>,
      render: asChildElement ?? undefined,
      props: {
        "data-slot": "sidebar-item",
        "data-active": active ? "true" : undefined,
        "aria-current": active ? "page" : undefined,
        title,
        className: composedClassName,
        ...props,
      },
    });

    if (asChildRendered) return asChildRendered;

    const content = (
      <>
        {active ? <ActivePill navId={navId} /> : null}
        {icon ? (
          <span
            data-slot="sidebar-item-icon"
            className={cn(
              "relative z-10 flex size-5 shrink-0 items-center justify-center transition-colors duration-150",
              active
                ? "text-[#34b344]"
                : "text-[#94a3b8] group-hover/sidebar-item:text-white",
            )}
          >
            {icon}
          </span>
        ) : null}
        <FadingLabel
          show={!collapsed}
          className="relative z-10 min-w-0 flex-1 truncate text-left font-body-md text-[13px]"
        >
          {children}
        </FadingLabel>
        {badge ? (
          <FadingLabel
            show={!collapsed}
            className="relative z-10 flex shrink-0 items-center ml-auto"
          >
            {badge}
          </FadingLabel>
        ) : null}
      </>
    );

    if (href) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          data-slot="sidebar-item"
          data-active={active ? "true" : undefined}
          aria-current={active ? "page" : undefined}
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          title={title}
          className={composedClassName}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        data-slot="sidebar-item"
        data-active={active ? "true" : undefined}
        aria-current={active ? "page" : undefined}
        disabled={disabled}
        title={title}
        className={composedClassName}
        {...props}
      >
        {content}
      </button>
    );
  },
);
SidebarItem.displayName = "SidebarItem";

/* ─── <SidebarNested> ───────────────────────────────────────── */

export const SidebarNested = React.forwardRef<
  HTMLDivElement,
  SidebarNestedProps
>(
  (
    {
      icon,
      label,
      open: controlledOpen,
      defaultOpen = false,
      onOpenChange,
      active = false,
      children,
    },
    ref,
  ) => {
    const { collapsed } = useSidebarContext();
    const prefersReducedMotion = useReducedMotion();
    const reactId = React.useId();

    const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;

    const toggle = React.useCallback(() => {
      const next = !open;
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    }, [open, isControlled, onOpenChange]);

    const contentId = `sidebar-nested-content-${reactId}`;

    return (
      <div ref={ref} data-slot="sidebar-nested" className="flex flex-col">
        <button
          type="button"
          data-slot="sidebar-nested-trigger"
          data-open={open ? "true" : "false"}
          data-active={active ? "true" : undefined}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={toggle}
          title={collapsed ? label : undefined}
          className={cn(
            itemBaseClasses,
            active && collapsed ? itemActiveClasses : itemInactiveClasses,
            collapsed && "justify-center px-0",
          )}
        >
          {active && collapsed && (
            <span aria-hidden="true" className={activePillClasses} />
          )}
          {icon && (
            <span
              data-slot="sidebar-nested-icon"
              className={cn(
                "relative z-10 flex size-5 shrink-0 items-center justify-center",
                "text-[#94a3b8] group-hover/sidebar-item:text-white transition-colors duration-150",
              )}
            >
              {icon}
            </span>
          )}
          <FadingLabel
            show={!collapsed}
            className="relative z-10 min-w-0 flex-1 truncate text-left"
          >
            {label}
          </FadingLabel>
          <FadingLabel
            show={!collapsed}
            className="relative z-10 flex shrink-0 items-center"
          >
            <motion.span
              aria-hidden="true"
              animate={{ rotate: open ? 90 : 0 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.2,
                ease: EASE_OUT,
              }}
              className="flex items-center justify-center text-[#94a3b8]"
            >
              <IconChevronRight className="size-3.5" stroke={2} />
            </motion.span>
          </FadingLabel>
        </button>
        <AnimatePresence initial={false}>
          {open && !collapsed && (
            <motion.div
              id={contentId}
              data-slot="sidebar-nested-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: {
                  duration: prefersReducedMotion ? 0 : 0.24,
                  ease: EASE_OUT,
                },
                opacity: {
                  duration: prefersReducedMotion ? 0 : 0.16,
                  ease: EASE_OUT,
                },
              }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  "relative ml-5 flex flex-col gap-0.5 py-0.5 pl-2.5",
                  "before:absolute before:inset-y-1 before:left-0 before:w-px",
                  "before:bg-[#283548]",
                )}
              >
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
SidebarNested.displayName = "SidebarNested";

/* ─── <SidebarFooter> ───────────────────────────────────────── */

export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  SidebarFooterProps
>(({ className, children, ...props }, ref) => {
  const { collapsed } = useSidebarContext();
  return (
    <div
      ref={ref}
      data-slot="sidebar-footer"
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "flex shrink-0 items-center py-3 bg-[#131923] border-t border-[#283548]",
        collapsed ? "justify-center px-0" : "gap-2.5 px-3.5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
SidebarFooter.displayName = "SidebarFooter";

/* ─── <SidebarToggle> ───────────────────────────────────────── */

export const SidebarToggle = React.forwardRef<
  HTMLButtonElement,
  SidebarToggleProps
>(
  (
    { className, children, collapsed: collapsedProp, onToggle, ...props },
    ref,
  ) => {
    const ctx = React.useContext(SidebarContext);
    const usesContext = ctx?.variant === "collapsible";

    const collapsed = usesContext ? ctx!.collapsed : collapsedProp;
    const toggle = usesContext ? ctx!.toggleCollapsed : onToggle;

    if (collapsed === undefined || !toggle) return null;

    return (
      <button
        ref={ref}
        type="button"
        data-slot="sidebar-toggle"
        data-collapsed={collapsed ? "true" : "false"}
        onClick={toggle}
        aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        aria-expanded={!collapsed}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg outline-none cursor-pointer",
          "bg-[#1c2432] text-[#94a3b8] hover:text-[#34b344] border border-[#283548] hover:border-[#34b344]",
          "focus-visible:ring-2 focus-visible:ring-[#34b344]",
          "transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
          "active:scale-95",
          className,
        )}
        {...props}
      >
        {typeof children === "function" ? (
          children({ collapsed })
        ) : (
          children ??
          (collapsed ? (
            <PanelLeftOpen
              className="size-[18px]"
              strokeWidth={1.8}
            />
          ) : (
            <PanelLeftClose
              className="size-[18px]"
              strokeWidth={1.8}
            />
          ))
        )}
      </button>
    );
  },
);
SidebarToggle.displayName = "SidebarToggle";
