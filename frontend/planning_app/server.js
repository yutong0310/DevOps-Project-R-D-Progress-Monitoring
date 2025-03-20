const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// In-memory users and checklists for the mock server
const users = [
    { username: 'user1', password: '$2a$10$P7UddMy1y5k9y42yHt9AOi3eoyfI6/xS/BGTkFpQxX9UGy9/Y4pd6' } // password123 (hashed)
  ];  

const checklists = [
  { id: 1, title: "Sample Checklist", description: "Sample Description", assignedTeam: "Team A" },
];

// Login Route
app.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const accessToken = jwt.sign({ username: user.username }, "secretkey", { expiresIn: "1h" });
  res.json({ access_token: accessToken });
});

// Checklist Route
app.get("/checklists", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    jwt.verify(token, "secretkey");
    res.json(checklists);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

app.post("/checklists", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    jwt.verify(token, "secretkey");
    const { title, description, assignedTeam } = req.body;
    const newChecklist = { id: checklists.length + 1, title, description, assignedTeam };
    checklists.push(newChecklist);
    res.status(201).json(newChecklist);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
