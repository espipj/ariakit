import { MouseEvent, useCallback, useContext } from "react";
import { invariant } from "@ariakit/core/utils/misc";
import {
  CompositeItemOptions,
  useCompositeItem,
} from "../composite/composite-item";
import { useEvent, useId } from "../utils/hooks";
import {
  createElement,
  createHook,
  createMemoComponent,
} from "../utils/system";
import { As, Props } from "../utils/types";
import { TabContext } from "./tab-context";
import { TabStore } from "./tab-store";

/**
 * A component hook that returns props that can be passed to `Role` or any other
 * Ariakit component to render a tab element. The underlying element must be
 * wrapped in a `TabList` component or a component that implements the
 * `useTabList` props.
 * @see https://ariakit.org/components/tab
 * @example
 * ```jsx
 * const store = useTabStore();
 * const props = useTab({ store });
 * <TabList store={store}>
 *   <Role {...props}>Tab 1</Role>
 * </TabList>
 * <TabPanel store={store}>Panel 1</TabPanel>
 * ```
 */
export const useTab = createHook<TabOptions>(
  ({
    store,
    accessibleWhenDisabled = true,
    getItem: getItemProp,
    ...props
  }) => {
    const context = useContext(TabContext);
    store = store || context;

    invariant(
      store,
      process.env.NODE_ENV !== "production" &&
        "Tab must be wrapped in a TabList component"
    );

    // Keep a reference to the default id so we can wait before all tabs have
    // been assigned an id before registering them in the store. See
    // https://github.com/ariakit/ariakit/issues/1721
    const defaultId = useId();
    const id = props.id || defaultId;
    const dimmed = props.disabled;

    const getItem = useCallback<NonNullable<CompositeItemOptions["getItem"]>>(
      (item) => {
        const nextItem = { ...item, dimmed };
        if (getItemProp) {
          return getItemProp(nextItem);
        }
        return nextItem;
      },
      [dimmed, getItemProp]
    );

    const onClickProp = props.onClick;

    const onClick = useEvent((event: MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event);
      if (event.defaultPrevented) return;
      store?.setSelectedId(id);
    });

    const panelId = store.panels.useState(
      (state) => state.items.find((item) => item.tabId === id)?.id
    );
    const selected = store.useState((state) => !!id && state.selectedId === id);

    props = {
      id,
      role: "tab",
      "aria-selected": selected,
      "aria-controls": panelId || undefined,
      ...props,
      onClick,
    };

    props = useCompositeItem({
      store,
      ...props,
      accessibleWhenDisabled,
      getItem,
      shouldRegisterItem: !!defaultId ? props.shouldRegisterItem : false,
    });

    return props;
  }
);

/**
 * A component that renders a tab element. The underlying element must be
 * wrapped in a `TabList` component.
 * @see https://ariakit.org/components/tab
 * @example
 * ```jsx
 * const tab = useTabStore();
 * <TabList store={tab}>
 *   <Tab>Tab 1</Tab>
 *   <Tab>Tab 2</Tab>
 * </TabList>
 * <TabPanel store={tab}>Panel 1</TabPanel>
 * <TabPanel store={tab}>Panel 2</TabPanel>
 * ```
 */
export const Tab = createMemoComponent<TabOptions>((props) => {
  const htmlProps = useTab(props);
  return createElement("button", htmlProps);
});

if (process.env.NODE_ENV !== "production") {
  Tab.displayName = "Tab";
}

export type TabOptions<T extends As = "button"> = Omit<
  CompositeItemOptions<T>,
  "store"
> & {
  /**
   * Object returned by the `useTabStore` hook. If not provided, the parent
   * `TabList` component's context will be used.
   */
  store?: TabStore;
};

export type TabProps<T extends As = "button"> = Props<TabOptions<T>>;