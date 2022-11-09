import { flatten2DArray, reverseArray } from "ariakit-utils/array";
import { chain } from "ariakit-utils/misc";
import { PartialStore, Store, createStore } from "ariakit-utils/store";
import { SetState } from "ariakit-utils/types";
import {
  CollectionStore,
  CollectionStoreProps,
  CollectionStoreState,
  createCollectionStore,
} from "../collection/collection-store";

type Orientation = "horizontal" | "vertical" | "both";

type Item = {
  id: string;
  element?: HTMLElement | null;
  rowId?: string;
  disabled?: boolean;
};

const NULL_ITEM = { id: null as unknown as string };

function findFirstEnabledItem(items: Item[], excludeId?: string) {
  return items.find((item) => {
    if (excludeId) {
      return !item.disabled && item.id !== excludeId;
    }
    return !item.disabled;
  });
}

function getEnabledItems(items: Item[], excludeId?: string) {
  return items.filter((item) => {
    if (excludeId) {
      return !item.disabled && item.id !== excludeId;
    }
    return !item.disabled;
  });
}

function getOppositeOrientation(orientation: Orientation) {
  if (orientation === "vertical") return "horizontal" as const;
  if (orientation === "horizontal") return "vertical" as const;
  return;
}

function getItemsInRow(items: Item[], rowId?: string) {
  return items.filter((item) => item.rowId === rowId);
}

function flipItems(
  items: Item[],
  activeId: string,
  shouldInsertNullItem = false
): Item[] {
  const index = items.findIndex((item) => item.id === activeId);
  return [
    ...items.slice(index + 1),
    ...(shouldInsertNullItem ? [NULL_ITEM] : []),
    ...items.slice(0, index),
  ];
}

function getActiveId(
  items: Item[],
  activeId?: string | null,
  passedId?: string | null
) {
  if (passedId !== undefined) return passedId;
  if (activeId !== undefined) return activeId;
  return findFirstEnabledItem(items)?.id;
}

function groupItemsByRows(items: Item[]) {
  const rows: Item[][] = [];
  for (const item of items) {
    const row = rows.find((currentRow) => currentRow[0]?.rowId === item.rowId);
    if (row) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  }
  return rows;
}

function getMaxRowLength(array: Item[][]) {
  let maxLength = 0;
  for (const { length } of array) {
    if (length > maxLength) {
      maxLength = length;
    }
  }
  return maxLength;
}

function createEmptyItem(rowId?: string) {
  return {
    id: "__EMPTY_ITEM__",
    disabled: true,
    rowId,
  };
}

function normalizeRows(
  rows: Item[][],
  activeId?: string | null,
  focusShift?: boolean
) {
  const maxLength = getMaxRowLength(rows);
  for (const row of rows) {
    for (let i = 0; i < maxLength; i += 1) {
      const item = row[i];
      if (!item || (focusShift && item.disabled)) {
        const isFirst = i === 0;
        const previousItem =
          isFirst && focusShift ? findFirstEnabledItem(row) : row[i - 1];
        row[i] =
          previousItem && activeId !== previousItem.id && focusShift
            ? previousItem
            : createEmptyItem(previousItem?.rowId);
      }
    }
  }
  return rows;
}

function verticalizeItems(items: Item[]) {
  const rows = groupItemsByRows(items);
  const maxLength = getMaxRowLength(rows);
  const verticalized: Item[] = [];
  for (let i = 0; i < maxLength; i += 1) {
    for (const row of rows) {
      const item = row[i];
      if (item) {
        verticalized.push({
          ...item,
          // If there's no rowId, it means that it's not a grid composite, but
          // a single row instead. So, instead of verticalizing it, that is,
          // assigning a different rowId based on the column index, we keep it
          // undefined so they will be part of the same row. This is useful
          // when using up/down on one-dimensional composites.
          rowId: item.rowId ? `${i}` : undefined,
        });
      }
    }
  }
  return verticalized;
}

