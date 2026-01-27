import * as fs from "fs";
import * as path from "path";
import * as toml from "toml";

export interface Config {
  migrations_dir: string;
}

const DEFAULT_CONFIG: Config = {
  migrations_dir: "migrations",
};

export function loadConfig(): Config {
  const configPath = path.join(process.cwd(), "siquil.toml");

  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = toml.parse(content) as Partial<Config>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
    };
  } catch (error) {
    console.error(`Error parsing siquil.toml: ${error}`);
    process.exit(1);
  }
}

export function getMigrationsDir(config: Config): string {
  return path.join(process.cwd(), config.migrations_dir);
}
