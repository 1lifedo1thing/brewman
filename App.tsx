import { createAnimatedValue, effect, keymap, reduceMotion, computed, Scroll, List, mount, signal, Text, View } from "nsh";
import { Menu } from "nsh/desktop";
import { Dialog } from "nsh/base";
import { brew, inventory, modify, type Package } from "./src/brew";
import { Button, Chip, Field, KindTile, NavItem, PackageRow, SearchField, Spinner, display } from "./src/ui/controls";
import { Icon, type IconName } from "./src/ui/Icon";
import { motionTokens, revealOn } from "./src/ui/motion";
import { NightScene } from "./src/ui/NightScene";
import { TitleBar } from "./src/ui/TitleBar";

type Section = {id: "all" | "Formula" | "Cask" | "updates"; label: string; icon: IconName};
const sections: Section[] = [
  {id: "all", label: "全部软件", icon: "box"},
  {id: "Formula", label: "Formula", icon: "terminal"},
  {id: "Cask", label: "Cask", icon: "apps"},
  {id: "updates", label: "可更新", icon: "update"},
];
const key = (p: Package) => p.kind + "/" + p.id;
const reason = (error: unknown) => error instanceof Error ? error.message : String(error);

function App() {
  const compact = signal(false);
  const packages = signal<Package[]>([]);
  const section = signal<Section>(sections[0]);
  const query = signal("");
  const selected = signal("");
  const busy = signal("");
  const loaded = signal(false);
  const message = signal<{text: string; tone: "done" | "error"} | null>(null);
  const removing = signal<Package | null>(null);
  let cancelButton: {focus(): void} | undefined;
  let searchInput: {focus(): void} | undefined;

  const matches = (p: Package, id: Section["id"]) => id === "all" || id === p.kind || (id === "updates" && p.outdated);
  const visible = computed(() => packages().filter(p =>
    matches(p, section().id) && p.name.toLowerCase().includes(query().trim().toLowerCase())));
  const item = computed(() => visible().find(p => key(p) === selected()) || visible()[0]);
  const count = (id: Section["id"]) => loaded() ? packages().filter(p => matches(p, id)).length : 0;
  const inspectorMotion = revealOn(() => item() ? key(item()!) : "");
  const feedbackMotion = revealOn(() => busy() || message()?.text || "");

  const navOffset = createAnimatedValue(0);
  effect(() => {
    const destination = sections.indexOf(section()) * (motionTokens.navHeight + motionTokens.navGap);
    if (reduceMotion()) navOffset.set(destination);
    else void navOffset.spring(destination, motionTokens.selectionSpring);
  });
  keymap.bind("mod+f", () => searchInput?.focus());

  async function refresh(label: string, operation?: () => Promise<unknown>, result?: () => string) {
    if (busy()) return;
    busy.set(label);
    message.set(null);
    let failure = "";
    try {
      if (operation) await operation();
    } catch (error) { failure = reason(error); }
    try {
      packages.set(await inventory());
      loaded.set(true);
    } catch (error) { failure = [failure, reason(error)].filter(Boolean).join("\n"); }
    busy.set("");
    if (failure) message.set({text: failure, tone: "error"});
    else if (result) message.set({text: result(), tone: "done"});
  }
  function upgrade(target: Package) {
    if (busy() || !target.outdated) return;
    void refresh("正在升级 " + target.name + "…", () => modify("upgrade", target), () => {
      const version = packages().find(p => key(p) === key(target))?.installed;
      return "已将 " + target.name + " 升级到 " + (version || target.latest);
    });
  }
  function checkUpdates() {
    void refresh("正在检查更新…", () => brew(["update"]), () =>
      count("updates") ? count("updates") + " 个软件包可更新" : "所有软件包都是最新版本");
  }
  function openRowMenu(target: Package, at: {x: number; y: number}) {
    selected.set(key(target));
    void Menu.popup([
      {label: "升级软件包", disabled: !!busy() || !target.outdated, onSelect: () => upgrade(target)},
      {label: "卸载软件包…", disabled: !!busy(), onSelect: () => { if (!busy()) removing.set(target); }},
    ], at);
  }

  void refresh("正在读取软件包…");

  const sidebarWidth = () => compact() ? 184 : 208;

  return <View class="flex-1 bg-background" onLayout={e => compact.set(e.bounds.size.width < 980)}>
    <NightScene/>

    <TitleBar brandWidth={sidebarWidth()}
      brand={<>
        <Icon name="bat" tone="primary" size="md"/>
        <Text style={{...display, fontSize: 14, letterSpacing: 3.2}} class="text-foreground">Brewman</Text>
      </>}
      title={<>
        <Text style={{...display, fontSize: 15, letterSpacing: 2}} class="text-foreground">{section().label}</Text>
        <Text class="font-mono text-xs text-subtle">{loaded() ? visible().length : ""}</Text>
      </>}
      actions={<View class="flex-row items-center gap-2.5">
        <SearchField class={compact() ? "w-44" : "w-56"} value={query()} change={q => query.set(q)}
          shortcut={keymap.label("mod+f")} inputRef={node => { searchInput = node; }}/>
        <Button label="检查更新" icon="refresh" disabled={!!busy()} press={checkUpdates}/>
      </View>}/>

    <View class="flex-1 flex-row">
    <View class="border-r border-foreground/10 bg-background/30" style={{width: sidebarWidth()}}>
      <Text style={{...display, fontSize: 11, letterSpacing: 2.2}} class="px-4 pb-2 pt-5 text-subtle">Library · 软件库</Text>
      <View class="px-2.5" style={{gap: motionTokens.navGap}}>
        <View class="absolute left-2.5 right-2.5 top-0 border-l-2 border-primary bg-foreground/10"
          style={{height: motionTokens.navHeight, translate: [0, navOffset]}}/>
        <Each of={sections}>{s => <NavItem label={s().label} icon={s().icon} selected={section() === s()}
          count={loaded() ? String(count(s().id)) : "—"} alert={s().id === "updates" && count("updates") > 0}
          press={() => section.set(s())}/>}</Each>
      </View>
      <View class="flex-1"/>
      <View class="gap-1 border-t border-foreground/10 px-4 py-3">
        <View class="flex-row items-center gap-2">
          <View style={{rotate: "45deg"}} class={`w-1.5 h-1.5 ${loaded() ? "bg-success" : "bg-dot"}`}/>
          <Text class="text-xs text-soft">本机 Homebrew</Text>
        </View>
        <Text class="font-mono text-xs text-subtle">/opt/homebrew</Text>
      </View>
    </View>

    <View class="flex-1">
      <View class="flex-1 flex-row">
        <View class="flex-1">
          <If when={loaded() && !!visible().length}>
            <View class="h-8 flex-row items-center gap-3 border-b border-foreground/10 px-5">
              <Text class="flex-1 text-xs text-subtle">软件包</Text>
              <If when={!compact()}><Text class="w-24 text-xs text-subtle">当前版本</Text></If>
              <Text class="w-26 text-xs text-subtle">最新版本</Text>
            </View>
            <List each={visible()} keyExtractor={key} estimatedItemSize={44} class="flex-1 px-2 py-1">
              {row => <PackageRow testID={key(row())} name={row().name} desc={row().desc || row().kind}
                installed={row().installed} outdated={row().outdated} status={row().outdated ? row().latest : "最新"}
                cask={row().kind === "Cask"} compact={compact()} selected={!!item() && key(item()!) === key(row())}
                press={() => selected.set(key(row()))} menu={at => openRowMenu(row(), at)}/>}
            </List>
          </If>
          <If when={loaded() && !visible().length}>
            <View class="flex-1 items-start gap-2 px-5 py-6">
              <If when={!!query().trim()} else={<>
                <Text class="text-sm text-foreground">{section().id === "updates" ? "所有软件包都是最新版本" : "此分类没有软件包"}</Text>
              </>}>
                <Text class="text-sm text-foreground">没有找到“{query().trim()}”</Text>
                <Text class="text-xs text-subtle">换个关键词，或清除搜索查看全部软件包。</Text>
                <Button label="清除搜索" press={() => query.set("")}/>
              </If>
            </View>
          </If>
          <If when={!loaded()}><View class="flex-1"/></If>

          <View class="h-7 flex-row items-center justify-between gap-3 border-t border-foreground/10 px-5">
            <Text class="text-xs text-subtle">
              {loaded() ? "共 " + packages().length + " 项 · " + count("updates") + " 项可更新" : ""}</Text>
            <View style={feedbackMotion} class="flex-row items-center gap-1.5">
              <If when={!!busy()}><Spinner/><Text class="text-xs text-foreground">{busy()}</Text></If>
              <If when={!busy() && !!message()}>
                <Icon name={message()?.tone === "error" ? "alert" : "check"} tone={message()?.tone === "error" ? "danger" : "success"} size="xs"/>
                <Text style={{numberOfLines: 1}} class={`text-xs ${message()?.tone === "error" ? "text-danger" : "text-soft"}`}>{message()?.text}</Text>
              </If>
            </View>
          </View>
        </View>

        <If when={!!item()}>
          <View selectable style={inspectorMotion} class={`border-l border-foreground/10 bg-background/40 ${compact() ? "w-62" : "w-75"}`}>
            <Scroll class="flex-1">
              <View class="gap-5 p-5">
                <View class="flex-row items-center gap-3">
                  <KindTile cask={item()?.kind === "Cask"} size="lg"/>
                  <View class="flex-1 gap-0.5">
                    <Text style={{numberOfLines: 1}} class="text-lg font-semibold text-foreground">{item()?.name}</Text>
                    <Text style={{numberOfLines: 1}} class="font-mono text-xs text-subtle">{item()?.tap}</Text>
                  </View>
                </View>
                <If when={!!item()?.desc}><Text class="text-sm text-soft">{item()?.desc}</Text></If>
                <If when={!!item()?.outdated} else={
                  <View class="flex-row items-center gap-2 border border-foreground/10 bg-foreground/5 px-3 py-2.5">
                    <Icon name="check" tone="success" size="sm"/><Text class="text-sm text-soft">已是最新版本</Text>
                  </View>}>
                  <View class="gap-3 border border-primary/30 bg-primary/5 p-3.5">
                    <Text style={{...display, fontSize: 11, letterSpacing: 2}} class="text-primary">有新版本</Text>
                    <View class="flex-row items-center gap-2">
                      <Text class="font-mono text-base text-soft">{item()?.installed}</Text>
                      <Icon name="arrow" tone="subtle" size="sm"/>
                      <Text class="font-mono text-base text-primary">{item()?.latest}</Text>
                    </View>
                    <Button variant="primary" size="md" label={"升级到 " + item()?.latest} disabled={!!busy()}
                      press={() => { const target = item(); if (target) upgrade(target); }}/>
                  </View>
                </If>
                <View>
                  <Field label="类型" value={item()?.kind || ""}/>
                  <Field label="当前版本" value={item()?.installed || ""} mono/>
                  <Field label="最新版本" value={item()?.latest || ""} mono/>
                  <Field label="来源" value={item()?.tap || ""} mono/>
                </View>
                <If when={!!item()?.dependencies.length}>
                  <View class="gap-2">
                    <Text class="text-xs text-subtle">依赖项 · {item()?.dependencies.length}</Text>
                    <View class="flex-row flex-wrap gap-1.5"><Each of={item()?.dependencies || []}>{d => <Chip label={d()}/>}</Each></View>
                  </View>
                </If>
              </View>
            </Scroll>
            <View class="border-t border-foreground/10 p-5">
              <Button variant="danger" size="md" icon="trash" label="卸载软件包…" disabled={!!busy()}
                press={() => removing.set(item() || null)}/>
            </View>
          </View>
        </If>
      </View>
    </View>
    </View>

    <Dialog open={!!removing()} animation={reduceMotion() ? "none" : "fade"} role="alertdialog" accessibilityLabel={"卸载 " + (removing()?.name || "") + "？"}
      onOpen={() => cancelButton?.focus()} onOpenChange={e => { if (!e.open) removing.set(null); }}
      class="flex-1 items-center justify-center" backdropClass="bg-background/70">
      <View class="w-86 gap-4 border border-border-strong bg-card p-5">
        <View class="gap-1.5">
          <Text class="text-base font-semibold text-foreground">卸载 {removing()?.name}？</Text>
          <Text class="text-xs text-soft">Homebrew 会从本机移除 {removing()?.name} {removing()?.installed}。依赖它的软件包可能无法运行。</Text>
        </View>
        <View class="flex-row justify-end gap-2">
          <Button buttonRef={node => { cancelButton = node; }} label="取消" press={() => removing.set(null)}/>
          <Button variant="danger-solid" label="卸载" press={() => {
            const target = removing(); removing.set(null);
            if (target) void refresh("正在卸载 " + target.name + "…", () => modify("uninstall", target), () => "已卸载 " + target.name);
          }}/>
        </View>
      </View>
    </Dialog>
  </View>;
}
mount(App);
