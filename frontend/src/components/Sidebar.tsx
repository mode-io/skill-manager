import {
  type RefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  BookOpen,
  Check,
  ChevronDown,
  Command,
  Languages,
  LayoutDashboard,
  RefreshCw,
  Settings,
  Store,
  SunMedium,
  Terminal,
} from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { useSidebarModel, type SidebarIconKey } from "../app/capability-registry";
import { LoadingSpinner } from "./LoadingSpinner";
import { useToast } from "./Toast";
import { useCommonCopy, useLocale } from "../i18n";

interface SidebarProps {
  onRefresh: () => void | Promise<void>;
  refreshPending: boolean;
}

export function Sidebar({ onRefresh, refreshPending }: SidebarProps) {
  const model = useSidebarModel();
  const { toast } = useToast();
  const common = useCommonCopy();

  return (
    <aside className="sidebar ui-scrollbar--thin" aria-label={common.nav.primary}>
      <div className="sidebar__brand">
        <Link to="/overview" className="sidebar__brand-name">
          skill-manager
        </Link>
      </div>

      <nav className="sidebar__nav">
        {model.topLinks.map((link) => (
          <SidebarTopLink
            key={link.key}
            to={link.to}
            label={link.label}
            icon={<LayoutDashboard size={16} />}
          />
        ))}

        {model.groups.map((group) => (
          <NavGroup
            key={group.key}
            label={group.label}
            icon={sidebarIcon(group.iconKey)}
            count={group.count}
          >
            {group.links.map((link) => (
              <SidebarLink
                key={link.key}
                to={link.to}
                label={link.label}
                count={link.count}
              />
            ))}
          </NavGroup>
        ))}
      </nav>

      <div className="sidebar__footer">
        <button
          type="button"
          className="sidebar-footer-btn"
          onClick={() => void onRefresh()}
          disabled={refreshPending}
          aria-busy={refreshPending}
        >
          {refreshPending ? <LoadingSpinner size="sm" label={common.actions.refreshing} /> : <RefreshCw size={16} />}
          <span>{common.actions.refresh}</span>
        </button>
        <button
          type="button"
          className="sidebar-footer-btn"
          onClick={() => toast(common.nav.lightComingSoon)}
        >
          <SunMedium size={16} />
          <span>{common.nav.light}</span>
        </button>
        <SidebarLanguageMenu />
        <NavLink
          to="/settings"
          className={({ isActive }) => `sidebar-footer-btn${isActive ? " is-active" : ""}`}
        >
          <Settings size={16} />
          <span>{common.nav.settings}</span>
        </NavLink>
      </div>
    </aside>
  );
}

