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

const COUNTRIES = [
  "United States","United Kingdom","Canada","Australia","India","Philippines","Singapore","United Arab Emirates","Germany","France","Spain","Italy","Netherlands","Brazil","Mexico","Japan","South Korea","China","Thailand","Vietnam"
];

type Props = {
  value?: string;
  onChange: (val: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
};

export default function CountryCombobox({
  value,
  onChange,
  placeholder = "Select or type a country...",
  allowCustom = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState(value ?? "");

  React.useEffect(() => {
    setInput(value ?? "");
  }, [value]);

  const filtered = React.useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [input]);

  const selectCountry = (c: string) => {
    onChange(c);
    setInput(c);
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
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between text-left">
          <span className={cn(value && value.length > 0 ? "text-foreground" : "text-muted-foreground", "truncate")}>{value && value.length > 0 ? value : (placeholder || "Country")}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

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
          </div>

          <CommandEmpty>No country found.</CommandEmpty>
          <CommandGroup>
            <CommandList>
              {filtered.map((c) => (
                <CommandItem key={c} onSelect={() => selectCountry(c)} className="cursor-pointer">
                  <Check className={cn("mr-2 h-4 w-4", value === c ? "opacity-100" : "opacity-0")} />
                  {c}
                </CommandItem>
              ))}
              {allowCustom && input.trim() && !COUNTRIES.some((c) => c.toLowerCase() === input.trim().toLowerCase()) && (
                <CommandItem onSelect={() => selectCountry(input.trim())}>
                  Use "{input.trim()}"
                </CommandItem>
              )}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
