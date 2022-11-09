import { useLiveRef } from "ariakit-react-utils/hooks";
import {
  createComponent,
  createElement,
  createHook,
} from "ariakit-react-utils/system";
import { As, Props } from "ariakit-react-utils/types";
import { matches } from "ariakit-utils/dom";
import { PopoverOptions, usePopover } from "../popover/store-popover";
import { ComboboxListOptions, useComboboxList } from "./store-combobox-list";

function isController(
  target: EventTarget | Element | null,
  ...ids: Array<string | undefined>
) {
  if (!target) return false;
  if ("id" in target) {
    const selector = ids
      .filter(Boolean)
      .map((id) => `[aria-controls="${id}"]`)
      .join(", ");
    if (!selector) return false;
    return matches(target, selector);
  }
  return false;
}

/**
 * A component hook that returns props that can be passed to `Role` or any other
 * Ariakit component to render a combobox popover.
 * @see https://ariakit.org/components/combobox
 * @example
 * ```jsx
 * const store = useComboboxStore();
 * const props = useComboboxPopover({ store });
 * <Role {...props}>
 *   <ComboboxItem value="Item 1" />
 *   <ComboboxItem value="Item 2" />
 *   <ComboboxItem value="Item 3" />
 * </Role>
 * ```
 */
export const useComboboxPopover = createHook<ComboboxPopoverOptions>(
  ({ store, tabIndex, hideOnInteractOutside = true, ...props }) => {
    const baseElement = store.useState("baseElement");
    const finalFocusRef = useLiveRef(baseElement);

    props = useComboboxList({ store, ...props });

    props = usePopover({
      store,
      autoFocusOnShow: false,
      autoFocusOnHide: false,
      finalFocusRef,
      ...props,
      // Combobox popovers can't be modal because the focus may be (and is by
      // default) outside of it on the combobox input element.
      modal: false,
      // Make sure we don't hide the popover when the user interacts with the
      // combobox cancel or the combobox disclosure buttons. They will have the
      // aria-controls attribute pointing to either the combobox input or the
      // comboobx popover elements.
      hideOnInteractOutside: (event: Event) => {
        const { contentElement, baseElement } = store.getState();
        const contentId = contentElement?.id;
        const baseId = baseElement?.id;
        if (isController(event.target, contentId, baseId)) return false;
        const result =
          typeof hideOnInteractOutside === "function"
            ? hideOnInteractOutside(event)
            : hideOnInteractOutside;
        return result;
      },
    });

    return props;
  }
);

/**
 * A component that renders a combobox popover. The `role` prop is set to
 * `listbox` by default, but can be overriden by any other valid combobox popup
 * role (`listbox`, `menu`, `tree`, `grid` or `dialog`). The `aria-labelledby`
 * prop is set to the combobox input element's `id` by default.
 * @see https://ariakit.org/components/combobox
 * @example
 * ```jsx
 * const combobox = useComboboxStore();
 * <Combobox store={combobox} />
 * <ComboboxPopover store={combobox}>
 *   <ComboboxItem value="Item 1" />
 *   <ComboboxItem value="Item 2" />
 *   <ComboboxItem value="Item 3" />
 * </ComboboxPopover>
 * ```
 */
export const ComboboxPopover = createComponent<ComboboxPopoverOptions>(
  (props) => {
    const htmlProps = useComboboxPopover(props);
    return createElement("div", htmlProps);
  }
);

if (process.env.NODE_ENV !== "production") {
  ComboboxPopover.displayName = "ComboboxPopover";
}

export type ComboboxPopoverOptions<T extends As = "div"> =
  ComboboxListOptions<T> & Omit<PopoverOptions<T>, "store" | "modal">;

export type ComboboxPopoverProps<T extends As = "div"> = Props<
  ComboboxPopoverOptions<T>
>;