function SidebarLanguageMenu() {
  const common = useCommonCopy();
  const { locale, setLocale, supportedLocales } = useLocale();
  const activeLabel = supportedLocales.find((option) => option.value === locale)?.nativeLabel ?? locale;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="sidebar-footer-btn"
          aria-label={common.language.ariaLabel(activeLabel)}
          aria-haspopup="menu"
        >
          <Languages size={16} />
          <span>{activeLabel}</span>
          <ChevronDown className="sidebar-footer-btn__chevron" size={14} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="ui-popup ui-popup--menu ui-menu"
          side="right"
          align="end"
          sideOffset={8}
        >
          <ul className="ui-menu__list" role="menu" aria-label={common.language.label}>
            {supportedLocales.map((option) => {
              const selected = option.value === locale;
              return (
                <li key={option.value}>
                  <Popover.Close asChild>
                    <button
                      type="button"
                      className="ui-menu__item"
                      data-selected={selected || undefined}
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => setLocale(option.value)}
                    >
                      <span className="ui-menu__icon" aria-hidden="true">
                        {selected ? <Check size={14} /> : null}
                      </span>
                      <span className="ui-menu__label">{option.nativeLabel}</span>
                      <span className="ui-menu__meta">
                        {selected ? common.language.selected : option.label}
                      </span>
                    </button>
                  </Popover.Close>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function sidebarIcon(iconKey: SidebarIconKey): ReactNode {
  if (iconKey === "skills") return <BookOpen size={16} />;
  if (iconKey === "slash-commands") return <Command size={16} />;
  if (iconKey === "mcp") return <Terminal size={16} />;
  if (iconKey === "marketplace") return <Store size={16} />;
  return <LayoutDashboard size={16} />;
}

function NavGroup({
  label,
  icon,
  count,
  children,
}: {
  label: string;
  icon: ReactNode;
  count?: number | null;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const indicator = useNavIndicator(listRef, collapsed);

  return (
    <div className="sidebar-group" data-collapsed={collapsed}>
      <button
        type="button"
        className="sidebar-group__header"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        {icon}
        <span>{label}</span>
        {count != null ? <span className="sidebar-group__count">{count}</span> : null}
        <ChevronDown className="sidebar-group__chevron" size={14} aria-hidden="true" />
      </button>
      {!collapsed ? (
        <div className="sidebar-group__items" ref={listRef}>
          <span
            className="sidebar-indicator"
            aria-hidden="true"
            data-visible={indicator != null}
            style={
              indicator
                ? {
                    transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`,
                    width: `${indicator.width}px`,
                    height: `${indicator.height}px`,
                  }
                : undefined
            }
          />
          {children}
        </div>
      ) : null}
    </div>
  );
}

interface IndicatorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureActive(list: HTMLDivElement): IndicatorRect | null {
  const active = list.querySelector<HTMLElement>(".sidebar-link.is-active");
  if (!active) {
    return null;
  }
  return {
    top: active.offsetTop,
    left: active.offsetLeft,
    width: active.offsetWidth,
    height: active.offsetHeight,
  };
}

function measureLink(link: HTMLElement): IndicatorRect {
  return {
    top: link.offsetTop,
    left: link.offsetLeft,
    width: link.offsetWidth,
    height: link.offsetHeight,
  };
}

function useNavIndicator(
  listRef: RefObject<HTMLDivElement | null>,
  collapsed: boolean,
): IndicatorRect | null {
  const location = useLocation();
  const [activeRect, setActiveRect] = useState<IndicatorRect | null>(null);
  const [hoverRect, setHoverRect] = useState<IndicatorRect | null>(null);

  const refreshActive = useCallback(() => {
    const list = listRef.current;
    if (!list || collapsed) {
      setActiveRect(null);
      return;
    }
    setActiveRect(measureActive(list));
  }, [listRef, collapsed]);

  useLayoutEffect(() => {
    refreshActive();
  }, [refreshActive, location.pathname]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || collapsed || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => refreshActive());
    observer.observe(list);
    for (const child of Array.from(list.querySelectorAll<HTMLElement>(".sidebar-link"))) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [listRef, collapsed, refreshActive]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || collapsed) {
      return;
    }

    const handlePointerMove = (event: Event): void => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(".sidebar-link");
      if (!target || !list.contains(target)) {
        return;
      }
      setHoverRect(measureLink(target));
    };

    const clearHover = (): void => {
      setHoverRect(null);
    };

    const handleFocusOut = (event: FocusEvent): void => {
      if (!list.contains(event.relatedTarget as Node | null)) {
        setHoverRect(null);
      }
    };

    list.addEventListener("mouseover", handlePointerMove);
    list.addEventListener("focusin", handlePointerMove);
    list.addEventListener("mouseleave", clearHover);
    list.addEventListener("focusout", handleFocusOut);

    return () => {
      list.removeEventListener("mouseover", handlePointerMove);
      list.removeEventListener("focusin", handlePointerMove);
      list.removeEventListener("mouseleave", clearHover);
      list.removeEventListener("focusout", handleFocusOut);
    };
  }, [listRef, collapsed]);

  return hoverRect ?? activeRect;
}

function SidebarTopLink({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <NavLink to={to} className={({ isActive }) => `sidebar-top-link${isActive ? " is-active" : ""}`}>
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function SidebarLink({
  to,
  label,
  count,
}: {
  to: string;
  label: string;
  count?: number | null;
}) {
  return (
    <NavLink to={to} className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`}>
      <span className="sidebar-link__dot" aria-hidden="true" />
      <span>{label}</span>
      {count != null ? <span className="sidebar-link__count">{count}</span> : null}
    </NavLink>
  );
}