export function createCompositeStore<T extends Item = Item>(
  {
    orientation = "both",
    rtl = false,
    virtualFocus = false,
    focusLoop = false,
    focusWrap = false,
    focusShift = false,
    activeId,
    includesBaseElement = activeId === null,
    moves = 0,
    ...props
  }: CompositeStoreProps<T> = {},
  parentStore?: PartialStore
): CompositeStore<T> {
  const collection = createCollectionStore(props, parentStore);
  const store = createStore<CompositeStoreState<T>>(
    {
      baseElement: null,
      activeId,
      includesBaseElement,
      moves,
      orientation,
      rtl,
      virtualFocus,
      focusLoop,
      focusWrap,
      focusShift,
      ...collection.getState(),
    },
    collection
  );

  const setup = () => {
    // TODO: Automatically call parentStore setup on createStore.
    return chain(
      store.setup?.(),
      store.subscribe(
        (state) => {
          store.setState(
            "activeId",
            getActiveId(state.renderedItems, state.activeId)
          );
        },
        ["renderedItems", "activeId"]
      )
    );
  };

  const setBaseElement: CompositeStore<T>["setBaseElement"] = (element) => {
    store.setState("baseElement", element);
  };

  const setMoves: CompositeStore<T>["setMoves"] = (moves) => {
    store.setState("moves", moves);
  };

  const setActiveId: CompositeStore<T>["setActiveId"] = (id) => {
    store.setState("activeId", id);
  };

  const move: CompositeStore<T>["move"] = (id) => {
    // move() does nothing
    if (id === undefined) return;
    store.setState("activeId", id);
    store.setState("moves", (moves) => moves + 1);
  };

  const first: CompositeStore<T>["first"] = () => {
    return findFirstEnabledItem(store.getState().renderedItems)?.id;
  };

  const last: CompositeStore<T>["last"] = () => {
    return findFirstEnabledItem(reverseArray(store.getState().renderedItems))
      ?.id;
  };

  const getNextId = (
    items: Item[],
    orientation: Orientation,
    hasNullItem: boolean,
    skip?: number
  ): string | null | undefined => {
    const { activeId, rtl, focusLoop, focusWrap, includesBaseElement } =
      store.getState();
    // RTL doesn't make sense on vertical navigation
    const isHorizontal = orientation !== "vertical";
    const isRTL = rtl && isHorizontal;
    const allItems = isRTL ? reverseArray(items) : items;
    // If there's no item focused, we just move the first one.
    if (activeId == null) {
      return findFirstEnabledItem(allItems)?.id;
    }
    const activeItem = allItems.find((item) => item.id === activeId);
    // If there's no item focused, we just move to the first one.
    if (!activeItem) {
      return findFirstEnabledItem(allItems)?.id;
    }
    const isGrid = !!activeItem.rowId;
    const activeIndex = allItems.indexOf(activeItem);
    const nextItems = allItems.slice(activeIndex + 1);
    const nextItemsInRow = getItemsInRow(nextItems, activeItem.rowId);
    // Home, End, PageUp, PageDown
    if (skip !== undefined) {
      const nextEnabledItemsInRow = getEnabledItems(nextItemsInRow, activeId);
      const nextItem =
        nextEnabledItemsInRow.slice(skip)[0] ||
        // If we can't find an item, just return the last one.
        nextEnabledItemsInRow[nextEnabledItemsInRow.length - 1];
      return nextItem?.id;
    }
    const oppositeOrientation = getOppositeOrientation(
      // If it's a grid and orientation is not set, it's a next/previous
      // call, which is inherently horizontal. up/down will call next with
      // orientation set to vertical by default (see below on up/down
      // methods).
      isGrid ? orientation || "horizontal" : orientation
    );
    const canLoop = focusLoop && focusLoop !== oppositeOrientation;
    const canWrap = isGrid && focusWrap && focusWrap !== oppositeOrientation;
    // previous and up methods will set hasNullItem, but when calling next
    // directly, hasNullItem will only be true if if it's not a grid and
    // focusLoop is set to true, which means that pressing right or down keys
    // on grids will never focus the composite container element. On
    // one-dimensional composites that don't loop, pressing right or down
    // keys also doesn't focus on the composite container element.
    hasNullItem = hasNullItem || (!isGrid && canLoop && includesBaseElement);

    if (canLoop) {
      const loopItems =
        canWrap && !hasNullItem
          ? allItems
          : getItemsInRow(allItems, activeItem.rowId);
      const sortedItems = flipItems(loopItems, activeId, hasNullItem);
      const nextItem = findFirstEnabledItem(sortedItems, activeId);
      return nextItem?.id;
    }

    if (canWrap) {
      const nextItem = findFirstEnabledItem(
        // We can use nextItems, which contains all the next items, including
        // items from other rows, to wrap between rows. However, if there is
        // a null item (the composite container), we'll only use the next
        // items in the row. So moving next from the last item will focus on
        // the composite container. On grid composites, horizontal navigation
        // never focuses on the composite container, only vertical.
        hasNullItem ? nextItemsInRow : nextItems,
        activeId
      );
      const nextId = hasNullItem ? nextItem?.id || null : nextItem?.id;
      return nextId;
    }

    const nextItem = findFirstEnabledItem(nextItemsInRow, activeId);
    if (!nextItem && hasNullItem) {
      return null;
    }
    return nextItem?.id;
  };

  const next: CompositeStore<T>["next"] = (skip) => {
    const { renderedItems, orientation } = store.getState();
    return getNextId(renderedItems, orientation, false, skip);
  };

  const previous: CompositeStore<T>["previous"] = (skip) => {
    const { renderedItems, orientation, includesBaseElement } =
      store.getState();
    // If activeId is initially set to null or if includesBaseElement is set
    // to true, then the composite container will be focusable while
    // navigating with arrow keys. But, if it's a grid, we don't want to
    // focus on the composite container with horizontal navigation.
    const isGrid = !!findFirstEnabledItem(renderedItems)?.rowId;
    const hasNullItem = !isGrid && includesBaseElement;
    return getNextId(
      reverseArray(renderedItems),
      orientation,
      hasNullItem,
      skip
    );
  };

  const down: CompositeStore<T>["down"] = (skip) => {
    const {
      activeId,
      renderedItems,
      focusShift,
      focusLoop,
      includesBaseElement,
    } = store.getState();
    const shouldShift = focusShift && !skip;
    // First, we make sure rows have the same number of items by filling it
    // with disabled fake items. Then, we reorganize the items.
    const verticalItems = verticalizeItems(
      flatten2DArray(
        normalizeRows(groupItemsByRows(renderedItems), activeId, shouldShift)
      )
    );
    const canLoop = focusLoop && focusLoop !== "horizontal";
    // Pressing down arrow key will only focus on the composite container if
    // loop is true, both, or vertical.
    const hasNullItem = canLoop && includesBaseElement;
    return getNextId(verticalItems, "vertical", hasNullItem, skip);
  };

  const up: CompositeStore<T>["up"] = (skip) => {
    const { activeId, renderedItems, focusShift, includesBaseElement } =
      store.getState();
    const shouldShift = focusShift && !skip;
    const verticalItems = verticalizeItems(
      reverseArray(
        flatten2DArray(
          normalizeRows(groupItemsByRows(renderedItems), activeId, shouldShift)
        )
      )
    );
    // If activeId is initially set to null, we'll always focus on the
    // composite container when the up arrow key is pressed in the first row.
    const hasNullItem = includesBaseElement;
    return getNextId(verticalItems, "vertical", hasNullItem, skip);
  };

  return {
    ...collection,
    ...store,
    setup,
    setBaseElement,
    setMoves,
    setActiveId,
    move,
    first,
    last,
    next,
    previous,
    down,
    up,
  };
}

