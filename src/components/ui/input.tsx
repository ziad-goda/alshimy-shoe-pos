import * as React from "react";
import { cn } from "@/lib/utils";

// Replace native <input> with a contentEditable div that behaves like an input but is not an <input> element.
// This keeps the existing props API (value, onChange, onKeyDown, placeholder, type) so the rest of the app
// doesn't need to be changed. We intentionally avoid controlled re-writes of the DOM when the caret is active.

type Props = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  value?: any;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<any>) => void;
  placeholder?: string;
  type?: string;
};

const Input = React.forwardRef<any, Props>(({ className, value, onChange, onKeyDown, placeholder, type, ...props }, ref) => {
  const divRef = React.useRef<HTMLDivElement | null>(null);
  const lastValueRef = React.useRef<string>(String(value ?? ""));

  // expose focus() on the forwarded ref so code that calls .focus() continues to work
  React.useImperativeHandle(ref, () => ({
    focus: () => divRef.current?.focus(),
    // keep compatibility for existing code that may call select/focus
    select: () => {
      if (!divRef.current) return;
      const range = document.createRange();
      range.selectNodeContents(divRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    },
  }), []);

  // update DOM only when external value changes and differs from current DOM value
  React.useEffect(() => {
    const el = divRef.current;
    const str = String(value ?? "");
    if (!el) return;
    const current = el.innerText;
    if (str !== current) {
      // Only update if they're different to avoid resetting caret during typing
      el.innerText = str;
      lastValueRef.current = str;
    }
  }, [value]);

  const handleInput = React.useCallback(() => {
    const el = divRef.current;
    if (!el || !onChange) return;
    const text = el.innerText;
    // Avoid calling onChange if value didn't change
    if (text === lastValueRef.current) return;
    lastValueRef.current = text;
    const syntheticEvent = { target: { value: text } } as unknown as React.ChangeEvent<HTMLInputElement>;
    try {
      onChange(syntheticEvent);
    } catch (e) {
      // swallow to avoid crashes from unexpected handlers
      console.error(e);
    }
  }, [onChange]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onKeyDown) onKeyDown(e);
  }, [onKeyDown]);

  // show placeholder when empty
  const showPlaceholder = !(value ?? "") && !!placeholder;

  return (
    <div
      {...props}
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={cn(
        "min-h-[2.25rem] rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus:outline-none",
        className,
      )}
      aria-placeholder={placeholder}
      data-placeholder={placeholder}
      // keep other attributes like title etc.
    >
      {showPlaceholder ? (
        // render placeholder span so it can be styled by CSS if needed
        <span className="text-muted-foreground" contentEditable={false}>{placeholder}</span>
      ) : (
        // value will be synced to innerText via effect; don't place it here to avoid React-controlled re-renders
        null
      )}
    </div>
  );
});

Input.displayName = "Input";

export { Input };
