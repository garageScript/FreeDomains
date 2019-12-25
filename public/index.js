/* global fetch localStorage $ */

const hostSelector = document.querySelector('#hostSelector')
const dropDownDomains = document.querySelector('.dropdown-menu')
const sshKeySaveButton = document.querySelector('#saveSshKey')
const sshKeyInput = document.querySelector('#sshKeyInput')

let selectedHost = ''

class DomainOption {
  constructor (domain) {
    const dropdownElement = document.createElement('button')
    dropdownElement.classList.add('dropdown-item')
    dropdownElement.textContent = domain
    dropdownElement.onclick = () => {
      hostSelector.innerText = domain
      selectedHost = domain
    }

    dropDownDomains.appendChild(dropdownElement)
  }
}

const getDomainNames = () => {
  return fetch('/api/domains').then(r => r.json())
}

getDomainNames().then(list => {
  list.forEach(({ domain }) => {
    return new DomainOption(domain)
  })
  selectedHost = list[0].domain
  hostSelector.innerText = list[0].domain
})

let userId = localStorage.getItem('freedomains')
if (!userId) {
  $('#exampleModal').modal('show')
} else {
  fetch(`/api/users/${userId}`).then(r => r.json()).then(data => {
    if (!data.key) {
      return $('#exampleModal').modal('show')
    }
    sshKeyInput.value = data.key
  })
}

sshKeySaveButton.addEventListener('click', () => {
  fetch('/api/sshKeys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      key: sshKeyInput.value
    })
  }).then(r => r.json()).then((jResponse) => {
    userId = jResponse.userId
    localStorage.setItem('freedomains', userId)
  })
})
