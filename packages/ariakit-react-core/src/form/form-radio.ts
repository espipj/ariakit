import { ChangeEvent, useContext } from "react";
import { invariant } from "@ariakit/core/utils/misc";
import { RadioOptions, useRadio } from "../radio/radio";
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
 * Ariakit component to render a radio button in a form.
 * @see https://ariakit.org/components/form
 * @example
 * ```jsx
 * const store = useFormStore({ defaultValues: { char: "a" } });
 * const a = useFormRadio({ store, name: store.names.char, value: "a" });
 * const b = useFormRadio({ store, name: store.names.char, value: "b" });
 * const c = useFormRadio({ store, name: store.names.char, value: "c" });
 * <Form store={store}>
 *   <FormRadioGroup>
 *     <FormGroupLabel>Favorite character</FormGroupLabel>
 *     <Role {...a} />
 *     <Role {...b} />
 *     <Role {...c} />
 *   </FormRadioGroup>
 * </Form>
 * ```
 */
export const useFormRadio = createHook<FormRadioOptions>(
  ({ store, name: nameProp, value, ...props }) => {
    const context = useContext(FormContext);
    store = store || context;

    invariant(
      store,
      process.env.NODE_ENV !== "production" &&
        "FormRadio must be wrapped in a Form component"
    );

    const name = `${nameProp}`;
    const onChangeProp = props.onChange;

    const onChange = useEvent((event: ChangeEvent<HTMLInputElement>) => {
      onChangeProp?.(event);
      if (event.defaultPrevented) return;
      store?.setValue(name, value);
    });

    const checkedProp = props.checked;
    const checked = store.useState(
      () => checkedProp ?? store?.getValue(name) === value
    );

    props = {
      ...props,
      checked,
      onChange,
    };

    props = useRadio({ value, ...props });

    props = useFormField({
      store,
      name,
      "aria-labelledby": undefined,
      ...props,
    });

    return props;
  }
);

/**
 * A component that renders a radio button in a form.
 * @see https://ariakit.org/components/form
 * @example
 * ```jsx
 * const form = useFormStore({ defaultValues: { char: "a" } });
 * <Form store={form}>
 *   <FormRadioGroup>
 *     <FormGroupLabel>Favorite character</FormGroupLabel>
 *     <FormRadio name={form.names.char} value="a" />
 *     <FormRadio name={form.names.char} value="b" />
 *     <FormRadio name={form.names.char} value="c" />
 *   </FormRadioGroup>
 * </Form>
 * ```
 */
export const FormRadio = createMemoComponent<FormRadioOptions>((props) => {
  const htmlProps = useFormRadio(props);
  return createElement("input", htmlProps);
});

if (process.env.NODE_ENV !== "production") {
  FormRadio.displayName = "FormRadio";
}

export type FormRadioOptions<T extends As = "input"> = FormFieldOptions<T> &
  Omit<RadioOptions<T>, "store">;

export type FormRadioProps<T extends As = "input"> = Props<FormRadioOptions<T>>;