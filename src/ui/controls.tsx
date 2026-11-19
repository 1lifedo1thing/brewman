import { t } from "nsh/i18n";
import { createMotion, effect, Image, reduceMotion, Text, token, View } from "nsh";
import eyesGlyph from "./icons/eyes.svg";
import { Button as BaseButton, Input } from "nsh/base";
import { Icon, type IconName, type IconTone } from "./Icon";
import { motionTokens } from "./motion";

export type ButtonVariant = "primary" | "default" | "ghost" | "danger" | "danger-solid";
type Look = {box: string; label: string; icon: IconTone};
const looks: Record<ButtonVariant, Look> = {
  primary: {box: "bg-primary hover:bg-primary-hover active:bg-primary-active", label: "text-primary-foreground font-semibold", icon: "primary-foreground"},
  default: {box: "border border-border-strong bg-muted hover:bg-selected active:bg-pressed", label: "text-foreground", icon: "soft"},
  ghost: {box: "hover:bg-foreground/5 active:bg-foreground/10", label: "text-foreground", icon: "soft"},
  danger: {box: "border border-danger/40 hover:bg-danger/10 active:bg-danger/20", label: "text-danger", icon: "danger"},
  "danger-solid": {box: "bg-danger hover:opacity-90 active:opacity-80", label: "text-danger-foreground font-semibold", icon: "danger"},
};
const sizes = {sm: {box: "h-7 px-2.5 gap-1.5", label: "text-xs"}, md: {box: "h-8 px-3 gap-2", label: "text-sm"}};

/** The app's button: a variant by meaning, a size, an optional leading icon. */
export function Button(p: {label: string; press: () => void; variant?: ButtonVariant; size?: keyof typeof sizes; icon?: IconName;
  disabled?: boolean; class?: string; testID?: string; buttonRef?: (node: {focus(): void}) => void}) {
  const look = () => looks[p.variant || "default"];
  const size = () => sizes[p.size || "sm"];
  return <BaseButton ref={p.buttonRef} testID={p.testID} disabled={p.disabled} onPress={p.press}
    class={`${motionTokens.control} flex-row items-center justify-center rounded-(--radius) focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 ${size().box} ${look().box} ${p.class || ""}`}>
    <If when={p.icon}>{icon => <Icon name={icon()} tone={look().icon} size="sm"/>}</If>
    <Text class={`${size().label} ${look().label}`}>{p.label}</Text>
  </BaseButton>;
}

/** A sidebar destination. Its selected fill is the sidebar's one sliding indicator, drawn by the parent. */
export function NavItem(p: {label: string; icon: IconName; count: string; alert?: boolean; selected: boolean; press: () => void}) {
  return <BaseButton selected={p.selected} onPress={p.press} style={{height: motionTokens.navHeight}}
    class={`${motionTokens.wash} flex-row items-center gap-2.5 px-2 rounded-(--radius) focus-visible:ring-2 focus-visible:ring-ring ${p.selected ? "" : "hover:bg-foreground/5 active:bg-foreground/10"}`}>
    <Icon name={p.icon} tone={p.selected ? "foreground" : "subtle"}/>
    <Text class={`flex-1 text-sm ${p.selected ? "text-foreground font-medium" : "text-soft"}`}>{p.label}</Text>
    <If when={p.alert} else={<Text class="font-mono text-xs text-subtle tabular-nums">{p.count}</Text>}>
      <View class="min-w-4.5 h-4.5 px-1.5 items-center justify-center bg-primary/15">
        <Text class="font-mono text-xs text-primary tabular-nums">{p.count}</Text>
      </View>
    </If>
  </BaseButton>;
}

/** The package search, with its ⌘F hint. */
export function SearchField(p: {value: string; change: (s: string) => void; shortcut: string; inputRef?: (node: {focus(): void}) => void; class?: string}) {
  return <View class={`h-7 justify-center ${p.class || ""}`}>
    <Input ref={p.inputRef} testID="search" accessibilityLabel={t("toolbar.search")} placeholder={t("toolbar.search")} value={p.value} onChange={e => p.change(e.value)}
      class={`${motionTokens.wash} h-7 rounded-(--radius) border border-foreground/10 bg-background/40 ps-7 pe-9 text-xs text-foreground placeholder:text-subtle focus:border-primary`}/>
    <View class="absolute start-2"><Icon name="search" size="sm"/></View>
    <View class="absolute end-1.5 rounded-(--radius-sm) border border-border-strong px-1"><Text class="font-mono text-xs text-subtle">{p.shortcut}</Text></View>
  </View>;
}

/** A status that never relies on colour alone: a dot and its words. */
export function StatusMark(p: {label: string; attention: boolean}) {
  return <View class="flex-row items-center gap-1.5">
    <View style={{rotate: "45deg"}} class={`w-1.5 h-1.5 ${p.attention ? "bg-warning" : "bg-dot"}`}/>
    <Text style={{numberOfLines: 1}} class={`font-mono text-xs ${p.attention ? "text-warning" : "text-subtle"}`}>{p.label}</Text>
  </View>;
}

