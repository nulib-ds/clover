import "./setupBrowser";

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

import { cloverI18n } from "./i18n/config";

// runs a cleanup after each test case (e.g. clearing jsdom), and puts Clover's interface
// language back to the visitor's, so a test's choice never reaches the next
afterEach(() => {
  cleanup();
  void cloverI18n.chooseInterfaceLanguage();
});
