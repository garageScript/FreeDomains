const express = require('express')
const app = express()
app.use(express.static('public'))

app.get('/api/mappings', (req, res) => {
  res.json([{name:'hello world'}])
})

app.listen(process.env.PORT || 8123)
