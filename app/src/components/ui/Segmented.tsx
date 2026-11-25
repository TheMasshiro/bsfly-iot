interface SegmentedProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  block?: boolean;
  disabled?: boolean;
}

function Segmented<T extends string>({ value, options, onChange, label, block, disabled }: SegmentedProps<T>) {
  return (
    <div className={`bs-segmented ${block ? "block" : ""}`} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          disabled={disabled}
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default Segmented;
