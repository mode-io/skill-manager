import { Search } from "lucide-react";

import { LoadingSpinner } from "./LoadingSpinner";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  submitPending?: boolean;
  disabled?: boolean;
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Search...",
  submitPending = false,
  disabled,
}: SearchInputProps) {
  return (
    <div className="search-bar">
      <div className="search-bar__field">
        <Search size={16} className="search-bar__icon" />
        <input
          className="search-input"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          disabled={disabled}
        />
      </div>
      <button
        type="button"
        className="btn btn-primary search-bar__submit"
        onClick={onSubmit}
        disabled={submitPending || disabled}
        aria-busy={submitPending}
      >
        {submitPending ? <LoadingSpinner size="sm" label="Searching marketplace" /> : <Search size={16} />}
        Search
      </button>
    </div>
  );
}
