import {
  FocusEvent,
  KeyboardEvent,
  RefObject,
  SyntheticEvent,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useBooleanEvent,
  useEvent,
  useForkRef,
  useId,
  useSafeLayoutEffect,
  useWrapElement,
} from "ariakit-react-utils/hooks";
import {
  createElement,
  createHook,
  createMemoComponent2,
} from "ariakit-react-utils/system";
import { As, Props } from "ariakit-react-utils/types";
import { getScrollingElement, isButton, isTextField } from "ariakit-utils/dom";
import { isPortalEvent, isSelfTarget } from "ariakit-utils/events";
import { invariant } from "ariakit-utils/misc";
import { BooleanOrCallback } from "ariakit-utils/types";
import {
  CollectionItemOptions,
  useCollectionItem,
} from "../collection/store-collection-item";
import { CommandOptions, useCommand } from "../command/command";
import {
  CompositeContext,
  CompositeItemContext,
  CompositeRowContext,
  focusSilently,
  getEnabledItem,
  isItem,
} from "./__store-utils";
import { CompositeStore } from "./store-composite-store";

function isEditableElement(element: HTMLElement) {
  if (element.isContentEditable) return true;
  if (isTextField(element)) return true;
  return element.tagName === "INPUT" && !isButton(element);
}

function getNextPageOffset(scrollingElement: Element, pageUp = false) {
  const height = scrollingElement.clientHeight;
  const { top } = scrollingElement.getBoundingClientRect();
  // Calculates the size of the page based on the scrolling element's height.
  // This is similar to how browsers calculate the scroll position when pressing
  // spacebar, page up, or page down.
  const pageSize = Math.max(height * 0.875, height - 40) * 1.5;
  const pageOffset = pageUp ? height - pageSize + top : pageSize + top;
  if (scrollingElement.tagName === "HTML") {
    return pageOffset + scrollingElement.scrollTop;
  }
  return pageOffset;
}

function getItemOffset(itemElement: Element, pageUp = false) {
  const { top } = itemElement.getBoundingClientRect();
  if (pageUp) {
    // PageUp is always the inverse of PageDown. On PageDown, we consider only
    // the top offset of the element. On PageUp we need to add the height of the
    // element as well so we consider the bottom of it.
    return top + itemElement.clientHeight;
  }
  return top;
}

function findNextPageItemId(
  element: Element,
  store?: CompositeStore,
  next?: CompositeStore["next"],
  pageUp = false
) {
  if (!store) return;
  if (!next) return;
  const { renderedItems } = store.getState();
  const scrollingElement = getScrollingElement(element);
  if (!scrollingElement) return;
  const nextPageOffset = getNextPageOffset(scrollingElement, pageUp);
  let id: string | null | undefined;
  let prevDifference: number | undefined;
  // We need to loop through the next items to find the one that is closest to
  // the next page offset.
  for (let i = 0; i < renderedItems.length; i += 1) {
    const previousId = id;
    id = next(i);
    if (!id) break;
    if (id === previousId) continue;
    const itemElement = getEnabledItem(store, id)?.element;
    if (!itemElement) continue;
    const itemOffset = getItemOffset(itemElement, pageUp);
    const difference = itemOffset - nextPageOffset;
    const absDifference = Math.abs(difference);
    // On PageUp, the element is at the next page if the difference between its
    // top offset (plus its height) and the next page offset is less than or
    // equal zero. On PageDown, the difference should be greater than or equal
    // zero.
    if ((pageUp && difference <= 0) || (!pageUp && difference >= 0)) {
      // There may be cases when there's a lot of space between the pages, for
      // example, when there's a lot of disabled items. In this case, the first
      // item in the next page might not be the closest one. So we return the
      // previous item id if its difference is less than the current one.
      if (prevDifference !== undefined && prevDifference < absDifference) {
        id = previousId;
      }
      break;
    }
    prevDifference = absDifference;
  }
  return id;
}

function targetIsAnotherItem(event: SyntheticEvent, store: CompositeStore) {
  if (isSelfTarget(event)) return false;
  return isItem(store, event.target as HTMLElement);
}

function useRole(ref: RefObject<HTMLElement>, props: CompositeItemProps) {
  const roleProp = props.role;
  const [role, setRole] = useState(roleProp);

  useSafeLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setRole(element.getAttribute("role") || roleProp);
  }, [roleProp]);

  return role;
}

function requiresAriaSelected(role?: string) {
  return role === "option" || role === "treeitem";
}

function supportsAriaSelected(role?: string) {
  if (role === "option") return true;
  if (role === "tab") return true;
  if (role === "treeitem") return true;
  if (role === "gridcell") return true;
  if (role === "row") return true;
  if (role === "columnheader") return true;
  if (role === "rowheader") return true;
  return false;
}

