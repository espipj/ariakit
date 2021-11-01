import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  Ref,
  useMemo,
  RefObject,
  ComponentType,
  EffectCallback,
  useCallback,
  DependencyList,
  useReducer,
} from "react";
import { canUseDOM } from "./dom";
import { noop, setRef } from "./misc";
import { AnyFunction, SetState, WrapElement } from "./types";

/**
 * `React.useLayoutEffect` that fallbacks to `React.useEffect` on server side.
 */
export const useSafeLayoutEffect = canUseDOM ? useLayoutEffect : useEffect;

/**
 * Returns a value that never changes even if the argument is updated.
 *
 * @example
 * import { useInitialValue } from "reakit-utils";
 *
 * function Component({ prop }) {
 *   const initialProp = useInitialValue(prop);
 * }
 */
export function useInitialValue<T>(value: T | (() => T)) {
  const [initialValue] = useState(value);
  return initialValue;
}

/**
 * Returns a value that is lazily initiated and never changes.
 *
 * @example
 * import { useLazyRef } from "reakit-utils";
 *
 * function Component() {
 *   const set = useLazyRef(() => new Set());
 * }
 */
export function useLazyRef<T>(init: () => T) {
  const ref = useRef<T>();
  if (ref.current === undefined) {
    ref.current = init();
  }
  return ref.current;
}

/**
 * Creates a `React.RefObject` that is constantly updated with the incoming
 * value.
 *
 * @example
 * import { useLiveRef } from "reakit-utils";
 *
 * function Component({ prop }) {
 *   const propRef = useLiveRef(prop);
 * }
 */
export function useLiveRef<T>(value: T) {
  const ref = useRef(value);
  useSafeLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * Creates a memoized callback function that is constantly updated with the
 * incoming callback.
 *
 * @example
 * import { useEffect } from "react";
 * import { useEventCallback } from "reakit-utils";
 *
 * function Component(props) {
 *   const onClick = useEventCallback(props.onClick);
 *   useEffect(() => {}, [onClick]);
 * }
 */
export function useEventCallback<T extends AnyFunction>(callback?: T) {
  // @ts-ignore
  const ref = useRef<T | undefined>(() => {
    throw new Error("Cannot call an event handler while rendering.");
  });
  useSafeLayoutEffect(() => {
    ref.current = callback;
  });
  return useCallback(
    // @ts-ignore
    (...args: Parameters<T>): ReturnType<T> => ref.current?.(...args),
    []
  );
}

/**
 * Merges React Refs into a single memoized function ref so you can pass it to
 * an element.
 *
 * @example
 * import { forwardRef, useRef } from "react";
 * import { useForkRef } from "reakit-utils";
 *
 * const Component = forwardRef((props, ref) => {
 *   const internalRef = useRef();
 *   return <div {...props} ref={useForkRef(internalRef, ref)} />;
 * });
 */
export function useForkRef(...refs: Array<Ref<any> | undefined>) {
  return useMemo(() => {
    if (!refs.some(Boolean)) return;
    return (value: any) => {
      refs.forEach((ref) => {
        setRef(ref, value);
      });
    };
  }, refs);
}

/**
 * Returns the ref element's ID.
 */
export function useRefId(ref?: RefObject<HTMLElement>, deps?: DependencyList) {
  const [id, setId] = useState<string | undefined>(undefined);
  useSafeLayoutEffect(() => {
    setId(ref?.current?.id);
  }, deps);
  return id;
}

/**
 * Generates a random ID.
 */
export function useId(defaultId?: string) {
  const [id, setId] = useState(defaultId);
  useSafeLayoutEffect(() => {
    if (defaultId || id) return;
    const random = Math.random().toString(36).substr(2, 6);
    setId(`id-${random}`);
  }, [defaultId, id]);
  return defaultId || id;
}

/**
 * Returns the tag name by parsing an element ref and the `as` prop.
 *
 * @example
 * import * as React from "react";
 * import { useTagName } from "reakit-utils";
 *
 * function Component(props) {
 *   const ref = React.useRef();
 *   const tagName = useTagName(ref, "button"); // div
 *   return <div ref={ref} {...props} />;
 * }
 */
export function useTagName(
  ref: RefObject<HTMLElement> | undefined,
  type?: string | ComponentType
) {
  const [tagName, setTagName] = useState(() => stringOrUndefined(type));

  useSafeLayoutEffect(() => {
    setTagName(ref?.current?.tagName.toLowerCase() || stringOrUndefined(type));
  }, [ref, type]);

  return tagName;
}

function stringOrUndefined(type?: string | ComponentType) {
  if (typeof type === "string") {
    return type;
  }
  return;
}

/**
 * A `React.useEffect` that will not run on the first render.
 */
export function useUpdateEffect(effect: EffectCallback, deps?: DependencyList) {
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) {
      return effect();
    }
    mounted.current = true;
  }, deps);
}

/**
 * A `React.useLayoutEffect` that will not run on the first render.
 */
export function useUpdateLayoutEffect(
  effect: EffectCallback,
  deps?: DependencyList
) {
  const mounted = useRef(false);
  useSafeLayoutEffect(() => {
    if (mounted.current) {
      return effect();
    }
    mounted.current = true;
  }, deps);
}

/**
 * A custom version of `React.useState` that uses the `state` and `setState`
 * arguments. If they're not provided, it will use the internal state.
 */
export function useControlledState<S>(
  defaultState: S | (() => S),
  state?: S,
  setState?: SetState<S>
): [S, SetState<S>] {
  // TODO: If setState is provided, but state is not, we should use the internal
  // state, but merge the internal setState with the provided one.
  const isControlled = state !== undefined;
  const [internalState, setInternalState] = useState(defaultState);
  state = isControlled ? state! : internalState;
  setState = setState || (isControlled ? noop : setInternalState);
  return [state, setState];
}

/**
 * A React hook similar to `useState` and `useReducer`, but with the only
 * purpose of re-rendering the component.
 */
export function useForceUpdate() {
  return useReducer(() => ({}), {});
}

/**
 * Returns an event callback similar to `useEventCallback`, but this also
 * accepts a boolean value, which will be turned into a function.
 */
export function useBooleanEventCallback<T extends unknown[]>(
  booleanOrCallback: boolean | ((...args: T) => boolean)
) {
  return useEventCallback(
    typeof booleanOrCallback === "function"
      ? booleanOrCallback
      : () => booleanOrCallback
  );
}

/**
 * Comment.
 */
export function useWrapElement<P>(
  props: P & { wrapElement?: WrapElement },
  callback: WrapElement,
  deps: DependencyList = []
): P & { wrapElement: WrapElement } {
  const wrapElement: WrapElement = useCallback(
    (element) => {
      if (props.wrapElement) {
        element = props.wrapElement(element);
      }
      return callback(element);
    },
    [...deps, props.wrapElement]
  );

  return { ...props, wrapElement };
}