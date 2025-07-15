import dns from 'node:dns';
import url from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from 'dotenv';

dns.setDefaultResultOrder('ipv4first');

config();

const getHostFromUrl = (dbUrl: string) => {
  try {
    const parsedUrl = new url.URL(dbUrl);
    return parsedUrl.hostname;
  } catch (error) {
    console.error('Error parsing URL:', error);
    return null;
  }
};

const connectionString = process.env.DATABASE_URL || '';
const hostname = getHostFromUrl(connectionString);

console.log(`Using database host: ${hostname}`);

const sql = postgres(connectionString, {
  max: 1,
  connect_timeout: 30,
  idle_timeout: 30,
  ssl: false,
});

const db = drizzle(sql);

(async () => {
  try {
    console.log(`Starting database migration...`);
    await migrate(db, {
      migrationsFolder: './libs/db/src/postgres/migrations',
    });
    console.log(`Migration completed successfully!`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();
