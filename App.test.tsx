import { expect, open, test } from "nsh/test";

test("opens the package library in English and switches categories", async () => {
  const app = await open("./App.tsx", {locale: "en-US"});
  expect(app.texts()).toContain("LIBRARY");
  expect(app.texts()).toContain("All Packages");
  await app.press("Cask");
  expect(app.texts()).toContain("CASK");
});

test("shows Simplified Chinese for a Chinese locale", async () => {
  const app = await open("./App.tsx", {locale: "zh-CN"});
  expect(app.texts()).toContain("全部软件");
  expect(app.texts()).toContain("可更新");
  await app.waitFor("未找到 Homebrew，请检查 brew 安装路径。");
});

test("falls back to English for other locales", async () => {
  const app = await open("./App.tsx", {locale: "fr-FR"});
  expect(app.texts()).toContain("Local Homebrew");
});

test("category selection works with reduced motion", async () => {
  const app = await open("./App.tsx", {locale: "en-US", reducedMotion: true});
  await app.press("Cask >> nth=0");
  expect(app.texts()).toContain("CASK");
});

test("reports a missing Homebrew in the status bar without an error prefix", async () => {
  const app = await open("./App.tsx", {locale: "en-US"});
  await app.waitFor("Homebrew was not found. Check where brew is installed.");
  expect(app.texts().some(t => t.startsWith("Error:"))).toBe(false);
});
