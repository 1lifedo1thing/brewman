import { titleBarControlHeight } from "./TitleBar";
import { Text, View } from "nsh";
import { Menu as BaseMenu, MenuItem, MenuSeparator } from "nsh/base";
import { Icon, type IconName } from "./Icon";
import { motionTokens } from "./motion";

/** One row of a dropdown menu, or a line between groups. */
export type MenuEntry =
  | {label: string; select: () => void; icon?: IconName; shortcut?: string; disabled?: boolean; tone?: "danger"}
  | "separator";

/**
 * The app's dropdown menu: a square icon trigger (its label for screen readers) in the title bar's button size, opening a dark
 * panel under it, aligned to its end. Rows wash on hover and keyboard focus alike, show their shortcut at the end,
 * and the panel fades and drops in by 4pt (instant with reduced motion).
 */
export function DropdownMenu(p: {label: string; icon: IconName; items: () => MenuEntry[]}) {
  return <BaseMenu offset={6} placement="bottom" align="end"
    popupClass="min-w-56 border border-border-strong bg-card p-1 shadow-lg transition-all duration-150 ease-out motion-reduce:transition-none"
    popupStartingClass="opacity-0 -translate-y-1" popupEndingClass="opacity-0"
    trigger={<View testID="title-menu" accessibilityLabel={p.label} style={{width: titleBarControlHeight, height: titleBarControlHeight}} class={`${motionTokens.wash} items-center justify-center rounded-(--radius) border border-border-strong bg-muted hover:bg-selected active:bg-pressed`}>
      <Icon name={p.icon} tone="soft" size="md"/>
    </View>}>
    {p.items().map(entry => entry === "separator"
      ? <MenuSeparator class="my-1 h-px bg-foreground/10"/>
      : <MenuItem disabled={entry.disabled} onSelect={entry.select}
          class={`${motionTokens.wash} h-8 flex-row items-center gap-2.5 px-2.5 rounded-(--radius-sm) hover:bg-foreground/8 focus:bg-foreground/8 active:bg-foreground/12 disabled:opacity-40`}>
          <View class="w-4 items-center">{entry.icon ? <Icon name={entry.icon} tone={entry.tone === "danger" ? "danger" : "soft"} size="sm"/> : null}</View>
          <Text class={`flex-1 text-sm ${entry.tone === "danger" ? "text-danger" : "text-foreground"}`}>{entry.label}</Text>
          {entry.shortcut ? <Text class="font-mono text-xs text-subtle">{entry.shortcut}</Text> : null}
        </MenuItem>)}
  </BaseMenu>;
}
