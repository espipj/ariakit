import { useContext } from "react";
import { invariant } from "@ariakit/core/utils/misc";
import { getPopupRole } from "ariakit-utils/dom";
import {
  CompositeRowOptions,
  useCompositeRow,
} from "../composite/composite-row";
import { createComponent, createElement, createHook } from "../utils/system";
import { As, Props } from "../utils/types";
import { SelectContext } from "./select-context";
import { SelectStore } from "./select-store";

/**
 * A component hook that returns props that can be passed to `Role` or any other
 * Ariakit component to render a select row.
 * @see https://ariakit.org/components/select
 * @example
 * ```jsx
 * const store = useSelectStore();
 * const props = useSelectRow({ store });
 * <SelectPopover store={store}>
 *   <Role {...props}>
 *     <SelectItem value="Apple" />
 *     <SelectItem value="Orange" />
 *   </Role>
 * </SelectPopover>
 * ```
 */
export const useSelectRow = createHook<SelectRowOptions>(
  ({ store, ...props }) => {
    const context = useContext(SelectContext);
    store = store || context;

    invariant(
      store,
      process.env.NODE_ENV !== "production" &&
        "SelectRow must be wrapped in a SelectList or SelectPopover component"
    );

    const contentElement = store.useState("contentElement");
    const popupRole = getPopupRole(contentElement);
    const role = popupRole === "grid" ? "row" : "presentation";

    props = { role, ...props };

    props = useCompositeRow({ store, ...props });

    return props;
  }
);

/**
 * A component that renders a select row.
 * @see https://ariakit.org/components/select
 * @example
 * ```jsx
 * const select = useSelectStore();
 * <Select store={select} />
 * <SelectPopover store={select}>
 *   <SelectRow>
 *     <SelectItem value="Apple" />
 *     <SelectItem value="Orange" />
 *   </SelectRow>
 *   <SelectRow>
 *     <SelectItem value="Banana" />
 *     <SelectItem value="Grape" />
 *   </SelectRow>
 * </SelectPopover>
 * ```
 */
export const SelectRow = createComponent<SelectRowOptions>((props) => {
  const htmlProps = useSelectRow(props);
  return createElement("div", htmlProps);
});

if (process.env.NODE_ENV !== "production") {
  SelectRow.displayName = "SelectRow";
}

export type SelectRowOptions<T extends As = "div"> = Omit<
  CompositeRowOptions<T>,
  "store"
> & {
  /**
   * Object returned by the `useSelectStore` hook. If not provided, the parent
   * `SelectList` or `SelectPopover` components' context will be used.
   */
  store?: SelectStore;
};

export type SelectRowProps<T extends As = "div"> = Props<SelectRowOptions<T>>;