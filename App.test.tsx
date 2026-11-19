import { expect, open, test } from "nsh/test";

test("opens the package library and switches categories", async () => {
  const app = await open("./App.tsx");
  expect(app.texts()).toContain("LIBRARY · 软件库");
  expect(app.texts()).toContain("全部软件");
  await app.press("Cask");
  expect(app.texts()).toContain("CASK");
});

test("category selection works with reduced motion", async () => {
  const app = await open("./App.tsx", {reducedMotion: true});
  await app.press("Cask >> nth=0");
  expect(app.texts()).toContain("CASK");
});

test("reports a missing Homebrew in the status bar without an error prefix", async () => {
  const app = await open("./App.tsx");
  await app.waitFor("未找到 Homebrew，请检查 brew 安装路径。");
  expect(app.texts().some(t => t.startsWith("Error:"))).toBe(false);
});
