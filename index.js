require('dotenv').config();
const jwt = require('jsonwebtoken')
const express = require("express");
const cors = require('cors')
const app = express();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

const corsOption = {
    origin: ['http://localhost:5173', 'https://medical-camp-management-dda87.web.app'],
    credentials: true,
    optionSuccessStatus: 200,
}

const cookieParser = require('cookie-parser')

app.use(cookieParser())
app.use(cors(corsOption));
app.use(express.json());

const verifyToken = (req, res, next) => {
    const token = req.cookies?.token
    if (!token) return res.status(401).send({ message: 'Unauthorized access' })
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded
        next()
    })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.u6wg9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const userCollection = client.db('hospitalCampManagement').collection("users")
        const campCollection = client.db('hospitalCampManagement').collection('camps')
        const registerCollection = client.db('hospitalCampManagement').collection('registrations')
        const feedBackCollection = client.db('hospitalCampManagement').collection('feedBacks')
        const orderCollection = client.db('hospitalCampManagement').collection('orders')

        app.post('/jwt', async (req, res) => {
            const email = req.body
            const token = jwt.sign(email, process.env.ACCESS_TOKEN, {
                expiresIn: '7d',
            })
            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
            })
                .send({ success: true })
        })


        app.get('/logout', verifyToken, async (req, res) => {
            res.clearCookie('token', {
                secure: true,
                sameSite: 'none'
            })
                .send({ success: true })
        })


        const verifyOrganizer = async (req, res, next) => {
            const email = req.user.email;
            const query = { email };
            const result = await userCollection.findOne(query)
            if (!result || result?.role !== 'organizer') {
                return res.status(403).send({ message: 'Forbidden access! Organizer only action!' })
            }
            next()
        }

        app.post('/users', async (req, res) => {
            const email = req.body.email;
            const data = req.body
            const query = { email }
            const existingUser = await userCollection.findOne(query)
            if (!existingUser) {
                const result = await userCollection.insertOne({ ...data, role: 'participant' })
                res.send(result)
            } else {
                res.send({ message: "User already exist" })
            }
        })


        app.get('/users', async (req, res) => {
            try {
                const email = req.query.email;

                if (email) {
                    const result = await userCollection.findOne({ email });
                    return res.send(result); // send single user
                }

                const result = await userCollection.find().toArray(); // send all users
                res.send(result);
            } catch (error) {
                console.error('Error fetching users:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const result = await userCollection.findOne(query)
            res.send(result)
        })

        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: data
            }
            const result = await userCollection.updateOne(query, updatedDoc)
            res.send(result)
        })

        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const result = await userCollection.findOne(query)
            res.send(result)
        })

        app.post('/addCamp', async (req, res) => {
            const data = req.body;
            const result = await campCollection.insertOne(data);
            res.send(result)
        })

        app.get('/camps', async (req, res) => {
            const search = req.query.search || '';
            const sort = req.query.sort || '';
            const query = {
                $or: [
                    { campName: { $regex: search, $options: 'i' } },
                    { location: { $regex: search, $options: 'i' } },
                    { date: { $regex: search, $options: 'i' } }
                ]
            }
            let sortOption = {};

            if (sort === 'most-registered') {
                sortOption = { participantCount: -1 }
            }

            if (sort === "camp-fees") {
                sortOption = { campFees: 1 }
            }

            if (sort === "camp-name") {
                sortOption = { campName: 1 }
            }


            const result = await campCollection.find(query).sort(sortOption).toArray()
            res.send(result)
        })

        app.get('/camp-details/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await campCollection.findOne(query)
            res.send(result)
        })


        app.post('/registrations/:email', async (req, res) => {
            const data = req.body;
            const email = req.params.email;
            const campId = data.campId
            const query = { participantEmail: (email), campId }
            const isExist = await registerCollection.find(query).toArray()
            if (isExist.length > 0) {
                return res.send({ message: "You have already applied to join this camp!" })
            }

            const ownCamp = { organizerEmail: (email), campId }
            const checkOwnCamp = await registerCollection.find(ownCamp).toArray()
            if (checkOwnCamp.length > 0) {
                return res.send({ message: "You cant apply to join your own camp" })
            }

            const result = await registerCollection.insertOne(data);
            res.send(result);
        })


        app.get('/registrations/:email', async (req, res) => {

            const email = req.params.email;
            const campId = req.query.campId;
            const query = { participantEmail: (email), campId }
            const result = await registerCollection.find(query).toArray()

            res.send(result)
        })

        app.patch('/registrations-participantCount/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            let updatedDoc = {
                $inc: { participantCount: 1 }
            }
            const result = await campCollection.updateOne(query, updatedDoc)
            res.send(result);
        })

        // app.patch('/status-update', verifyToken, verifyOrganizer, async (req, res) => {
        //     const id = req.query.id;
        //     const status = req.query.status;
        //     const userEmail = req.user.email;
        //     const query = { _id: new ObjectId(id) }
        //     const checkSameOrganizer = await registerCollection.findOne(query)

        //     if (checkSameOrganizer.organizerEmail !== userEmail) {
        //         return res.send({ message: "Unauthorized Access!" })
        //     }
        //     const updatedDoc = {
        //         $set: {
        //             confirmationStatus: status
        //         }
        //     }
        //     const result = await registerCollection.updateOne(query, updatedDoc)
        //     res.send(result)
        // })


        app.patch('/order-confirm', verifyToken, verifyOrganizer, async (req, res) => {
            try {
                const id = req.query.id;
                const status = req.query.status;
                const userEmail = req.user.email;

                // First find the registration to verify organizer
                const registrationQuery = { _id: new ObjectId(id) };
                const registration = await registerCollection.findOne(registrationQuery);

                if (!registration) {
                    return res.status(404).send({ message: "Registration not found" });
                }

                if (registration.organizerEmail !== userEmail) {
                    return res.status(403).send({ message: "Unauthorized Access!" });
                }

                // Update both registration and order collections
                const updatedDoc = {
                    $set: { confirmationStatus: status }
                };

                // Update registration
                const regResult = await registerCollection.updateOne(
                    registrationQuery,
                    updatedDoc
                );

                // Update corresponding order
                const orderQuery = { registrationId: (id) };
                const orderResult = await orderCollection.updateOne(
                    orderQuery,
                    updatedDoc
                );

                res.send({
                    registrationModified: regResult.modifiedCount,
                    orderModified: orderResult.modifiedCount
                });
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Server error" });
            }
        });

        app.delete('/cancel-registration', verifyToken, verifyOrganizer, async (req, res) => {
            const id = req.query.id;
            const userEmail = req.user.email;
            const query = { _id: new ObjectId(id) }
            const registration = await registerCollection.findOne(query)
            if (!registration) {
                return res.status(404).send({ message: "Registration not found" });
            }

            if (registration.organizerEmail !== userEmail) {
                return res.send({ message: "Unauthorized Access!" })
            }

            const result = await registerCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/manage-camp/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { organizerEmail: email }
            const result = await campCollection.find(query).toArray()
            res.send(result)
        })

        app.delete('/delete-camp/:campId', verifyToken, async (req, res) => {
            const id = req.params.campId;
            const query = { _id: new ObjectId(id) }
            const result = await campCollection.deleteOne(query);
            res.send(result);
        })

        app.patch('/update-camp/:campId', verifyToken, async (req, res) => {
            const id = req.params.campId;
            const query = { _id: new ObjectId(id) }
            const data = req.body;
            const updatedDoc = {
                $set: data
            }
            const result = await campCollection.updateOne(query, updatedDoc)
            res.send(result)
        })

        app.get('/manage-registered-camps', verifyToken, verifyOrganizer, async (req, res) => {
            const email = req.user.email;
            const query = { organizerEmail: email }
            const result = await registerCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/registered-camps', verifyToken, async (req, res) => {
            const email = req.user.email;
            const query = { participantEmail: email }
            const result = await registerCollection.find(query).toArray()
            res.send(result)
        })

        app.delete('/cancel/:id', verifyToken, async (req, res) => {
            const email = req.user.email;
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const findCamp = await registerCollection.findOne(query)
            if (findCamp.participantEmail !== email) {
                return res.send({ message: "Unauthorized Access" })
            }
            const result = await registerCollection.deleteOne(query)
            res.send(result)
        })

        // Feedbacks

        app.post('/feedback', verifyToken, async (req, res) => {
            // TODO
            const feedback = req.body;
            const result = await feedBackCollection.insertOne(feedback)
            res.send(result)
        })

        app.get('/feedback', async (req, res) => {
            const result = await feedBackCollection.find().toArray()
            res.send(result)
        })

        // Payment intent
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { campId } = req.body
            const camp = await campCollection.findOne({ _id: new ObjectId(campId) })
            if (!camp) {
                return res.status(400).send({ message: "Camp not found" })
            }
            const price = camp.campFees * 100
            const { client_secret } = await stripe.paymentIntents.create({
                amount: price,
                currency: 'usd',
                automatic_payment_methods: {
                    enabled: true,
                },
            })
            res.send({ clientSecret: client_secret });
        })

        app.post('/order', verifyToken, async (req, res) => {
            const orderInfo = req.body
            const result = await orderCollection.insertOne(orderInfo)
            res.send(result)
        })

        app.patch('/payment-status-update', verifyToken, async (req, res) => {
            const id = req.query.id;
            const status = req.query.status
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paymentStatus: status
                }
            }
            const result = await registerCollection.updateOne(query, updatedDoc)
            res.send(result)
        })

        app.get('/payment-status-update', verifyToken, async (req, res) => {
            const email = req.user.email;
            const query = { 'customer.email': email }
            const result = await orderCollection.find(query).toArray()
            res.send(result)
        })

        // app.patch('/order-confirm', verifyToken, verifyOrganizer, async (req, res) => {
        //     const id = req.query.id;
        //     const status = req.query.status;
        //     const query = { registrationId: new ObjectId(id) }

        //     const updatedDoc = {
        //         $set: {
        //             confirmationStatus: status
        //         }
        //     }
        //     const result = await orderCollection.updateOne(query, updatedDoc)
        //     res.send(result)
        // })

    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('server is running')
})

app.listen(port, () => {
    console.log(`Server is rolling in ${port}`);
})