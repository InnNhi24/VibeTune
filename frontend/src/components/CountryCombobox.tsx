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
// ScrollArea not used here; using native scroll container for precise control

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

  // height for the left list + right rail (px)
  const LIST_HEIGHT = 256; // 16rem

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

  

  // Alphabetical rail removed; rely on search/filter and grouping headers in list

  // A–Z rail removed: keep list simple and rely on search/filter for navigation

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
      <PopoverContent
        className="country-popover p-0 bg-background border border-border shadow-md z-50 relative"
        style={{
          // Use a sensible max width and let the list handle vertical overflow; avoid calculating +48px which can clip
          width: "min(90vw, 480px)",
          maxHeight: "60vh",
          overflow: "visible",
        }}
      >
        {/* Layout: left = search + grouped list (scrollable). Right rail is an absolute overlay */}
  <div className="relative p-2">
          <Input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleFreeEnter}
            placeholder="Type to search or press Enter to use text"
          />

          <div className="mt-2">
            {/* use a native scroll container so we can control scrollTop precisely */}
            <div className="overflow-y-auto pr-1" style={{ maxHeight: `${LIST_HEIGHT}px` }}>
              <Command shouldFilter={false}>
                <CommandList className="!max-h-none !overflow-visible">
                  {Object.entries(grouped).map(([letter, list]) => (
                    <div key={letter}>
                      <div data-letter={letter} className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        {letter}
                      </div>
                      <CommandGroup className="flex flex-col">
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

                <CommandEmpty>No country found.</CommandEmpty>
              </Command>
            </div>
          </div>
        </div>

        {/* A–Z rail removed */}
      </PopoverContent>
    </Popover>
  );
}
