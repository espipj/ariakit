import { CSSProperties, FocusEvent } from "react";
import { PopoverOptions, usePopover } from "../popover/popover";
import { useEvent } from "../utils/hooks";
import { createComponent, createElement, createHook } from "../utils/system";
import { As, Props } from "../utils/types";
import { CompositeOverflowStore } from "./composite-overflow-store";

// Hiding the popover with `display: none` would prevent the hidden items to
// be focused, so we just make it transparent and disable pointer events.
const hiddenStyle: CSSProperties = {
  opacity: 0,
  pointerEvents: "none",
};

/**
 * A component hook that returns props that can be passed to `Role` or any other
 * Ariakit component to render a popover that will contain the overflow items in
 * a composite collection.
 * @see https://ariakit.org/components/composite
 * @example
 * ```jsx
 * const store = useCompositeOverflowStore();
 * const props = useCompositeOverflow({ store });
 * <Role {...props}>
 *   <CompositeItem>Item 3</CompositeItem>
 *   <CompositeItem>Item 4</CompositeItem>
 * </Role>
 * ```
 */
export const useCompositeOverflow = createHook<CompositeOverflowOptions>(
  ({
    store,
    backdropProps: backdropPropsProp,
    wrapperProps: wrapperPropsProp,
    portal = false,
    ...props
  }) => {
    const onFocusProp = props.onFocus;

    const onFocus = useEvent((event: FocusEvent<HTMLDivElement>) => {
      onFocusProp?.(event);
      if (event.defaultPrevented) return;
      store.show();
    });

    const mounted = store.useState("mounted");

    const getStyle = (styleProp?: CSSProperties) =>
      mounted ? styleProp : { ...hiddenStyle, ...styleProp };

    const backdropProps = {
      hidden: false,
      ...backdropPropsProp,
      style: getStyle(backdropPropsProp?.style),
    };

    const wrapperProps = {
      ...wrapperPropsProp,
      style: getStyle(wrapperPropsProp?.style),
    };

    props = {
      role: "presentation",
      hidden: false,
      focusable: false,
      ...props,
      onFocus,
    };

    props = usePopover({
      store,
      backdropProps,
      wrapperProps,
      portal,
      ...props,
    });

    return props;
  }
);

/**
 * A component that renders a popover that will contain the overflow items in a
 * composite collection.
 * @see https://ariakit.org/components/composite
 * @example
 * ```jsx
 * const composite = useCompositeStore();
 * const overflow = useCompositeOverflowStore();
 * <Composite store={composite}>
 *   <CompositeItem>Item 1</CompositeItem>
 *   <CompositeItem>Item 2</CompositeItem>
 *   <CompositeOverflowDisclosure store={overflow}>
 *     +2 items
 *   </CompositeOverflowDisclosure>
 *   <CompositeOverflow store={overflow}>
 *     <CompositeItem>Item 3</CompositeItem>
 *     <CompositeItem>Item 4</CompositeItem>
 *   </CompositeOverflow>
 * </Composite>
 * ```
 */
export const CompositeOverflow = createComponent<CompositeOverflowOptions>(
  (props) => {
    const htmlProps = useCompositeOverflow(props);
    return createElement("div", htmlProps);
  }
);

if (process.env.NODE_ENV !== "production") {
  CompositeOverflow.displayName = "CompositeOverflow";
}

export type CompositeOverflowOptions<T extends As = "div"> = Omit<
  PopoverOptions<T>,
  "store"
> & {
  /**
   * Object returned by the `useCompositeOverflowStore` hook.
   */
  store: CompositeOverflowStore;
};

export type CompositeOverflowProps<T extends As = "div"> = Props<
  CompositeOverflowOptions<T>
>;