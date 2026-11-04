import { toggleAll, type Category, type Choice } from "./selection.ts";

export type MenuAction = "up" | "down" | "next" | "previous" | "toggle" | "all" | "none" | "auto" | "apply" | "cancel" | "pageUp" | "pageDown";
export interface MenuResult { choices: Choice[]; autoOpen: boolean }
const categories: Category[] = ["skills", "extensions", "tools"];
const titles = ["Skills", "Extensions", "Tools"];

/** UI state contains only a draft: Escape never changes settings or active tools. */
export class Menu {
  choices: Choice[];
  autoOpen: boolean;
  tab = 0;
  cursor = 0;
  constructor(choices: Choice[], autoOpen: boolean) {
    this.choices = choices.map((choice) => ({ ...choice }));
    this.autoOpen = autoOpen;
  }
  get items(): Choice[] { return this.choices.filter((choice) => choice.category === categories[this.tab]); }
  act(action: MenuAction): MenuResult | "cancel" | undefined {
    const items = this.items;
    switch (action) {
      case "next": this.tab = (this.tab + 1) % 3; this.cursor = 0; break;
      case "previous": this.tab = (this.tab + 2) % 3; this.cursor = 0; break;
      case "up": this.cursor = Math.max(0, this.cursor - 1); break;
      case "down": this.cursor = Math.max(0, Math.min(items.length - 1, this.cursor + 1)); break;
      case "pageUp": this.cursor = Math.max(0, this.cursor - 10); break;
      case "pageDown": this.cursor = Math.max(0, Math.min(items.length - 1, this.cursor + 10)); break;
      case "toggle": if (items[this.cursor] && !items[this.cursor].locked) items[this.cursor].enabled = !items[this.cursor].enabled; break;
      case "all": toggleAll(this.choices, categories[this.tab], true); break;
      case "none": toggleAll(this.choices, categories[this.tab], false); break;
      case "auto": this.autoOpen = !this.autoOpen; break;
      case "cancel": return "cancel";
      case "apply": return { choices: this.choices, autoOpen: this.autoOpen };
    }
  }
  render(width: number, rows: number, truncate: (text: string, width: number) => string): string[] {
    const items = this.items;
    const count = Math.max(1, rows - 10);
    const start = Math.max(0, Math.min(this.cursor - Math.floor(count / 2), items.length - count));
    return [
      "Pi-Startmenü — Auswahl vor der nächsten Aufgabe",
      titles.map((title, index) => index === this.tab ? `[ ${title} ]` : `  ${title}  `).join(" "),
      `${items.filter((item) => item.enabled).length}/${items.length} ausgewählt · Tab: Bereich wechseln`,
      ...items.slice(start, start + count).map((item, index) => `${start + index === this.cursor ? ">" : " "} [${item.enabled ? "x" : " "}] ${item.label}${item.locked ? " (geschützt)" : ""}`),
      ...(items.length ? [] : ["  Keine Ressourcen in diesem Bereich."]),
      `${items.length ? this.cursor + 1 : 0}/${items.length} · ${items[this.cursor]?.resource?.path ?? ""}`,
      `[${this.autoOpen ? "x" : " "}] Beim Pi-Start öffnen (s)`,
      "↑/↓: navigieren · Leertaste: Checkbox · a/n: alle/keine im Bereich",
      "Enter: speichern & weiter · Esc: verwerfen · Bild↑/↓: blättern",
      this.tab === 2 ? "Tools: Modell-Auswahl sofort; keine Sicherheits-Sandbox." : "Skills/Extensions: wirksam nach Reload; bereits geladener Code lief schon.",
    ].map((line) => truncate(line, Math.max(1, width)));
  }
}
