const bodyParser = require('body-parser')
const express = require('express')
const logger = require('morgan')
const fs = require('fs')
const program = require('commander')
const fetch = require('node-fetch')
const reinforce = require('reinforcenode')
const app = express()
const {
  fallbackHandler,
  notFoundHandler,
  genericErrorHandler,
  poweredByHandler
} = require('./handlers.js')

program
  .version('0.1.0')
  .option('-t, --train <n>', 'Train model')
  .parse(process.argv)

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

var spec = {
  alpha: 0.01,
  update: 'qlearn',
  gamma: 0.9,
  epsilon: 0.2,
  experience_add_every: 10,
  experience_size: 5000,
  learning_steps_per_iteration: 20,
  tderror_clamp: 1.0,
  num_hidden_units: 100
}
agent = new Agent(env, spec)

if (fs.existsSync('model/agent.json')) {
  model = JSON.parse(fs.readFileSync('model/agent.json', 'utf8'))
  agent.fromJSON(model)
}

var size = 0

var state_from_board = function(board) {
  state = []

  for (var i = 0; i < grid_size; i++) {
    aux = []
    for (var j = 0; j < grid_size; j++) {
      aux.push(0)
    }
    state.push(aux)
  }

  for (var i in board.snakes) {
    for (var j in board.snakes[i].body) {
      body = board.snakes[i].body[j]

      state[body.y][body.x] = -1
    }
  }

  for (var i in board.food) {
    food = board.food[i]

    state[food.y][food.x] = 1
  }

  return [].concat.apply([], state)
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
  var turn = request.body.turn

  // check whether has eaten or not
  new_size = me.body.length

  if (turn > 0) {
    if (new_size > size) agent.learn(1.0)
    else agent.learn(0.0)
  }

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

  agent.learn(-1.0)

  if (program.train && program.train > 0)
    train()

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

server = app.listen(app.get('port'), () => {
  console.log('Server listening on port %s', app.get('port'))
})

var onClose = function() {
  fs.writeFile('model/agent.json', JSON.stringify(agent.toJSON()), 
    'utf8', 
    (err) => {
      if (err) console.error(err);
      else console.log("Snake has been saved from doom.");

      server.close()
      process.exit();
    })
}

process.on('SIGTERM', onClose)
process.on('SIGINT', onClose)

var train = function() {
  program.train--

  fetch("http://localhost:3005/games", {
    method: "POST",
    body: JSON.stringify({
      width: 15,
      height: 15,
      food: 10,
      MaxTurnsToNextFoodSpawn: 0,
      "snakes": snakes,
    })
  }).then(resp => resp.json())
    .then(json => {
      const id = json.ID
      fetch(`http://localhost:3005/games/${id}/start`, {
        method: "POST"
      }).catch(err => console.log(err))
    })
    .catch(err => console.log(err))
}

var snakes = []

snakes.push({
  name: 'Cobrinha',
  url: 'http://localhost:' + app.get('port')
})

if (program.train) {
  train()
}