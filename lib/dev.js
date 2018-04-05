module.exports = async function dev (sourceDir) {
  const fs = require('fs')
  const path = require('path')
  const chalk = require('chalk')
  const chokidar = require('chokidar')
  const webpack = require('webpack')
  const serve = require('webpack-serve')
  const HTMLPlugin = require('html-webpack-plugin')
  const convert = require('koa-connect')
  const history = require('connect-history-api-fallback')
  const serveStatic = require('koa-static')
  const createClientConfig = require('./webpack/clientConfig')
  const HeadPlugin = require('./webpack/HeadPlugin')
  const prepare = require('./prepare')

  const options = await prepare(sourceDir)

  // setup watchers to update options and dynamically generated files
  const pagesWatcher = chokidar.watch([
    path.join(sourceDir, '**/*.md'),
    path.join(sourceDir, '.vuepress/components/**/*.vue')
  ], {
    ignored: '.vuepress/**/*.md',
    ignoreInitial: true
  })
  pagesWatcher.on('add', () => prepare(sourceDir))
  pagesWatcher.on('unlink', () => prepare(sourceDir))

  // resolve webpack config
  const _config = createClientConfig(options)

  _config
    .plugin('html')
    .use(HTMLPlugin, [
      { template: path.resolve(__dirname, 'app/index.dev.html') }
    ])

  _config
    .plugin('site-data')
    .use(HeadPlugin, [options.siteConfig.head || []])

  const config = _config.toConfig()
  const compiler = webpack(config)
  const port = options.siteConfig.port || 8080

  let isFirst = true
  compiler.hooks.done.tap('vuepress', () => {
    if (isFirst) {
      isFirst = false
      console.log(
        `\n  VuePress dev server listening at ${
          chalk.cyan(`http://localhost:${port}`)
        }\n`
      )
    } else {
      const time = new Date().toTimeString().match(/^[\d:]+/)[0]
      console.log(`  ${chalk.gray(`[${time}]`)} ${chalk.green('✔')} successfully compiled.`)
    }
  })

  await serve({
    compiler,
    dev: { logLevel: 'error' },
    hot: { logLevel: 'error' },
    logLevel: 'error',
    port,
    add: app => {
      const userPublic = path.resolve(sourceDir, '.vuepress/public')
      if (fs.existsSync(userPublic)) {
        app.use(serveStatic(userPublic))
      }

      app.use(convert(history({
        rewrites: [
          { from: /\.html$/, to: '/' }
        ]
      })))
    }
  })
}