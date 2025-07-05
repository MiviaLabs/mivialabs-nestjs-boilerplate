import type { Config } from "drizzle-kit";
import 'dotenv/config';

const baseConfig = {
    dialect: "postgresql" as const,
    dbCredentials: {
        url: process.env.DATABASE_URL || "",
    },
    verbose: true,
    strict: true,
    ssl: false
};

export default {
    ...baseConfig,
    schema: "./libs/db/src/postgres/schema",
    out: "./libs/db/src/postgres/migrations",
    entities: {
        roles: true,
    },
    tablesFilter: ["!pg_*", "!v_*", "!information_schema.*"],
} satisfies Config;