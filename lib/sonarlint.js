/* --------------------------------------------------------------------------------------------
 * SonarLint for Atom
 * Copyright (C) 2017 SonarSource SA
 * sonarlint@sonarsource.com
 * Licensed under the LGPLv3 License. See LICENSE.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

const cp = require('child_process')
const net = require('net')
const path = require('path')
const {AutoLanguageClient, LinterPushV2Adapter} = require('atom-languageclient')

const files = require('./files');
const javaUtils = require('./java-utils');

const ruleDetailsBaseUrl = 'http://www.sonarlint.org/atom/rules/index.html#version=1.0.0'

class SonarLintLanguageServer extends AutoLanguageClient {
  getGrammarScopes () { return ['source.js', 'source.python', 'text.html.php'] }
  getLanguageName () { return 'JavaScript, Python, PHP' }
  getServerName () { return 'SonarLint' }

  startServerProcess () {
    const basedir = path.resolve(__dirname, "..")
    const command = javaUtils.java
    const args = ['-jar', files.languageServerJar(basedir)]
    let process

    return new Promise((resolve, reject) => {
      const server = net.createServer(socket => {
        server.close()
        this.socket = socket
        resolve(process)
      })
      server.listen(0, '127.0.0.1', () => {
        args.push(server.address().port)
        files.analyzerJars(basedir).map(p => args.push(toUrl(p)));
        process = this.spawnServer(command, args)
      })
    })
  }

  spawnServer (command, args) {
    return cp.spawn(command, args)
  }

  getInitializeParams (projectPath, process) {
    return {
      processId: process.pid,
      capabilities: {},
      rootPath: projectPath,
      initializationOptions: {
        // TODO
        telemetryStorage: "/tmp/sonarlint-telemetry-atom",
        disableTelemetry: true
      }
    }
  }

  newLinterPushV2Adapter(connection) {
    return new CustomLinterPushV2Adapter(connection)
  }
}

class CustomLinterPushV2Adapter extends LinterPushV2Adapter {
  constructor(connection) {
    super(connection)
  }

  diagnosticToV2Message(path, diagnostic) {
    var message = super.diagnosticToV2Message(path, diagnostic)
    this.setRuleDetailsUrl(message, diagnostic)
    this.setSolutions(message)
    return message
  }

  setRuleDetailsUrl(message, diagnostic) {
    var languageAndRuleId = diagnostic.code.split(':')
    if (languageAndRuleId.length == 2) {
      var language = languageAndRuleId[0]
      var ruleId = languageAndRuleId[1]
      message.url = `${ruleDetailsBaseUrl}&ruleId=${ruleId}&language=${language}`
    }
  }

  setSolutions(message) {
    // TODO add dependency: intentions
    // usage: move cursor on underliend area, press alt + enter to show intentions,
    //        option "Open rule details" should pop up, press enter again to do it
    message.solutions = [
      {
        title: "Open rule details",
        position: message.location.position,
        // TODO
        apply: (() => { alert("todo"); })
      }
    ]
  }
}

function toUrl(filePath) {
    var pathName = path.resolve(filePath).replace(/\\/g, '/')

    // Windows drive letter must be prefixed with a slash
    if (pathName[0] !== '/') {
        pathName = '/' + pathName
    }

    return encodeURI('file://' + pathName)
}

module.exports = new SonarLintLanguageServer()