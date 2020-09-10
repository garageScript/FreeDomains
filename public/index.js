/* global fetch localStorage $, confirm, alert */

const hostSelector = document.querySelector('#hostSelector')
const dropDownDomains = document.querySelector('.dropdown-menu')
const createButton = document.querySelector('.create')
const domainList = document.querySelector('.domainList')
const sshKeySaveButton = document.querySelector('#saveSshKey')
const sshKeyInput = document.querySelector('#sshKeyInput')
const subDomain = document.querySelector('.subDomain')
const invalidElement = document.querySelector('.invalid-feedback')

let selectedHost = ''

class DomainOption {
  constructor (domain) {
    const dropdownElement = document.createElement('button')
    dropdownElement.classList.add('dropdown-item')
    dropdownElement.textContent = domain
    dropdownElement.onclick = () => {
      hostSelector.innerText = domain
      selectedHost = domain
      checkAvailability()
    }

    dropDownDomains.appendChild(dropdownElement)
  }
}

class MappingItem {
  constructor (data, idx) {
    const mappingElement = document.createElement('li')
    let iconClass
    let iconColor
    // The variables below are to hide log related icons when pm2 is not
    // being used to monitor the apps. These apps will not have status since
    // they are not managed by pm2.
    let settingClass
    let logClass
    if (data.status === 'running') {
      iconClass = 'fa fa-circle mr-1 mt-1'
      iconColor = 'rgba(50,255,50,0.5)'
      logClass = 'fa fa-file-text-o ml-1 mt-1'
      settingClass = 'ml-1 fa fa-cog'
    } else if (data.status === 'not started') {
      iconClass = ''
      iconColor = 'transparent'
    } else {
      iconClass = 'fa fa-circle mr-1 mt-1'
      iconColor = 'rgba(255, 50, 50, 0.5)'
      logClass = 'fa fa-file-text-o ml-1 mt-1'
      settingClass = 'ml-1 fa fa-cog'
    }
    mappingElement.classList.add(
      'list-group-item',
      'd-flex',
      'align-items-center'
    )
    domainList.appendChild(mappingElement)

    const createdDate = new Date(data.createdAt || Date.now())
    let step2Content = ''
    if (idx) {
      step2Content = `
          <small class="form-text text-muted" style="display: inline-block;">
            ${data.gitLink}
          </small>
      `
    } else {
      step2Content = `
          <span class="step2">Step 2 --&gt; </span>
          <span class="inlineCode">git clone
            <small class="form-text text-muted" style="display: inline-block;">
              ${data.gitLink}
            </small>
          </span>
      `
    }
    mappingElement.innerHTML = `
      <div style="width: 100%">
        <div style="display: flex">
          <i class="${iconClass}" style="font-size: 15px; color: ${iconColor}">
          </i>
          <a class="font-weight-bold" href="https://${data.fullDomain}">
            ${data.fullDomain}
          </a>
          <small class="form-text text-muted ml-1">
            ${createdDate.toDateString()}
          </small>
          <a
            class="${logClass}"
            style="font-size: 15px; color: rgba(255,50,50,0.5)"
            href="/api/logs/stderr/${data.fullDomain}"
          >
          </a>
          <a
            class="${logClass}"
            style="font-size: 15px; color: rgba(40,167,70,0.5)"
            href="/api/logs/stdout/${data.fullDomain}"
          >
          </a>
        </div>
        ${step2Content}
      </div>
      <button
        class="btn btn-sm btn-outline-danger mr-3 deleteButton"
        type="button"
      >
        Delete
      </button>
    `

    const delButton = mappingElement.querySelector('.deleteButton')
    delButton.onclick = () => {
      if (confirm('Are you sure want to delete this domain?')) {
        apiFetch(`/api/mappings/${data.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        }).then(res => {
          window.location.reload()
        })
      }
    }
  }
}

const getDomainNames = () => {
  return fetch('/api/domains').then(r => r.json())
}

const apiFetch = (url, options = {}) => {
  options.headers = options.headers || {}
  options.headers.authorization = userId
  return fetch(url, options).then(res => {
    if (res.status >= 400) {
      return res.json().then(response => {
        alert(response.message)
        localStorage.removeItem('freedomains')
        window.location.reload()
      })
    }
    return res.json()
  })
}

const getMappings = () => {
  return apiFetch('/api/mappings')
}

const startApp = () => {
  getDomainNames().then(list => {
    list.forEach(({ domain }) => {
      return new DomainOption(domain)
    })
    selectedHost = list[0].domain
    hostSelector.innerText = list[0].domain
  })
  getMappings().then(list => {
    list.forEach((dd, idx) => {
      return new MappingItem(dd, idx)
    })
  })

  createButton.addEventListener('click', () => {
    checkAvailability().then((d) => {
      if (!d.isAvailable) {
        return
      }
      apiFetch('/api/mappings', {
        method: 'POST',
        body: JSON.stringify({
          domain: selectedHost,
          subDomain: subDomain.value
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }).then(res => {
        window.location.reload()
      })
      subDomain.value = ''
    })
  })
}

const checkAvailability = () => {
  const sDomain = subDomain.value
  return fetch(`/isAvailable?domain=${selectedHost}&subDomain=${sDomain}`).then(r => r.json()).then(d => {
    if (d.isAvailable) {
      invalidElement.innerText = ' '
      subDomain.classList.remove('is-invalid')
    } else {
      const prefix = sDomain ? sDomain + '.' : ''
      invalidElement.innerText = `${prefix}${selectedHost} is not available. Please pick another!`
      subDomain.classList.add('is-invalid')
    }
    return d
  })
}
subDomain.addEventListener('keyup', checkAvailability)
subDomain.addEventListener('blur', checkAvailability)

let userId = localStorage.getItem('freedomains')
if (!userId) {
  $('#exampleModal').modal('show')
} else {
  fetch(`/api/users/${userId}`).then(r => r.json()).then(data => {
    if (!data.key) {
      return $('#exampleModal').modal('show')
    }
    sshKeyInput.value = data.key
    startApp()
  })
}

// SSH KEY Logic
let saving = false
sshKeySaveButton.addEventListener('click', () => {
  if (saving) {
    return
  }
  saving = true
  apiFetch(`/api/sshKeys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      key: sshKeyInput.value
    })
  }).then(jResponse => {
    userId = jResponse.userId
    localStorage.setItem('freedomains', userId)
    saving = false
    $('#exampleModal').modal('hide')
    window.location.reload()
  }).catch(() => {
    saving = false
    $('#exampleModal').modal('hide')
  })
})
