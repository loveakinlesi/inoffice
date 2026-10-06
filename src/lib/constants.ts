import type { Region, Status } from './types.ts';
export const STATUS_ORDER: Status[] = ["home", "office", "ooo", "sick", "bank"];
export const STATUS_META: Record<Status, { label: string; classes: string; dot: string }> = {
        home: { label: "Home", classes: "bg-home-soft text-home-fg border-home-line", dot: "bg-home" },
        office: { label: "Office", classes: "bg-office-soft text-office-fg border-office-line", dot: "bg-office" },
        ooo: { label: "OOO", classes: "bg-ooo-soft text-ooo-fg border-ooo-line", dot: "bg-ooo" },
        sick: { label: "Sick", classes: "bg-sick-soft text-sick-fg border-sick-line", dot: "bg-sick" },
        bank: { label: "Bank holiday", classes: "bg-bank-soft text-bank-fg border-bank-line", dot: "bg-bank" }
      };
export const REGION_NAMES: Record<Region, string> = {
        "england-and-wales": "England & Wales",
        scotland: "Scotland",
        "northern-ireland": "Northern Ireland"
      };
