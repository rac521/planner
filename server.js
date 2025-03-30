const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// MySQL connection
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

let db;
(async () => {
    try {
        db = await mysql.createPool(dbConfig);
        console.log('Connected to MySQL');
    } catch (err) {
        console.error('MySQL connection error:', err);
        process.exit(1);
    }
})();

// Routes


app.get('/', (req, res) => {
    res.render('index', { userId: req.session.userId || null });
});


// app.get('/login', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'login.html'));
// });

app.get('/login', (req, res) => {
    res.render('login'); // Render the login.ejs page
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

// Handle signup
app.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.execute(
            "INSERT INTO Users (username, email, password) VALUES (?, ?, ?)",
            [username, email, hashedPassword]
        );

        console.log("User Registered:", username);
        res.redirect('/login');
    } catch (err) {
        console.error("Error in Signup:", err);
        res.status(500).json({ error: 'Error registering user' });
    }
});

// Handle login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log("req",req.body);
        // Fetch user from database
        const [users] = await db.execute(
            "SELECT * FROM Users WHERE email = ?", [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = users[0];

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user.user_id;
        req.session.username = user.username;
        console.log("req.session.userId",req.session.userId);
        console.log("User Logged In:", user.username);
        res.redirect('/startplanning');
    } catch (err) {
        console.error("Error in Login:", err);
        res.status(500).json({ error: 'Error logging in' });
    }
});


// app.get('/home', (req, res) => {
//     // if (!req.session.userId) {
//     //     return res.redirect('/login'); // Redirect if not logged in
//     // }
//     res.render('home');
//     res.redirect('/startplanning');
// });

// Dashboard Route (After Login)
app.get('/dashboard', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    res.render('dashboard', { username: req.session.username });
});


// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
}); 

app.get('/startplanning', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'startplanning.html'));
});

app.post('/save-itinerary', async (req, res) => {
    try {
        console.log("save-itinerary");
        const { itinerary, tripId } = req.body;
        const userId = req.session.userId;
        console.log("userId-save-itinerary",userId);
        console.log("itinerary",itinerary);
        console.log("tripId",tripId);
        for (const day of itinerary) {
            const orderedActivities = day.activities.join(',');

            // Insert or update the saved itinerary order

            await db.execute(
                        "INSERT INTO saveditinerary (trip_id, day_number,activity_order,user_id) VALUES (?, ?, ?, ?)",
                        [tripId, day.day_number,day.activities,userId]
                    );

            // await db.execute(`
            //     INSERT INTO SavedItinerary (trip_id, day_number, activity_order)
            //     VALUES (?, ?, ?, ?)
            //     ON DUPLICATE KEY UPDATE activity_order = VALUES(activity_order)
            // `, [tripId, day.day_number, orderedActivities]);
        }

        res.json({ success: true, message: "Itinerary saved successfully!" });

    } catch (err) {
        console.error("Error saving itinerary:", err);
        res.status(500).json({ error: "Error saving itinerary" });
    }
});


app.post('/create', async (req, res) => {
    try {
        const { tripName, destination, startDate, endDate } = req.body;

        console.log("Form Data Received:", req.body);  // Debugging

        await db.execute(
            "INSERT INTO Trips (trip_name, destination, start_date, end_date) VALUES (?, ?, ?, ?)",
            [tripName, destination, startDate, endDate]
        );

        console.log("Trip Inserted Successfully"); // Debugging

        res.redirect(`/${destination}`);

    } catch (err) {
        console.error("Error Creating Trip:", err);
        res.status(500).json({ error: 'Error creating trip' });
    }
});



app.get('/rajasthan', async (req, res) => {
    try {
        const [tripRows] = await db.execute(
            "SELECT * FROM Trips WHERE destination = 'rajasthan' ORDER BY start_date DESC LIMIT 1"
        );

        console.log("Fetched Trip Data:", tripRows); // Debugging

        if (tripRows.length === 0) {
            return res.render('rajasthan', { trip: null, itinerary: [] });
        }

        const trip = tripRows[0];
        const [itineraryRows] = await db.execute(
            "SELECT * FROM Itineraries WHERE trip_id = ?", [trip.id]
        );

        console.log("Fetched Itinerary Data:", itineraryRows); // Debugging

        res.render('rajasthan', { trip, itinerary: itineraryRows });

    } catch (err) {
        console.error("Error Fetching Rajasthan Data:", err);
        res.status(500).json({ error: 'Error fetching Rajasthan data' });
    }
});





// Route for specific trip names
app.post('/update-itinerary', async (req, res) => {
    try {
        const { itinerary, tripId } = req.body;
        const userId = req.session.userId;
        // console.log("request",req);
        // console.log("session",req.session);

        for (let day of itinerary) {
            console.log("day.activies",day.activities);
            console.log("tripId",tripId);
            console.log("day.day_number",day.day_number);
            console.log("userId-update-itinerary",userId);

            await db.execute(
                "UPDATE SavedItinerary SET activity_order = ? WHERE trip_id = ? AND day_number = ? AND user_id = ?",
                [day.activities, tripId, day.day_number,userId]
            );

            // await db.execute(
            //     "INSERT INTO SavedItinerary (trip_id, user_id, day_number,activity_order) VALUES (?, ?, ?, ?)",
            //     [tripId,userId, day.day_number,day.activities]
            // );
         }
        
        res.json({ message: 'Itinerary updated successfully!' });
    } catch (err) {
        console.error("Error updating itinerary:", err);
        res.status(500).json({ error: 'Failed to update itinerary' });
    }
});

app.get('/saved-itinerary', async (req, res) => {
    res.redirect('/rajasthan'); // Modify based on the actual trip data
});



app.get('/kerala', async (req, res) => {
    try {
        const [tripRows] = await db.execute(
            "SELECT * FROM Trips WHERE destination = 'kerala'"
        );

        console.log("Fetched Kerala Trip Data:", tripRows);  // Debugging log

        if (tripRows.length === 0) {
            return res.status(404).render('kerala', { trip: null, itinerary: [] });
        }

        const trip = tripRows[0];

        console.log("Trip Start Date:", trip.start_date); // Check if start_date is null or incorrect

        const [itineraryRows] = await db.execute(
            "SELECT * FROM Itineraries WHERE trip_id = ?", [trip.id]
        );

        res.render('kerala', { trip, itinerary: itineraryRows });

    } catch (err) {
        console.error("Error fetching Kerala data:", err);
        res.status(500).json({ error: 'Error fetching Kerala data', details: err.message });
    }
});



app.get('/api/trip', async (req, res) => {
    let tripId = req.query.tripId;
    let destination = req.query.destination; // Get destination from the request

    try {
        if (!tripId && destination) {
            // Select the latest trip for the given destination
            const [latestTrip] = await db.execute(
                `SELECT id FROM Trips WHERE destination = ? ORDER BY start_date DESC LIMIT 1`, 
                [destination]
            );
            if (latestTrip.length > 0) tripId = latestTrip[0].id;
        }

        if (!tripId) {
            return res.status(404).json({ error: 'No trips found' });
        }

        const [tripRows] = await db.execute(`SELECT * FROM Trips WHERE id = ?`, [tripId]);
        const [itineraryRows] = await db.execute(`SELECT * FROM Itineraries WHERE trip_id = ?`, [tripId]);

        res.json({
            trip: tripRows[0] || {},
            itinerary: itineraryRows.length ? itineraryRows : []
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching trip data' });
    }
});



// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});