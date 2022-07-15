#!/bin/bash

curl -s https://raw.githubusercontent.com/letsesign/letsesign-enclave/main/tcb-info.json -o dist/tcb-info.json

node ./dist/scripts/kms-update.js
node ./dist/scripts/kms-download.js

pm2-runtime ./dist/index.js
