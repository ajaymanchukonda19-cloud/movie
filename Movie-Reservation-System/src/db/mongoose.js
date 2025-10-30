// /Users/harsh/mongodb/bin/mongod.exe --dbpath=/Users/harsh/mongodb-data
const mongoose = require('mongoose')

// Mongoose v6+ removed many legacy options (useNewUrlParser, useFindAndModify, etc.).
// Use a simple connect call and provide a sensible default for local development.
const mongoURL = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/apnashow'

mongoose.connect(mongoURL)
	.then(() => console.log('MongoDB connected'))
	.catch((err) => console.error('MongoDB connection error:', err))
