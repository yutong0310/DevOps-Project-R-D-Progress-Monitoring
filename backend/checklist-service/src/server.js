// Load environment variables
require('dotenv').config();

// Import required modules
const express = require('express');
const cors = require('cors');
const { DynamoDBClient, PutItemCommand, ScanCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const { v4: uuidv4 } = require('uuid');
const fs = require("fs");
const https = require("https");
const path = require("path");
const PORT = 5002;

// Initialize Express app
const app = express();


// Load SSL Certificates
const options = {
    key: fs.readFileSync("/etc/letsencrypt/live/checklist.planmeet.net/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/checklist.planmeet.net/fullchain.pem"),
  };

// Middleware
app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));

app.use(cors({
    origin: ['https://main.d1b3jmhnz9hi7t.amplifyapp.com', '*'], // Allow Amplify frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
})); 

// Load AWS SDK and set up CloudWatch
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch({ region: 'us-east-1' }); // Ensure this matches your AWS region

// Middleware to track request latency
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', async () => {
        const latency = Date.now() - start; // Measure latency in milliseconds
        const params = {
            MetricData: [
                {
                    MetricName: "RequestLatency",
                    Dimensions: [
                        { Name: "ServiceName", Value: "ChecklistMicroservice" },
                        { Name: "Path", Value: req.path }
                    ],
                    Unit: "Milliseconds",
                    Value: latency
                }
            ],
            Namespace: "Checklist Microservice"
        };
        try {
            await cloudwatch.putMetricData(params).promise();
            console.log(`✅ Sent latency metric: ${latency}ms for ${req.path}`);
        } catch (err) {
            console.error("❌ Error sending latency metric:", err);
        }
    });
    next();
});

// Set up DynamoDB client
const dynamoDB = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

// Keycloak setup
const memoryStore = new session.MemoryStore();
app.use(session({ secret: 'my-secret', resave: false, saveUninitialized: true, store: memoryStore }));

const keycloak = new Keycloak({ store: memoryStore }, {
    realm: process.env.KEYCLOAK_REALM,
    "auth-server-url": process.env.KEYCLOAK_URL,
    resource: process.env.KEYCLOAK_CLIENT_ID,
    "bearer-only": true
});
app.use(keycloak.middleware());

// ✅ Health check
app.get('/', (req, res) => res.send('Checklist Service is Running'));

// tested
// ✅ CIO: Create a new checklist
app.post('/checklists', keycloak.protect('realm:CIO'), async (req, res) => {
    
    // extract `status`
    const { title, description, assignedTeam, status } = req.body;

    console.log("🔥 Received status from frontend:", status); // ✅ Debugging
    console.log("📌 Extracted status before saving:", status); // New debugging

    // ✅ Ensure status is included
    if (!title || !assignedTeam || !status) {  
        return res.status(400).json({ error: "Title, Status, and Assigned Team are required" });
    }

    const checklist = {
        id: { S: uuidv4() },
        title: { S: title },
        description: { S: description || "" },
        assignedTeam: { S: assignedTeam },
        createdAt: { S: new Date().toISOString() },
        updatedAt: { S: new Date().toISOString() },
        // status: { S: status }
        status: { S: String(status) || "Unknown" }  // Force string conversion
    };

    console.log("✅ Final checklist object before inserting into DynamoDB:", checklist); // 🔥 Debugging

    try {
        await dynamoDB.send(new PutItemCommand({ TableName: TABLE_NAME, Item: checklist }));
        res.status(201).json({ message: "Checklist created successfully", checklist });
    } catch (error) {
        res.status(500).json({ error: "Failed to create checklist", details: error.message });
    }
});

