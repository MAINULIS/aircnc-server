const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const morgan = require('morgan')
const port = process.env.PORT || 5000

// middleware
// will solve deployment of cors interceptor
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(morgan('dev'))

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9fxhf2q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

// validate jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({
      error: true, message: "Unauthorized Access"
    })
  }
  const token = authorization.split(' ')[1];
  console.log(token);
  // verify token
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({
        error: true, message: "Unauthorized Access"
      })
    }
    req.decoded = decoded;
    next()
  })
}

async function run() {
  try {
    // await client.connect(); //comment this to not face deployment problem
    const usersCollection = client.db('aircncDB').collection('users')
    const roomsCollection = client.db('aircncDB').collection('rooms')
    const bookingsCollection = client.db('aircncDB').collection('bookings')

    // generate jwt
    app.post('/jwt', (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '3h' });
      res.send({ token });
    })


    //1. user related apis
    // save user email and role in db when login or sinUp
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      }
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    })

    // get user
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    })

    // 2. room apis
    // save a room in  database
    app.post('/rooms', async (req, res) => {
      const room = req.body;
      const result = await roomsCollection.insertOne(room);
      res.send(result);
    })
    // get a single room data by id
    app.get('/room/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query);
      res.send(result);
    })

    // get all posted room for host
    app.get('/rooms/:email', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      console.log(decodedEmail);
      const email = req.params.email;
      if(email !== decodedEmail){
        return res.status(403).send({
          error:true, message: "Forbidden Access"
        })
      }
      const query = {'host.email': email };
      const result = await roomsCollection.find(query).toArray();
      res.send(result);
    })
    // get all room data
    app.get('/rooms', async (req, res) => {
      const result = await roomsCollection.find().toArray();
      res.send(result);
    })

    // delete posted room by id
    app.delete('/rooms/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.deleteOne(query);
      res.send(result)
    })
    // update booking room status
    app.patch('/rooms/status/:id', async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          booked: status,
        }
      }
      const update = await roomsCollection.updateOne(query, updateDoc);
      res.send(update)
    })

    // 3. booking related apis
    // save booking info in db
    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    })

    // get booking data for guest by email
    app.get('/bookings', async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([])
      }
      const query = { 'guest.email': email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    })
    // get booking data for host by email
    app.get('/bookings/host', async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([])
      }
      const query = { host: email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    })

    // delete a booking
    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('AirCNC Server is running..')
})

app.listen(port, () => {
  console.log(`AirCNC is running on port ${port}`)
})