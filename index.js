/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { auth } = require('express-openid-connect');

const { Caller } = require('./lib/caller');
const { Verifier } = require('./lib/verifier');

let kmsPubKey = '';
let auth0Config = null;
try {
  kmsPubKey = fs.readFileSync(path.join(__dirname, '/kmsPublicKey.pem')).toString('utf-8');
  auth0Config = JSON.parse(fs.readFileSync(path.join(__dirname, '/auth0-config.json')).toString('utf-8'));
  if (kmsPubKey === '' || auth0Config === null) {
    throw new Error('Invalid PEM or JSON');
  }
} catch (err) {
  console.log(err);
  process.exit(1);
}

const config = {
  authRequired: auth0Config.authRequired,
  auth0Logout: auth0Config.auth0Logout,
  secret: auth0Config.secret,
  baseURL: auth0Config.baseURL,
  clientID: auth0Config.clientID,
  issuerBaseURL: auth0Config.issuerBaseURL
};

const { webApp, apiKey, bearerSecret } = process.env;

const app = express();
app.use(cors());
app.use(auth(config));
app.use(express.json({ limit: '40mb' }));
app.use(express.static('build'));

app.get('/', (req, res) => {
  if (!req.oidc.isAuthenticated() && config.authRequired === true) {
    res.redirect('login');
  } else {
    if (webApp === 'on') {
      res.sendFile(path.join(__dirname, '/index.html'));
      return;
    }
    res.send("Let's eSign Server is running");
  }
});

app.post('/submit-task/', async (req, res) => {
  if (!req.oidc.isAuthenticated() && config.authRequired === true) {
    res.status(200).send({ error: 'Not Login' });
  }
  if (!apiKey) {
    console.log('Invalid API Key');
    res.status(200).send({ error: 'Invalid API Key' });
    return;
  }
  const rootDomain = apiKey.substring(apiKey.indexOf('@') + 1);
  if (!req.body.payload.taskConfig.options.notificantEmail.includes(rootDomain)) {
    console.log('Invalid Email Address');
    res.status(200).send({ error: 'Invalid Email Address' });
    return;
  }
  try {
    const { payload } = req.body;
    const caller = new Caller();
    const byteBuffer = Buffer.from(payload.templateData, 'base64');
    if (payload.taskConfig.options.isBulk === true) {
      const list = payload.taskConfig.signerInfoList;
      let csvText = 'Name,Email,Phone Number\n';
      for (let i = 0; i < list.length; i += 1) {
        csvText += `${list[i].name},${list[i].emailAddr},${list[i].phoneNumber}`;
        csvText += i !== list.length - 1 ? '\n' : '';
      }
      const bulkTaskConfig = {
        senderMsg: payload.taskConfig.options.senderMsg,
        notificantEmail: payload.taskConfig.options.notificantEmail,
        notificantLocale: payload.taskConfig.options.notificantLocale
      };
      // Dry Run
      result = await caller.submitBulkTask(
        apiKey,
        bearerSecret,
        kmsPubKey,
        bulkTaskConfig,
        payload.templateInfo,
        byteBuffer,
        csvText,
        true
      );
      if (result.retCode === 0) {
        res.status(200).send(result);
      } else {
        console.log(result);
        res.status(200).send({ error: `SDK Error: ${result.retCode}` });
        return;
      }
      // Live Run
      result = await caller.submitBulkTask(
        apiKey,
        bearerSecret,
        kmsPubKey,
        bulkTaskConfig,
        payload.templateInfo,
        byteBuffer,
        csvText,
        false
      );
      if (result.retCode !== 0) {
        console.log(result);
      }
    } else {
      result = await caller.submitTask(
        apiKey,
        bearerSecret,
        kmsPubKey,
        payload.taskConfig,
        payload.templateInfo,
        byteBuffer
      );
      if (result.retCode === 0) {
        res.status(200).send(result);
      } else {
        console.log(result);
        res.status(200).send({ error: `SDK Error: ${result.retCode}` });
      }
    }
  } catch (err) {
    console.log(err);
    res.status(200).send({ error: 'Backend Error' });
  }
});

app.post('/verify-pdf/', async (req, res) => {
  if (!req.oidc.isAuthenticated() && config.authRequired === true) {
    res.status(200).send({ error: 'Not login' });
  }
  try {
    const { pdfBufferB64, spfDataB64 } = req.body;
    const verifier = new Verifier();
    const result = await verifier.semiVerify(pdfBufferB64, spfDataB64);
    res.send(result);
  } catch (err) {
    console.log(err);
    res.status(200).send({ error: 'Backend Error' });
  }
});

app.get('*', (req, res) => {
  res.redirect('/');
});

const getConfig = async () => {
  const siteConfigPath = '/root/build/config.js';
  try {
    const siteConfigStr = fs
      .readFileSync(siteConfigPath)
      .toString('utf-8')
      .replace('window.siteConfig=', '')
      .replaceAll('!0', 'true')
      .replaceAll('!1', 'false')
      .replaceAll(';', '')
      .replaceAll(':', '":')
      .replaceAll(',', ',"')
      .replaceAll('{', '{"')
      .replaceAll('""', '"');
    const siteConfig = JSON.parse(siteConfigStr);
    const caller = new Caller();
    const serverConfig = await caller.getConfig(apiKey);
    siteConfig.enablePhoneNo = serverConfig.enablePhoneNo;
    siteConfig.maxSignerNumber = serverConfig.maxSignerNumber;
    siteConfig.maxBulkSendSignerNumber = serverConfig.maxBulkSendSignerNumber;
    siteConfig.maxFieldPerType = serverConfig.maxFieldPerType;
    siteConfig.maxFileSizeInMb = serverConfig.maxFileSizeInMb;
    const content = `window.siteConfig=${JSON.stringify(siteConfig)}`;
    fs.writeFileSync(siteConfigPath, content);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

getConfig();
app.listen(80);
