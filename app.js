const express = require('express')
const fs = require('fs')
const fetch = require('node-fetch')
const { exec } = require('child_process')
const uuidv4 = require('uuid/v4')
const app = express()
app.use(express.static('public'))
app.use(express.json())

const myProxyApi = process.env.MYPROXY_API
const myProxyKey = process.env.MYPROXY_KEY

const dataPath = './data.db'
let data = {}
fs.readFile(dataPath, (err, fileData) => {
  if (err) return
  try {
    data = JSON.parse(fileData)
  } catch (e) {
    console.log('parse error', e)
  }
})

const getMappings = () => {
  return data.mappings || {}
}

const domains = {
  abc123: 'freedomains.dev',
  gen123: 'general.gs',
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


app.get('/isAvailable', (req, res) => {
  const { subDomain, domain } = req.query
  const fullDomain = getFullDomain(subDomain, domain)
  const allMappings = getMappings()
  const result = {
    isAvailable: true
  }
  if (allMappings[fullDomain]) {
    result.isAvailable = false
  }
  return res.json(result)
})

app.get('/downloadConfig', (req, res) => {
  fetch(`${myProxyApi}/mappings/download/?fullDomain=${req.query.fullDomain}`, {
    headers: {
      authorization: myProxyKey
    }
  }).then(r => {
    r.body.pipe(res)
    res.setHeader('content-disposition', `attachment; filename="deploy.config.js"`)
  })
})

app.get('/api/logs/:type/:domain', (req, res) => {
  const { type, domain } = req.params
  fetch(`${myProxyApi}/logs/${type}/${domain}`, {
    headers: {
      authorization: myProxyKey
    }
  }).then(r => {
    r.body.pipe(res)
  })
})

app.delete('/api/logs/:domain', (req, res) => {
  const { domain } = req.params
  fetch(`${myProxyApi}/logs/${domain}`, {
    method: 'DELETE',
    headers: {
      authorization: myProxyKey
    }
  }).then(r => {
    r.body.pipe(res)
  })
})

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
  const originalMappings = await fetch(`${myProxyApi}/mappings`, {
    headers: {
      authorization: myProxyKey
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
  }).sort((a, b) => b.createdAt - a.createdAt)
  res.json(userMappings)
})

app.delete('/api/mappings/:id', async (req, res) => {
  const allMappings = getMappings()
  const mapping = Object.values(allMappings).find(m => {
    return m.id === req.params.id
  })

  if (!mapping || mapping.userId !== req.user.id) {
    return res.status(401).json({ message: 'user id is invalid' })
  }

  await fetch(`${myProxyApi}/mappings/${req.params.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      authorization: myProxyKey
    }
  }).then(r => r.json()).catch(e => {
    console.log('error for deleting mapping', e)
  })

  delete allMappings[mapping.fullDomain]
  saveData()

  res.json(mapping)
})

app.post('/api/mappings', async (req, res) => {
  const { subDomain, domain } = req.body

  const newMapping = await fetch(`${myProxyApi}/mappings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: myProxyKey
    },
    body: JSON.stringify({
      domain, subDomain
    })
  }).then(r => r.json()).catch(e => {
    console.log('error for creating mapping', e)
  })

  // DEV env:
  /*
  const newMapping = {
    fullDomain: getFullDomain(subDomain, domain),
    gitLink: 'demo.com',
    id: Date.now()
  }
  */

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

  const tmpFilePath = `${__dirname}/keys_${uuidv4()}`
  fs.writeFile(tmpFilePath, key, () => {
    exec(`ssh-keygen -lf ${tmpFilePath}`, (err, result) => {
      exec(`rm ${tmpFilePath}`, async () => {
        if (err) {
          return res.status(400).send({
            message: 'SSH KEY is invalid. Run "cat ~/.ssh/id_rsa.pub" and submit the output of the command'
          })
        }

        // Replace UserId
        if (users[userId]) {
          // Delete oldSshKey?
          //   Decided not to, a user could have multiple
          //   sshKeys on one browser
        }

        // Create new key
        await fetch(`${myProxyApi}/sshKeys`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: myProxyKey
          },
          body: JSON.stringify({
            key
          })
        }).then(r => r.json()).catch(e => {
          console.log('error for creating mapping', e)
        })

        userId = uuidv4()
        users[userId] = key
        data.users = users
        await saveData()
        return res.json({ userId, key })
      })
    })
  })
})

app.listen(process.env.PORT || 8123)
