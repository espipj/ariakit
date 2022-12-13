import {
  CollectionStoreFunctions,
  CollectionStoreItem,
  CollectionStoreOptions,
  CollectionStoreState,
  createCollectionStore,
} from "../collection/collection-store";
import { flatten2DArray, reverseArray } from "../utils/array";
import { defaultValue } from "../utils/misc";
import { Store, StoreOptions, StoreProps, createStore } from "../utils/store";
import { SetState } from "../utils/types";

type Orientation = "horizontal" | "vertical" | "both";
type Item = CollectionStoreItem & {
  rowId?: string;
  disabled?: boolean;
  children?: string;
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
  props: CompositeStoreProps<T> = {}
): CompositeStore<T> {
  const syncState = props.store?.getState();

  const collection = createCollectionStore(props);

  const activeId = defaultValue(
    props.activeId,
    syncState?.activeId,
    props.defaultActiveId
  );

  const initialState: CompositeStoreState<T> = {
    ...collection.getState(),
    activeId,
    baseElement: defaultValue(syncState?.baseElement, null),
    includesBaseElement: defaultValue(
      props.includesBaseElement,
      syncState?.includesBaseElement,
      activeId === null
    ),
    moves: defaultValue(props.moves, syncState?.moves, 0),
    orientation: defaultValue(
      props.orientation,
      syncState?.orientation,
      "both" as const
    ),
    rtl: defaultValue(props.rtl, syncState?.rtl, false),
    virtualFocus: defaultValue(
      props.virtualFocus,
      syncState?.virtualFocus,
      false
    ),
    focusLoop: defaultValue(props.focusLoop, syncState?.focusLoop, false),
    focusWrap: defaultValue(props.focusWrap, syncState?.focusWrap, false),
    focusShift: defaultValue(props.focusShift, syncState?.focusShift, false),
  };

  const composite = createStore(initialState, collection, props.store);

  composite.setup(() =>
    composite.sync(
      (state) => {
        composite.setState(
          "activeId",
          getActiveId(state.renderedItems, state.activeId)
        );
      },
      ["renderedItems", "activeId"]
    )
  );

  const getNextId = (
    items: Item[],
    orientation: Orientation,
    hasNullItem: boolean,
    skip?: number
  ): string | null | undefined => {
    const { activeId, rtl, focusLoop, focusWrap, includesBaseElement } =
      composite.getState();
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

  return {
    ...collection,
    ...composite,

    setBaseElement: (element) => composite.setState("baseElement", element),
    // TODO: Remove setMoves?
    setMoves: (moves) => composite.setState("moves", moves),
    setActiveId: (id) => composite.setState("activeId", id),

    move: (id) => {
      // move() does nothing
      if (id === undefined) return;
      composite.setState("activeId", id);
      composite.setState("moves", (moves) => moves + 1);
    },

    first: () => findFirstEnabledItem(composite.getState().renderedItems)?.id,
    last: () =>
      findFirstEnabledItem(reverseArray(composite.getState().renderedItems))
        ?.id,

    next: (skip) => {
      const { renderedItems, orientation } = composite.getState();
      return getNextId(renderedItems, orientation, false, skip);
    },

    previous: (skip) => {
      const { renderedItems, orientation, includesBaseElement } =
        composite.getState();
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
    },

    down: (skip) => {
      const {
        activeId,
        renderedItems,
        focusShift,
        focusLoop,
        includesBaseElement,
      } = composite.getState();
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
    },

    up: (skip) => {
      const { activeId, renderedItems, focusShift, includesBaseElement } =
        composite.getState();
      const shouldShift = focusShift && !skip;
      const verticalItems = verticalizeItems(
        reverseArray(
          flatten2DArray(
            normalizeRows(
              groupItemsByRows(renderedItems),
              activeId,
              shouldShift
            )
          )
        )
      );
      // If activeId is initially set to null, we'll always focus on the
      // composite container when the up arrow key is pressed in the first row.
      const hasNullItem = includesBaseElement;
      return getNextId(verticalItems, "vertical", hasNullItem, skip);
    },
  };
}

export type CompositeStoreOrientation = Orientation;

export type CompositeStoreItem = Item;

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

export type CompositeStoreFunctions<T extends Item = Item> =
  CollectionStoreFunctions<T> & {
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

export type CompositeStoreOptions<T extends Item = Item> =
  CollectionStoreOptions<T> &
    StoreOptions<
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
    > & {
      defaultActiveId?: CompositeStoreState<T>["activeId"];
    };

export type CompositeStoreProps<T extends Item = Item> =
  CompositeStoreOptions<T> & StoreProps<CompositeStoreState<T>>;

export type CompositeStore<T extends Item = Item> = CompositeStoreFunctions<T> &
  Store<CompositeStoreState<T>>;