/**
 * A component hook that returns props that can be passed to `Role` or any other
 * Ariakit component to render a composite item.
 * @see https://ariakit.org/components/composite
 * @example
 * ```jsx
 * const state = useCompositeState();
 * const props = useCompositeItem({ state });
 * <Role {...props}>Item 1</Role>
 * ```
 */
export const useCompositeItem = createHook<CompositeItemOptions>(
  ({
    store,
    rowId: rowIdProp,
    preventScrollOnKeyDown = false,
    moveOnKeyPress = true,
    getItem: getItemProp,
    ...props
  }) => {
    const id = useId(props.id);
    const context = useContext(CompositeContext);
    store = store || context;

    invariant(
      store,
      process.env.NODE_ENV !== "production" &&
        "CompositeItem must be wrapped in a Composite component"
    );

    const ref = useRef<HTMLButtonElement>(null);
    const row = useContext(CompositeRowContext);
    const rowId = store.useState((state) => {
      if (rowIdProp) return rowIdProp;
      if (!row?.baseElement) return;
      if (row.baseElement !== state.baseElement) return;
      return row.id;
    });
    const trulyDisabled = props.disabled && !props.accessibleWhenDisabled;

    const getItem = useCallback<NonNullable<CollectionItemOptions["getItem"]>>(
      (item) => {
        const nextItem = {
          ...item,
          id: id || item.id,
          rowId,
          disabled: !!trulyDisabled,
        };
        if (getItemProp) {
          return getItemProp(nextItem);
        }
        return nextItem;
      },
      [id, rowId, trulyDisabled, getItemProp]
    );

    const onFocusProp = props.onFocus;
    const hasFocusedComposite = useRef(false);

    const onFocus = useEvent((event: FocusEvent<HTMLButtonElement>) => {
      onFocusProp?.(event);
      if (event.defaultPrevented) return;
      if (isPortalEvent(event)) return;
      if (!id) return;
      if (!store) return;
      const { activeId, virtualFocus, baseElement } = store.getState();
      // If the target is another item, this probably means that composite items
      // are nested. This is okay when building, for example, tree or treegrid
      // elements. In this case, we just ignore the focus event on this parent
      // item.
      if (targetIsAnotherItem(event, store)) return;
      if (activeId !== id) {
        store.setActiveId(id);
      }
      // When using aria-activedescendant, we want to make sure that the
      // composite container receives focus, not the composite item.
      if (!virtualFocus) return;
      // But we'll only do this if the focused element is the composite item
      // itself
      if (!isSelfTarget(event)) return;
      // and the composite item is not a text field or contenteditable element.
      if (isEditableElement(event.currentTarget)) return;
      if (!baseElement) return;
      hasFocusedComposite.current = true;
      // If the previously focused element is a composite or composite item
      // component, we'll transfer focus silently to the composite element.
      // That's because this is just a transition event, the composite element
      // was likely already focused, so we're just immediately returning focus
      // to it when navigating through the items.
      const fromComposite =
        event.relatedTarget === baseElement ||
        isItem(store, event.relatedTarget);
      if (fromComposite) {
        focusSilently(baseElement);
      }
      // Otherwise, the composite element is likely not focused, so we need this
      // focus event to propagate so consumers can use the onFocus prop on
      // <Composite>.
      else {
        baseElement.focus();
      }
    });

    const onBlurCaptureProp = props.onBlurCapture;

    const onBlurCapture = useEvent((event: FocusEvent<HTMLButtonElement>) => {
      onBlurCaptureProp?.(event);
      if (event.defaultPrevented) return;
      const state = store?.getState();
      if (state?.virtualFocus && hasFocusedComposite.current) {
        // When hasFocusedComposite is true, composite has been focused right
        // after focusing on this item. This is an intermediate blur event, so
        // we ignore it.
        hasFocusedComposite.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    });

    const onKeyDownProp = props.onKeyDown;
    const preventScrollOnKeyDownProp = useBooleanEvent(preventScrollOnKeyDown);
    const moveOnKeyPressProp = useBooleanEvent(moveOnKeyPress);

    const onKeyDown = useEvent((event: KeyboardEvent<HTMLButtonElement>) => {
      onKeyDownProp?.(event);
      if (event.defaultPrevented) return;
      if (!isSelfTarget(event)) return;
      if (!store) return;
      const { currentTarget } = event;
      const state = store.getState();
      const item = store.item(id);
      const isGrid = !!item?.rowId;
      const isVertical = state.orientation !== "horizontal";
      const isHorizontal = state.orientation !== "vertical";
      const keyMap = {
        ArrowUp: (isGrid || isVertical) && store.up,
        ArrowRight: (isGrid || isHorizontal) && store.next,
        ArrowDown: (isGrid || isVertical) && store.down,
        ArrowLeft: (isGrid || isHorizontal) && store.previous,
        Home: () => {
          if (!isGrid || event.ctrlKey) {
            return store?.first();
          }
          return store?.previous(-1);
        },
        End: () => {
          if (!isGrid || event.ctrlKey) {
            return store?.last();
          }
          return store?.next(-1);
        },
        PageUp: () => {
          return findNextPageItemId(currentTarget, store, store?.up, true);
        },
        PageDown: () => {
          return findNextPageItemId(currentTarget, store, store?.down);
        },
      };
      const action = keyMap[event.key as keyof typeof keyMap];
      if (action) {
        const nextId = action();
        if (preventScrollOnKeyDownProp(event) || nextId !== undefined) {
          if (!moveOnKeyPressProp(event)) return;
          event.preventDefault();
          store.move(nextId);
        }
      }
    });

    const baseElement = store.useState(
      (state) => state.baseElement || undefined
    );

    const providerValue = useMemo(
      () => ({ id, baseElement }),
      [id, baseElement]
    );

    props = useWrapElement(
      props,
      (element) => (
        <CompositeItemContext.Provider value={providerValue}>
          {element}
        </CompositeItemContext.Provider>
      ),
      [providerValue]
    );

    const isActiveItem = store.useState((state) => state.activeId === id);
    const role = useRole(ref, props);
    const virtualFocus = store.useState("virtualFocus");
    let ariaSelected: boolean | undefined;

    if (isActiveItem) {
      if (requiresAriaSelected(role)) {
        // When the active item role _requires_ the aria-selected attribute
        // (e.g., option, treeitem), we always set it to true.
        ariaSelected = true;
      } else if (virtualFocus && supportsAriaSelected(role)) {
        // Otherwise, it will be set to true when virtualFocus is set to true
        // (meaning that the focus will be managed using the
        // aria-activedescendant attribute) and the aria-selected attribute is
        // _supported_ by the active item role.
        ariaSelected = true;
      }
    }

    const shouldTabIndex = store.useState(
      (state) =>
        (!state.virtualFocus && isActiveItem) ||
        // We don't want to set tabIndex="-1" when using CompositeItem as a
        // standalone component, without state props.
        !state.items.length
    );

    props = {
      id,
      "aria-selected": ariaSelected,
      "data-active-item": isActiveItem ? "" : undefined,
      ...props,
      ref: useForkRef(ref, props.ref),
      tabIndex: shouldTabIndex ? props.tabIndex : -1,
      onFocus,
      onBlurCapture,
      onKeyDown,
    };

    props = useCommand(props);
    props = useCollectionItem({
      store,
      ...props,
      getItem,
      shouldRegisterItem: !!id ? props.shouldRegisterItem : false,
    });

    return props;
  }
);

/**
 * A component that renders a composite item.
 * @see https://ariakit.org/components/composite
 * @example
 * ```jsx
 * const composite = useCompositeState();
 * <Composite state={composite}>
 *   <CompositeItem>Item 1</CompositeItem>
 *   <CompositeItem>Item 2</CompositeItem>
 *   <CompositeItem>Item 3</CompositeItem>
 * </Composite>
 * ```
 */
export const CompositeItem = createMemoComponent2<CompositeItemOptions>(
  (props) => {
    const htmlProps = useCompositeItem(props);
    return createElement("button", htmlProps);
  }
);

if (process.env.NODE_ENV !== "production") {
  CompositeItem.displayName = "CompositeItem";
}

export type CompositeItemOptions<T extends As = "button"> = CommandOptions<T> &
  Omit<CollectionItemOptions<T>, "store"> & {
    /**
     * Object returned by the `useCompositeState` hook. If not provided, the
     * parent `Composite` component's context will be used.
     */
    store?: CompositeStore;
    /**
     * The id that will be used to group items in the same row. This is
     * usually retrieved by the `CompositeRow` component through context so in
     * most cases you don't need to set it manually.
     */
    rowId?: string;
    /**
     * Whether the scroll behavior should be prevented when pressing arrow keys
     * on the first or the last items.
     * @default false
     */
    preventScrollOnKeyDown?: BooleanOrCallback<KeyboardEvent<HTMLElement>>;
    /**
     * Whether pressing arrow keys should move the focus to a different item.
     * @default true
     */
    moveOnKeyPress?: BooleanOrCallback<KeyboardEvent<HTMLElement>>;
  };

export type CompositeItemProps<T extends As = "button"> = Props<
  CompositeItemOptions<T>
>;