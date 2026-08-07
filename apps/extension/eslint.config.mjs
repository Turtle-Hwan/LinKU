import baseConfig from "../../tooling/eslint/base.mjs";

export default [
  ...baseConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@radix-ui/*",
                "class-variance-authority",
                "cmdk",
                "sonner",
                "tailwind-merge",
              ],
              message:
                "Extension UI primitives must come from @linku/ui so the extension and web keep the same design.",
            },
          ],
        },
      ],
    },
  },
];
