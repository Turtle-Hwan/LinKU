import { createRobots } from "@linku/seo";
import { siteEnv } from "@/lib/site";

export default function robots() {
  return createRobots(siteEnv.siteUrl);
}
