import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="app">
      <span className="app__mascot" role="img" aria-label="koala">
        🐨
      </span>
      <h1>Hello, Koala Cub Club</h1>
      <p className="app__tagline">Vite + React + TypeScript</p>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        clicked {count} {count === 1 ? 'time' : 'times'}
      </button>
    </main>
  )
}

export default App
