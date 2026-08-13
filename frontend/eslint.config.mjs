import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "frontend/.next/**",
    "out/**",
    "build/**",
    "dist/**",
    "frontend/dist/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // 此專案既有的單頁工作流元件會在事件與 effect 中更新狀態；
      // 不使用 React Compiler，因此關閉其僅適用於編譯器模式的限制。
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;
