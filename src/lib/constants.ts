import type { Region, Status } from './types.ts';
export const STATUS_ORDER: Status[] = ["home", "office", "ooo", "sick", "bank"];
export const STATUS_META: Record<Status, { label: string; classes: string; dot: string }> = {
        home: { label: "Home", classes: "bg-sky-50 text-sky-800 border-sky-200", dot: "bg-sky-500" },
        office: { label: "Office", classes: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
        ooo: { label: "OOO", classes: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
        sick: { label: "Sick", classes: "bg-rose-50 text-rose-800 border-rose-200", dot: "bg-rose-500" },
        bank: { label: "Bank holiday", classes: "bg-violet-50 text-violet-800 border-violet-200", dot: "bg-violet-500" }
      };
export const REGION_NAMES: Record<Region, string> = {
        "england-and-wales": "England & Wales",
        scotland: "Scotland",
        "northern-ireland": "Northern Ireland"
      };
