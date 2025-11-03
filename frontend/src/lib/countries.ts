import raw from "world-countries";

export type Country = {
  name: string;
  cca2: string;
  cca3: string;
  flag: string;
  region: string;
};

export const COUNTRY_LIST: Country[] = (raw as any)
  .map((c: any) => ({
    name: c?.name?.common || "",
    cca2: c?.cca2 || "",
    cca3: c?.cca3 || "",
    flag: c?.flag || "",
    region: c?.region || "",
  }))
  .filter((c: Country) => c.name)
  .sort((a: Country, b: Country) => a.name.localeCompare(b.name));
