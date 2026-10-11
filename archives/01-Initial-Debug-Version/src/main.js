import './css/main.css'
import { createDebugView } from './debug/debugView.js'

// For now the app boots straight into the generator debug view.
// The first-person game will get its own entry point once the maze is right.
createDebugView(document.querySelector('#app'))
