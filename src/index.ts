import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';

const { submitTask, submitBulkTask, submitTaskWithTemplate, submitBulkTaskWithTemplate } = require('./lib/caller');
const { semiVerify, autoVerify } = require('./lib/verifier');
const { createSendTemplate, createBulkSendTemplate } = require('./lib/template-creator');

let kmsPubKey = '';
try {
  kmsPubKey = fs.readFileSync(path.resolve(__dirname, '..', 'kmsPublicKey.pem')).toString('utf-8');
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

app.get('/', (req: any, res: any) => {
  res.send("Let's eSign Server is running");
});

// send API route
app.post('/send/', async (req: any, res: any) => {
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
    const result = await submitTask(apiKey, bearerSecret, kmsPubKey, taskConfig, fieldList, pdfFileName, pdfFileData);
    if (result.httpCode === 200) res.status(200).send(result.response);
    else res.status(result.httpCode).send({ errorMsg: result.errorMsg });
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// send_with_template API route
app.post('/send_with_template/', async (req: any, res: any) => {
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

  const { taskConfig, template } = req.body;
  try {
    const result = await submitTaskWithTemplate(apiKey, bearerSecret, kmsPubKey, taskConfig, template);
    if (result.httpCode === 200) res.status(200).send(result.response);
    else res.status(result.httpCode).send({ errorMsg: result.errorMsg });
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// bulk_send API route
app.post('/bulk_send/', async (req: any, res: any) => {
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
    const result = await submitBulkTask(
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

// bulk_send_with_template API route
app.post('/bulk_send_with_template/', async (req: any, res: any) => {
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

  const { taskConfig, template } = req.body;
  try {
    const result = await submitBulkTaskWithTemplate(apiKey, bearerSecret, kmsPubKey, taskConfig, template);
    if (result.httpCode === 200) res.status(200).send(result.response);
    else res.status(result.httpCode).send({ errorMsg: result.errorMsg });
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// create_send_template API route
app.post('/create_send_template/', async (req: any, res: any) => {
  const { fieldList, pdfFileName, pdfFileData } = req.body;
  try {
    const result = await createSendTemplate(fieldList, pdfFileName, pdfFileData);
    if (result.httpCode === 200) res.status(200).send(result.response);
    else res.status(result.httpCode).send({ errorMsg: result.errorMsg });
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// create_bulk_send_template API route
app.post('/create_bulk_send_template/', async (req: any, res: any) => {
  const { fieldList, pdfFileName, pdfFileData } = req.body;
  try {
    const result = await createBulkSendTemplate(fieldList, pdfFileName, pdfFileData);
    if (result.httpCode === 200) res.status(200).send(result.response);
    else res.status(result.httpCode).send({ errorMsg: result.errorMsg });
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// preview_send API route
app.post('/preview_send/', async (req: any, res: any) => {
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
    const result = await submitTask(
      apiKey,
      bearerSecret,
      kmsPubKey,
      taskConfig,
      fieldList,
      pdfFileName,
      pdfFileData,
      true
    );
    if (result.httpCode === 200) res.status(200).send(result.response);
    else res.status(result.httpCode).send({ errorMsg: result.errorMsg });
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// preview_send_with_template API route
app.post('/preview_send_with_template/', async (req: any, res: any) => {
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

  const { taskConfig, template } = req.body;
  try {
    const result = await submitTaskWithTemplate(apiKey, bearerSecret, kmsPubKey, taskConfig, template, true);
    if (result.httpCode === 200) res.status(200).send(result.response);
    else res.status(result.httpCode).send({ errorMsg: result.errorMsg });
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// preview_bulk_send API route
app.post('/preview_bulk_send/', async (req: any, res: any) => {
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

  const { taskConfig, fieldList, pdfFileName, pdfFileData, signerNo } = req.body;
  try {
    let result = null;

    if (signerNo) {
      result = await submitBulkTask(
        apiKey,
        bearerSecret,
        kmsPubKey,
        taskConfig,
        fieldList,
        pdfFileName,
        pdfFileData,
        true,
        signerNo
      );
    } else {
      result = await submitBulkTask(
        apiKey,
        bearerSecret,
        kmsPubKey,
        taskConfig,
        fieldList,
        pdfFileName,
        pdfFileData,
        true
      );
    }

    if (result.httpCode === 200) res.status(200).send(result.response);
    else res.status(result.httpCode).send({ errorMsg: result.errorMsg });
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// preview_bulk_send_with_template API route
app.post('/preview_bulk_send_with_template/', async (req: any, res: any) => {
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

  const { taskConfig, template, signerNo } = req.body;
  try {
    let result = null;

    if (signerNo) {
      result = await submitBulkTaskWithTemplate(apiKey, bearerSecret, kmsPubKey, taskConfig, template, true, signerNo);
    } else {
      result = await submitBulkTaskWithTemplate(apiKey, bearerSecret, kmsPubKey, taskConfig, template, true);
    }

    if (result.httpCode === 200) res.status(200).send(result.response);
    else res.status(result.httpCode).send({ errorMsg: result.errorMsg });
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// verify_pdf API route
app.post('/verify_pdf/', async (req: any, res: any) => {
  try {
    const { bindingDataHash, pdfBufferB64, spfBufferB64 } = req.body;
    const result = await autoVerify(bindingDataHash, pdfBufferB64, spfBufferB64);

    if ('error' in result) res.status(400).send({ errorMsg: result.error });
    else res.status(200).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

// verify_pdf_with_human API route
app.post('/verify_pdf_with_human/', async (req: any, res: any) => {
  try {
    const { pdfBufferB64, spfBufferB64 } = req.body;
    const result = await semiVerify(pdfBufferB64, spfBufferB64);

    if ('error' in result) res.status(400).send({ errorMsg: result.error });
    else res.status(200).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ errorMsg: 'Backend Error' });
  }
});

app.get('*', (req: any, res: any) => {
  res.redirect('/');
});

app.listen(80);
