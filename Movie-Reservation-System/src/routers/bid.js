const express = require('express')
const router = new express.Router()
const axios = require('axios')
const qrcode = require('qrcode')
// var LocalStorage = require('node-localstorage').LocalStorage,
// localStorage = new LocalStorage('./scratch');

// Simple unique booking id generator
function generateBookingId () {
    const now = Date.now().toString(36)
    const rand = Math.random().toString(36).slice(2, 8)
    return `APN-${now}-${rand}`.toUpperCase()
}

// Allow visiting /pay directly to generate a ticket locally
router.get('/pay', (req, res) => {
    const bookingId = generateBookingId()
    req.session.lastBookingId = bookingId
    return res.render('ticket', {
        bookingId,
        userdata: req.session.user,
        loginsuccess: req.session.successlogin,
        loginpage: req.session.loginpage,
        error: req.session.error
    })
})

// Cash payment - direct to ticket printing
router.post('/pay/cash', async (req, res) => {
    const userdata = req.session.user
    if (userdata != undefined) {
        const bookingId = generateBookingId()
        req.session.lastBookingId = bookingId
        req.session.paymentMethod = 'cash'
        req.session.paymentStatus = 'completed'
        
        return res.render('ticket', {
            bookingId,
            userdata: req.session.user,
            loginsuccess: req.session.successlogin,
            loginpage: req.session.loginpage,
            error: req.session.error,
            paymentMethod: 'cash',
            paymentStatus: 'completed'
        })
    } else {
        return res.status(400).send("You are not authorized")
    }
})

// Online payment - generate QR code
router.post('/pay/online', async (req, res) => {
    const userdata = req.session.user
    if (userdata != undefined) {
        const bookingId = generateBookingId()
        req.session.lastBookingId = bookingId
        req.session.paymentMethod = 'online'
        req.session.paymentStatus = 'pending'
        
        // Generate QR code for payment
        const paymentData = {
            bookingId: bookingId,
            amount: req.body.paymentprice,
            user: userdata[0].Fname + " " + userdata[0].Lname,
            timestamp: new Date().toISOString()
        }
        
        try {
            const qrCodeDataURL = await qrcode.toDataURL(JSON.stringify(paymentData))
            
            return res.render('payment-qr', {
                bookingId,
                userdata: req.session.user,
                loginsuccess: req.session.successlogin,
                loginpage: req.session.loginpage,
                error: req.session.error,
                qrCode: qrCodeDataURL,
                paymentData: paymentData
            })
        } catch (err) {
            console.error('QR Code generation failed:', err)
            return res.status(500).send({ error: 'QR Code generation failed' })
        }
    } else {
        return res.status(400).send("You are not authorized")
    }
})

// Counter person verification for online payments
router.get('/verify-payment/:bookingId', (req, res) => {
    const bookingId = req.params.bookingId
    if (req.session.lastBookingId === bookingId && req.session.paymentMethod === 'online') {
        return res.render('counter-verification', {
            bookingId,
            userdata: req.session.user,
            loginsuccess: req.session.successlogin,
            loginpage: req.session.loginpage,
            error: req.session.error
        })
    } else {
        return res.status(404).send("Payment not found")
    }
})

// Counter person confirms payment
router.post('/confirm-payment', (req, res) => {
    const bookingId = req.body.bookingId
    if (req.session.lastBookingId === bookingId) {
        req.session.paymentStatus = 'confirmed'
        return res.redirect('/ticket')
    } else {
        return res.status(400).send("Invalid booking ID")
    }
})

// Legacy payment route for backward compatibility
router.post('/pay', async (req, res) => {
    const amount = req.body.paymentprice;
    const API_KEY = process.env.API_KEY
    const AUTH_KEY = process.env.AUTH_KEY
    // default to sandbox unless explicitly disabled
    const SANDBOX = (process.env.INSTA_SANDBOX || 'true').toLowerCase() !== 'false'
    const baseUrl = SANDBOX ? 'https://test.instamojo.com/api/1.1' : 'https://www.instamojo.com/api/1.1'
   
    const userdata = req.session.user
    if (userdata!= undefined) {
        // If API keys are missing locally, simulate a successful payment and show ticket
        if (!API_KEY || !AUTH_KEY) {
            const bookingId = generateBookingId()
            req.session.lastBookingId = bookingId
            return res.render('ticket', {
                bookingId,
                userdata: req.session.user,
                loginsuccess: req.session.successlogin,
                loginpage: req.session.loginpage,
                error: req.session.error
            })
        }
        
        const hostBase = `${req.protocol}://${req.get('host')}`
        const payload = {
            purpose: 'Movie Payment',
            amount: amount,
            buyer_name: userdata[0].Fname + " " + userdata[0].Lname,
            redirect_url: hostBase + '/orders',
            email: userdata[0].Email,
            phone: '9876543210',
            send_email: false,
            webhook: hostBase + '/orders',
            send_sms: false,
            allow_repeated_payments: false
        }

        try {
            const response = await axios.post(baseUrl + '/payment-requests/', payload, {
                headers: {
                    'X-Api-Key': API_KEY || '',
                    'X-Auth-Token': AUTH_KEY || '',
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            })

            const responseData = response.data
            if (responseData && responseData.payment_request && responseData.payment_request.longurl) {
                return res.redirect(responseData.payment_request.longurl)
            }

            return res.status(500).send({ error: 'Invalid response from payment provider', details: responseData })
        } catch (err) {
            return res.status(500).send({ error: 'Payment creation failed', details: err && err.toString ? err.toString() : err })
        }
    }
});


module.exports = router