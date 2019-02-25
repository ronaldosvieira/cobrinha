const bodyParser = require('body-parser')
const express = require('express')
const logger = require('morgan')
const reinforce = require('reinforcenode')
const app = express()
const {
  fallbackHandler,
  notFoundHandler,
  genericErrorHandler,
  poweredByHandler
} = require('./handlers.js')

// For deployment to Heroku, the port needs to be set using ENV, so
// we check for the port number in process.env
app.set('port', (process.env.PORT || 9001))

app.enable('verbose errors')

app.use(logger('dev'))
app.use(bodyParser.json())
app.use(poweredByHandler)

// --- SNAKE LOGIC GOES BELOW THIS LINE ---

const Agent = reinforce.DQNAgent

grid_size = 15

var env = {}
env.getNumStates = function() {return grid_size * grid_size}
env.getMaxNumActions = function() {return 4}

directions = ['up', 'down', 'left', 'right']

var spec = {alpha: 0.01}
agent = new Agent(env, spec)

var size = 0

var state_from_board = function(board) {
  state = Array(grid_size).fill(Array(grid_size).fill(0))

  for (var i in board.snakes) {
    for (var j in board.snakes[i].body) {
      body = board.snakes[i].body[j]

      state[body.x][body.y] = -1
    }
  }

  for (var i in board.food) {
    food = board.food[i]

    state[food.x][food.y] = 1
  }

  return state
}

// Handle POST request to '/start'
app.post('/start', (request, response) => {
  // NOTE: Do something here to start the game

  size = request.body.you.body.length

  // Response data
  const data = {
    color: '#DFFF00',
  }

  return response.json(data)
})

// Handle POST request to '/move'
app.post('/move', (request, response) => {
  // NOTE: Do something here to generate your move

  var board = request.body.board
  var me = request.body.you

  // check whether has eaten or not
  new_size = me.body.length

  if (new_size > size) agent.learn(1)
  else agent.learn(0)

  size = new_size

  var state = state_from_board(board)

  var action = agent.act(state)

  // Response data
  const data = {
    move: directions[action],
  }

  return response.json(data)
})

app.post('/end', (request, response) => {
  // NOTE: Any cleanup when a game is complete.

  agent.learn(-1)

  return response.json({})
})

app.post('/ping', (request, response) => {
  // Used for checking if this snake is still alive.
  return response.json({});
})

// --- SNAKE LOGIC GOES ABOVE THIS LINE ---

app.use('*', fallbackHandler)
app.use(notFoundHandler)
app.use(genericErrorHandler)

app.listen(app.get('port'), () => {
  console.log('Server listening on port %s', app.get('port'))
})
