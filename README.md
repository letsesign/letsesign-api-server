# Let's eSign API Server

![api-server](https://user-images.githubusercontent.com/2587360/175509599-e44e1292-c9d9-47e0-8f0d-2e2e84a7673d.png)

## Introduction

Let's eSign API Server is an open-source *confidential eSignature API* server for you to deploy at your site. It provides normal eSignature APIs for your in-house apps to call and hides the complexities of confidential computing inside. When deployed at your site, Let's eSign API Server will encrypt your documents before sending them to the isolated [Let's eSign Enclave](https://github.com/letsesign/letsesign-enclave), which can decrypt and process your documents in a confidential manner.

Let's eSign API Server supports various features including
- SMS Authentication
- Bulk Send
- Document Template
- Single & Multiple Signers
- Specific Signing Order
- Email Notification

## How to deploy

**To deploy Let's eSign API Server, you need to [register your root domain with Let's eSign](https://github.com/letsesign/letsesign-docs/blob/main/HOWTO-register.md) first in order to get the required `env.list` file which encapsulates the API key.**

Depending on your choice there are two ways to deploy Let's eSign API Server:

### A. Deploy the pre-built docker image

1. Copy the `env.list` file that you obtained during the registration process to the current directory.

2. Next, run the following:

    ```
    docker run -d -p 80:80 --env-file ./env.list letsesign/letsesign-api-server
    ```

3. Now you can make API calls to Let's eSign API Server at `http://localhost`.

### B. Build and then deploy

1. First, build the docker image:

    ```
    git clone https://github.com/letsesign/letsesign-api-server.git
    cd letsesign-api-server
    docker build -t letsesign-api-server .
    ```

2. Copy the `env.list` file that you obtained during the registration process to the current directory.

3. Next, run the following:

    ```
    docker run -d -p 80:80 --env-file letsesign-api-server
    ```

4. Now you can make API calls to Let's eSign API Server at `http://localhost`.

## How to make API calls

Please check [Let's eSign API Server Examples](https://github.com/letsesign/letsesign-api-server-examples) for the details.
