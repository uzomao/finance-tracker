const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// SQLite DB setup
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Initialize tables
const initDb = () => {
  db.serialize(() => {
    db.run(`DROP TABLE IF EXISTS categories`); // Remove old table if present
    db.run(`CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      percentage REAL NOT NULL,
      keywords TEXT DEFAULT ''
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      source TEXT,
      date TEXT DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      account_id INTEGER,
      description TEXT,
      date TEXT DEFAULT (datetime('now')),
      source TEXT,
      type TEXT CHECK(type IN ('income', 'expense')),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    )`);
  });
};

initDb();

// Basic test route
app.get('/', (req, res) => {
  res.send('Finance Tracker backend is running!');
});

// --- Account CRUD Endpoints ---

// Get all accounts
app.get('/accounts', (req, res) => {
  db.all('SELECT * FROM accounts', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Create a new account
app.post('/accounts', (req, res) => {
  const { name, percentage, keywords } = req.body;
  if (!name || percentage == null) {
    return res.status(400).json({ error: 'Name and percentage are required.' });
  }
  db.run(
    'INSERT INTO accounts (name, percentage, keywords) VALUES (?, ?, ?)',
    [name, percentage, keywords || ''],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, name, percentage, keywords: keywords || '' });
    }
  );
});

// Update an account
app.put('/accounts/:id', (req, res) => {
  const { id } = req.params;
  const { name, percentage, keywords } = req.body;
  if (!name || percentage == null) {
    return res.status(400).json({ error: 'Name and percentage are required.' });
  }
  db.run(
    'UPDATE accounts SET name = ?, percentage = ?, keywords = ? WHERE id = ?',
    [name, percentage, keywords || '', id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      res.json({ id, name, percentage, keywords: keywords || '' });
    }
  );
});

// Delete an account
app.delete('/accounts/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM accounts WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    res.json({ success: true });
  });
});

// Get a single account by ID
app.get('/accounts/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM accounts WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    res.json(row);
  });
});

// Add income and allocate across accounts
app.post('/income', (req, res) => {
  const { amount, source } = req.body;
  if (!amount || isNaN(amount)) {
    return res.status(400).json({ error: 'Amount is required and must be a number.' });
  }
  // Insert into income table
  db.run(
    'INSERT INTO income (amount, source) VALUES (?, ?)',
    [amount, source || ''],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const incomeId = this.lastID;
      // Fetch all accounts
      db.all('SELECT * FROM accounts', [], (err, accounts) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        // Prepare transactions for each account
        const transactions = accounts.map((account) => {
          const allocated = (amount * account.percentage) / 100;
          return {
            amount: allocated,
            account_id: account.id,
            description: 'Income allocation',
            source: source || '',
            type: 'income',
          };
        });
        // Insert all transactions
        const stmt = db.prepare(
          'INSERT INTO transactions (amount, account_id, description, source, type) VALUES (?, ?, ?, ?, ?)'
        );
        transactions.forEach((t) => {
          stmt.run([t.amount, t.account_id, t.description, t.source, t.type]);
        });
        stmt.finalize((err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.status(201).json({ incomeId, allocated: transactions });
        });
      });
    }
  );
});

// Get all transactions with account name
app.get('/transactions', (req, res) => {
  db.all(
    `SELECT transactions.*, accounts.name AS account_name
     FROM transactions
     LEFT JOIN accounts ON transactions.account_id = accounts.id
     ORDER BY transactions.date DESC, transactions.id DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 