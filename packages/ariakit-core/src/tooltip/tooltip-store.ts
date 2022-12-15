import { createDisclosureStore } from "../disclosure/disclosure-store";
import {
  PopoverStoreFunctions,
  PopoverStoreOptions,
  PopoverStoreState,
  createPopoverStore,
} from "../popover/popover-store";
import { defaultValue } from "../utils/misc";
import { Store, StoreOptions, StoreProps, createStore } from "../utils/store";

const tooltips = createStore({ activeRef: null as symbol | null });

function afterTimeout(timeoutMs: number, cb: () => void) {
  const timeoutId = setTimeout(cb, timeoutMs);
  return () => clearTimeout(timeoutId);
}

export function createTooltipStore(
  props: TooltipStoreProps = {}
): TooltipStore {
  const syncState = props.store?.getState();
  const open = defaultValue(props.open, syncState?.open, false);

  const disclosure = createDisclosureStore({ ...props, open });

  const popover = createPopoverStore({
    ...props,
    open,
    placement: defaultValue(
      props.placement,
      syncState?.placement,
      "top" as const
    ),
    gutter: defaultValue(props.gutter, syncState?.gutter, 8),
  });

  const initialState: TooltipStoreState = {
    ...popover.getState(),
    timeout: defaultValue(props.timeout, syncState?.timeout, 0),
  };
  const tooltip = createStore(
    initialState,
    popover,
    disclosure.omit("open", "mounted"),
    props.store
  );

  const ref = Symbol();

  tooltip.setup(() =>
    disclosure.sync(
      (state, prev) => {
        const { timeout } = tooltip.getState();
        const { activeRef } = tooltips.getState();
        if (state.open) {
          if (!timeout || activeRef) {
            // If there's no timeout or an open tooltip already, we can show
            // this immediately.
            tooltips.setState("activeRef", ref);
            tooltip.setState("open", true);
            return;
          } else {
            // There may be a reference with focus whose tooltip is still not
            // open. In this case, we want to update it before it gets shown.
            tooltips.setState("activeRef", null);
            // Wait for the timeout to show the tooltip.
            return afterTimeout(timeout, () => {
              tooltips.setState("activeRef", ref);
            });
          }
        } else if (state.open !== prev.open) {
          tooltip.setState("open", false);
          // Let's give some time so people can move from a reference to
          // another and still show tooltips immediately.
          return afterTimeout(timeout, () => {
            tooltips.setState("activeRef", (activeRef) =>
              activeRef === ref ? null : activeRef
            );
          });
        }
        return;
      },
      ["open"]
    )
  );

  tooltip.setup(() =>
    tooltips.sync(
      (state) => {
        tooltip.setState("open", state.activeRef === ref);
      },
      ["activeRef"]
    )
  );

  tooltip.setup(() => () => {
    tooltips.setState("activeRef", (activeRef) =>
      activeRef === ref ? null : activeRef
    );
  });

  return {
    ...popover,
    ...disclosure,
    ...tooltip,
  };
}

export type TooltipStoreState = PopoverStoreState & {
  /**
   * The amount in milliseconds to wait before showing the tooltip. When there's
   * already an open tooltip in the page, this value will be ignored and other
   * tooltips will be shown immediately.
   * @default 0
   */
  timeout: number;
};

export type TooltipStoreFunctions = PopoverStoreFunctions;

export type TooltipStoreOptions = PopoverStoreOptions &
  StoreOptions<TooltipStoreState, "timeout">;

export type TooltipStoreProps = TooltipStoreOptions &
  StoreProps<TooltipStoreState>;

export type TooltipStore = TooltipStoreFunctions & Store<TooltipStoreState>;