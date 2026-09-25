import { app, port } from './app.js'

app.listen(port, () => {
  console.log(`Wallet server listening on http://127.0.0.1:${port}`)
})
