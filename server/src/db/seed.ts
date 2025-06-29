async function seed() {
  console.log('Starting database seed...');

  try {
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run seed if this file is executed directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
