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
  console.error(err);
  process.exit(1);
}

const { apiKey, bearerSecret } = process.env;

const app = express();
app.use(cors());
app.use(express.json({ limit: '40mb' }));

app.get('/', (req, res) => {
  res.send("Let's eSign Server is running");
});

// send API route
app.post('/send/', async (req, res) => {
  if (!apiKey) {
    console.error('Invalid API Key setting');
    res.status(409).send({ errorMsg: 'Invalid API Key setting' });
    return;
  }
  if (!bearerSecret) {
    console.error('Invalid bearerSecret setting');
    res.status(409).send({ errorMsg: 'Invalid bearerSecret setting' });
    return;
  }
  if (!kmsPubKey) {
    console.error('Invalid KMS public key setting');
    res.status(409).send({ errorMsg: 'Invalid KMS public key setting' });
    return;
  }

  const { taskConfig, fieldList, pdfFileName, pdfFileData } = req.body;
  try {
    const caller = new Caller();
    const result = await caller.submitTask(
      apiKey,
      bearerSecret,
      kmsPubKey,
      taskConfig,
      fieldList,
      pdfFileName,
      pdfFileData
    );
    if (result.httpCode === 200) res.status(200).send(result.response);
    else res.status(result.httpCode).send({ errorMsg: result.errorMsg });
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// bulk_send API route
app.post('/bulk_send/', async (req, res) => {
  if (!apiKey) {
    console.error('Invalid API Key setting');
    res.status(401).send({ errorMsg: 'Invalid API Key setting' });
    return;
  }
  if (!bearerSecret) {
    console.error('Invalid bearerSecret setting');
    res.status(401).send({ errorMsg: 'Invalid bearerSecret setting' });
    return;
  }
  if (!kmsPubKey) {
    console.error('Invalid KMS public key setting');
    res.status(401).send({ errorMsg: 'Invalid KMS public key setting' });
    return;
  }

  const { taskConfig, fieldList, pdfFileName, pdfFileData } = req.body;
  try {
    const caller = new Caller();
    const result = await caller.submitBulkTask(
      apiKey,
      bearerSecret,
      kmsPubKey,
      taskConfig,
      fieldList,
      pdfFileName,
      pdfFileData
    );
    if (result.httpCode === 200) res.status(200).send(result.response);
    else res.status(result.httpCode).send({ errorMsg: result.errorMsg });
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// verify_pdf API route
app.post('/verify_pdf/', async (req, res) => {
  try {
    const { bindingDataHash, pdfBufferB64, spfBufferB64 } = req.body;
    const verifier = new Verifier();
    const result = await verifier.autoVerify(bindingDataHash, pdfBufferB64, spfBufferB64);

    if ('error' in result) res.status(400).send({ errorMsg: result.error });
    else res.status(200).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// verify_pdf_with_human API route
app.post('/verify_pdf_with_human/', async (req, res) => {
  try {
    const { pdfBufferB64, spfBufferB64 } = req.body;
    const verifier = new Verifier();
    const result = await verifier.semiVerify(pdfBufferB64, spfBufferB64);

    if ('error' in result) res.status(400).send({ errorMsg: result.error });
    else res.status(200).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

app.get('*', (req, res) => {
  res.redirect('/');
});

app.listen(80);
