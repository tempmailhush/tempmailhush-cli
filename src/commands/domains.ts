import type { Command } from "commander";
import { clientFromOptions, globalOptions } from "./context.js";
import { writeJson, writePretty } from "../output.js";

export function registerDomains(program: Command): void {
  program
    .command("domains")
    .description("List available TempMailHush domains")
    .action(async () => {
      const options = globalOptions(program);
      const domains = await (await clientFromOptions(options)).listDomains();
      if (options.pretty) {
        writePretty(domains.map((item) => item.domain));
        return;
      }
      writeJson({ domains });
    });
}
