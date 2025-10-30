// /Users/harsh/mongodb/bin/mongod.exe --dbpath=/Users/harsh/mongodb-data
const express = require('express')
require('./db/mongoose')
const path = require('path')
const http = require('http')
const hbs = require('hbs')
const socketio = require('socket.io')
const bodyParser = require("body-parser")
var expressSession = require('express-session');


// Image
// const multer = require('multer')
// const upload = multer({
//     dest: 'images'
// })


// Routers
const userRouter = require('./routers/user')
const bid = require('./routers/bid')

// Models
const User = require('./models/user')
const Movies = require('./models/movies')

// App
const app = express()
app.use(express.json())
// Port precedence: PORT env var -> CLI arg (node src/app.js 3000 or npm start -- 3000) -> default 3000
const port = process.env.PORT || process.argv[2] || 3000

// create server
const server = http.createServer(app)
const io = socketio(server)


// Define paths for Express config
const publicDirectionPath = path.join(__dirname, '../public')
const viewPath = path.join(__dirname,'../templates/views')
const partialsPath = path.join(__dirname, '../templates/partials')

//Setup handlebars engine and views location
app.set('view engine', 'hbs')
app.use(bodyParser.urlencoded({ extended: true })); 
app.set('views', viewPath)
hbs.registerPartials(partialsPath)

// Setup static directory to serve
app.use(express.static(publicDirectionPath))


// express session
app.use(expressSession({secret: 'max', saveUninitialized: false, resave: false}));

// Router connection
app.use(userRouter);
app.use(bid);



// 

app.get('/', async (req, res) => {
    req.session.loginpage = false
    // Prefer showing specific current movies on home page
    const preferredNames = ['og', 'shinshan', 'rajasaab']
    let movies = await Movies.find({ movieName: { $in: preferredNames } })

    // Fallback if DB doesn't have them yet
    if (!movies || movies.length === 0) {
        movies = [
            { movieName: 'og', like: 90, review: 'Hot pick', language: 'English', genre: 'action', dateRelease: '2025-09-01' },
            { movieName: 'shinshan', like: 85, review: 'Family favorite', language: 'Japanese', genre: 'comedy', dateRelease: '2025-08-15' },
            { movieName: 'rajasaab', like: 78, review: 'Spine-chilling', language: 'Hindi', genre: 'horror', dateRelease: '2025-07-30' }
        ]
    }
    res.render('index', {
        userdata: req.session.user,
        loginsuccess: req.session.successlogin,
        loginpage: req.session.loginpage,
        error: req.session.error,
        movies
    })
})

app.get('/offer', (req, res) => {
    res.render('offer',{
        loginsuccess: req.session.successlogin,
        loginpage: req.session.loginpage,
        error: req.session.error
    })
})

app.get('/faq', (req, res) => {
    res.render('faq', {
        userdata: req.session.user,
        loginsuccess: req.session.successlogin,
        loginpage: req.session.loginpage,
        error: req.session.error
    })
})

app.get('/movies', async (req, res) => {
    req.session.loginpage = false
    let movies 
    const filter = Object.keys(req.query)
    if (Object.keys(req.query)[0] === "search") {
        movies = await Movies.find({ movieName: Object.values(req.query) })
    }else{
        
        if (filter.length <1) {
            // Prefer showing the updated movies set on the main listing
            const preferredNames = ['og', 'shinshan', 'rajasaab']
            movies = await Movies.find({ movieName: { $in: preferredNames } })
            if (!movies || movies.length === 0) {
                movies = await Movies.find({})
            } else {
                // sort by preferred order
                const order = new Map(preferredNames.map((n, i) => [n, i]))
                movies.sort((a, b) => (order.get((a.movieName||'').toLowerCase()) ?? 999) - (order.get((b.movieName||'').toLowerCase()) ?? 999))
            }
        } else {
            movies = await Movies.find({ genre: filter })
            language = await Movies.find({ language: filter })
            if (language.length > 0) {
                movies = [...language]
            }
        }
    }
    
    res.render('movies', {
        userdata: req.session.user,
        loginsuccess: req.session.successlogin,
        loginpage: req.session.loginpage,
        error: req.session.error,
        movies,
        filter
    })
})

app.get('/movies/seats', async (req, res) => {
    res.render('seats', {
        userdata: req.session.user,
        loginsuccess: req.session.successlogin,
        loginpage: req.session.loginpage,
        error: req.session.error
    })
})


// console.log(req.session.movieName);
app.get('/movies/*', async (req, res) => {
    try {
        res.render('timing', {
            
        })
    } catch (e) {
        res.status(400).send(e)
    }
})

// app.post('/movies', async (req, res) => {
//     const movies = new Movies(req.body)
//     try {
//         await movies.save()
//         res.status(201).send({ movies })
//     } catch (e) {
//         res.status(400).send(e)
//     }
// })

// app.post('/upload', upload.single('upload'), (req, res) => {
//     res.send()
// })

app.get('/orders', (req, res) => {
    if (req.session.successlogin) {
        res.render('orders', {
                
        })
    } else {
        res.status(400).send("You are not authorize")
    }

})


// Ticket page (after successful seat selection/payment)
app.get('/ticket', (req, res) => {
    if (req.session.successlogin) {
        res.render('ticket', {
            userdata: req.session.user,
            loginsuccess: req.session.successlogin,
            loginpage: req.session.loginpage,
            error: req.session.error
        })
    } else {
        res.redirect('/login')
    }
})


app.get('/help', (req, res) => {
    res.render('help',{
        
    })
})

app.get('*', (req,res) => {
    res.render('404',{
      
    })
})


// app.listen(port,()=> {
//     console.log('Server is up on port '+port+'.')
// })


let count = 0
io.on('connection', (socket)=>{
    console.log('New WebSocket connection')

    socket.emit('countUpdated',count)
})

server.listen(port, () => {
    const addr = `http://localhost:${port}`
    console.log(`Server is up on port ${port}!`)
    console.log(`Local: ${addr}`)

    // print LAN IP addresses for direct access from other devices on the same network
    try {
        const os = require('os')
        const ifaces = os.networkInterfaces()
        Object.keys(ifaces).forEach(name => {
            ifaces[name].forEach(iface => {
                if (iface.family === 'IPv4' && !iface.internal) {
                    console.log(`LAN:   http://${iface.address}:${port}`)
                }
            })
        })
    } catch (e) {
        // ignore if os/network info can't be read
    }

    if (!process.env.PORT && process.argv[2] === undefined) {
        console.log('Tip: to choose a different port run: node src/app.js 4000  OR  npm start -- 4000')
    }
})
