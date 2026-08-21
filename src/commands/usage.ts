import type { Command } from "commander";
import { clientFromOptions, globalOptions } from "./context.js";
import { writeJson, writePretty } from "../output.js";

export function registerUsage(program: Command): void {
  program
    .command("usage")
    .description("Show monthly API usage")
    .action(async () => {
      const options = globalOptions(program);
      const usage = await (await clientFromOptions(options)).getUsage();
      if (options.pretty) {
        writePretty([
          `Period: ${usage.period}`,
          `Plan: ${usage.plan}`,
          `Used: ${usage.used}`,
          `Limit: ${usage.limit}`,
          `Remaining: ${usage.remaining}`
        ]);
        return;
      }
      writeJson(usage);
    });

  program
    .command("rate-limit")
    .alias("rate_limit")
    .description("Show per-minute API rate limit")
    .action(async () => {
      const options = globalOptions(program);
      const rateLimit = await (await clientFromOptions(options)).getRateLimit();
      if (options.pretty) {
        writePretty([`Rate limit: ${rateLimit.rateLimitPerMinute} requests/minute`]);
        return;
      }
      writeJson(rateLimit);
    });
}
