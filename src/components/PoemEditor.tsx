// Sacred & bare editor. A textarea, so line breaks and indentation are preserved
// byte-for-byte — the poem's shape is the poem. No reflow, no autocorrect, no toolbar.
export function PoemEditor({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <textarea
      className="poem"
      value={value}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      // let arrow keys inside a non-empty line move the caret, not turn the page;
      // page-turn only fires when the caret can't move further (handled in Notebook)
    />
  );
}
