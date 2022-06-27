/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const { Caller } = require('./lib/caller');
const { Verifier } = require('./lib/verifier');

let kmsPubKey = '';
try {
  kmsPubKey = fs.readFileSync(path.join(__dirname, '/kmsPublicKey.pem')).toString('utf-8');
  if (kmsPubKey === '') {
    throw new Error('Error: Invalid PEM');
  }
} catch (err) {
  console.log(err);
  process.exit(1);
}

const { apiKey, bearerSecret } = process.env;

const app = express();
app.use(cors());
app.use(express.json({ limit: '40mb' }));

app.get('/', (req, res) => {
  res.send("Let's eSign Server is running");
});

app.post('/submit-task/', async (req, res) => {
  if (!apiKey) {
    console.log('Invalid API Key');
    res.status(200).send({ error: 'Invalid API Key' });
    return;
  }
  const rootDomain = apiKey.substring(apiKey.indexOf('@') + 1);
  const { taskConfig, templateInfo, templateData } = req.body;
  if (!taskConfig.options.notificantEmail.includes(rootDomain)) {
    console.log('Invalid Email Address');
    res.status(200).send({ error: 'Invalid Email Address' });
    return;
  }
  try {
    const caller = new Caller();
    const byteBuffer = Buffer.from(templateData, 'base64');
    const result = await caller.submitTask(apiKey, bearerSecret, kmsPubKey, taskConfig, templateInfo, byteBuffer);
    if (result.retCode === 0) {
      res.status(200).send(result);
    } else {
      console.log(result);
      res.status(200).send({ error: `SDK Error: ${result.retCode}` });
    }
  } catch (err) {
    console.log(err);
    res.status(200).send({ error: 'Backend Error' });
  }
});

app.post('/submit-bulk-task/', async (req, res) => {
  if (!apiKey) {
    console.log('Invalid API Key');
    res.status(200).send({ error: 'Invalid API Key' });
    return;
  }
  const rootDomain = apiKey.substring(apiKey.indexOf('@') + 1);
  const { taskConfig, templateInfo, templateData } = req.body;
  if (!taskConfig.options.notificantEmail.includes(rootDomain)) {
    console.log('Invalid Email Address');
    res.status(200).send({ error: 'Invalid Email Address' });
    return;
  }
  try {
    const caller = new Caller();
    const byteBuffer = Buffer.from(templateData, 'base64');
    const result = await caller.submitBulkTask(apiKey, bearerSecret, kmsPubKey, taskConfig, templateInfo, byteBuffer);
    if (result.retCode === 0) {
      res.status(200).send(result);
    } else {
      console.log(result);
      res.status(200).send({ error: `SDK Error: ${result.retCode}` });
    }
  } catch (err) {
    console.log(err);
    res.status(200).send({ error: 'Backend Error' });
  }
});

app.post('/verify-pdf/', async (req, res) => {
  try {
    const { bindingDataHash, pdfBufferB64, spfDataB64 } = req.body;
    const verifier = new Verifier();
    let result = {};
    if (bindingDataHash) {
      result = await verifier.autoVerify(bindingDataHash, pdfBufferB64, spfDataB64);
    } else {
      result = await verifier.semiVerify(pdfBufferB64, spfDataB64);
    }
    res.send(result);
  } catch (err) {
    console.log(err);
    res.status(200).send({ error: 'Backend Error' });
  }
});

app.get('*', (req, res) => {
  res.redirect('/');
});

app.listen(80);