// tested
// ✅ PO & Devs: View checklists assigned to their team
app.get("/checklists", keycloak.protect(), async (req, res) => {
    try {
        const userToken = req.kauth.grant.access_token.content;
        const userGroups = userToken.groups || [];

        console.log("User groups:", userGroups);
        console.log("User roles:", userToken.realm_access.roles);

        // ✅ CIOs can see all checklists
        if (userGroups.includes("CIO") || userGroups.includes("/CIO")) {
            const allChecklists = await getAllChecklists();
            return res.json(allChecklists);
        }

        // ✅ Identify user's team
        const userTeam = userGroups.find(group => group !== "/CIO");
        if (!userTeam) {
            return res.status(403).json({ error: "User has no assigned team" });
        }

        // ✅ Remove leading "/" from group name
        const formattedTeam = userTeam.replace("/", "");

        // ✅ Fetch checklists assigned to this team
        const teamChecklists = await getChecklistsByTeam(formattedTeam);
        res.json(teamChecklists);
    } catch (error) {
        console.error("Error fetching checklists:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// tested
// ✅ PO: Update checklist status
app.put('/checklists/:id/:assignedTeam', keycloak.protect('realm:PO'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        // let result = await dynamoDB.send(new GetItemCommand({ TableName: TABLE_NAME, Key: { id: { S: id } } }));
        
        let result = await dynamoDB.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: {
                id: { S: id },
                assignedTeam: { S: req.params.assignedTeam }  // ✅ Add assignedTeam in the Key
            }
        }));        

        if (!result.Item) return res.status(404).json({ error: "Checklist not found" });

        await dynamoDB.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: { 
                id: { S: id },
                assignedTeam: { S: req.params.assignedTeam }  // ✅ Add assignedTeam in the Key
            },

            UpdateExpression: "SET #s = :s, updatedAt = :u",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
                ":s": { S: status },
                ":u": { S: new Date().toISOString() }
            }
        }));

        res.json({ message: "Checklist updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update checklist", details: error.message });
    }
});

// tested
// ✅ CIO: Delete a checklist
app.delete('/checklists/:id/:assignedTeam', keycloak.protect('realm:CIO'), async (req, res) => {
    const { id, assignedTeam } = req.params;

    try {
        await dynamoDB.send(new DeleteItemCommand({ 
            TableName: TABLE_NAME, 
            Key: { 
                id: { S: id } ,
                assignedTeam: { S: assignedTeam }  // ✅ Added assignedTeam as part of the key
            }
        }));
        res.json({ message: "Checklist deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete checklist", details: error.message });
    }
});

// tested
// ✅ Function to retrieve all checklists
async function getAllChecklists() {
    try {
        const result = await dynamoDB.send(new ScanCommand({ TableName: TABLE_NAME }));
        return result.Items || [];
    } catch (error) {
        console.error("Error fetching all checklists:", error);
        return [];
    }
}

// tested
// ✅ Get Checklists for a Specific Team
app.get('/checklists/team/:team', keycloak.protect(), async (req, res) => {
    const { team } = req.params;

    try {
        console.log(`Fetching checklists for team: ${team}`);
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "assignedTeam = :team",
            ExpressionAttributeValues: { ":team": { S: team } }
        }));
        res.json(result.Items || []);
    } catch (error) {
        console.error("Error fetching checklists for team:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ✅ CIO: Update checklist title and description
app.put('/checklists/:id/:assignedTeam/edit', keycloak.protect('realm:CIO'), async (req, res) => {
    const { id, assignedTeam } = req.params;
    const { title, description } = req.body;

    if (!title || !description) {
        return res.status(400).json({ error: "Title and Description are required" });
    }

    try {
        let result = await dynamoDB.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: {
                id: { S: id },
                assignedTeam: { S: assignedTeam }
            }
        }));

        if (!result.Item) return res.status(404).json({ error: "Checklist not found" });

        await dynamoDB.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: {
                id: { S: id },
                assignedTeam: { S: assignedTeam }
            },
            UpdateExpression: "SET title = :t, description = :d, updatedAt = :u",
            ExpressionAttributeValues: {
                ":t": { S: title },
                ":d": { S: description },
                ":u": { S: new Date().toISOString() }
            }
        }));

        res.json({ message: "Checklist updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update checklist", details: error.message });
    }
});

