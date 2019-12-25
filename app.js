const express = require('express')
const fs = require('fs')
const fetch = require('node-fetch')
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

const getMappings = () => {
  return data.mappings || {}
}

const domains = {
  abc123: 'freedomains.dev',
  gen123: 'generals.gs',
  hir192: 'hireme.fun',
  lrn999: 'learnjs.tips',
  n00033: 'n00b.city',
  never8: 'neverhustle.club',
  us1923: 'usemy.app'
}

const getFullDomain = (subDomain, domain) => {
  const prefix = subDomain ? `${subDomain}.` : ''
  return `${prefix}${domain}`
}

app.get('/api/domains', (req, res) => {
  const domainList = Object.entries(domains).map(([id, domain]) => {
    return { id, domain }
  })
  res.json(domainList)
})

app.use('/api/mappings', (req, res, next) => {
  const userId = req.headers.authorization
  if (!userId || !(data.users || {})[userId]) {
    return res.status(401).json({ message: 'user id is invalid' })
  }
  req.user = {
    id: userId
  }
  next()
})

app.get('/api/mappings', async (req, res) => {
  const originalMappings = await fetch('http://165.227.55.105:2229/api/mappings', {
    headers: {
      authorization: '6ecbeea1-6dcd-4d77-870b-fcc04b86d79a'
    }
  }).then(r => r.json())
  const originalMap = originalMappings.reduce((acc, mapping) => {
    acc[mapping.fullDomain] = mapping
    return acc
  }, {})

  const allMappings = getMappings()
  const userMappings = Object.values(allMappings).filter(m => {
    return m.userId === req.user.id
  }).map((mapping) => {
    const original = originalMap[mapping.fullDomain] || {}
    mapping.status = original.status || mapping.status
    mapping.id = original.id || mapping.id
    return mapping
  })
  res.json(userMappings)
})

app.post('/api/mappings', async (req, res) => {
  const { subDomain, domain } = req.body

  const newMapping = await fetch('http://165.227.55.105:2229/api/mappings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: '6ecbeea1-6dcd-4d77-870b-fcc04b86d79a'
    },
    body: JSON.stringify({
      domain, subDomain
    })
  }).then(r => r.json()).catch(e => {
    console.log('error for creating mapping', e)
  })

  const { gitLink, id, fullDomain } = newMapping
  const mappings = getMappings()
  mappings[fullDomain] = {
    id,
    domain,
    subDomain,
    fullDomain,
    gitLink,
    userId: req.user.id,
    createdAt: Date.now()
  }
  data.mappings = mappings
  saveData()

  res.json(req.body)
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
