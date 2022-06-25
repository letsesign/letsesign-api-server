#!/bin/bash

curl -sO https://raw.githubusercontent.com/letsesign/letsesign-enclave/main/tcb-info.json

node ./scripts/kms-update.js
node ./scripts/kms-download.js

unset awsAccessKeyID
unset awsSecretAccessKey

pm2-runtime index.js
