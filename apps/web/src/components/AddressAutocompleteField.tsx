import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { searchAddressOptions, type GeocodeOption } from '../lib/geocoding';

interface AddressAutocompleteFieldProps {
  label: string;
  value: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (option: GeocodeOption) => void;
}

const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 250;
const OPTION_LIMIT = 5;

export function AddressAutocompleteField({
  label,
  value,
  required,
  disabled,
  onChange,
  onSelect
}: AddressAutocompleteFieldProps) {
  const listboxId = useId();
  const [options, setOptions] = useState<GeocodeOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const committedSelectionLabelRef = useRef<string | null>(null);

  useEffect(() => {
    if (disabled) {
      setOptions([]);
      setIsOpen(false);
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }

    const query = value.trim();
    if (query.length < MIN_SEARCH_LENGTH) {
      setOptions([]);
      setIsOpen(false);
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }
    const normalizedQuery = query.toLowerCase();
    if (committedSelectionLabelRef.current) {
      if (committedSelectionLabelRef.current === normalizedQuery) {
        committedSelectionLabelRef.current = null;
        setIsLoading(false);
        return;
      }
      committedSelectionLabelRef.current = null;
    }

    let isMounted = true;
    const timer = setTimeout(() => {
      setIsLoading(true);
      searchAddressOptions(query, OPTION_LIMIT)
        .then((hits) => {
          if (!isMounted) {
            return;
          }
          setOptions(hits);
          setIsOpen(hits.length > 0 && isFocused);
          setActiveIndex(hits.length > 0 ? 0 : -1);
        })
        .catch(() => {
          if (!isMounted) {
            return;
          }
          setOptions([]);
          setIsOpen(false);
          setActiveIndex(-1);
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [disabled, isFocused, value]);

  const applyOption = (option: GeocodeOption): void => {
    committedSelectionLabelRef.current = option.label.trim().toLowerCase();
    onChange(option.label);
    onSelect(option);
    setOptions([]);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (!isOpen || options.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % options.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? options.length - 1 : current - 1));
      return;
    }

    if (event.key === 'Enter') {
      const selected = options[activeIndex];
      if (selected) {
        event.preventDefault();
        applyOption(selected);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const showHints = !disabled && isFocused && value.trim().length >= MIN_SEARCH_LENGTH;

  return (
    <label className="address-autocomplete-field">
      {label}
      <div className="address-autocomplete-wrap">
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onFocus={() => {
            setIsFocused(true);
            if (options.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => {
              setIsOpen(false);
            }, 120);
          }}
          onKeyDown={handleInputKeyDown}
          required={required}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
        />
        {showHints && (
          <span className="address-autocomplete-status">
            {isLoading ? 'Searching...' : 'Type to see suggestions'}
          </span>
        )}
        {isOpen && options.length > 0 && (
          <ul id={listboxId} role="listbox" className="address-autocomplete-options">
            {options.map((option, index) => (
              <li
                key={`${option.label}-${option.lat}-${option.lng}`}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`address-autocomplete-option${index === activeIndex ? ' active' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applyOption(option);
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  );
}
