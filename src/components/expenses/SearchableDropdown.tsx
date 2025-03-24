
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  id: number;
  name: string;
  [key: string]: any;
}

interface SearchableDropdownProps {
  options: Option[];
  label?: string;
  id?: string;
  selectedVal: string;
  handleChange: (value: string | null) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  options,
  label = "name",
  id = "id",
  selectedVal,
  handleChange,
  placeholder = "Select option...",
  emptyMessage = "No results found.",
  className,
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Ensure options is always a valid array
  const safeOptions = Array.isArray(options) ? options : [];
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectOption = (option: Option) => {
    setQuery("");
    handleChange(option[label]);
    setIsOpen(false);
  };

  const getDisplayValue = () => {
    if (query) return query;
    if (selectedVal && !isFocused) return selectedVal;
    return "";
  };

  const filteredOptions = safeOptions.filter(
    (option) => option[label].toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div 
      ref={dropdownRef}
      className={cn(
        "relative w-full",
        className
      )}
    >
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={getDisplayValue()}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            if (e.target.value === "") handleChange(null);
          }}
          onClick={() => {
            setIsOpen(true);
            setIsFocused(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setIsFocused(true);
          }}
          onBlur={() => {
            if (!selectedVal && query === "") {
              setIsFocused(false);
            }
          }}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          placeholder={isFocused ? "" : placeholder}
        />
        <div 
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "transform rotate-180"
          )} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <div
                key={`${option[id]}-${index}`}
                onClick={() => selectOption(option)}
                className={cn(
                  "px-3 py-2 cursor-pointer hover:bg-muted transition-colors",
                  option[label] === selectedVal && "bg-primary/10 font-medium"
                )}
              >
                {option[label]}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
