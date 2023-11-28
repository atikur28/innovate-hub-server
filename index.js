const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hxtgr0p.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("innovateHub").collection("users");
    const contestsCollection = client.db("innovateHub").collection("contests");
    const registersCollection = client.db("innovateHub").collection("registers");
    const bestCreatorsCollection = client.db("innovateHub").collection("bestCreator");

    // jwt
    app.post("/jwt", async (req, res) => {
      const users = req.body;
      const token = jwt.sign(users, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access!" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "forbidden access!" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user) {
        isAdmin = user?.role === "admin";
      }
      res.send({ isAdmin });
    });

    app.get("/users/creator/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isCreator = false;
      if (user) {
        isCreator = user?.role === "creator";
      }
      res.send({ isCreator });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users/role/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateRole = req.body;
      const updatedDoc = {
        $set: {
          role: updateRole.selectedOption,
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateUser = req.body;
      const updatedDoc = {
        $set: {
          name: updateUser.userName,
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // contests
    app.get("/contests", async (req, res) => {
      const result = await contestsCollection.find().toArray();
      res.send(result);
    });

    app.get("/contests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestsCollection.findOne(query);
      res.send(result);
    });

    app.post("/contests", verifyToken, async (req, res) => {
      const contestInfo = req.body;
      const result = await contestsCollection.insertOne(contestInfo);
      res.send(result);
    })

    app.patch("/contests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedStatus = req.body;
      const updatedDoc = {
        $set: {
          status: updatedStatus.confirmation,
          participated: updatedStatus.newCount
        },
      };
      const result = await contestsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.put("/contests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
           name: updatedInfo.name,
           contestPrice: updatedInfo.contestPrice,
           prizeMoney: updatedInfo.prizeMoney,
           image: updatedInfo.image,
           tag: updatedInfo.tag,
           deadline: updatedInfo.deadline,
           description: updatedInfo.description,
           instruction: updatedInfo.instruction
      };
      const result = await contestsCollection.updateOne(filter, { $set: { ...updatedDoc } }, options);
      res.send(result);
 });

    app.delete("/contests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestsCollection.deleteOne(query);
      res.send(result);
    });

    // best creator
    app.get("/bestCreator", async (req, res) => {
      const result = await bestCreatorsCollection.find().toArray();
      res.send(result);
    })

    // payment
    app.post("/create-payment-intent", async(req, res) => {
      const {price} =req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // registers
    app.get("/registers", verifyToken, async (req, res) => {
      const result = await registersCollection.find().toArray();
      res.send(result);
    })

    app.post("/registers", verifyToken, async (req, res) => {
      const register = req.body;
      const result = await registersCollection.insertOne(register);
      res.send(result);
    })

    app.patch("/registers/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedWinner = req.body;
      const updatedDoc = {
        $set: {
          winner: updatedWinner.confirmation
        },
      };
      const result = await registersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.put("/registers/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
           status: updatedInfo.status,
      };
      const result = await registersCollection.updateOne(filter, { $set: { ...updatedDoc } }, options);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("InnovateHub server is running...");
});

app.listen(port, () => {
  console.log(`InnovateHub server is running on port ${port}`);
});
