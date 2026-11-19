import { View } from "nsh";
import type { JSX } from "nsh/types";
import { titleBar, windowState } from "nsh/desktop";


/**
 * The window's own title bar, drawn in place of the hidden system one: one dark strip across the whole window that
 * moves the window, keeps clear of the system's window controls, and dims while the window is in the background.
 * `brand` sits after the controls over the sidebar (`brandWidth` wide), `title` starts the content column, and
 * `actions` sit at the right end. Its views stay pressable: only its empty space drags.
 */
export function TitleBar(p: {brand?: JSX.Element; brandWidth: number; title?: JSX.Element; actions?: JSX.Element}) {
  const area = () => titleBar();
  const active = () => windowState()?.focused ?? true;
  return <View desktop={{windowDrag: true}} role="toolbar"
    class="flex-row items-center border-b border-foreground/10 bg-background/55"
    style={{height: area().height || 42, flexShrink: 0, paddingRight: area().right + 14, paddingTop: 2.5}}>
    <View desktop={{windowDrag: true}} class="h-full flex-row items-center gap-2.5 border-r border-foreground/10"
      style={{width: p.brandWidth, paddingLeft: area().left + 6}}>
      <View class={`flex-row items-center gap-2.5 transition-opacity duration-150 ease-out motion-reduce:transition-none`} style={{opacity: active() ? 1 : 0.5}}>{p.brand}</View>
    </View>
    <View desktop={{windowDrag: true}} class={`flex-1 h-full flex-row items-center gap-3 pl-5 transition-opacity duration-150 ease-out motion-reduce:transition-none`}
      style={{opacity: active() ? 1 : 0.55}}>
      {p.title}
      <View desktop={{windowDrag: true}} class="flex-1 h-full"/>
      {p.actions}
    </View>
  </View>;
}
