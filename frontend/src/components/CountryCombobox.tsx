"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../components/ui/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { COUNTRY_LIST, type Country } from "../lib/countries";

type Props = {
  value?: string;
  onChange: (val: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  showFlags?: boolean;
};

export default function CountryCombobox({
  value,
  onChange,
  placeholder = "Select or type a country...",
  allowCustom = true,
  showFlags = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState(value ?? "");

  React.useEffect(() => {
    setInput(value ?? "");
  }, [value]);

  const filtered: Country[] = React.useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return COUNTRY_LIST;
    return COUNTRY_LIST.filter((c) =>
      c.name.toLowerCase().includes(q) || c.cca2.toLowerCase() === q || c.cca3.toLowerCase() === q
    );
  }, [input]);

  // Group countries by first letter for alphabetical navigation
  const grouped = React.useMemo(() => {
    const groups: Record<string, Country[]> = {};
    (filtered.length ? filtered : COUNTRY_LIST).forEach((c) => {
      const letter = (c.name[0] || "").toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    });
    // sort letters
    const sorted: Record<string, Country[]> = {};
    Object.keys(groups)
      .sort()
      .forEach((k) => {
        sorted[k] = groups[k];
      });
    return sorted;
  }, [filtered]);

  const listRef = React.useRef<HTMLDivElement | null>(null);
  const headingRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToLetter = (letter: string) => {
    const el = headingRefs.current[letter];
    const list = listRef.current;
    if (el && list) {
      // scroll the container so that the heading is visible at top
      const offset = el.offsetTop;
      list.scrollTo({ top: offset - 4, behavior: "smooth" });
    }
  };

  const selectCountry = (cname: string) => {
    onChange(cname);
    setInput(cname);
    setOpen(false);
  };

  const handleFreeEnter: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!allowCustom) return;
    if (e.key === "Enter") {
      const v = input.trim();
      if (v.length > 0) {
        onChange(v);
        setOpen(false);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          {value && value.length > 0 ? value : (placeholder || "Country")}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      {/* max-h-64 ~ hiển thị ~5–6 item, phần còn lại cuộn */}
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <div className="p-2">
            <Input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleFreeEnter}
              placeholder="Type to search or press Enter to use text"
            />

            {/* Alphabet quick-jump */}
            <div className="mt-2 mb-1 flex flex-wrap gap-1 text-xs">
              {Object.keys(grouped).map((letter) => (
                <button
                  key={letter}
                  type="button"
                  className="h-6 w-6 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center"
                  onClick={() => scrollToLetter(letter)}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>

          <CommandEmpty>No country found.</CommandEmpty>

          <CommandList className="max-h-64 overflow-y-auto" ref={(el: any) => (listRef.current = el)}>
            {Object.entries(grouped).map(([letter, list]) => (
              <div key={letter}>
                <div ref={(el) => (headingRefs.current[letter] = el as HTMLDivElement)} className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  {letter}
                </div>
                <CommandGroup>
                  {list.map((c) => (
                    <CommandItem key={c.cca3} value={c.name} onSelect={() => selectCountry(c.name)} className="cursor-pointer">
                      <Check className={cn("mr-2 h-4 w-4", value === c.name ? "opacity-100" : "opacity-0")} />
                      {showFlags && c.flag ? <span className="mr-2">{c.flag}</span> : null}
                      <span className="truncate">{c.name}</span>
                      <span className="ml-2 text-muted-foreground text-xs">({c.cca2})</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}

            {allowCustom && input.trim() && !COUNTRY_LIST.some((c) => c.name.toLowerCase() === input.trim().toLowerCase()) && (
              <CommandItem onSelect={() => selectCountry(input.trim())}>
                Use “{input.trim()}”
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