// ✅ PO: Submit all "Done" checklists for their team 
app.post('/submission/:assignedTeam', keycloak.protect('realm:PO'), async (req, res) => {
    const { assignedTeam } = req.params;

    try {
        // Fetch all checklists that: 
        // 1) belong to the specified `assignedTeam`, 
        // 2) have the status `Done`, 
        // 3) either do not have the `submitted` attribute (they haven't been submitted yet) or have `submitted = false`
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAME,
            // FilterExpression: "assignedTeam = :team AND #s = :done AND attribute_not_exists(submitted)",
            FilterExpression: "assignedTeam = :team AND #s = :done AND (attribute_not_exists(submitted) OR submitted = :notSubmitted)",
            ExpressionAttributeNames: {"#s": "status"},
            ExpressionAttributeValues: {
                ":team": { S: assignedTeam },
                ":done": { S: "Done" },
                ":notSubmitted": { BOOL: false }
            }
        }));

        const checklists = result.Items;

        if (!checklists || checklists.length === 0) {
            return res.status(400).json({ error: "No completed checklists available for submission." });
        }

        // ✅ Mark each checklist as "submitted"
        for (const checklist of checklists) {
            await dynamoDB.send(new UpdateItemCommand({
                TableName: TABLE_NAME,
                Key: {
                    id: checklist.id,
                    assignedTeam: checklist.assignedTeam
                },
                // Add `submitted` attribute & update timestamp
                UpdateExpression: "SET submitted = :submitted, submittedAt = :submittedAt",
                ExpressionAttributeValues: {
                    ":submitted": { BOOL: true },
                    ":submittedAt": { S: new Date().toISOString() }
                }
            }));
        }

        res.json({ message: "All 'Done' checklists submitted successfully!", submittedChecklists: checklists });
    } catch (error) {
        console.error("❌ Error submitting checklists:", error);
        res.status(500).json({ error: "Failed to submit checklists", details: error.message });
    }
});

// ✅ CIO: View all submitted checklists
app.get('/submissions', keycloak.protect('realm:CIO'), async (req, res) => {
    try {
        // Fetch all checklists that: 1) have the `submitted` attribute, and 2) `submitted` is set to `true`
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "attribute_exists(submitted) AND submitted = :submitted",
            ExpressionAttributeValues: { ":submitted": { BOOL: true } }
        }));

        res.json(result.Items || []); // Return the submitted checklists
    } catch (error) {
        console.error("❌ Error fetching submitted checklists:", error);
        res.status(500).json({ error: "Failed to fetch submissions", details: error.message });
    }
});

// ✅ PO: View all submitted checklists for their team
app.get('/submissions/:assignedTeam', keycloak.protect('realm:PO'), async (req, res) => {
    const { assignedTeam } = req.params;

    try {
        // Fetch checklists that: 1) belong to the team, 2) are marked as "submitted"
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "assignedTeam = :team AND submitted = :submitted",
            ExpressionAttributeValues: {
                ":team": { S: assignedTeam },
                ":submitted": { BOOL: true }
            }
        }));

        res.json(result.Items || []);
    } catch (error) {
        console.error("❌ Error fetching submitted checklists:", error);
        res.status(500).json({ error: "Failed to fetch submitted checklists", details: error.message });
    }
});

// ✅ PO: Modify submitted checklist (title & description)
app.put('/submissions/:id/:assignedTeam/edit', keycloak.protect('realm:PO'), async (req, res) => {
    const { id, assignedTeam } = req.params;
    const { title, description } = req.body;

    if (!title || !description) {
        return res.status(400).json({ error: "Title and Description are required" });
    }

    try {
        let result = await dynamoDB.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: {
                id: { S: id },
                assignedTeam: { S: assignedTeam }
            }
        }));

        if (!result.Item) return res.status(404).json({ error: "Checklist not found" });

        await dynamoDB.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: {
                id: { S: id },
                assignedTeam: { S: assignedTeam }
            },
            UpdateExpression: "SET title = :t, description = :d, updatedAt = :u",
            ExpressionAttributeValues: {
                ":t": { S: title },
                ":d": { S: description },
                ":u": { S: new Date().toISOString() }
            }
        }));
        
        res.json({ message: "Checklist updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update checklist", details: error.message });
    }
});

// Start HTTPS Server
https.createServer(options, app).listen(PORT, () => {
    console.log(`✅ Checklist Service is running on HTTPS at https://checklist.planmeet.net:${PORT}`);
});