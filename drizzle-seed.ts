import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dns from 'node:dns';
import url from 'node:url';
import { PostgresDb, seedDatabase } from '@db';

// Configure DNS to prefer IPv4
dns.setDefaultResultOrder('ipv4first');

// Load environment variables
config();

// Function to extract hostname from URL
const getHostFromUrl = (dbUrl: string) => {
    try {
        const parsedUrl = new url.URL(dbUrl);
        return parsedUrl.hostname;
    } catch (error) {
        console.error('Error parsing URL:', error);
        return null;
    }
};

// Connect to database with connection string - DNS settings will prefer IPv4
const connectionString = process.env.DATABASE_URL || '';
const hostname = getHostFromUrl(connectionString);

console.log(`Using database host: ${hostname}`);

const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 30,
    idle_timeout: 30,
    ssl: false
});

const db = drizzle(sql);

async function seed() {
    try {
        console.log('🌱 Starting seeding process...');

        // Seed users first
        // await seedUsers(db as unknown as PostgresDb);

        // Seed tools and agents
        await seedDatabase(db as unknown as PostgresDb);

        console.log('✅ All seeds completed successfully!');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        throw error;
    }
}

(async () => {
    try {
        await seed();
    } catch (error) {
        console.error('Seeding process failed:', error);
        process.exit(1);
    } finally {
        await sql.end();
        process.exit(0);
    }
})(); 