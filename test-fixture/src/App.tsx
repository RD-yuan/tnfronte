import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <header className="header">
        <h1>TNFronte Test Page</h1>
        <p>A simple page to test the visual editor</p>
      </header>

      <main className="main">
        <section className="card">
          <h2>Counter Card</h2>
          <p className="count-display">{count}</p>
          <div className="button-group">
            <button className="btn btn-primary" onClick={() => setCount(count + 1)}>
              Increment
            </button>
            <button className="btn btn-secondary" onClick={() => setCount(count - 1)}>
              Decrement
            </button>
            <button className="btn btn-danger" onClick={() => setCount(0)}>
              Reset
            </button>
          </div>
        </section>

        <section className="card">
          <h2>User Profile</h2>
          <div className="profile">
            <div className="avatar">JD</div>
            <div className="info">
              <p className="name">John Doe</p>
              <p className="email">john@example.com</p>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Features</h2>
          <ul className="feature-list">
            <li>Click to select elements</li>
            <li>Drag to move elements</li>
            <li>Edit properties in the panel</li>
            <li>Changes write back to code</li>
          </ul>
        </section>
      </main>

      <footer className="footer">
        <p>Built with React + TNFronte</p>
      </footer>
    </div>
  );
}
