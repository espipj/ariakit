import {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  forwardRef,
  useMemo,
} from "react";
import * as Ariakit from "@ariakit/react";

/* Toolbar */

export type ToolbarProps = HTMLAttributes<HTMLDivElement>;

export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(
  (props, ref) => {
    const toolbar = Ariakit.useToolbarStore();
    return (
      <Ariakit.Toolbar
        ref={ref}
        store={toolbar}
        className="toolbar"
        {...props}
      />
    );
  }
);

/* ToolbarButton */

export type ToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (props, ref) => {
    return <Ariakit.ToolbarItem ref={ref} className="button" {...props} />;
  }
);

/* ToolbarSeparator */

export type ToolbarSeparatorProps = HTMLAttributes<HTMLHRElement>;

export const ToolbarSeparator = forwardRef<
  HTMLHRElement,
  ToolbarSeparatorProps
>((props, ref) => {
  return (
    <Ariakit.ToolbarSeparator ref={ref} className="separator" {...props} />
  );
});

/* ToolbarSelect */

export type ToolbarSelectProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  options: Array<{ value: string; icon?: ReactNode; label?: ReactNode }>;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
};

export const ToolbarSelect = forwardRef<HTMLButtonElement, ToolbarSelectProps>(
  (props, ref) => {
    const {
      options,
      // Accept controlled props.
      value,
      onChange,
      // Automatically set the default value as the first option. This is
      // necessary for server side rendering.
      defaultValue = options[0]?.value,
      ...rest
    } = props;

    const select = Ariakit.useSelectStore({
      value,
      setValue: onChange,
      defaultValue,
      gutter: 4,
    });

    const selectValue = select.useState("value");

    // The display value includes an icon if one is provided, so we have to
    // compose it based on the value and the passed options.
    const displayValue = useMemo(() => {
      const item = options.find((option) => option.value === selectValue);
      return (
        <>
          {item?.icon}
          {item?.label || selectValue}
        </>
      );
    }, [options, selectValue]);

    return (
      <>
        <Ariakit.Select
          as={Ariakit.ToolbarItem}
          ref={ref}
          store={select}
          className="button"
          {...rest}
        >
          {displayValue}
          <Ariakit.SelectArrow />
        </Ariakit.Select>
        <Ariakit.SelectPopover store={select} className="popover">
          {options.map((option) => (
            <Ariakit.SelectItem
              key={option.value}
              value={option.value}
              className="select-item"
            >
              {option.icon}
              {option.label || option.value}
            </Ariakit.SelectItem>
          ))}
        </Ariakit.SelectPopover>
      </>
    );
  }
);
