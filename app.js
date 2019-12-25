const express = require('express')
const fs = require('fs')
const uuidv4 = require('uuid/v4')
const app = express()
app.use(express.static('public'))
app.use(express.json())

const dataPath = './data.db'
let data = {}
fs.readFile(dataPath, (err, fileData) => {
  if (err) return
  try {
    data = JSON.parse(fileData)
    console.log('data', data)
  } catch (e) {
    console.log('parse error', e)
  }
})

const domains = {
  abc123: 'freedomains.dev',
  gen123: 'generals.gs',
  hir192: 'hireme.fun',
  lrn999: 'learnjs.tips',
  n00033: 'n00b.city',
  never8: 'neverhustle.club',
  us1923: 'usemy.app'
}

app.get('/api/domains', (req, res) => {
  const domainList = Object.entries(domains).map(([id, domain]) => {
    return { id, domain }
  })
  res.json(domainList)
})

app.get('/api/users/:userId', (req, res) => {
  const users = data.users || {}
  res.json({
    key: users[req.params.userId]
  })
})

const saveData = () => {
  return new Promise((resolve, reject) => {
    fs.writeFile(dataPath, JSON.stringify(data, null, 2), (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

app.post('/api/sshKeys', async (req, res) => {
  console.log('rebody', req.body)
  let { userId, key } = req.body
  if (!key) return res.json({ error: 'invalid input' })

  const users = data.users || {}

  const foundUser = Object.entries(users).find(([uid, sshKey]) => {
    return (sshKey === key)
  })

  // User already exist
  if (foundUser && foundUser.length === 2) {
    return res.json({
      userId: foundUser[0],
      key: foundUser[1]
    })
  }

  if (!userId) {
    userId = uuidv4()
  }

  // Replace UserId
  if (users[userId]) {
    // Delete oldSshKey
    const oldSshKey = users[userId]
    console.log('oldSshKey', oldSshKey)
  }

  // Create new key
  users[userId] = key
  data.users = users
  await saveData()
  return res.json({ userId, key })
})

app.listen(process.env.PORT || 8123)