/** A label/value line of the inspector. Versions and identifiers use `mono`. */
export function Field(p: {label: string; value: string; mono?: boolean}) {
  return <View class="flex-row justify-between items-center gap-3 border-b border-foreground/10 py-2.5">
    <Text class="text-xs text-subtle">{p.label}</Text>
    <Text style={{numberOfLines: 1}} class={`flex-1 text-right text-xs text-foreground ${p.mono ? "font-mono" : ""}`}>{p.value}</Text>
  </View>;
}

/** A small identifier tag, such as a dependency. */
export function Chip(p: {label: string}) {
  return <View class="rounded-(--radius-sm) border border-foreground/10 bg-foreground/5 px-1.5 py-0.5">
    <Text class="font-mono text-xs text-soft">{p.label}</Text>
  </View>;
}

/** A square tile holding a kind's icon. */
export function KindTile(p: {cask: boolean; size?: "sm" | "lg"}) {
  return <View class={`items-center justify-center border border-foreground/10 bg-foreground/5 ${p.size === "lg" ? "w-10 h-10 rounded-(--radius-lg)" : "w-7 h-7 rounded-(--radius)"}`}>
    <Icon name={p.cask ? "apps" : "terminal"} tone={p.size === "lg" ? "foreground" : "subtle"} size={p.size === "lg" ? "lg" : "sm"}/>
  </View>;
}

/** The busy mark of the status bar: a turning arc that rests with reduced motion. */
/** Busy: a pair of eyes that glow up and down and blink now and then, instead of a spinning ring. Still (lit) under
 * reduced motion. */
export function Spinner() {
  const motion = createMotion();
  effect(() => {
    if (reduceMotion()) { motion.reset(); return; }
    void motion.play({duration: motionTokens.watchMs, iterations: "infinite", easing: "easeInOut", keyframes: [
      {opacity: 0.4, scaleY: 1, offset: 0},
      {opacity: 1, scaleY: 1, offset: 0.45},
      {opacity: 1, scaleY: 1, offset: 0.8},
      {opacity: 1, scaleY: 0.1, offset: 0.84},
      {opacity: 1, scaleY: 1, offset: 0.88},
      {opacity: 0.4, scaleY: 1, offset: 1},
    ]});
  });
  return <View accessibilityElementsHidden style={motion.style}>
    <Image src={eyesGlyph} class="w-5 h-2.5" style={{tintColor: token("primary")}}/>
  </View>;
}

/** The display face: a condensed, widely tracked uppercase for the wordmark and section labels. */
export const display = {fontFamily: "Avenir Next Condensed", textTransform: "uppercase", letterSpacing: 2.4, fontWeight: "700"} as const;

/** A package of the table: kind tile, name and description, installed version, and its status. */
export function PackageRow(p: {name: string; desc: string; installed: string; status: string; outdated: boolean; cask: boolean;
  compact: boolean; selected: boolean; press: () => void; menu: (at: {x: number; y: number}) => void; testID: string}) {
  return <BaseButton testID={p.testID} selected={p.selected} onPress={p.press} onContextMenu={e => p.menu(e.pagePosition)}
    class={`${motionTokens.wash} flex-row h-11 items-center gap-3 px-3 rounded-(--radius) focus-visible:ring-2 focus-visible:ring-ring ${p.selected ? "bg-foreground/10" : "hover:bg-foreground/5 active:bg-foreground/10"}`}>
    <If when={!p.compact}><KindTile cask={p.cask}/></If>
    <View class="flex-1 gap-0.5">
      <Text style={{numberOfLines: 1}} class="text-sm font-medium text-foreground">{p.name}</Text>
      <Text style={{numberOfLines: 1}} class="text-xs text-subtle">{p.desc}</Text>
    </View>
    <If when={!p.compact}><Text style={{numberOfLines: 1, fontVariant: "tabular-nums"}} class="w-24 font-mono text-xs text-soft">{p.installed}</Text></If>
    <View class="w-26"><StatusMark label={p.status} attention={p.outdated}/></View>
  </BaseButton>;
}

/** The letter a package name files under: A–Z, or # for anything else. */
export const letterOf = (name: string) => { const c = name.charAt(0).toUpperCase(); return c >= "A" && c <= "Z" ? c : "#"; };
export const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/** An A–Z rail beside a list: each letter jumps to the first row filed under it; letters with no rows are dimmed and
 * disabled. The letters share the rail's height, so it fits short windows. */
export function LetterIndex(p: {present: (letter: string) => boolean; current: string; press: (letter: string) => void}) {
  return <View role="navigation" accessibilityLabel={t("index.label")} class="w-6 items-center py-1.5">
    <Each of={LETTERS}>{letter =>
      <BaseButton disabled={!p.present(letter())} onPress={() => p.press(letter())}
        accessibilityLabel={t("index.jump", {letter: letter()})}
        class={`${motionTokens.wash} flex-1 w-5 max-h-5 items-center justify-center hover:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-ring`}>
        <Text style={{fontFamily: "Avenir Next Condensed", fontWeight: "700", fontSize: 10}}
          class={p.current === letter() ? "text-primary" : p.present(letter()) ? "text-soft" : "text-foreground/20"}>{letter()}</Text>
      </BaseButton>}</Each>
  </View>;
}
