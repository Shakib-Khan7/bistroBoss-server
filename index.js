const express = require('express');
const app = express()
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const cors = require('cors');
const port = process.env.PORT || 5000
//middlewares

app.use(cors())

app.use(express.json())





const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pqiaide.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    const menuCollection = client.db("bistroDB").collection('menu')
    const userCollection = client.db("bistroDB").collection('users')
    const reviewsCollection = client.db("bistroDB").collection('reviews')
    const cartCollection = client.db("bistroDB").collection('carts')
    const paymentCollection = client.db("bistroDB").collection('payments')


    //jwt related api

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '10h'
      });
      res.send({ token })
    })

    //middleawares
    const verifyToken = (req,res,next)=>{
      console.log('inside verify token',req.headers);
      if(!req.headers.authorization){
        return res.status(401).send({message : 'unathorized access'})

      }
      const token = req.headers.authorization.split(' ')[1];
      if(!token){
       return res.status(401).send({message : 'no token'})
      }
      jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(error,decoded)=>{
        if(error){
          return res.status(401).send({message : 'forbidden access'})
        }
        req.decoded = decoded
        next()

      })

      
    }
    //use verify admin after verify token
    const verifyAdmin = async (req,res,next)=>{
      const email = req.decoded.email;
      const query = {email : email}
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'admin'
      if(!isAdmin){
        return res.status(403).send({message : 'Forbiden acces'})
      }
      next()
    }




    //users related api

    app.get('/users', verifyToken,verifyAdmin, async (req, res) => {
      
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    app.get('/user/admin/:email',verifyToken,async(req,res)=>{
      const email = req.params.email
      if(email !== req.decoded.email){
        return res.status(403).send({message : 'unathorized access'})
      }
      const query = {email : email};
      const user = await userCollection.findOne(query)
      let isAdmin = false;
      if(user){
        isAdmin = user?.role === 'admin'
      }
      res.send({isAdmin});
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      //insert email if user doesnot exist
      //can do many ways
      //1.Email unique,upsert,simple checking

      const query = { email: user.email }
      console.log(query);
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: "user already exists" })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })




    app.delete('/users/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })

    app.patch('/users/admin/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(query, updatedDoc)
      res.send(result)

    })



    //menu related api

    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray()
      res.send(result)
    })
    app.patch('/menu/:id',async(req,res)=>{
      const item =req.body;
      const id = req.params.id
      const query = {_id : new ObjectId(id)}
      const updatedDoc = {
        $set :{
          name : item.name,
          category : item.category,
          price : item.price,
          recipe : item.recipe,
          image : item.image
        }
      }
      const result = await menuCollection.updateOne(query,updatedDoc)
      res.send(result)
    })
    app.post('/menu',verifyToken,verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item)
      res.send(result)
    })

    app.get('/menu/:id',async(req,res)=>{
      const id = req.params.id
      const query = {_id : new ObjectId(id)}
      const result = await menuCollection.findOne(query)
      res.send(result)
    })

    app.delete('/menu/:id',verifyToken,verifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })
    app.get('/reviews', async (req, res) => {
      
      const result = await reviewsCollection.find().toArray()
      res.send(result)
    })

    //cart collection

    app.get('/carts', verifyToken, async (req, res) => {
      const email = req.query.email
      const query = { email: email }
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem)
      res.send(result)
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })

    //payment intent

    app.post('/create-payment-intent',async(req,res)=>{
      const {price} = req.body
      const amount = parseInt(price*100)
      console.log(amount,'amount inisde intentt');
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency : 'usd',
        payment_method_types : ['card']
      })

      res.send({
        clientSecret : paymentIntent.client_secret
      })
    })

    app.post('/payments',async(req,res)=>{
      const payment = req.body
      const paymentResult = await paymentCollection.insertOne(payment)

      //carefully delte eaxh itme form cart
      console.log('payment info',payment);
      const query = {_id : {
        $in : payment.cartIds.map(id=>new ObjectId(id))
      }};
      const deleteResult = await cartCollection.deleteMany(query)
      res.send({paymentResult,deleteResult})

    })

    app.get('/history/:email',verifyToken,async(req,res)=>{
      const query = {email : req.params.email}
      if(req.params.email !== req.decoded.email){
       return res.status(403).send('Forbidden access')
      }
      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })

    //stats or analytics
    app.get('/admin-stats',verifyToken,verifyAdmin,async(req,res)=>{
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      //this is not the best way
      // const payments = await paymentCollection.find().toArray()
      // const revenue = payments.reduce((total,payment)=>total+payment.price,0)
      const result = await paymentCollection.aggregate([
        {
          $group : {
            _id : null,
            totalRevenue : {
              $sum : '$price'
            }
          }
        }
      ]).toArray()

      const revenue = result.length > 0 ? result[0].totalRevenue : 0

      res.send({
        users,menuItems,orders,revenue
      })
    })


    app.get('/order-stats', async (req, res) => {
      const result = await paymentCollection.aggregate([
        {
          $unwind: "$menuItemIds"
        },
        {
          $lookup: {
            from: 'menu',
            let: { menuItemId: "$menuItemIds" }, // pass menuItemIds as a variable
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", { $toObjectId: "$$menuItemId" }] // Convert menuItemIds to ObjectId inside $lookup
                  }
                }
              }
            ],
            as: 'menuItems'
          }
        },
        {
          $unwind : '$menuItems'
        },
        {
          $group : {
            _id : '$menuItems.category',
            quantity : {
              $sum : 1,
            },
            revenue : {
              $sum : '$menuItems.price'
            }
          }
        }
      ]).toArray();
    
      res.send(result);
    });








    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);











app.get('/', (req, res) => {
  res.send('boss is running')
})

app.listen(port, () => {
  console.log(`bistro is rnning on port ${port}`);
})