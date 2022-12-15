import { ChangeEvent, useContext } from "react";
import { invariant } from "@ariakit/core/utils/misc";
import { FocusableOptions, useFocusable } from "../focusable/focusable";
import { useEvent } from "../utils/hooks";
import {
  createElement,
  createHook,
  createMemoComponent,
} from "../utils/system";
import { As, Props } from "../utils/types";
import { FormContext } from "./form-context";
import { FormFieldOptions, useFormField } from "./form-field";

/**
 * A component hook that returns props that can be passed to `Role` or any other
 * Ariakit component to render a form input. Unlike `useFormField`, this hook
 * returns the `value` and `onChange` props that can be passed to a native
 * input, select or textarea elements.
 * @see https://ariakit.org/components/form
 * @example
 * ```jsx
 * const store = useFormStore({ defaultValues: { email: "" } });
 * const props = useFormInput({ store, name: store.names.email });
 * <Form store={store}>
 *   <FormLabel name={store.names.email}>Email</FormLabel>
 *   <Role as="input" {...props} />
 * </Form>
 * ```
 */
export const useFormInput = createHook<FormInputOptions>(
  ({ store, name: nameProp, ...props }) => {
    const context = useContext(FormContext);
    store = store || context;

    invariant(
      store,
      process.env.NODE_ENV !== "production" &&
        "FormInput must be wrapped in a Form component"
    );

    const name = `${nameProp}`;
    const onChangeProp = props.onChange;

    const onChange = useEvent((event: ChangeEvent<HTMLInputElement>) => {
      onChangeProp?.(event);
      if (event.defaultPrevented) return;
      store?.setValue(name, event.target.value);
    });

    const value = store.useValue(name);

    props = {
      value,
      ...props,
      onChange,
    };

    props = useFocusable(props);
    props = useFormField({ store, name, ...props });

    return props;
  }
);

/**
 * A component that renders a form input. Unlike `FormField`, this component
 * passes the `value` and `onChange` props down to the underlying element that
 * can be a native input, select or textarea elements.
 * @see https://ariakit.org/components/form
 * @example
 * ```jsx
 * const form = useFormStore({ defaultValues: { email: "" } });
 * <Form store={form}>
 *   <FormLabel name={form.names.email}>Email</FormLabel>
 *   <FormInput name={form.names.email} />
 * </Form>
 * ```
 */
export const FormInput = createMemoComponent<FormInputOptions>((props) => {
  const htmlProps = useFormInput(props);
  return createElement("input", htmlProps);
});

if (process.env.NODE_ENV !== "production") {
  FormInput.displayName = "FormInput";
}

export type FormInputOptions<T extends As = "input"> = FocusableOptions<T> &
  FormFieldOptions<T>;

export type FormInputProps<T extends As = "input"> = Props<FormInputOptions<T>>;