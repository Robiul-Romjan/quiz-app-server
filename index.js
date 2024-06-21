const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vhjeumo.mongodb.net/?retryWrites=true&w=majority`;
// const uri = "mongodb+srv://shaan:shaan666@cluster0.xplhvcp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

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

    // collection name
    const questionCollection = client.db("quizApp").collection("questions");
    const usersCollection = client.db("quizApp").collection("users");
    const resultsCollection = client.db("quizApp").collection("quizResults");

    app.get("/questions", async (req, res) => {
      try {
        const numQuestions = parseInt(req.query.num) || 10; // Default to 10 questions if not specified
        const category = req.query.category; // Get the category from query parameters

        const pipeline = [
          { $match: { category: category } }, // Filter questions by category
          { $sample: { size: numQuestions } }, // Sample the specified number of questions
        ];

        let questions = await questionCollection.aggregate(pipeline).toArray();

        // Randomize options for each question
        questions = questions.map((question) => {
          question.options = question.options.sort(() => Math.random() - 0.5);
          return question;
        });

        res.send(questions);
      } catch (error) {
        console.error("Error fetching random questions:", error);
        res.status(500).send("Error fetching random questions");
      }
    });

    // get all quizzes
    app.get("/all-questions", async (req, res) => {
      const result = await questionCollection.find().toArray();
      res.send(result);
    });

    // post question
    app.post("/add-question", async (req, res) => {
      const newQuestion = req.body;
      const result = await questionCollection.insertOne(newQuestion);
      res.send(result);
    });

    //get all users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // get users only'Students'
    app.get("/users/students", async (req, res) => {
      try {
        const result = await usersCollection
          .find({ role: "Student" })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).send("Error fetching students");
      }
    });
    // get users only'Teachers'
    app.get("/users/teachers", async (req, res) => {
      try {
        const result = await usersCollection
          .find({ role: "Teacher" })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).send("Error fetching students");
      }
    });

    // search for student by id or name
    app.get("/searchUser", async (req, res) => {
      try {
        const { name, id } = req.query;

        let query = {};

        if (name) {
          query.name = { $regex: name, $options: "i" }; // Case-insensitive partial matching
        } else if (id) {
          query.id = id; // Directly use the id field in the query
        } else {
          query.role = "Student";
        }

        const users = await usersCollection.find(query).toArray();

        if (users.length === 0) {
          return res.status(404).send("No users found");
        }

        res.send(users);
      } catch (error) {
        console.error("Error searching for user:", error);
        res.status(500).send("Error searching for user");
      }
    });

    // save user Email and name in DB
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //   make teacher
    app.patch("/users/teacher/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "Teacher",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //   make user admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "Admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get my quizzes tech
    app.get("/my-quizzes", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { createdBy: req.query.email };
      }
      const result = await questionCollection.find(query).toArray();
      res.send(result);
    });

    // get all quiz results
    app.get("/all-exam-results", async(req, res)=> {
      const result = await resultsCollection.find().toArray();
      res.send(result);
    })

    // reset exam
    app.delete("/reset-exam/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await resultsCollection.deleteOne(query);
      res.send(result);
    });

    // get quiz results by email
    app.get("/my-results", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      try {
        const result = await resultsCollection
          .find(query)
          .sort({ date: -1 }) // Sort by date in descending order
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching results:", error);
        res.status(500).send("Error fetching results");
      }
    });

    // post quiz results
    app.post("/add-results", async (req, res) => {
      const quizResults = req.body;
      const result = await resultsCollection.insertOne(quizResults);
      res.send(result);
    });

    // delete quiz
    app.delete("/quiz/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await questionCollection.deleteOne(query);
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
  res.send("Quiz app Server is running..");
});

app.listen(port, () => {
  console.log(`Quiz app Server running on port ${port}`);
});
