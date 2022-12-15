import { FocusEvent, useEffect, useRef, useState } from "react";
import {
  PopoverDisclosureOptions,
  usePopoverDisclosure,
} from "../popover/popover-disclosure";
import { useEvent, useForkRef } from "../utils/hooks";
import { createComponent, createElement, createHook } from "../utils/system";
import { As, Props } from "../utils/types";
import { CompositeItemOptions, useCompositeItem } from "./composite-item";
import { CompositeOverflowStore } from "./composite-overflow-store";

/**
 * A component hook that returns props that can be passed to `Role` or any other
 * Ariakit component to render a disclosure button for the `CompositeOverflow`
 * component. This hook should be used in a component that's wrapped with
 * a composite component.
 * @see https://ariakit.org/components/composite
 * @example
 * ```jsx
 * // This component should be wrapped with Composite
 * const props = useCompositeOverflowDisclosure();
 * <Role {...props}>+2 items</Role>
 * ```
 */
export const useCompositeOverflowDisclosure =
  createHook<CompositeOverflowDisclosureOptions>(({ store, ...props }) => {
    const ref = useRef<HTMLButtonElement>(null);
    const [shouldRegisterItem, setShouldRegisterItem] = useState(false);

    useEffect(() => {
      return store.sync(() => {
        store.setDisclosureElement(ref.current);
      }, ["disclosureElement"]);
    }, [store]);

    const onFocusProp = props.onFocus;

    const onFocus = useEvent((event: FocusEvent<HTMLButtonElement>) => {
      onFocusProp?.(event);
      if (event.defaultPrevented) return;
      setShouldRegisterItem(true);
    });

    const onBlurProp = props.onBlur;

    const onBlur = useEvent((event: FocusEvent<HTMLButtonElement>) => {
      onBlurProp?.(event);
      if (event.defaultPrevented) return;
      setShouldRegisterItem(false);
    });

    props = {
      "aria-hidden": !shouldRegisterItem,
      ...props,
      ref: useForkRef(props.ref, ref),
      onFocus,
      onBlur,
    };

    props = useCompositeItem({ ...props, shouldRegisterItem });
    props = usePopoverDisclosure({ store, ...props });

    return props;
  });

/**
 * A component that renders a disclosure button for the `CompositeOverflow`
 * component. This component should be wrapped with a composite component.
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
export const CompositeOverflowDisclosure =
  createComponent<CompositeOverflowDisclosureOptions>((props) => {
    const htmlProps = useCompositeOverflowDisclosure(props);
    return createElement("button", htmlProps);
  });

if (process.env.NODE_ENV !== "production") {
  CompositeOverflowDisclosure.displayName = "CompositeOverflowDisclosure";
}

export type CompositeOverflowDisclosureOptions<T extends As = "button"> = Omit<
  PopoverDisclosureOptions<T>,
  "store"
> &
  Omit<CompositeItemOptions<T>, "store"> & {
    /**
     * Object returned by the `useCompositeOverflowStore` hook.
     */
    store: CompositeOverflowStore;
  };

export type CompositeOverflowDisclosureProps<T extends As = "button"> = Props<
  CompositeOverflowDisclosureOptions<T>
>;