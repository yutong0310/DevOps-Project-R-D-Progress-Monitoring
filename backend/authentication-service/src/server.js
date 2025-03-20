// Load environment variables from AWS Secrets Manager
require('dotenv').config();

// Import required modules
const express = require('express');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');
const os = require('os');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { fromEnv } = require('@aws-sdk/credential-provider-env');

// AWS Secrets Manager Client 
const client = new SecretsManagerClient({
  region: "us-east-1",
  credentials: fromEnv()
});

// Initialize Express app
const app = express();
app.use(express.json());
app.disable('strict routing'); // Treat /test and /test/ as the same route

app.use(cors({
    origin: ['https://main.d1b3jmhnz9hi7t.amplifyapp.com', 'https://auth.planmeet.net'], // ✅ Allow only trusted origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // ✅ Allow necessary methods
    allowedHeaders: ['Content-Type', 'Authorization'], // ✅ Allow these headers
    credentials: true, // ✅ Allow cookies if needed
}));


// Load SSL certificates
// const letsEncryptCA = fs.readFileSync(`/app/fullchain.pem`);
const letsEncryptCA = fs.readFileSync('/usr/local/share/ca-certificates/ISRG_Root_X1.crt')
// console.log('Loaded certificate chain:', letsEncryptCA.toString());

const agent = new https.Agent({
    ca: letsEncryptCA
});

// Set up session storage for Keycloak
const memoryStore = new session.MemoryStore();
app.use(session({
    secret: 'my-secret',
    resave: false,
    saveUninitialized: false,
    store: memoryStore,
    cookie: { secure: false } 
}));

// Function to fetch secrets from AWS Secrets Manager
async function getSecretValue(secretId) {
  try {
    console.log(`Fetching secret: ${secretId}`);
    const data = await client.send(
      new GetSecretValueCommand({
        SecretId: secretId,
        VersionStage: "AWSCURRENT",
      })
    );
    // console.log("after getting the secret")
    if (data.SecretString) {
      return JSON.parse(data.SecretString);
    } else {
      const buff = Buffer.from(data.SecretBinary, "base64");
      return buff.toString("ascii");
    }
  } catch (error) {
    console.error(`Error retrieving secret for ${secretId}`, error);
    throw error;
  }
}

// Fetch Keycloak and Authentication Service Configurations
async function getServiceConfig() {
  try {

    console.log("🔍 Fetching Keycloak URL from AWS Secrets Manager...");

    const keycloakUrl = await getSecretValue('KEYCLOAK_URL1');
    const keycloakRealm = await getSecretValue('KEYCLOAK_REALM');
    const keycloakClientID = await getSecretValue('KeycloakClientID');
    const authService = await getSecretValue('AUTH_SERVICE_SECRET');

    console.log("keycloakUrl = " + JSON.stringify(keycloakUrl))
    console.log("✅ Keycloak Secrets Fetched:");

    return {
      keycloakUrl: keycloakUrl.KEYCLOAK_URL1, // assuming the secret is a JSON object with the key `KEYCLOAK_URL1`
      keycloakRealm: keycloakRealm.KEYCLOAK_REALM,
      keycloakClientID: keycloakClientID.KEYCLOAK_CLIENT_ID,
      authServiceUrl: authService.AUTH_SERVICE_URL,
    };
  } catch (error) {
    console.error("Error fetching Keycloak/Auth config", error);
    throw error;
  }
}

