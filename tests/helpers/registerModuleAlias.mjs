import { register } from "node:module";

register("./moduleAliasLoader.mjs", import.meta.url);
