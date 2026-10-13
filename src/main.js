import './css/main.css'
import { createGame } from './game/game.js'
import { createDebugView } from './debug/debugView.js'

const app = document.querySelector('#app')
const params = new URLSearchParams(location.search)

if (params.has('debug')) createDebugView(app)
else createGame(app)
