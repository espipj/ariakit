import {
  CompositeGroupLabelOptions,
  useCompositeGroupLabel,
} from "../composite/composite-group-label";
import { createComponent, createElement, createHook } from "../utils/system";
import { As, Props } from "../utils/types";
import { ComboboxStore } from "./combobox-store";

/**
 * A component hook that returns props that can be passed to `Role` or any other
 * Ariakit component to render a label in a combobox group. This hook should be
 * used in a component that's wrapped with `ComboboxGroup` so the
 * `aria-labelledby` is correctly set on the combobox group element.
 * @see https://ariakit.org/components/combobox
 * @example
 * ```jsx
 * // This component should be wrapped with ComboboxGroup
 * const props = useComboboxGroupLabel();
 * <Role {...props}>Label</Role>
 * ```
 */
export const useComboboxGroupLabel = createHook<ComboboxGroupLabelOptions>(
  (props) => {
    props = useCompositeGroupLabel(props);
    return props;
  }
);

/**
 * A component that renders a label in a combobox group. This component should
 * be wrapped with `ComboboxGroup` so the `aria-labelledby` is correctly set on
 * the combobox group element.
 * @see https://ariakit.org/components/combobox
 * @example
 * ```jsx
 * const combobox = useComboboxStore();
 * <Combobox store={combobox} />
 * <ComboboxPopover store={combobox}>
 *   <ComboboxGroup>
 *     <ComboboxGroupLabel>Label</ComboboxGroupLabel>
 *     <ComboboxItem value="Item 1" />
 *     <ComboboxItem value="Item 2" />
 *   </ComboboxGroup>
 * </ComboboxPopover>
 * ```
 */
export const ComboboxGroupLabel = createComponent<ComboboxGroupLabelOptions>(
  (props) => {
    const htmlProps = useComboboxGroupLabel(props);
    return createElement("div", htmlProps);
  }
);

if (process.env.NODE_ENV !== "production") {
  ComboboxGroupLabel.displayName = "ComboboxGroupLabel";
}

export type ComboboxGroupLabelOptions<T extends As = "div"> = Omit<
  CompositeGroupLabelOptions<T>,
  "store"
> & {
  /**
   * Object returned by the `useComboboxStore` hook. If not provided, the parent
   * `ComboboxList` or `ComboboxPopover` components' context will be used.
   */
  store?: ComboboxStore;
};

export type ComboboxGroupLabelProps<T extends As = "div"> = Props<
  ComboboxGroupLabelOptions<T>
>;