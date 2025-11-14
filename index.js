require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const app = express()
const admin = require("firebase-admin");
const port = process.env.PORT || 5000

const serviceAccount = require("./smart-dealse-firbase-admin.json");


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

//middleware
app.use(cors())
app.use(express.json())

const logger = (req, res, next)=>{
	console.log('Logging Info');
	next();
}
const verifyFireBaseToken = async(req, res, next) =>{
	console.log('in the verify middleware', req.headers.authorization);
	if(!req.headers.authorization){
		//do not allow togo 
		return res.status(401).send({message: 'unauthorized access'})
	}
	const token = req.headers.authorization.split(' ')[1]
	if(!token){
		return res.status(401).send({message: 'unauthorized access'})
	}
	try{
	const userInfo = await admin.auth().verifyIdToken(token);
	req.token_email=userInfo.email;
	console.log('after token velidation', userInfo);	
	next();
	}
	catch{
		return res.status(401).send({message: 'unauthorized access'})
	}


	//verify token

	// next();
}

const verifyJWTToken = (req, res, next) =>{
	
	const authorization = req.headers.authorization;
	if(!authorization){
		return res.status(401).send({message: 'unauthorized access'})
	}
	const token = authorization.split(' ')[1];
	if(!token){
		return res.status(401).send({message: 'unauthorization access'})
	}

	
	jwt.verify(token, process.env.JWT_SECRET, (err, decoded) =>{
		if(err){
			return res.status(401).send({message: 'unauthorized access'})
		}
		console.log('after decoded', decoded);
		req.token_email = decoded.email;
	next();
	})
//put it in the right place

}

const uri = `mongodb+srv://${process.env.DB_USERS}:${process.env.DB_PASS}@cluster0.5asayq5.mongodb.net/?appName=Cluster0`;
	

const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
})

async function run() {
	try {
		// await client.connect(); //it has automatic uses here....

		const db = client.db('smart_db')
		const productsCollection = db.collection('products')
		const bidsCollection = db.collection('bids')
		const usersCollection = db.collection('users')
		
		//jwt related api
		app.post('/getToken', (req, res)=>{
			const loggedUser =req.body;
			const token = jwt.sign(loggedUser, 
				process.env.JWT_SECRET, {expiresIn: '1h'})
			res.send({token: token })
		})

		//USERS API
		app.post('/users', async (req, res) => {
			const newUser = req.body

			const email = req.body.email
			const query = { email: email }
			const existingUser = await usersCollection.findOne(query)
			if (existingUser) {
				res.send({ message: 'user already exits Don`t need to intend' })
			} else {
				const result = await usersCollection.insertOne(newUser)
				res.send(result)
			}
			const result = await usersCollection.insertOne(newUser)
			res.send(result)
		})

		//products APIs
		app.get('/products', async (req, res) => {
			// const projectFields = {title: 1, price_min: 1, price_max: 1, image:1 }
			// const cursor = productsCollection.find().sort({price_min: 1})
			// .skip(2).limit(2).project(projectFields);

			console.log(req.query)
			const email = req.query.email
			const query = {}
			if (email) {
				query.email = email
			}
			const cursor = productsCollection.find(query)
			const result = await cursor.toArray()
			res.send(result)
		})
		app.get('/latest-products', async (req, res) => {
			const cursor = productsCollection.find().sort({ created_at: -1 })
			const result = await cursor.toArray()
			res.send(result)
		})

		app.get('/products/:id', async (req, res) => {
			const id = req.params.id
			const query = { _id: id }
			console.log('query', query)
			const result = await productsCollection.findOne(query)
			res.send(result)
		})

		app.post('/products', async (req, res) => {
			const newProduct = req.body
			const result = await productsCollection.insertOne(newProduct)
			res.send(result)
		})
		app.patch('/products/:id', async (req, res) => {
			const id = req.params.id
			const updatedProduct = req.body
			const query = { _id: new ObjectId(id) }
			const update = {
				$set: updatedProduct,
			}
			const result = await productsCollection.updateOne(query, update)
			res.send(result)
		})
		app.delete('/products/:id', async (req, res) => {
			const id = req.params.id
			const query = { _id: new ObjectId(id) }
			const result = await productsCollection.deleteOne(query)
			res.send(result)
		})

		app.get('/bids', verifyJWTToken, async(req, res) =>{
			
			const email = req.query.email;
			const query = {}
			if(email){
				query.buyer_email = email
			}

			// verify user have access to see this data
			if(email !== req.token_email){
				return res.status(403).send({message: 'forbidden access'})

			}

			const cursor = bidsCollection.find(query)
			const result = await cursor.toArray()
			res.send(result);
		})

		//bids related api with firebase token verify
		app.get('/bids', logger, verifyFireBaseToken, async (req, res) => {
			console.log('headers', req);
			
			const email = req.query.email
			const query = {}
			if (email) {
				if(email !== req.token_email){
					return res.status(403).send({message: 'forbidden access'})
				}
				query.buyer_email = email;
			}

			const cursor = bidsCollection.find(query)
			const result = await cursor.toArray()
			res.send(result)
		})

		// bids related api with firebase token verify
		// app.get('/bids', logger, verifyFireBaseToken, async (req, res) => {
		// 	console.log('headers', req);
			
		// 	const email = req.query.email
		// 	const query = {}
		// 	if (email) {
		// 		if(email !== req.token_email){
		// 			return res.status(403).send({message: 'forbidden access'})
		// 		}
		// 		query.buyer_email = email;
		// 	}

		// 	const cursor = bidsCollection.find(query)
		// 	const result = await cursor.toArray()
		// 	res.send(result)
		// })
		app.get('/products/bids/:productId', verifyFireBaseToken, async (req, res) => {
			const productId = req.params.productId
			const query = { product: productId }
			const cursor = bidsCollection.find(query).sort({ bid_price: -1 })
			const result = await cursor.toArray()
			res.send(result)
		})
        // app.get('/bids', async(req, res) =>{

        //     const query = {};
        //     if(query.email){
        //         query.buyer_email = email;

        //     }
        //     const cursor = bidsCollection.find(query);
        //     const result = await cursor.toArray();
        //     res.send(result);
        // })

		app.post('/add-bid', async (req, res) => {
			const newBid = req.body
			console.log(newBid)
			const result = await bidsCollection.insertOne(newBid)
			res.send(result)
		})

		app.delete('/bids/:id', async (req, res) => {
			const id = req.params.id
			const query = { _id: new ObjectId(id) }
			const result = await bidsCollection.deleteOne(query)
			res.send(result)
		})

		console.log('Pinged Your deployment. You successfully connected to MongDb!')
	} finally {
		// this is finally block
	}
}

run().catch(console.dir)

app.get('/', (req, res) => {
	res.send('Smart server is running')
})

app.listen(port, () => {
	console.log(`Smart server is running on port: ${port}`)
})
