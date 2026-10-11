import './css/main.css'
import { createGame } from './game/game.js'
import { createDebugView } from './debug/debugView.js'

// Normal play: the first-person game.
// Add ?debug to the URL for the generator view (all three floors stacked up).
const app = document.querySelector('#app')
const params = new URLSearchParams(location.search)

if (params.has('debug')) createDebugView(app)
else createGame(app)