// Initialize the application and Keycloak middleware
async function initializeApp() {
    const { keycloakUrl, keycloakRealm, keycloakClientID, authServiceUrl } = await getServiceConfig();

    console.log(`🔹 Keycloak URL: ${keycloakUrl}, Realm: ${keycloakRealm}, Client ID: ${keycloakClientID}`);
    console.log(`🔹 Auth Service URL: ${authServiceUrl}`);

    // Configure Keycloak instance
    const keycloak = new Keycloak({ store: memoryStore }, {
        "realm": keycloakRealm,
        "auth-server-url": keycloakUrl,
        "resource": keycloakClientID,
        "bearer-only": true,
    });

    console.log("🔹 Keycloak initialized");

    // Use Keycloak middleware to protect routes
    app.use(keycloak.middleware({
        logout: '/logout',
        admin: '/',
    }))

    console.log("after keycloak middleware")

    // ✅ Basic health check endpoint
    app.get('/', (req, res) => {
        res.send('Authentication Service is Running');
    });

    // ✅ User Login Endpoint
    app.post('/auth/login/', async (req, res) => {
        try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }


        console.log("🔍 Fetching Keycloak client secret from AWS Secrets Manager...");
        const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
        const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

        
        console.log("trying to get keycloak configurations");

        console.log("URL = " + `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`);

        // Request a token from Keycloak
        const response = await axios.post(
            `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
            new URLSearchParams({
              client_id: keycloakClientID,
              client_secret: clientSecret,  // ✅ Include the client_secret
              grant_type: 'password',
              username,
              password
            }), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                httpsAgent: agent  // ✅ Use HTTPS agent
            }
        );

        return res.json(response.data);
        } catch (error) {
          console.error("❌ Login error", error);
          res.status(500).json({ error: "Failed to authenticate" });
        }
    });

    // ✅ Protected route: Retrieve user info 
    app.get('/user/', keycloak.protect(), (req, res) => {
        res.json({
            message: 'User Authenticated',
            user: req.kauth.grant.access_token.content // Return user data from Keycloak
        });
    });

    app.get('/getUserRoles/', keycloak.protect(), async (req, res) => {
      try {

        console.log("In endpoint getUserData")

        const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
        const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

        console.log("Before getting searchedId")

        const searchedId = req.query.userId

        console.log("SearchedId = " + JSON.stringify(searchedId))

        // Step 1: Get Admin Token
        const tokenResponse = await axios.post(
            `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: keycloakClientID,
                client_secret: clientSecret,
            }),
            { 
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              httpsAgent: agent  // ✅ Use HTTPS agent }
            }
        );

        const adminToken = tokenResponse.data.access_token;

        console.log("before request to get user roles")
        
        const rolesUser = await axios.get(
          `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${encodeURIComponent(searchedId)}/role-mappings/clients/${keycloakClientID}`,
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );
        
        // console.log("roles user = " + rolesUser.data)

        const roles = rolesUser.data;
        // console.log('Roles:', roles);

        return { roles };
      } catch(err) {
        console.error("Error: " + err)
      }
    });

     app.get('/getUserGroups/', keycloak.protect(), async (req, res) => {
      try {

        console.log("In endpoint getUserData")

        const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
        const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

        console.log("Before getting searchedId")

        const searchedId = req.query.userId

        console.log("SearchedId = " + JSON.stringify(searchedId))

        // Step 1: Get Admin Token
        const tokenResponse = await axios.post(
            `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: keycloakClientID,
                client_secret: clientSecret,
            }),
            { 
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              httpsAgent: agent  // ✅ Use HTTPS agent }
            }
        );

        const adminToken = tokenResponse.data.access_token;
        
        // console.log("before request to get user groups")

        const groupsUser = await axios.get(
          `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${encodeURIComponent(searchedId)}/groups`,
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );
        
        // console.log("groups user = " + groupsUser.data)

        const groups = groupsUser.data;
        // console.log('groups:', groups);

        return { groups };
      } catch(err) {
        console.error("Error: " + err)
      }
    });
   
    
    app.get('/getUserData/', keycloak.protect(), async (req, res) => {
      try {

        console.log("In endpoint getUserData")

        const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
        const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

        console.log("Before getting searchedId")

        const searchedId = req.query.userId

        console.log("SearchedId = " + JSON.stringify(searchedId))

        // Step 1: Get Admin Token
        const tokenResponse = await axios.post(
            `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: keycloakClientID,
                client_secret: clientSecret,
            }),
            { 
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              httpsAgent: agent  // ✅ Use HTTPS agent }
            }
        );

        const adminToken = tokenResponse.data.access_token;

        const userResponse = await axios.get(
          `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${encodeURIComponent(searchedId)}`,
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );

        // console.log("userResponse data = " + JSON.stringify(userResponse.data))
        
        console.log("before group request")

        const groupsUser = await axios.get(
          `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${searchedId}/groups`,
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );
        
        // console.log("groups user = " + JSON.stringify(groupsUser.data))
        
        console.log("roles request")

        const rolesUser = await axios.get(
            `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${searchedId}/role-mappings/realm`,
            {
                headers: { Authorization: `Bearer ${adminToken}` },
                httpsAgent: agent // If using a custom HTTPS agent
            }
        );

        console.log("User's Realm Roles:", rolesUser.data);

        
        // console.log("roles user = " + JSON.stringify(rolesUser.data))
        
        const user = userResponse.data;
        const roles = rolesUser.data;
        const groups = groupsUser.data;

        // console.log('User Details:', user);
        // console.log('Roles:', roles);
        // console.log('Groups:', groups);

        return res.json({ "user": user, "roles": roles, "groups": groups});
      } catch(err) {
        console.error("Error: " + err)
        return res.status(500).json({ error: "Internal Server Error", details: err.toString() });
      }
    });

    
    // Assume we only have one client for now
    // ✅ Protected route: Retrieve user info 
    app.get('/project/members/', keycloak.protect(), async (req, res) => {
      try {

          // SHOULD GET ALL THE REALM NAMES AND IDs in order to check which is which
          // let body = req.body
          // let client_req = body.client
          console.log("In project members innit")
          console.log("Keycloak Authenticated User:", req.kauth?.grant?.access_token?.content);

          const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
          const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

          // Step 1: Get Admin Token
          const tokenResponse = await axios.post(
              `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
              new URLSearchParams({
                  grant_type: "client_credentials",
                  client_id: keycloakClientID,
                  client_secret: clientSecret,
              }),
              { 
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                httpsAgent: agent  // ✅ Use HTTPS agent }
              }
          );

          const adminToken = tokenResponse.data.access_token;

          // console.log("after keycloak initial request")

          // Step 3: Get Users Assigned to This Client
          const usersResponse = await axios.get(
              `${keycloakUrl}/admin/realms/${keycloakRealm}/users`,
              { 
                headers: { Authorization: `Bearer ${adminToken}` },
                httpsAgent: agent
              }
          );

          // console.log("usersResponse = " + JSON.stringify(usersResponse.data))
           
          console.log("after getting users from realm")

          return res.json({"users" : usersResponse.data});
      } catch (error) {
          console.error("Error fetching client users:", error);
          res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get('/groups/', keycloak.protect(), async (req, res) => {
      try {

        console.log("======================================") 
        console.log("============== GROUPS ================")
        console.log("======================================") 
          // SHOULD GET ALL THE REALM NAMES AND IDs in order to check which is which
          // let body = req.body
          // let client_req = body.client
          console.log("Groups endpoint innit")
          console.log("Keycloak Authenticated User:", req.kauth?.grant?.access_token?.content);

          const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
          const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

          // Step 1: Get Admin Token
          const tokenResponse = await axios.post(
              `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
              new URLSearchParams({
                  grant_type: "client_credentials",
                  client_id: keycloakClientID,
                  client_secret: clientSecret,
              }),
              { 
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                httpsAgent: agent  // ✅ Use HTTPS agent }
              }
          );

          const adminToken = tokenResponse.data.access_token;

          // Step 3: Get Users Assigned to This Client
          const groupsResponse = await axios.get(
              `${keycloakUrl}/admin/realms/${keycloakRealm}/groups`,
              { 
                headers: { Authorization: `Bearer ${adminToken}` },
                httpsAgent: agent
              }
          );

          // console.log("groupsResponse = " + JSON.stringify(groupsResponse.data))
           
          // console.log("after getting groups from realm")

          return res.json({"groups" : groupsResponse.data});
      } catch (error) {
          console.error("Error fetching client users:", error);
          res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get('/roles/', keycloak.protect(), async (req, res) => {
      try {

          // SHOULD GET ALL THE REALM NAMES AND IDs in order to check which is which
          // let body = req.body
          // let client_req = body.client
          console.log("Groups endpoint innit")
          console.log("Keycloak Authenticated User:", req.kauth?.grant?.access_token?.content);

          const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
          const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

          // Step 1: Get Admin Token
          const tokenResponse = await axios.post(
              `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
              new URLSearchParams({
                  grant_type: "client_credentials",
                  client_id: keycloakClientID,
                  client_secret: clientSecret,
              }),
              { 
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                httpsAgent: agent  // ✅ Use HTTPS agent }
              }
          );

          const adminToken = tokenResponse.data.access_token;

          // Step 3: Get Users Assigned to This Client
          const rolesResponse = await axios.get(
              `${keycloakUrl}/admin/realms/${keycloakRealm}/roles`,
              { 
                headers: { Authorization: `Bearer ${adminToken}` },
                httpsAgent: agent
              }
          );

          // console.log("rolesResponse = " + JSON.stringify(rolesResponse.data))
           
          // console.log("after getting roles from realm")

          return res.json({"roles" : rolesResponse.data});
      } catch (error) {
          console.error("Error fetching client users:", error);
          res.status(500).json({ error: "Internal Server Error" });
      }
    });
    
    // ✅ Assign a user to a team (CIO only)
    app.post('/assign-team/', keycloak.protect('realm:CIO'), async (req, res) => {
        try {

            console.log("======================================") 
            console.log("            IN ASSIGN TEAMS           ")
            console.log("======================================") 

            const roles = req.kauth.grant.access_token.content.realm_access.roles;
            if (!roles.includes("CIO")) {
                return res.status(403).json({ error: "Access Denied" });
            }
            
            console.log("Role includes CIO moving on")

            console.log("body = " + JSON.stringify(req.body))
            console.log("body = " + req.body)

            const { userId, teamName } = req.body;
            if (!userId || !teamName) {
                return res.status(400).json({ error: "User ID and Team Name are required" });
            }
            
            console.log("Checked userId and teamName exist")

            const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
            const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

            const tokenResponse = await axios.post(
                `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: keycloakClientID,
                    client_secret: clientSecret,
                }),
                { 
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  httpsAgent: agent  // ✅ Use HTTPS agent }
                }
            );

            const adminToken = tokenResponse.data.access_token;

            console.log("Got token")

            // Step 3: Get Users Assigned to This Client
            const groupsResponse = await axios.get(
                `${keycloakUrl}/admin/realms/${keycloakRealm}/groups`,
                { 
                  headers: { Authorization: `Bearer ${adminToken}` },
                  httpsAgent: agent
                }
            );

            // console.log("After group response with group data = " + JSON.stringify(groupsResponse.data))

            const team = groupsResponse.data.find(group => group.name === teamName);
            if (!team) return res.status(404).json({ error: "Team not found" });
            
            // console.log("Adding to team = " + JSON.stringify(team))

            await axios.put(
              `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${userId}/groups/${team.id}`,
              {}, // Empty body as PUT to this endpoint doesn't require data
              {
                headers: { Authorization: `Bearer ${adminToken}` },
                httpsAgent: agent
              }
            )

            console.log(`✅ User ${userId} assigned to team ${teamName}`)

            res.json({ message: `✅ User ${userId} assigned to team ${teamName}` });
        } catch (error) {
            res.status(500).json({ error: "❌ Failed to assign user to team", details: error.response?.data || error.message });
        }
    }); 

    // ✅ Assign a user to a team (CIO only)
    app.post('/delete-group/', keycloak.protect('realm:CIO'), async (req, res) => {
        try {

            console.log("======================================") 
            console.log("            IN DELETE GROUPS          ")
            console.log("======================================") 

            const roles = req.kauth.grant.access_token.content.realm_access.roles;
            if (!roles.includes("CIO")) {
                return res.status(403).json({ error: "Access Denied" });
            }
            
            console.log("Role includes CIO moving on")

            console.log("body = " + JSON.stringify(req.body))
            console.log("body = " + req.body)

            const { userId, group1 } = req.body;
            if (!userId || !group1) {
                return res.status(400).json({ error: "User ID and group Name are required" });
            }
            
            console.log("Checked userId and group1 exist")

            const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
            const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

            const tokenResponse = await axios.post(
                `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: keycloakClientID,
                    client_secret: clientSecret,
                }),
                { 
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  httpsAgent: agent  // ✅ Use HTTPS agent }
                }
            );

            const adminToken = tokenResponse.data.access_token;

            console.log("Got token")

            // Step 3: Get Users Assigned to This Client
            const groupsResponse = await axios.get(
                `${keycloakUrl}/admin/realms/${keycloakRealm}/groups`,
                { 
                  headers: { Authorization: `Bearer ${adminToken}` },
                  httpsAgent: agent
                }
            );

            console.log("After group response with group data = " + JSON.stringify(groupsResponse.data))

            const group = groupsResponse.data.find(group => group.name === group1.name);
            if (!group) return res.status(404).json({ error: "group not found" });
            
            console.log("Deleting from group = " + JSON.stringify(group))

            await axios.delete(
              `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${userId}/groups/${group.id}`,
              {
                headers: { Authorization: `Bearer ${adminToken}` },
                httpsAgent: agent
              }
            )

            console.log(`✅ User ${userId} deleted from group ${group1.name}`)

            res.json({ message: `✅ User ${userId} deleted from group ${group1}` });
        } catch (error) {
            res.status(500).json({ error: "❌ Failed to delete user to group", details: error.response?.data || error.message });
        }
    }); 

     // ✅ Assign a user to a team (CIO only)
    app.post('/assign-role/', keycloak.protect('realm:CIO'), async (req, res) => {
        try {

            console.log("======================================") 
            console.log("            IN ASSIGN ROLES           ")
            console.log("======================================") 

            const roles = req.kauth.grant.access_token.content.realm_access.roles;
            if (!roles.includes("CIO")) {
                return res.status(403).json({ error: "Access Denied" });
            }
            
            console.log("Role includes CIO moving on")

            console.log("body = " + JSON.stringify(req.body))
            console.log("body = " + req.body)

            const { userId, roleName } = req.body;
            if (!userId || !roleName) {
                return res.status(400).json({ error: "User ID and role Name are required" });
            }
            
            console.log("Checked userId and roleName exist")

            const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
            const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

            const tokenResponse = await axios.post(
                `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: keycloakClientID,
                    client_secret: clientSecret,
                }),
                { 
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  httpsAgent: agent  // ✅ Use HTTPS agent }
                }
            );

            const adminToken = tokenResponse.data.access_token;

            console.log("Got token")

            // Step 3: Get Users Assigned to This Client
            const rolesResponse = await axios.get(
                `${keycloakUrl}/admin/realms/${keycloakRealm}/roles`,
                { 
                  headers: { Authorization: `Bearer ${adminToken}` },
                  httpsAgent: agent
                }
            );

            console.log("After role response with role data = " + JSON.stringify(rolesResponse.data))

            const role = rolesResponse.data.find(role => role.name === roleName);
            if (!role) return res.status(404).json({ error: "role not found" });
            
            console.log("Adding to role = " + JSON.stringify(role))

            await axios.post(
                `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${userId}/role-mappings/realm`,
                [role], // Array of role objects
                { headers: { "Authorization": `Bearer ${adminToken}` },
                  httpsAgent: agent
                }
            );

            // const clientsResponse = await axios.get(
            //     `${keycloakUrl}/admin/realms/${keycloakRealm}/clients`,
            //     { headers: { "Authorization": `Bearer ${adminToken}` } }
            // );
            // const client = clientsResponse.data.find(client => client.clientId === keycloakClientID);
            // if (!client) throw new Error("Client not found!");
            // const keycloakClientUUID = client.id;
            // console.log("After client")
            // console.log("client = " + JSON.stringify(client))

            // await axios.post(
            //     `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${userId}/role-mappings/clients/${keycloakClientUUID}`,
            //     [role], // Array of role objects
            //     {
            //         headers: { "Authorization": `Bearer ${adminToken}` },
            //         httpsAgent: agent
            //     }
            // );
            
            console.log(`✅ User ${userId} assigned to team ${roleName}`)

            res.json({ message: `✅ User ${userId} assigned to role ${roleName}` });
        } catch (error) {
            res.status(500).json({ error: "❌ Failed to assign user to role", details: error.response?.data || error.message });
        }
    }); 


     // ✅ Assign a user to a team (CIO only)
    app.post('/delete-role/', keycloak.protect('realm:CIO'), async (req, res) => {
        try {

            console.log("======================================") 
            console.log("            IN DELETE GROUPS          ")
            console.log("======================================") 

            const roles = req.kauth.grant.access_token.content.realm_access.roles;
            if (!roles.includes("CIO")) {
                return res.status(403).json({ error: "Access Denied" });
            }
            
            console.log("Role includes CIO moving on")

            console.log("body = " + JSON.stringify(req.body))
            console.log("body = " + req.body)

            const { userId, role } = req.body;
            if (!userId || !role) {
                return res.status(400).json({ error: "User ID and group Name are required" });
            }
            
            console.log("Checked userId and groupName exist")

            const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
            const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

            const tokenResponse = await axios.post(
                `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: keycloakClientID,
                    client_secret: clientSecret,
                }),
                { 
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  httpsAgent: agent  // ✅ Use HTTPS agent }
                }
            );

            const adminToken = tokenResponse.data.access_token;

            console.log("Got token")

            // Step 3: Get Users Assigned to This Client
            const rolesResponse = await axios.get(
                `${keycloakUrl}/admin/realms/${keycloakRealm}/roles`,
                { 
                  headers: { Authorization: `Bearer ${adminToken}` },
                  httpsAgent: agent
                }
            );

            console.log("After role response with roles data = " + JSON.stringify(rolesResponse.data))

            const role1 = rolesResponse.data.find(r => r.name === role.name);
            if (!role1) return res.status(404).json({ error: "role not found" });
            
            console.log("Deleting role = " + JSON.stringify(role1))

            await axios.delete(
              `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${userId}/role-mappings/realm`,
                {
                  headers: { Authorization: `Bearer ${adminToken}` },
                  httpsAgent: agent,
                  data: [role1]
                }
            );


            console.log(`✅ User ${userId} deleted from role ${role1.name}`)

            res.json({ message: `✅ User ${userId} deleted from role ${role1.name}` });
        } catch (error) {
            res.status(500).json({ error: "❌ Failed to delete user to role", details: error.response?.data || error.message });
        }
    }); 

    // Start the server after Keycloak is initialized
    app.listen(5001, '0.0.0.0', () => {
        console.log(`✅ Authentication service running on ${authServiceUrl}`);
    });
}



// Run the initialization function to set up the app
initializeApp().catch(error => {
  console.error("Error initializing app", error);
  process.exit(1); // Exit with an error if initialization fails
})
