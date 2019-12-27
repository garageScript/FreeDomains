const appLink = document.querySelector('.appLink')

const renderNext = (str, orig, cb, i = 0) => {
  if (i >= str.length && i >= orig.length) {
    return cb()
  }

  const oldChars = orig.split('')
  const newChar = i >= str.length ? ' ' : str[i]
  oldChars[i] = newChar

  const newDisplay = oldChars.join('')
  appLink.innerText = newDisplay

  setTimeout(() => {
    return renderNext(str, newDisplay, cb, i + 1)
  }, 100)
}

const doAll = (arr, i = 0) => {
  if (i >= arr.length) {
    i = 0
  }
  renderNext(arr[i].name, appLink.innerText, () => {
    appLink.href = arr[i].url
    setTimeout(() => {
      return doAll(arr, i + 1)
    }, 2000)
  })
}

const data = [{
  name: "Herman's Portfolio",
  url: 'https://herman.hireme.fun'
}, {
  name: 'Corny Jokes',
  url: 'https://cornyjokes.learnjs.tips'
}]

doAll(data)
