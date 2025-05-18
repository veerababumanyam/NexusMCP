/**
 * Script to create and seed the breach detection tables directly
 */
const { setupBreachDetection } = require('./db/create-breach-detection-tables');

async function main() {
  try {
    console.log('Starting breach detection table setup...');
    
    await setupBreachDetection();
    
    console.log('Breach detection setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up breach detection:', error);
    process.exit(1);
  }
}

main();