export type CompositeStoreState<T extends Item = Item> =
  CollectionStoreState<T> & {
    baseElement: HTMLElement | null;
    virtualFocus: boolean;
    orientation: Orientation;
    rtl: boolean;
    focusLoop: boolean | Orientation;
    focusWrap: boolean | Orientation;
    focusShift: boolean;
    moves: number;
    includesBaseElement: boolean;
    activeId?: string | null;
  };

export type CompositeStore<T extends Item = Item> = Omit<
  CollectionStore<T>,
  keyof Store
> &
  Store<CompositeStoreState<T>> & {
    setBaseElement: SetState<CompositeStoreState<T>["baseElement"]>;
    setMoves: SetState<CompositeStoreState<T>["moves"]>;
    setActiveId: SetState<CompositeStoreState<T>["activeId"]>;
    move: (id?: string | null) => void;
    next: (skip?: number) => string | null | undefined;
    previous: (skip?: number) => string | null | undefined;
    up: (skip?: number) => string | null | undefined;
    down: (skip?: number) => string | null | undefined;
    first: () => string | null | undefined;
    last: () => string | null | undefined;
  };

export type CompositeStoreProps<T extends Item = Item> =
  CollectionStoreProps<T> &
    Partial<
      Pick<
        CompositeStoreState<T>,
        | "virtualFocus"
        | "orientation"
        | "rtl"
        | "focusLoop"
        | "focusWrap"
        | "focusShift"
        | "moves"
        | "includesBaseElement"
        | "activeId"
      >
    >;