import {
  CompositeContainerOptions,
  useCompositeContainer,
} from "../composite/composite-container";
import {
  createElement,
  createHook,
  createMemoComponent,
} from "../utils/system";
import { As, Props } from "../utils/types";
import { ToolbarItemOptions, useToolbarItem } from "./toolbar-item";

/**
 * A component hook that returns props that can be passed to `Role` or any other
 * Ariakit component to render a container for interactive widgets inside
 * toolbar items.
 * @see https://ariakit.org/components/toolbar
 * @example
 * ```jsx
 * const store = useToolbarStore();
 * const props = useToolbarContainer({ store });
 * <Toolbar store={store}>
 *   <Role {...props}>
 *     <input type="text" />
 *   </Role>
 * </Toolbar>
 * ```
 */
export const useToolbarContainer = createHook<ToolbarContainerOptions>(
  ({ store, ...props }) => {
    props = useCompositeContainer({ store, ...props });
    props = useToolbarItem({ store, ...props });
    return props;
  }
);

/**
 * A component that renders a container for interactive widgets inside toolbar
 * items.
 * @see https://ariakit.org/components/toolbar
 * @example
 * ```jsx
 * const toolbar = useToolbarStore();
 * <Toolbar store={toolbar}>
 *   <ToolbarContainer>
 *     <input type="text" />
 *   </ToolbarContainer>
 * </Toolbar>
 * ```
 */
export const ToolbarContainer = createMemoComponent<ToolbarContainerOptions>(
  (props) => {
    const htmlProps = useToolbarContainer(props);
    return createElement("div", htmlProps);
  }
);

if (process.env.NODE_ENV !== "production") {
  ToolbarContainer.displayName = "ToolbarContainer";
}

export type ToolbarContainerOptions<T extends As = "div"> = Omit<
  CompositeContainerOptions<T>,
  "store"
> &
  ToolbarItemOptions<T>;

export type ToolbarContainerProps<T extends As = "div"> = Props<
  ToolbarContainerOptions<T>
>;