import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
}

export function SearchInput({ value, onChange, onSubmit, placeholder = "Search...", loading, disabled }: SearchInputProps): JSX.Element {
  return (
    <div className="search-bar">
      <input
        className="search-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        disabled={disabled}
      />
      <button className="btn btn-primary" onClick={onSubmit} disabled={loading || disabled || !value.trim()}>
        {loading ? <span className="spinner spinner-sm" /> : <Search size={16} />}
        Search
      </button>
    </div>
  );
}
