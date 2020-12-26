

const express = require('express')
const WebSocket = require('ws')
const http = require('http')
const ViGEm = require('./ViGEm')

// Create Express app
const app = express()
const port = 3000

// Create HTTP server
const server = http.createServer(app)

// Create WebSocket server
const wss = new WebSocket.Server({ server })

// Serve static files
app.use(express.static('public'))

// Create virtual gamepad client
let vigem = new ViGEm()

// Accept incoming WebSocket connections
let lastID = 0
wss.on('connection', ws => {

    // Say hello
    ws.send('Hello')

    // Add virtual controller
    let deviceID = lastID++
    console.log(`[${deviceID}] Connected`)
    let x360 = vigem.createController()

    // Listen for incoming messages
    ws.on('message', msg => {

        // Decode it
        let json = JSON.parse(msg)

        // Pass values to the controller
        x360.update(json)

    })

    // Listen for close event
    ws.on('close', e => {

        // Remove virtual device
        console.log(`[${deviceID}] Disconnected`)
        x360.remove()

    })

})

// Start the server
server.listen(port, () => {

    // Print out listening addresses
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    let count = 0
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {

            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {

                // Print out address
                if (count == 0) console.log("Finger gamepad has started. Open your phone's browser to this address:")
                count += 1
                console.log('http://' + net.address + ':' + port)

            }

        }
    }

    if (count == 0)
        console.log("Finger Gamepad has started, but we're unable to find your computer's IP address.")

})