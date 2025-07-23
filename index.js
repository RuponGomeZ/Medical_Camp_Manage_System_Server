require('dotenv').config();
const jwt = require('jsonwebtoken')
const express = require("express");
const cors = require('cors')
const app = express();
const port = process.env.PORT || 5000;

const corsOption = {
    origin: ['http://localhost:5173'],
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

        app.post('/jwt', async (req, res) => {
            const email = req.body
            const token = jwt.sign(email, process.env.ACCESS_TOKEN, {
                expiresIn: '365d',
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
            const result = await userCollection.find().toArray()
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
            const result = await campCollection.find().toArray()
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
            const isExist = await registerCollection.findOne(query)
            if (isExist) {
                return res.send({ message: "You have already applied to join this camp!" })
            }

            const result = await registerCollection.insertOne(data);
            res.send(result)
        })


        app.get('/registrations/:email', async (req, res) => {

            const email = req.params.email;
            const campId = req.query.campId;
            const query = { participantEmail: (email), campId }
            const isExist = await registerCollection.find(query).toArray()
            console.log(isExist);

            res.send(isExist)
        })

        app.patch('/registrations-participantCount/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            let updatedDoc = {
                $inc: { participantCount: 1 }
            }
            const result = await campCollection.updateOne(query, updatedDoc)
            res.send(result)
        })

        app.get('/manage-camp/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { organizerEmail: email }
            const result = await campCollection.find(query).toArray()
            res.send(result)
            console.log(result);
        })

        app.delete('/delete-camp/:campId', verifyToken, async (req, res) => {
            const id = req.params.campId;
            const query = { _id: new ObjectId(id) }
            const result = await campCollection.deleteOne(query)
            res.send(result)
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