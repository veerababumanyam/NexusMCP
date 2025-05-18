import { pool } from './index';

/**
 * Updates the system_branding table with new columns for fonts and theme settings
 */
async function updateBrandingTable() {
  const client = await pool.connect();
  
  try {
    console.log('Starting branding table update...');
    await client.query('BEGIN');
    
    // Check if the columns already exist to avoid errors
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'system_branding' 
      AND column_name IN ('primary_font_family', 'primary_font_url', 'secondary_font_family', 'secondary_font_url', 'logo_url', 'logo_alt_text', 'accent_color', 'enable_dark_mode', 'default_theme', 'support_email', 'support_url', 'copyright_text')
    `;
    
    const { rows } = await client.query(checkColumnQuery);
    const existingColumns = rows.map(row => row.column_name);
    
    // Add columns if they don't exist
    const addColumnsQueries = [];
    
    if (!existingColumns.includes('logo_url')) {
      addColumnsQueries.push(`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS logo_url TEXT`);
    }
    
    if (!existingColumns.includes('logo_alt_text')) {
      addColumnsQueries.push(`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS logo_alt_text TEXT`);
    }
    
    if (!existingColumns.includes('accent_color')) {
      addColumnsQueries.push(`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS accent_color TEXT`);
    }
    
    if (!existingColumns.includes('enable_dark_mode')) {
      addColumnsQueries.push(`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS enable_dark_mode BOOLEAN DEFAULT TRUE`);
    }
    
    if (!existingColumns.includes('default_theme')) {
      addColumnsQueries.push(`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS default_theme TEXT DEFAULT 'system'`);
    }
    
    if (!existingColumns.includes('primary_font_family')) {
      addColumnsQueries.push(`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS primary_font_family TEXT`);
    }
    
    if (!existingColumns.includes('primary_font_url')) {
      addColumnsQueries.push(`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS primary_font_url TEXT`);
    }
    
    if (!existingColumns.includes('secondary_font_family')) {
      addColumnsQueries.push(`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS secondary_font_family TEXT`);
    }
    
    if (!existingColumns.includes('secondary_font_url')) {
      addColumnsQueries.push(`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS secondary_font_url TEXT`);
    }
    
    if (!existingColumns.includes('support_email')) {
      addColumnsQueries.push(`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS support_email TEXT`);
    }
    
    if (!existingColumns.includes('support_url')) {
      addColumnsQueries.push(`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS support_url TEXT`);
    }
    
    if (!existingColumns.includes('copyright_text')) {
      addColumnsQueries.push(`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS copyright_text TEXT`);
    }
    
    // Execute all column addition queries
    for (const query of addColumnsQueries) {
      await client.query(query);
      console.log(`Executed: ${query}`);
    }
    
    // Set default values for existing records
    if (addColumnsQueries.length > 0) {
      await client.query(`
        UPDATE system_branding 
        SET accent_color = '#3986ca',
            enable_dark_mode = TRUE,
            default_theme = 'system',
            copyright_text = '© ${new Date().getFullYear()} NexusMCP. All rights reserved.'
        WHERE accent_color IS NULL
      `);
      console.log('Added default values to existing branding records');
    }
    
    await client.query('COMMIT');
    console.log('Branding table update completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating branding table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
updateBrandingTable()
  .then(() => console.log('Migration completed'))
  .catch(err => console.error('Migration failed:', err))
  .finally(() => process.exit());