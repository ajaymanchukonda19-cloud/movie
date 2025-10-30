const mongoose = require('mongoose')
// load models
const User = require('../src/models/user')
const Movies = require('../src/models/movies')

async function seed() {
  const mongoURL = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apnashow'
  console.log('Connecting to', mongoURL)
  await mongoose.connect(mongoURL)

  // Keep existing data; do NOT delete users or movies. We'll upsert movies below.

  // Ensure demo user exists (upsert instead of insert to avoid duplicates)
  await User.updateOne(
    { Email: 'demo@example.com' },
    { $setOnInsert: { Fname: 'Demo', Lname: 'User', Email: 'demo@example.com', Password: 'DemoPass123!' } },
    { upsert: true }
  )

  // Sample movies (updated as requested)
  const movies = [
    { movieName: 'og', like: 92, review: 'High-octane action.', language: 'English', genre: 'action', dateRelease: '2025-09-01' },
    { movieName: 'shinshan', like: 88, review: 'Light-hearted comedy.', language: 'Japanese', genre: 'comedy', dateRelease: '2025-08-15' },
    { movieName: 'rajasaab', like: 80, review: 'Chilling horror thriller.', language: 'Hindi', genre: 'horror', dateRelease: '2025-07-30' }
  ]

  // Remove previously seeded demo titles so they don't linger
  const oldTitles = ['Space Adventure', 'Romantic Sunset', 'Comedy Night']
  await Movies.deleteMany({ movieName: { $in: oldTitles } })

  // Upsert movies by movieName so rerunning this script just updates them
  const ops = movies.map(m => ({
    updateOne: {
      filter: { movieName: m.movieName },
      update: { $set: m },
      upsert: true
    }
  }))
  await Movies.bulkWrite(ops)

  console.log('Seeding complete: movies upserted, demo user -> demo@example.com / DemoPass123!')

  await mongoose.disconnect()
}

seed().catch(err => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
