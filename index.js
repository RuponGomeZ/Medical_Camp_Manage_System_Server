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


const { MongoClient, ServerApiVersion } = require('mongodb');
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
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const userCollection = client.db('hospitalCampManagement').collection("users")

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



        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray()
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